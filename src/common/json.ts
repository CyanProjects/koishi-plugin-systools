export function stringify(value, ...args) {
    try {
        return JSON.stringify.call(this, value, ...args)
    } catch(error) {
        return null
    }
}

export function parse(text, ...args) {
    try {
        return JSON.parse.call(this, text, ...args)
    } catch(error) {
        return null
    }
}
