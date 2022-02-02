import { truncateByBytesUTF8, getStringBytes, getHexStringBytes } from '../utils';
import { bytesToBase64 } from 'byte-base64';
import { sha3_256 } from 'js-sha3';
import nacl from 'tweetnacl';
import { TEMP_ADDRESS_VERSION, ADDRESS_VERSION, SEED_REGEN_THRES } from './constants';
import { IMasterKey, IKeypair } from './interfaces';
import Mnemonic from 'bitcore-mnemonic';

/**
 * Get the address version for either a given public key and address
 * , or a version number
 *
 * The result is formatted for the network
 *
 * @param {Uint8Array} publicKey
 * @param {string} address
 * @return {*}  {(number | null)}
 */
export function getAddressVersion(
    publicKey?: Uint8Array,
    address?: string,
    version?: number | null,
): number | null {
    if (publicKey && address) {
        switch (address) {
            case constructAddress(publicKey, TEMP_ADDRESS_VERSION):
                return TEMP_ADDRESS_VERSION; /* Temporary address structure */
            case constructAddress(publicKey, ADDRESS_VERSION):
                return null; /* New address structure */
            default:
                return null;
        }
    } else if (version != null) {
        switch (version) {
            case TEMP_ADDRESS_VERSION:
                return TEMP_ADDRESS_VERSION;
            default:
                return null;
        }
    } else {
        return null;
    }
}

/**
 * Generates a new seed phrase
 */
export function generateSeed(): string {
    const seed = new Mnemonic();
    return seed.toString();
}

/**
 * Converts the given passphrase to a 32 byte Uint8Array
 *
 * @param passphrase {string}
 */
export function getPassphraseBuffer(passphrase: string): Uint8Array {
    const hash = sha3_256(passphrase);
    const val = truncateByBytesUTF8(hash, 32);

    return getStringBytes(val);
}

/**
 * Generates a new master key, seed phrase optional.
 * If no seed phrase is provided, a new one will be generated and returned.
 * If a seed phrase is provided, it's assumed to be in `Buffer` format
 *
 * @param seed {string}
 * @param passphrase {string}
 */
export function generateMasterKey(seed?: string, passphrase?: string): IMasterKey {
    const genInput = seed || Mnemonic.Words.ENGLISH.join(' ');
    const mGen = new Mnemonic(genInput);
    return {
        secret: mGen.toHDPrivateKey(passphrase || ''),
        seed: seed || mGen.toString(),
    };
}

/**
 * Generates a new keypair, potentially from seed
 *
 * @param version {number}
 * @param seed {string}
 * @returns
 */
export function generateKeypair(version = ADDRESS_VERSION, seed?: Uint8Array): IKeypair {
    if (seed && seed.length != 32) {
        seed = seed.slice(0, 32);
    }
    const keypairRaw = seed ? nacl.sign.keyPair.fromSeed(seed) : nacl.sign.keyPair();

    return {
        secretKey: keypairRaw.secretKey,
        publicKey: keypairRaw.publicKey,
        version,
    };
}

/**
 * Generates the next keypair at a given derivation depth
 *
 * @param masterKey {IMasterKey}
 * @param depth {number}
 */
export function getNextDerivedKeypair(
    masterKey: IMasterKey,
    depth: number,
    version = ADDRESS_VERSION,
): IKeypair {
    const seedKeyRaw = masterKey.secret.deriveChild(depth, true);
    const seedKey = getStringBytes(seedKeyRaw.xprivkey);
    return generateKeypair(version, seedKey);
}

/**
 * Constructs an address from the provided public key
 *
 * @param publicKey {Uint8Array}
 * @param version {number}
 */
export function constructAddress(publicKey: Uint8Array, version: number | null): string {
    switch (version) {
        case TEMP_ADDRESS_VERSION:
            return constructVersionTempAddress(publicKey);
        default:
            return constructVersionDefaultAddress(
                publicKey,
            ); /* `version` can be either 1 or null */
    }
}

/**
 * Constructs the address from the provided public key given the default version.
 *
 * @param publicKey {Uint8Array}
 * @returns
 */
export function constructVersionDefaultAddress(publicKey: Uint8Array): string {
    return sha3_256(publicKey);
}

/**
 * Constructs the address from the provided public key given the temporary version.
 * NOTE: Not to be used unless specifically needed
 *
 * @param publicKey {Uint8Array}
 * @returns
 */
export function constructVersionTempAddress(publicKey: Uint8Array): string {
    return sha3_256(getHexStringBytes(bytesToBase64(publicKey)));
}

/**
 * Signs a message with a provided private key
 *
 * @param secretKey {Uint8Array}
 * @param message {Uint8Array}
 */
export function createSignature(secretKey: Uint8Array, message: Uint8Array): Uint8Array {
    return nacl.sign.detached(message, secretKey);
}

/**
 * Generates a new keypair from a given master key and address version
 *
 * @param {*} masterKey
 * @param {number} addressVersion
 * @return {*}  {[Keypair, string]}
 */
export function generateNewKeypairAndAddress(
    masterKey: any,
    addressVersion: number | null,
    addresses: string[],
): [IKeypair, string] {
    let counter = addresses.length;

    let currentKey = getNextDerivedKeypair(masterKey, counter);
    let currentAddr = constructAddress(currentKey.publicKey, addressVersion);

    // Keep generating keys until we get a new one
    while (addresses.indexOf(currentAddr) != -1) {
        counter++;
        currentKey = getNextDerivedKeypair(masterKey, counter);
        currentAddr = constructAddress(currentKey.publicKey, addressVersion);
    }

    // Return keypair
    const keypair = {
        secretKey: currentKey.secretKey,
        publicKey: currentKey.publicKey,
        version: addressVersion,
    };

    return [keypair, currentAddr];
}
