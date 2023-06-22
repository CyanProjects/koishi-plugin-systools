import { readFile } from "fs/promises"

export async function read(filename: string, encoding: BufferEncoding & string = "utf-8"): Promise<string> {
    const buffer = await readFile(filename)
    return new TextDecoder(encoding).decode(buffer)
}

async function splitVerisons(text: string, regExp: string = "# V[0-9]+.[0-9]+.[0-9]+") {
    text = `\n${text}`

    const array = []
    while (true) {
        const start = text.search(new RegExp(regExp))
        if (start === -1) {
            array[array.length - 1].data += text
            break
        }
        const tmparr = text.split('V')
        const splitIndex = text.search('\n')  // 获取到行末的index
        const version = text.slice(tmparr[0].length + 1, splitIndex)
        const end = splitIndex + text.slice(splitIndex).search(new RegExp(regExp))
        array.push({
            version: version.trim(),
            data: text.slice(start, end).trim()
        })
        text = text.slice(end)
    }
    return array.slice(1)
}

export async function getUpdateInfos(text: string, regExp: string = "# V[0-9]+.[0-9]+.[0-9]+"): Promise<Array<{ version: string, data: string }>> {
    return await splitVerisons(text, regExp)
}

export async function getVersion(text: string, version: string): Promise<{ version: string, data: string }> {
    const array = await splitVerisons(text, "# V[0-9]+.[0-9]+.[0-9]+")
    for (let index in array) {
        const item = array[index]
        if (item.version.includes(version)) {
            return item
        }
    }
    return {
        version: version,
        data: undefined
    }
}

export async function getVersions(text: string, versionA: string, versionB: string): Promise<Array<{ version: string, data: string }>> {
    const array = await splitVerisons(text, "# V[0-9]+.[0-9]+.[0-9]+")
    let start = 0
    let end = 0
    for (let index in array) {
        const item = array[index]
        if (item.version.includes(versionA) && item.version.includes(versionB)) {
            return item
        }
        if (start === 0 && item.version.includes(versionA)) {
            start = parseInt(index)
        }
        if (item.version.includes(versionB)) {
            end = parseInt(index)
            return array.slice(start, end + 1)
        }
    }
    return [
        {
            version: versionA,
            data: undefined
        },
        {
            version: versionB,
            data: undefined
        }
    ]
}
