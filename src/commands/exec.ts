import { exec } from "node:child_process";
import { h } from "koishi"

import { Context, Session, logger } from "../constants";

export async function systoolsExec(ctx: Context, {session: _session}, timeout: number=30000) {
    const session: Session = _session

    let cmd = session.content.split(' ').slice(1).join(' ')
    // https://github.com/koishijs/koishi-plugin-spawn/blob/main/src/index.ts#L37
    cmd = h('', h.parse(cmd)).toString(true)  // 参考 koishi-plugin-spawn 将 HTML 字符转义回来
    if (cmd.length <= 0) {
        return session.text('tips.empty', ['cmd'])
    }

    session.splitedSend(session.text('commands.cmd.start', [cmd]))

    let running = { status: true, start: new Date().getTime(), stop: null }
    exec(  // ${os.platform() === 'win32' ? 'powershell -NoLogo -NoProfile ' : ''}
        `${cmd}`,
        { encoding: "buffer", timeout: timeout },
        (error, stdout, stderr) => {
            running.status = false
            running.stop = new Date().getTime()
            let used = running.stop - running.start

            if (error) {
                if (used > timeout) {
                    logger.debug(`run ${cmd} timeout: used time ${used}ms`)
                    session.splitedSend(session.text('commands.cmd.timeout', [used]))
                    return
                }
                session.splitedSend(session.text('commands.cmd.failed', [`${error}`, used]))
                return
            }
            
            let decoder = new TextDecoder("UTF-8")
            let stderrString = decoder.decode(stderr)
            let stdoutString = decoder.decode(stdout)

            if (stderrString.includes('�') || stdoutString.includes('�')) {  // 避免Windows中文环境下cmd使用GBK乱码的问题
                decoder = new TextDecoder("GBK")
                stderrString = decoder.decode(stderr)
                stdoutString = decoder.decode(stdout)
            }

            if (stderrString) {
                session.splitedSend(session.text('commands.cmd.failed', [stderrString, used]))
            } else {
                session.splitedSend(session.text('commands.cmd.success', [stdoutString, used]))
            }
        }
    )
}
