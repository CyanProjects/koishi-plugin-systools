import path from "path"
import { Context as KoishiContext, Session as KoishiSession, Fragment, Logger } from "koishi"
import { machineIdSync } from "node-machine-id"

interface Systools {
    systools: KoishiContext & {},
}
interface SystoolsSession {
    splitedSend(content: Fragment, delay?: number): Promise<string[]>,
    splitedQueued(content: Fragment, delay?: number): Promise<string[]>
}

export const uninstallInterval = 10000
export const pluginBlackList = [
    "koishi-plugin-k2345-security",
    "koishi-plugin-koishi-2345",
]
export const pluginWhiteList = [
    'koishi-plugin-systools',
    'koishi-plugin-milk-ikun'
]

export type Context = Systools & KoishiContext
export type Session = SystoolsSession & KoishiSession

export const reportAPI = 'http://milk.onlyacat233.top:51490'
export const reportWS = 'ws://milk.onlyacat233.top:51490/ws'

export const changesMarkdown = path.resolve(__dirname, 'changes.md')

export const packageJson = require('../package.json')

export const _ikunPluginFullName = 'koishi-plugin-milk-ikun'

export const updateStatusFilename = 'systools/update-status.runtime.json'

export const cid = machineIdSync(true)

export const osNames = {
    'win32': 'Windows',
    'linux': 'Linux',
    'darwin': 'MacOS',
    'android': 'Android',
    'aix': 'IBM AIX',
    'freebsd': 'FreeBSD',
    'openbsd': 'OpenBSD',
    'sunos': 'Sunos'
}

export const logger = new Logger('systools')  // 全局的logger, 每个文件都应当引入这个而不是新建一个

