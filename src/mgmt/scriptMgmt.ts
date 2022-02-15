import { getHexStringBytes } from '../utils';
import { Script, StackEntry } from './interfaces';
import { constructAddress } from './keyMgmt';

export function p2pkh(
    checkData: string,
    signatureData: string,
    publicKeyData: string,
    addressVersion: number | null,
): Script {
    const stackEntries: StackEntry[] = [];
    stackEntries.push(new StackEntry('Bytes', checkData));
    stackEntries.push(new StackEntry('Signature', signatureData));
    stackEntries.push(new StackEntry('PubKey', publicKeyData));
    stackEntries.push(new StackEntry('Op', 'OP_DUP'));
    stackEntries.push(
        new StackEntry(
            'Op',
            addressVersion == 1 || addressVersion == null ? 'OP_HASH256' : 'OP_HASH256_TEMP',
        ),
    );
    stackEntries.push(
        new StackEntry(
            'PubKeyHash',
            constructAddress(getHexStringBytes(publicKeyData), addressVersion),
        ),
    );
    stackEntries.push(new StackEntry('Op', 'OP_EQUALVERIFY'));
    stackEntries.push(new StackEntry('Op', 'OP_CHECKSIG'));
    return {
        stack: stackEntries,
    };
}
