import { Dict } from 'koishi'
import * as os from 'node:os'

import { Context, Session, logger } from '../constants'

interface _Sessions {
    status: boolean,
    session: Session,
    date: number,
    timeoutId: NodeJS.Timeout
}
type Sessions = _Sessions | undefined

const sessions: Dict<Sessions> = {}

export async function shutdown(ctx: Context, { session: _session }) {
    const session: Session = _session

    const userId = session.userId
    if (!userId) {
        return session.text('commands.shutdown.undefinedUserId')
    }

    const event = sessions[userId]
    if (!event || !event.status) {
        sessions[userId] = {
            status: true,
            session: session,
            date: new Date().getTime(),
            timeoutId: setTimeout(() => {  // 超时自动清除
                sessions[userId] = undefined
                session.splitedSend(session.text('commands.shutdown.delete'))
            }, ctx.config.shutdownTimeout)
        }

        const ETA = ctx.config.shutdownTimeout / 1000
        return session.text('commands.shutdown.first', [ETA % 1 == 0 ? ETA : ETA.toFixed(3)])
    }
    clearTimeout(event.timeoutId)  // 关闭清除信息的timeout
    sessions[userId] = undefined  // 手动清除

    logger.info(`will shutdown in ${ctx.config.shutdownDelay} seconds`)
    session.splitedSend(session.text('commands.shutdown.shutdown'))

    if (ctx.config.shutdownExperimentalOptions) {
        session.content = `cmd ${ctx.config.shutdownCommand.replaceAll('{delay}', ctx.config.shutdownDelay).trim()}`  // 修改context以符合cmd语法
    } else {
        session.content = os.platform() === 'win32' ? `cmd shutdown /f /s /t ${ctx.config.shutdownDelay}` : `shutdown -f ${ctx.config.shutdownDelay}`  // 未开启实验性使用默认命令
    }

    await session.execute('cmd')
    setTimeout(() => {
        session.splitedSend(session.text('commands.shutdown.exited'))
        setTimeout(() => {
            process.exit(0)
        }, 1500)
    }, 3000)
}
