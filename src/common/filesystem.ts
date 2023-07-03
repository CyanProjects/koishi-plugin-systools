import * as fs from 'node:fs/promises'
import path from 'node:path'

import { parse, stringify } from './json'

export async function writeFile(filename: string, data: string | object, encoding: BufferEncoding, options: object={}) {
    const dirname = path.dirname(filename)
    try {
        const dirinfo = await fs.stat(dirname)
        if (dirinfo.isFile()) {
            try {
                await fs.unlink(dirname)
                await fs.mkdir(dirname)  // 递归创建
            } catch (error) {
                return [-1, error, 'create dir error']
            }
        }
    } catch (error) {
        try {
            await fs.mkdir(dirname, { recursive: true })  // 递归创建
        } catch(err) {
            // pass
        }
    }

    try {
        await fs.writeFile(
            filename,
            typeof data === 'object' ? stringify(data, null, 4) : data,
            { encoding: encoding, ...options }
        )
        return [0, 'success', 'write file successfully']
    } catch (error) {
        return [-2, error, 'write file error']
    }
}

export async function readFile(filename: string, encoding: BufferEncoding, options: object={}) {
    try {
        return [0, await fs.readFile(filename, { encoding: encoding, ...options }), 'success']
    } catch (error) {
        return [-1, error, 'read file error']
    }
}
