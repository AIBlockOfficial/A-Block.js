import { BAL_LIMIT } from '../mgmt';
import { generateMasterKey, generateSeed } from '../mgmt/keyMgmt';

export function castAPIStatus(
    status: 'Success' | 'Error' | 'InProgress' | 'Unknown',
): 'success' | 'error' | 'pending' | 'unknown' {
    switch (status) {
        case 'Success':
            return 'success';
        case 'Error':
            return 'error';
        case 'InProgress':
            return 'pending';
        default:
            return 'unknown';
    }
}

/**
 * Test a seed phrase
 *
 * @export
 * @param {string} seed
 * @return {*}  {boolean}
 */
export function testSeedPhrase(seed: string): boolean {
    if (generateMasterKey(seed).isErr()) return false;
    return true;
}

/**
 * Generate a seed phrase
 *
 * @export
 * @return {*}  {string}
 */
export function generateSeedPhrase(): string {
    return generateSeed().unwrapOr('');
}

/**
 * Converts a string into a byte array for handling by nacl
 *
 * @param msg {string}
 * @returns
 */
export function getStringBytes(msg: string): Uint8Array {
    const enc = new TextEncoder();
    return enc.encode(msg);
}

/**
 * Converts a HEX string into a byte array for handling by nacl
 *
 * @param msg {string}
 * @returns
 */
export function getHexStringBytes(hexString: string): Uint8Array {
    const result = [];
    while (hexString.length >= 2) {
        result.push(parseInt(hexString.substring(0, 2), 16));
        hexString = hexString.substring(2, hexString.length);
    }
    return new Uint8Array(result);
}

/**
 * Converts a sequence of bytes into a HEX string
 *
 * @param bytes {Uint8Array}
 * @returns
 */
export function getBytesHexString(bytes: Uint8Array): string {
    return Array.from(bytes, (byte) => {
        return ('0' + (byte & 0xff).toString(16)).slice(-2);
    }).join('');
}

/**
 * Formats a balance for display
 *
 * @param balance {number}
 * @returns
 */
export function formatBalance(balance: number): string {
    if (balance == -999) {
        return 'N/A';
    }

    if (balance < 1) {
        return balance.toFixed(6);
    }

    if (balance < BAL_LIMIT) {
        const balString = balance.toFixed(2);
        const decimals = balString.slice(balString.length - 3);

        let balListReverse = balString
            .slice(0, balString.length - 3)
            .split('')
            .reverse()
            .join('')
            .match(/.{1,3}/g);

        if (!balListReverse) {
            return 'N/A';
        }

        balListReverse = balListReverse.reverse().map((e) => e.split('').reverse().join(''));

        return balListReverse.join(',').concat('', decimals);
    }

    const balListReverse = balance
        .toString()
        .split('')
        .reverse()
        .join('')
        .match(/.{1,3}/g);

    if (!balListReverse) {
        return 'N/A';
    }

    return balListReverse
        .reverse()
        .map((e) => e.split('').reverse().join(''))
        .join(',');
}

/**
 * Converts a byte array into a utf-8 string
 *
 * @param bytes {Uint8Array}
 * @returns
 */
export function getBytesString(bytes: Uint8Array): string {
    const dec = new TextDecoder('utf-8');
    return dec.decode(bytes);
}

/**
 * Truncates string to a specified number of bytes
 *
 * @param chars {string}
 * @param n {number}
 * @returns
 */
export function truncateByBytesUTF8(chars: string, n: number): string {
    let bytes = toBytesUTF8(chars).substring(0, n);
    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            return fromBytesUTF8(bytes);
            // eslint-disable-next-line no-empty
        } catch (e) {}
        bytes = bytes.substring(0, bytes.length - 1);
    }
}

export function typedArrayToBuffer(array: Uint8Array): ArrayBuffer {
    return array.buffer.slice(array.byteOffset, array.byteLength + array.byteOffset);
}

/**
 * Concatenates two typed arrays, as long as they are of the same type
 *
 * @param a {Uint8Array}
 * @param b {Uint8Array}
 * @returns
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function concatTypedArrays(a: any, b: any) {
    const c = new a.constructor(a.length + b.length);
    c.set(a, 0);
    c.set(b, a.length);
    return c;
}

/**
 * Converts string to bytes
 *
 * @param chars {string}
 * @returns
 */
function toBytesUTF8(chars: string) {
    return unescape(encodeURIComponent(chars));
}

/**
 * Converts bytes to string
 *
 * @param bytes {string}
 * @returns
 */
function fromBytesUTF8(bytes: string) {
    return decodeURIComponent(escape(bytes));
}
