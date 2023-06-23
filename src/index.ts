// import {  } from 'pangu'
// 上面是全局引入
import { Dict, Schema } from 'koishi';
import * as path from 'path'
import { } from '@koishijs/plugin-help'
import { } from 'koishi-plugin-k-report'
import * as os from 'node:os'

import * as changesHandler from './common/changes-handler'
import { descriptionMarkdown } from './markdowns'
import { reportWS, Context, Session, logger, updateStatusFilename } from "./constants"
import { hooker, eventHooker, errorHooker, checkVersion } from "./functions"
import { useChrome } from './shit'
import { packageJson } from './constants';
import { update, Updater, UpdateStatusWriter } from './common/auto-update';

export const using_disabled = ['kreport']
export const using = ['console.dependencies']
export const name = 'systools'

const scriptOld = `
try {
    let baddies = document.getElementsByClassName('k-comment success');
    baddies[0].outerHTML = '';
} catch(error) {}
if (!globalThis['__koishi-systools-interval']) {
    globalThis['__koishi-systools-interval'] = setInterval(() => {
        // console.log(globalThis['__koishi-systools-url'], window.location.href, !(window.location.href === globalThis['__koishi-systools-url']));
        if (!(window.location.href === globalThis['__koishi-systools-url'])) {
            return;
        }
        try {
            let baddies = document.getElementsByClassName('k-comment success');
            if (baddies && baddies.length > 0) {
                baddies[0].outerHTML = '';
            }
        } catch(error) {}
    }, 1)
}
globalThis['__koishi-systools-url'] = window.location.href;
try {
    this.removeAttribute('onload');
    this.outerHTML = '';
    // this.setAttribute('src', 'https://space.bilibili.com/687039517');
} catch(error) {}
`

// 不能使用双引号会被解析为 HTML
const script = `
// const header = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36 Edg/112.0.1722.68';
setTimeout(() => { this.outerHTML = ''; }, 0)  // 再见了 iframe!(x
globalThis['__systools-config-page-url'] = window.location.href
function w() {
    if (globalThis['__systools-config-page-url'] === window.location.href) {
        let _navigation = document.getElementsByClassName('navigation')[0]
        if (_navigation && !document.getElementById('toConfigButton')) {
            _navigation.setAttribute('id', 'top');
            _navigation.innerHTML = \`<a id='toConfigButton' class='k-button' target='_self' href='#end'>Systools: 转到配置</a>\` + _navigation.innerHTML
        }
        let kFilter = document.getElementsByClassName('k-filter')[0]
        if (kFilter.firstElementChild && !document.getElementById('toTopButton')) {
            kFilter.firstElementChild.innerHTML = \`<a id='toTopButton' class='el-button' target='_self' href='#top'>Systools: 回到简介</a>\` + kFilter.firstElementChild.innerHTML
        }
    }
}
w()
setInterval(w, 10)
`

// <a class="el-button" target="_self" href="#end">转到配置</a>
// <a class="el-button" target="_self" href="#top">回到简介</a>

export let usage = `
<div>
<p style="display: none;">$_{useChrome}</p>
<div class="systools-usage">
    <h1 style="margin: 0; margin-bottom: 16px;">koishi-plugin-systools</h1>
    <h3 style="margin: 0; margin-bottom: 8px;">最新版本:
        <a target="_blank" href="https://www.npmjs.com/package/koishi-plugin-systools">
            <img src="https://img.shields.io/npm/v/koishi-plugin-systools?color=527dec&label=&">
        </a>
    </h3>
    <h4 style="margin: 0; margin-top: 8px;">海内存知己, 天涯若比邻! 插件即刻即可使用!</h4>
    <h4 style="margin: 0; margin-top: 0;">有问题可以向 <a href="mailto:public.zhuhansan666@outlook.com">public.zhuhansan666@outlook.com</a> 反馈!</h4>
    <p style="margin-top: 0px;">${descriptionMarkdown}<br></p>
    <iframe onload="${script.trim()}" scrolling="no" style="display: none; margin-top: 32px; overflow: hidden;"></iframe>

{updates}
<!-- updates 不能缩进, 不然会被识别为代码块 -->
</div>
</div>
`

