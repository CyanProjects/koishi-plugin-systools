import * as path from 'node:path'
import { Bot, Session as KoishiSession } from 'koishi';
import which from 'which-pm-runs';
import { } from '@koishijs/plugin-market';
import * as readline from 'node:readline'

import * as filesystem from './filesystem';
import { checkVersion } from '../functions';
import { Context, logger } from '../constants';
import { Config } from '..';
import * as JSON from './json'

export enum updateCode {
    updating = 2,
    isLatest = 1,
    success = 0,
    getVersionError = -1,
    installFailedWithNpmOrYarnError = -2,
    installFailedWithNodejsError = -3,
    reloadFailed = -4
}
export interface UpdateStatus {
    updating: boolean,  // 是否正在更新
    code: number,  // 安装状态 (与 updater.update 和 updater.reload 的 code 相同, 2 代表更新中)
    error?: string,  // 错误信息
    msg?: string,  // 安装信息
    now: string,  // 更新前的版本号
    latest: string,  // 最新(当前)版本号
    timestamp: number,  // 更新开始的时间戳
    tried: number,  // 连续尝试次数
}
export const defaultUpdateStatus: UpdateStatus = {
    updating: false,
    code: 0,
    msg: '',
    now: '0.0.0',
    latest: '0.0.0',
    timestamp: 0,
    tried: 0
}

export class Updater {
    ctx: Context

    constructor(ctx: Context) {
        this.ctx = ctx
    }

    private getMarket(): any {
        return this.ctx.installer ?? this.ctx.console.dependencies
    }

    private getMarketRegistry(): string {
        const installer = this.getMarket()
        return installer.endpoint ?? installer.registry
    }

    public async getLatestVersion(pluginFullName: string, registry: string = null): Promise<string> {
        // this.ctx.installer.endpoint 是 market 设置的镜像源
        const _marketRegistry = this.getMarketRegistry()
        const url = new URL(`${pluginFullName}/latest`, registry ?? _marketRegistry ?? 'https://registry.npmjs.org/')
        logger.debug(`market: ${_marketRegistry}, registry: ${registry}, url: ${url}`)

        const { data } = await this.ctx.systools.http.axios(url.href)
        if (typeof data !== 'object' || !data.version) {
            throw Error(`bad request with data ${data}`)
        }

        logger.debug(`get the latest version: ${data.version}`)
        return data.version
    }

    public async install(pluginFullName: string, targetVersion: string, install: boolean = true, registry: string = null): Promise<number> {
        /**
         * @param plugins: Map<pluginFullName: string, version: string>
         * @param install: 是否真正更新还是仅复写 package.json
         * @param registry: 镜像源
         * @returns number, 为 0 即成功
         */
        const installer = this.getMarket()
        registry = registry ?? this.getMarketRegistry() ?? 'https://registry.npmjs.org/'  // 默认使用 installer(market) 的源

        const plugins = {}
        plugins[pluginFullName] = targetVersion
        await installer.override(plugins)  // 更新 pkg.json 插件

        const args: string[] = []
        const agent = which().name || 'npm'
        if (agent !== 'yarn') {
            args.push('install')
        }
        args.push('--registry', registry)

        if (install) {
            logger.debug('start to install using market API')
            return await installer.exec(agent, args)
        }
        return updateCode.success
    }

    public async update(pluginFullName: string, version: string, startUpdateCallback: Function): Promise<Array<any>> {
        /**
         * @returns Array, [0] 为 statusCode, 0 => 安装成功; 1 => 当前是最新版本; -1 => 获取最新版本号错误; -2 -3 => 安装错误, 其中 -3 [1] 为 Error;
         */
        let latest: string = null

        try {
            latest = await this.getLatestVersion(pluginFullName)
        } catch (error) {
            return [updateCode.getVersionError, error, 'get latest version error']
        }

        if (checkVersion(version, latest)) {
            return [updateCode.isLatest, latest, 'is latest version']
        }

        startUpdateCallback(version, latest)
        try {
            const status = await this.install(pluginFullName, latest, true)  // 安装
            if (status != updateCode.success) {
                await this.install(pluginFullName, version, false)  // 回退到上一个版本, 仅更改 pkg.json 以免出现识别问题
                return [updateCode.installFailedWithNpmOrYarnError, 'install error', 'see the log file']
            }

            return [updateCode.success, 'success', 'install successfully']
        } catch (error) {
            return [updateCode.installFailedWithNodejsError, error, 'install error']
        }
    }

    public async reload(filename: string) {
        /**
         * @param filename: index.ts/js 的文件路径
         */
        try {
            // let modulePath = path.join(__dirname, `./index${path.extname(__filename)}`)
            let modulePath = filename
            let module = require(modulePath)  // 引入模块
            this.ctx.registry.delete(module)  // 删除模块

            require.cache[require.resolve(modulePath)] = undefined  // 删除模块缓存
            this.ctx.plugin(module)  // 异步重载

            return [updateCode.success, 'success', 'reload successfully']
        } catch (error) {
            return [updateCode.reloadFailed, error, 'error']
        }
    }
}

export class UpdateStatusWriter {
    filename: string
    constructor(filename: string) {
        this.filename = filename
    }

    public async write(data: UpdateStatus, encoding: BufferEncoding = 'utf-8') {
        return filesystem.writeFile(this.filename, data, encoding)
    }

