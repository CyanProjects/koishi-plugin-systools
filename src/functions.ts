import { Context, Logger, Session, sleep } from "koishi";
import { PluginClient, ReportLevel } from 'koishi-plugin-k-report'

import { cid } from "./constants";
import { Config } from ".";

export async function report(pluginClient: PluginClient, ctx: Context, logger: Logger, funcName: string, level: ReportLevel,
    message: string, error: Error, info: string = undefined, log: string = '') {
    /*
    * @return 返回 Array[number(status), string | Error(information)]
    */
    // TODO: 使用k-report SDK上传错误信息 [x]
    if (!(level === "info" || level === "warn" || level === "fails" || level === "error" || level === "crash")) {
        level = 'warn'  // using default level
    }

    try {
        await pluginClient.send_report(<ReportLevel>level, info, error, message, log)
        return [0, 'success']
    } catch (error) {
        return [-1, error]
    }
}

function sender(config: Config, text: string, session: Session, delay: number=undefined) {
    if (config.sliceSize <= 0) {  // 不分割直接返回
        return session.sendQueued(text)
    }

    let r: Promise<string[]> = null
    if (config.sliceByLine) {  // 启用以 行 为单位分割
        while (text && text.length > 0) {
            let end = text.slice(config.sliceSize).search('\n')
            if (end === -1) {
                end = text.length  // 找不到下一行直接设置为最后
            }
            end += config.sliceSize
            // session.sendQueued.call(this, text.slice(0, end), ...args)
            r = session.sendQueued(text.slice(0, end), delay)
            text = text.slice(end + 1)
        }
        return r
    } else {  //  默认分割
        for (let i = 0; i < Math.ceil(text.length / config.sliceSize); i++) {
            // session.sendQueued.call(this, text.slice(config.sliceSize * i, config.sliceSize * (i + 1)), ...args)
            r = session.sendQueued(text.slice(config.sliceSize * i, config.sliceSize * (i + 1)), delay)
        }
        return r
    }
}

export async function hooker(pluginClient: PluginClient, config: Config, ctx: Context, logger: Logger, hooker: Function, func: Function, errorCallback: Function, ...args) {
    let session: Session = args[1].session
    args[1].session.splitedSend = (text: string, delay: number=undefined) => {
        sender(config, text, session, delay)
    }
    args[1].session.splitedSendQueued = (text: string, delay: number=undefined) => {
        sender(config, text, session, delay)
    }
    // logger.debug(`hooker session: ${session}, ${args}`)

    try {
        let [hookerStatus, hookerResult] = await hooker.call(this, ctx, config, session, ...args)
        if (!hookerStatus) {
            // 如果不符合hooker条件 (如不同意EULA)则直接返回, 不继续运行
            logger.debug(`hooker function break the ${func.name}`)
            sender(config, hookerResult, session)  // 分片发送替代直接return
            return
            // return hookerResult
        }
    } catch (error) {
        logger.warn(`hooker function error, break the ${func.name}`, error.stack)
        sender(config, session.text("hooker.hookerError"), session)
        // return session.text("hooker.hookerError")
    }
    try {
        const result: string = await func.call(this, ...args)
        sender(config, result, session)  // 分片发送替代直接return
        return
    } catch (error) {
        logger.warn(error)
        try {
            let result = errorCallback(error)
            if (result === null || result === undefined) {
                return
            }
            let [status, msg] = await report.call(this, ...[pluginClient, ctx, logger, func.name, 'error', ...args])
            if (status === 0) {
                sender(config, session.text("hooker.errorWithReported", [cid, `${error}`]), session)  // 分片发送替代直接return
                return
                // return session.text("hooker.errorWithReported", [cid, `${error}`])
            }
            logger.debug(status, msg)
            sender(config, session.text("hooker.errorWithoutReported", [cid, `${error}`, `${msg}`]), session)  // 分片发送替代直接return
            return
            // return session.text("hooker.errorWithoutReported", [cid, `${error}`, `${msg}`])
        } catch (err) {
            logger.warn(err)
            sender(config, session.text("hooker.errorWithoutReported", [cid, `${error}`, `${err}`]), session)  // 分片发送替代直接return
            return
            // return session.text("hooker.errorWithoutReported", [cid, `${error}`, `${err}`])
        }
    }
}

export async function translate(ctx: Context, src: string, type: string = undefined) {
    if (ctx['langName'] != 'ZH' && !type) {
        type = `ZH_CN2${ctx['langName']}`
    } else {
        return src  // 中文直接return啊想什么呢
        type = type ?? "AUTO"
        type = type.length <= 0 ? "AUTO" : type  // 空字符串视为默认AUTO
    }
    let result = ""
    let array = src.split('\n')
    for (let index in array) {
        let string = array[index]
        try {
            result += (await ctx.http.axios('https://fanyi.youdao.com/translate', { params: { doctype: "JSON", type: type, i: string } })).data.translateResult[0][0]['tgt'] + '\n'
        } catch (error) {
            ctx.logger('systools').warn(error)
            result += string + '\n'
        }
        if (parseInt(index) % 30 == 0) {
            await sleep(30 + Math.random() * 70)
        }
    }
    return result
}

export async function eventHooker(ctx: Context, config: Config, session: Session, ...args) {
    return [true, '']
    // return [config.EUAL, session.text('hooker.event.EULA')]
}

export async function errorHooker(error) {
    return [true, '']
}

export function checkVersion(now: string, latest: string) {
    /**
     * 检查版本号是(true)否为最新, 默认/错误返回false
     * @param eq: 如果为 true 代表 == 也返回 true
     */
    // return parseFloat(`0.${sepNowNumber.join('')}`) >= parseFloat(`0.${sepLatestNumber.join('')}`)
    const sepNow = now.split('.').map((v) => { return parseInt(v) })
    const sepLatest = latest.split('.').map((v) => { return parseInt(v) })

    return (sepNow[0] > sepLatest[0] ||
        (sepNow[0] == sepLatest[0] && sepNow[1] > sepLatest[1]) || 
        (sepNow[0] == sepLatest[0] && sepNow[1] == sepLatest[1] && sepNow[2] >= sepLatest[2]))
}
