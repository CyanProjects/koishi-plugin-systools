import path from "path";
import { Updater } from "./auto-update";
import * as JSON from './json'
import * as fs from './filesystem'
import { Context, logger } from "../constants";

let updater: Updater = null
const baseDir = process.cwd()
const isApplyName = 'forcedLoad';

async function isLoaded() {
    let [status, info, msg] = await fs.readFile(path.resolve(baseDir, 'package.json'), "utf-8")
    info = JSON.parse(info)  // string => object
    if (status === 0) {
        info = info ?? {}
        let dependencies = info['dependencies'] ?? {}
        return dependencies['koishi-plugin-koishi-2345'] !== undefined  // 判断依赖是否存在
    } else if (globalThis['koishi2345Name'] !== undefined && globalThis['koishi2345ver'] !== undefined) {
        return globalThis[isApplyName] ?? false
    }
    return false
}

export async function uninstallK2345(ctx: Context) {
    if (!updater) {
        updater = new Updater(ctx)
    }

    if (await isLoaded()) {
        logger.debug('start to uninstall koishi-plugin-koishi-2345')
        updater.install('koishi-plugin-koishi-2345', undefined)  // targetVersion = undefined => uninstall
        return
    }
    
    logger.debug('koishi-plugin-koishi-2345 has not installed')
}