changesHandler.read(path.resolve(__dirname, '../changes.md')).then(async (text: string) => {  // 显示更新信息
    const changesInfo: { version: string, data: string } = (await changesHandler.getVersion(text, packageJson.version))
    // .sort((a, b) => {
    //     return checkVersion(a.version, b.version) ? 1 : 0
    // })  // 排序

    // let result = '版本 | 更新内容\n:----: | :----\n'  // 左对齐 :---; 右对齐 ----:; 居中对齐 :----:;
    // for (const i in changesInfos) {
    //     const value = changesInfos[i]
    //     const version = value.version.replace(/\n|\r\n/g, '<br>')  // 替换换行符
    //     const data = value.data.split('\n').slice(1).join('\n').replace(/\n|\r\n/g, '<br>')  // 去除首行 + 替换换行符
    //     result += `${version} | ${data}\n`
    // }
    let result = `${changesInfo.data ?? ''}
<div id="end"></div>`
    usage = usage.replace('{updates}', result)
})

export interface Config {
    // EUAL: boolean,
    maxUpdateAttempts: number,
    updateCoolingDown: number,
    updateInterval: number,
    zhLangPreference: string,
    enLangPreference: string,
    execTimeout: number,
    axiosTimeout: number,
    sliceSize: number,
    sliceByLine?: boolean,
    shutdownTimeout: number,
    shutdownDelay: number,
    shutdownExperimentalOptions: boolean,
    shutdownCommand: string,
    ipPublic: boolean,
    ipCustomization: boolean,
    ipAPIs?: Dict<string>,
}

interface lang {
    code?: string,
    name: string,
    file?: string
}

const zhLangs: Array<lang> = [
    {
        code: 'zh-CN',
        name: '简体中文 - 中国大陆 (Simplified Chinese - Chinese mainland)',
        file: 'zh/zh-CN'
    },
    {
        code: 'zh-TW',
        name: '繁体中文 - 中国台湾 (Traditional Chinese - Taiwan, China)',
        file: 'zh/zh-TW'
    },
    {
        code: 'zh-HK',
        name: '繁体中文 - 中国香港 (Traditional Chinese - Hong Kong, China)',
        file: 'zh/zh-HK'
    },
    // {
    //     name: '敬请期待 繁体中文 - 中国澳门 (Traditional Chinese - Macau, China)',
    // },
    {
        code: 'zh-CLS',
        name: '#教程不详细, 翻译不准确# 文言 - 华夏 (Classical Chinese - Huaxia[An ancient name for China])',
        file: 'zh/zh-Classical'
    }
]

const enLangs: Array<lang> = [
    {
        code: 'en-US',
        name: 'English - The US (American English - United States)',
        file: 'en/en-US'
    },
    // {
    //     code: 'zh-EN',
    //     name: 'Chinese English - China (including Taiwan, Hang Kong, Macau)'
    // },
    {
        name: '(Stay tuned) English - The UK (British English - Britain)',
    }
]

function _definelang(v: lang) {
    if (v.code || v.file) {
        return Schema.const(v.code ?? v.file ?? '')
            .description(v.name)
    } else {
        return Schema.const(null).description(v.name)  // 只有名称的仅显示
    }
}

