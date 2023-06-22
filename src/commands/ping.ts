import { Context, Session, logger} from "../constants";
import { translate } from "../functions";
import * as JSON from "../common/json";  // 替换默认的JSON

export async function ping(ctx: Context, { session: _session }, url: string) {
    const session: Session = _session
    const langName = session.text('name')

    if (url === undefined) {
        return session.text('tips.empty', ['url'])
    }

    session.splitedSend(session.text('commands.ping.pinging', [url]))

    if (langName === 'ZH') {
        let { data } = await ctx.systools.http.axios(`https://v.api.aa1.cn/api/api-ping/ping.php?url=${url}`, { validateStatus: (status) => { return true } })
        if (data.host !== undefined) {
            return session.text('commands.ping.success', [data.host, data.ip, data.ping_time_min, data.ping_time_max, data.location, data.node])
        }
        session.splitedSend(session.text('commands.ping.CNAPIFailed'))
        ctx.logger('systools').debug('Call the Chinese mainland API ping failed!')
    }

    ctx.logger('systools').debug('Use the i18nal API!')
    let data = await ctx.systools.http.post(`https://geekflare.com/api/geekflare-api/ping`, { url: url }, { validateStatus: (status) => { return true } })  // 非中国大陆网站ping方式
    if (!data.data.ip || data.data.ip.length <= 0) {
        if (data.apiCode === 200) {
            return session.text('commands.ping.failed', ['unknown ip'])
        } else {
            let result = ''
            for (let index in data.data) {
                result += JSON.stringify(data.data[index]) + ',\n'
            }
            return session.text('commands.ping.failed', [result.length > 0 ? result : 'unknown'])
        }
    }

    return session.text('commands.ping.success', [data.meta.url, data.data.ip, `${data.data.min}ms`, `${data.data.max}ms`, langName === 'ZH' ? '中国大陆境外' : '-', 'geekflare.com'])
}
