import { Context, Session, logger } from "../constants";
import { Updater } from '../common/auto-update'
import path from "path";

let _reloadUpdater: Updater | null = null
export async function reload(ctx: Context, { session: _session }, url: string) {
    _reloadUpdater = _reloadUpdater ?? new Updater(ctx)

    const session: Session = _session

    _reloadUpdater.reload(path.resolve(__dirname, '../index'))
    return session.text('commands.reload.success')
}