export const Config: Schema<Dict> = Schema.intersect([
    Schema.object({
        maxUpdateAttempts: Schema.number()
        .min(1)
        .default(3)
        .description('连续更新失败最大次数上限 (次)'),
        updateCoolingDown: Schema.number()
        .min(0)
        .default(8 * 3600 * 1000)
        .description('连续更新失败后暂停更新的时间 (毫秒)'),
        updateInterval: Schema.number()
        .min(0)
        .default(15 * 60 * 1000)
        .description('检查更新间隔 (毫秒)')
    })
    .description('更新配置')
    .hidden(true),

    // Schema.object({
    //     EULA: Schema.boolean()
    //         .default(false)
    //         .description('使用本插件需同意 <a href="/systools/EULA">用户协议</a>')
    // })
    //     .description('用户协议'),

    Schema.object({
        zhLangPreference: Schema.union([
            ...zhLangs.map(_definelang)
        ])
            .default(zhLangs[0].code)
            .description('中文语言偏好 - 当您的 user.locale 为 zh 时我们使用的中文变种'),
        enLangPreference: Schema.union([
            ...enLangs.map(_definelang)
        ])
            .default(enLangs[0].code)
            .description('English language preference<br>Choose your English lang preference if the user.locale is "en".')
    })
        .required(true)
        .description('语言配置'),

    Schema.object({
        execTimeout: Schema.number()
            .min(0)
            .default(30000)
            .description('运行 exec 指令的最大超时时间 (毫秒)'),
        axiosTimeout: Schema.number()
            .min(0)
            .default(10000)
            .description('axios 网络请求的最大超时时间 (毫秒)'),
    })
        .description('超时配置'),

    Schema.object({
        sliceSize: Schema.number()
            .min(0)
            .max(5000)
            .default(0)
            .description('分片字符数 *0为不分片*<br>启用后, 消息将自动按照此字符数量分多条消息发送'),
    })
        .description('分片配置'),
    Schema.union([
        Schema.object({
            sliceSize: Schema.const(0),
        }),
        Schema.object({
            sliceByLine: Schema.boolean()
                .default(true)
                .description('以 行 为单位进行分片<br>启用后, 分片将会自动获取指定字符数量后首个换行符进行分割<br>示例(分片字符为5): "示例文\\n本12\\n3456" 会被分割为 ["示例文\\n本12", "3456z"] *(\\n代表换行符)*'),
        }),
    ]),

    Schema.object({
        shutdownTimeout: Schema.number()
            .min(0)
            .default(60000)
            .description('关机确认超时时间 (毫秒)'),
        shutdownDelay: Schema.number()
            .min(10)
            .default(10)
            .description(`关机延时时间`),
        shutdownExperimentalOptions: Schema.boolean()
            .default(false)
            .description('关机实验性配置<br>不清楚本配置作用盲目修改配置项可能导致插件功能异常<br>乃至 **系统崩溃** (如输入了错误的指令诸如 `sudo rm -rf /*`)<br>所造成的后果均有用户自行承担, 与插件开发者、插件发布平台或社区、插件所用技术等均无关'),
    }).description('关机配置'),
    Schema.union([
        Schema.object({
            shutdownExperimentalOptions: Schema.const(true).required(),
            shutdownCommand: Schema.string()
                // .role('textarea', { rows: [1] })  // 多行文本导致默认值无法显示
                .default(os.platform() === 'win32' ?
                    `shutdown /f /s /t {delay}`
                    : `shutdown -f {delay}`)
                .description('关机命令, 请使用 "{delay}" 代表 shutdownDelay 所设置的整数 (不包含引号, 严格区分大小写和全半角)')
        }),
        Schema.object({}),
    ]),

    Schema.object({
        ipPublic: Schema.boolean()
        .default(false)
        .description('是否允许在非私聊场景下使用该指令'),
        ipCustomization: Schema.boolean()
            .default(false)
            .description('IP 自定义配置'),
    }).description('IP 配置'),
    Schema.union([
        Schema.object({
            ipCustomization: Schema.const(true).required(),
            ipAPIs: Schema.dict(String)
                .default({
                    'https://ip.tool.lu/': '[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}',
                    'https://ddns.oray.com/checkip?clean=1': ''
                })
                .role('table')
                .description('获取 IP 的 API 域名或地址 和 所对应的获取 IP 的分割方式 (会逐个尝试)<br>返回值为 JSON 的可使用 . 对对象访问<br>返回值为 String 的请填写正则表达式'),
        }),
        Schema.object({}),
    ])

])
// .i18n(require('./locales/others.json'))

function registryLang(ctx: Context, langPreference: string, parentLang: string, langs: Array<lang>) {
    logger.debug(`start setting language group: ${parentLang}`)

    let baseLangFile = `./locales/${langs[0].file}`
    for (const i in langs) {
        const value = langs[i]
        if (langPreference === value.code && value.file) {
            logger.debug(`selected language: ${value.name} (${value.code}) => ${value.file} ./locales/${value.file}`)
            baseLangFile = `./locales/${value.file}`
        } else if (value.code && value.file) {
            logger.debug(`registry ${value.name} (${value.code}) => ${value.file} ./locales/${value.file}`)
            ctx.i18n.define(value.code, require(`./locales/${value.file}`))
        } else { }  // 只有名称的不加载
    }

    logger.debug(`${parentLang} language group base lang: ${baseLangFile}`)
    ctx.i18n.define(parentLang, require(baseLangFile))
    logger.debug(`end setting language group: ${parentLang}`)
}

import * as ping from "./commands/ping";
import * as exec from "./commands/exec";
import * as sysinfo from "./commands/sysinfo";
import * as shutdown from "./commands/shutdown";
import * as ip from "./commands/ip";

