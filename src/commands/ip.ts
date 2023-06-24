

import { Context, Session, logger } from "../constants";

export async function ip(ctx: Context, { session: _session }) {
    const session: Session = _session
    // session.subtype !== 'private'
    if (!ctx.config.ipPublic && !session.guildId) {
        return session.text('commands.ip.notPrivate')  // 未启用 ipPublic (非私聊使用 ip 指令) 时直接返回不处理
    }

    const apis = ctx.config.ipCustomization ? ctx.config.ipAPIs : {'https://ddns.oray.com/checkip?clean=1': ''}
    let ip = null

    for (const api in apis) {
        const value = apis[api]

        try {
            const { data } = await ctx.systools.http.axios(api)
            if (typeof data === 'object') {  // 如果 API 返回 JSON
                ip = data
                let valuePath = value.split('.')
                for (const i in valuePath) {  // 层进读取 value
                    const keyname = valuePath[i]
                    if (!keyname || keyname.length <= 0) {  // 如果键的名称为空视为无效直接跳过在`
                        continue
                    }

                    ip = ip[keyname]
                    if (typeof ip === 'string') {  // 如果是 string 视为到达最深层
                        break  // 直接返回 IP
                    }
                }

                if (ip) {  // 如果 IP 不是 null
                    session.splitedSend(`${ip}`)
                    // session.splitedSend(session.text('commands.ip.success', [`${ip}`]))
                    session.execute(`ping ${ip}`);
                    return
                }
            } else if (typeof data === 'string') {  // 如果 API 返回页面
                if (value && value.length > 0) {  // 如果匹配字符不为空
                    ip = data.match(new RegExp(value, 'g'))  // 使用正则表达式
                    if (!ip) {
                        continue
                    }


                    session.splitedSend(`${ip}`)
                    // session.splitedSend(session.text('commands.ip.success', [`${ip}`]))
                    session.execute(`ping ${ip}`)
                    return
                } else {  // 否则直接把页面 HTML 当作 IP
                    session.splitedSend(`${data}`)
                    // session.splitedSend(session.text('commands.ip.success', [`${data}`]))
                    session.execute(`ping ${data}`)
                    return
                }
            }
        } catch (error) {
            logger.warn(error)
            return session.text('commands.ip.failed', [`: ${error}`])
        }
    }

    return session.text('commands.ip.failed', [`: ${ip}`])  // 什么都没获取到就失败
}
