import * as os from "node:os"

import { Context, cid, osNames, Session } from "../constants";

export async function sysinfo(ctx: Context, { session: _session }) {
    const session: Session = _session;

    const total = (os.totalmem() / 1024 ** 3).toFixed(3)
    const free = (os.freemem() / 1024 ** 3).toFixed(3)
    const remaining = ((os.totalmem() - os.freemem()) / 1024 ** 3).toFixed(3)
    
    const cpus = os.cpus()
    const userinfo = os.userInfo()
    return session.text(
        'commands.sysinfo.success',
        [
            cid,
            os.hostname(),
            process.cwd(),
            `${osNames[os.platform()]} ${os.release()} ${os.arch}`,
            total,
            free,
            remaining,
            cpus[0].model,
            cpus.length,
            (os.uptime() / 3600).toFixed(2),
            userinfo.username,
            userinfo.homedir,
            userinfo.shell ?? '-'
        ]
    )
}