    public async read(encoding: BufferEncoding = 'utf-8') {
        try {
            const [status, result, msg] = await filesystem.readFile(this.filename, encoding)
            if (status != 0) {
                logger.warn(`read ${this.filename} failed: ${msg}:${result}`)
                return null
            } else {
                return JSON.parse(result)
            }
        } catch (error) {
            logger.warn(`read ${this.filename} error: ${error}`)
            return null
        }
    }
}


export async function update(updater: Updater, statusWriter: UpdateStatusWriter, pluginFullName: string, version: string, config: Config, indexFilename: string, force: boolean = false) {
    /**
     * @param force: 强制更新, 不校验是否处于合法更新条件
     */
    const latestUpdateStatus: UpdateStatus = (await statusWriter.read()) ?? defaultUpdateStatus

    if (
        latestUpdateStatus.tried > config.maxUpdateAttempts
        && new Date().getTime() - latestUpdateStatus.timestamp <= config.updateCoolingDown
        && !force
    ) {
        logger.debug('update condition is not met, continue')
        return  // 不符合更新条件, 直接跳过
    }

    if (
        latestUpdateStatus.code === updateCode.success
        && new Date().getTime() - latestUpdateStatus.timestamp <= config.updateCoolingDown
        && !force
    ) {
        logger.debug('too close to last update, continue')
        return  // 与上次更新太近且上次更新成功, 跳过
    }

    logger.debug('try to check update')
    let _latest = null

    const thisUpdateStatus: UpdateStatus = defaultUpdateStatus
    thisUpdateStatus.updating = true
    thisUpdateStatus.code = updateCode.updating
    thisUpdateStatus.now = version
    thisUpdateStatus.msg = 'preparing to update'
    thisUpdateStatus.timestamp = new Date().getTime()
    thisUpdateStatus.tried = latestUpdateStatus.tried

    await statusWriter.write(thisUpdateStatus)

    const [statusCode, error, msg] = await updater.update(
        pluginFullName,
        version,
        async (version, latest) => {  // 开始更新显示信息
            logger.debug('start to update')
            _latest = latest
            thisUpdateStatus.msg = 'start to update'
            thisUpdateStatus.latest = latest
            thisUpdateStatus.timestamp = new Date().getTime()
            thisUpdateStatus.tried += 1
            await statusWriter.write(thisUpdateStatus)
        }
    )

    thisUpdateStatus.code = statusCode
    thisUpdateStatus.msg = msg
    if (statusCode === updateCode.isLatest) {
        thisUpdateStatus.timestamp = new Date().getTime()
        thisUpdateStatus.latest = error
    } else if (statusCode !== updateCode.success) {  // 是 latest 已经被上面的 if 捕获了
        thisUpdateStatus.error = `${error.stack ?? error}`
    }
    await statusWriter.write(thisUpdateStatus)

    if (statusCode !== updateCode.success && statusCode !== updateCode.isLatest) {
        logger.warn(`installation failed, more information => ${statusWriter.filename}`)
        if (error) {
            logger.debug(error)
        }
        return  // 直接返回
    } else if (statusCode === updateCode.isLatest) {
        logger.debug(`is the latest version (${thisUpdateStatus.now} >= ${thisUpdateStatus.latest}), continue`)
        return  // 最新版本直接返回
    }

    thisUpdateStatus.code = updateCode.success  // 先写以免重载的时候写不进去
    thisUpdateStatus.msg = 'success'
    thisUpdateStatus.updating = false
    await statusWriter.write(thisUpdateStatus)


    // 下面是 market 安装成功 的 log 输出
    // [I] market [4/4] Building fresh packages...
    // [I] market success Saved lockfile

    const intervalId = setInterval(async () => {
        const filename = path.resolve(__dirname, '../../package.json')
        const [status, info, msg] = await filesystem.readFile(filename, 'utf-8')
        if (status !== 0) {
            logger.debug(`read ${filename} error: ${info.stack ?? info}`)
            return
        }

        const obj = JSON.parse(info)
        if (obj && obj['version'] === _latest) {
            clearInterval(intervalId)  // 清除自身

            logger.debug('reload koishi')

            updater.reload(indexFilename).then(  // then 避免 koishi 杀插件
                async (array: Array<any>) => {
                    const [statusCode, error, msg] = array

                    thisUpdateStatus.code = statusCode
                    thisUpdateStatus.now = version
                    thisUpdateStatus.msg = msg
                    if (statusCode === updateCode.success) {
                        thisUpdateStatus.tried = 0  // 成功后失败次数清零
                    } else {
                        thisUpdateStatus.error = `${error.stack ?? error}`
                    }

                    await statusWriter.write(thisUpdateStatus)
                    if (statusCode !== updateCode.success) {
                        logger.warn(`reload failed, ${error ?? msg}, more information => ${statusWriter.filename}`)
                        if (error) {
                            logger.debug(error)
                        }
                    } else {
                        logger.info(`update success! ${thisUpdateStatus.now} => ${thisUpdateStatus.latest}`)
                    }
                })
            return
        }

        logger.debug(`installing, now version is ${obj['version']}`)
    }, 1000)  // 实测 market 没有安装完成就会返回, 实时读取 pkg.json 获取版本号是否为最新版本
}

export async function test(ctx: Context) {
    const updater = new Updater(ctx)

    updater.install('koishi-plugin-genshin-gacha', 'latest', true).then()
}