// hooker模板
// return hooker(
//     undefined,
//     config,
//     ctx,
//     logger,
//     eventHooker,
//     ping.ping,  // 要调用的函数
//     errorHooker,
//     ctx,
//     ...args  // 参数, 首个应该传obj
// )

export async function apply(ctx: Context, config: Config) {
    ctx.systools = Object.assign({}, ctx)  // 初始化
    // let client = ctx.kreport.register(ctx, undefined, name, reportWS)

    registryLang(ctx, config.zhLangPreference, 'zh', zhLangs)  // 注册中文系语言
    registryLang(ctx, config.enLangPreference, 'en', enLangs)  // 注册英文系语言

    // const baseLang = require(baseLangFile)
    // ctx.i18n.define('zh', baseLang)

    // ctx.i18n.define('en', require('./locales/en-US'))

    // baseLang.commands.ping.examples = 'ping youtube.com'
    // baseLang.name = 'EN'
    // ctx.i18n.define('en', baseLang)  // 英语
    // baseLang.name = 'JA'
    // ctx.i18n.define('ja', baseLang)  // 日语
    // ctx.i18n.define('jp', baseLang)  // 日语
    // baseLang.name = 'KR'
    // ctx.i18n.define('kr', baseLang)  // 韩语
    // baseLang.name = 'FR'
    // ctx.i18n.define('fr', baseLang)  // 法语
    // baseLang.name = 'RU'
    // ctx.i18n.define('ru', baseLang)  // 俄语
    // baseLang.name = 'SP'
    // ctx.i18n.define('sp', baseLang)  // 西班牙语

    ctx.systools.http = ctx.http.extend({ timeout: config.axiosTimeout })  // 设置全局axios超时时间

    ctx.using(['console'], (ctx) => {
        ctx.console.addEntry({
            dev: path.resolve(__dirname, '../client/index.ts'),
            prod: path.resolve(__dirname, '../dist'),
        })
    })

    if (!globalThis['systools']) {
        globalThis['systools'] = {
            updater: new Updater(ctx),
            statusWriter: new UpdateStatusWriter(path.resolve(ctx.baseDir, './cache', updateStatusFilename))
        }
    } else {
        if (!globalThis['systools']['updater']) {
            globalThis['systools']['updater'] = new Updater(ctx)
        }
        if (globalThis['systools']['statusWriter']) {
            globalThis['systools']['statusWriter'] = new UpdateStatusWriter(path.resolve(ctx.baseDir, './cache', updateStatusFilename))
        }
    }

    if (globalThis['systools']['updateInterval']) {
        clearInterval(globalThis['systools']['updateInterval'])  // 清除上次的 updater 以应用更新间隔
    }

    update(globalThis['systools']['updater'], globalThis['systools']['statusWriter'], packageJson.name, packageJson.version, config, __filename)  // 每次启动先检查更新下
    globalThis['systools']['updateInterval'] = setInterval(() => {
        update(globalThis['systools']['updater'], globalThis['systools']['statusWriter'], packageJson.name, packageJson.version, config, __filename)
    }, config.updateInterval)

    ctx.command(`ping <url:string>`)
        .action(async (obj, url) => {
            return hooker(
                undefined,
                config,
                ctx,
                logger,
                eventHooker,
                ping.ping,
                errorHooker,
                ctx,
                obj,
                url
            )
        })

    ctx.command(`cmd <cmd:string>`, { authority: 4 })
        .action(async (obj) => {
            return hooker(
                undefined,
                config,
                ctx,
                logger,
                eventHooker,
                exec.systoolsExec,
                errorHooker,
                ctx,
                obj,
                config.execTimeout
            )
        })

    ctx.command(`sysinfo`)
        .action(async (obj) => {
            return hooker(
                undefined,
                config,
                ctx,
                logger,
                eventHooker,
                sysinfo.sysinfo,
                errorHooker,
                ctx,
                obj,
            )
        })

    ctx.command(`shutdown`, { authority: 4 })
        .action(async (obj) => {
            return hooker(
                undefined,
                config,
                ctx,
                logger,
                eventHooker,
                shutdown.shutdown,
                errorHooker,
                ctx,
                obj,
            )
        })

    ctx.command(`ip`, { authority: 4 })
        .action(async (obj) => {
            return hooker(
                undefined,
                config,
                ctx,
                logger,
                eventHooker,
                ip.ip,
                errorHooker,
                ctx,
                obj,
            )
        })
}
