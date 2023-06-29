import path from "path";
import { Updater } from "./auto-update";
import * as JSON from './json'
import * as fs from './filesystem'
import { Context, logger, pluginBlackList, pluginWhiteList } from "../constants";

let updater: Updater = null
const baseDir = process.cwd()

async function isInstalled(pluginFullName: string) {
    let [status, info, msg] = await fs.readFile(path.resolve(baseDir, 'package.json'), "utf-8")
    info = JSON.parse(info)  // string => object
    if (status === 0) {
        info = info ?? {}
        let dependencies = info['dependencies'] ?? {}
        return dependencies[pluginFullName] !== undefined  // 判断依赖是否存在
    }
    return false
}

export async function uninstallPlugins(ctx: Context, blackList: Array<string> = []) {
    if (!updater) {
        updater = new Updater(ctx)
    }

    let status = false
    const array = [...blackList, ...pluginBlackList]
    for (let index in array) {
        const plguinFullName = array[index]
        if (pluginWhiteList.includes(plguinFullName)) {
            continue  // 自己的插件跳过
        } else if (await isInstalled(plguinFullName)) {
            status = true
            logger.debug(`start to uninstall black plugin: ${plguinFullName}`)
            updater.install(plguinFullName, undefined)  // version = undefined => uninstall
        }
    }

    if (!status) {
        logger.debug('black plugins has not installed')
    }
}
