import { CreateTx, getFormattedOutPointString, getInputsForTx } from './txMgmt';
import { p2pkh } from './scriptMgmt';
import { sha3_256 } from 'js-sha3';
import { v4 as uuidv4 } from 'uuid';
import { truncateByBytesUTF8, getStringBytes } from '../utils';
import { RECEIPT_DEFAULT } from './constants';
import { Script, ICreateTxIn, IKeypair, IDruidExpectation, IDdeValues } from './interfaces';
import { constructAddress, createSignature } from './keyMgmt';
import {
    IReceiptCreationAPIPayload,
    IFetchBalanceResponse,
    ICreateTxPayload,
} from '../ZnpClient/apiInterfaces';

/* -------------------------------------------------------------------------- */
/*                            Transaction Utilities                           */
/* -------------------------------------------------------------------------- */

/**
 * Generates a new 16 byte DRUID
 *
 * @returns {string}
 */
export function generateDRUID() {
    let newDRUID = uuidv4().replace(/-/gi, '');
    newDRUID = truncateByBytesUTF8(sha3_256(newDRUID), 9);

    return `DRUID0x${newDRUID}`;
}

/**
 * Formats script data for "from" address creation
 *
 * @export
 * @param {Script} Script
 * @return {*}  {string}
 */
export function getFormattedScriptString(script: Script): string {
    return Object.values(script.stack)
        .map((stackEntry) => {
            return stackEntry.toString();
        })
        .join('-');
}

/**
 * Gets "from" address used in DDEValues
 *
 * @export
 * @param {ICreateTxIn[]} txIns
 * @param {StackEntry[]} stackEntries
 * @return {*}  {string}
 */
export function constructTxInsAddress(txIns: ICreateTxIn[]): string {
    const signableTxIns = txIns
        .map((txIn) => {
            const script_sig = txIn.script_signature;
            if (script_sig) {
                const previousOutPoint = txIn.previous_out;
                const script = p2pkh(
                    script_sig.Pay2PkH.signable_data,
                    script_sig.Pay2PkH.signature,
                    script_sig.Pay2PkH.public_key,
                    script_sig.Pay2PkH.address_version,
                );

                return previousOutPoint !== null
                    ? `${getFormattedOutPointString(previousOutPoint)}-${getFormattedScriptString(
                          script,
                      )}`
                    : `null-${getFormattedScriptString(script)}`;
            }
        })
        .join('-');

    const bytesToHash = getStringBytes(signableTxIns);
    return sha3_256(bytesToHash);
}

//TODO: Add data asset type
export function constructTxInSignableAssetHash(type: 'Token' | 'Receipt', amount: number): string {
    switch (type) {
        case 'Token':
            return sha3_256(
                getStringBytes(`Token:${amount}`),
            ); /* Actual token amount, not formatted */
        case 'Receipt':
            return sha3_256(getStringBytes(`Receipt:${amount}`));
    }
}

/* -------------------------------------------------------------------------- */
/*                            Transaction Creation                            */
/* -------------------------------------------------------------------------- */

/**
 * Constructs a receipt creation API payload
 *
 * @param secretKey {Uint8Array}
 * @param pubKey {Uint8Array}
 * @param version {number}
 * @param amount {number} Optional. Defaults to 1000
 * @returns
 */
export function createReceiptPayload(
    secretKey: Uint8Array,
    pubKey: Uint8Array,
    version: number | null,
    amount: number = RECEIPT_DEFAULT,
): IReceiptCreationAPIPayload {
    const address = constructAddress(pubKey, version);
    const signature = createSignature(
        secretKey,
        getStringBytes(constructTxInSignableAssetHash('Receipt', amount)),
    );
    return {
        receipt_amount: amount,
        script_public_key: address,
        public_key: Buffer.from(pubKey).toString('hex'),
        signature: Buffer.from(signature).toString('hex'),
        version: version,
    };
}

/**
 *  Creates one half of a receipt-based payment to send to compute
 *
 * @export
 * @param {FetchBalanceResponse} fetchBalanceResponse
 * @param {Uint8Array} passphrase
 * @param {string} paymentAddress
 * @param {string} fullDruid
 * @param {string} fromValue
 * @param {number} sendAmount
 * @param {('Token' | 'Receipt')} sendAssetType
 * @param {number} receiveAmount
 * @param {('Token' | 'Receipt')} receiveAssetType
 * @param {string} excessAddress
 * @param {(address: string, passphraseKey: Uint8Array) => Keypair} getKeypairCallback
 * @return {*}  {(CreateTxReturn | undefined)}
 */
export function CreateRbTxHalf(
    fetchBalanceResponse: IFetchBalanceResponse,
    paymentAddress: string,
    fullDruid: string,
    fromValue: string,
    sendAmount: number,
    sendAssetType: 'Token' | 'Receipt',
    receiveAmount: number,
    receiveAssetType: 'Token' | 'Receipt',
    receiveAddress: string,
    excessAddress: string,
    getKeypairCallback: (address: string) => IKeypair,
): ICreateTxPayload | undefined {
    const txIns = getInputsForTx(
        sendAmount,
        sendAssetType,
        fetchBalanceResponse,
        getKeypairCallback,
    );

    const druidExpectation: IDruidExpectation = {
        from: fromValue,
        to: receiveAddress,
        asset:
            receiveAssetType == 'Receipt'
                ? { Receipt: Number(receiveAmount) }
                : { Token: Number(receiveAmount) },
    };

    const druidInfo: IDdeValues = {
        druid: fullDruid,
        participants: 2 /* This is a receipt-based payment, hence two participants */,
        expectations: [druidExpectation],
    };

    return CreateTx(paymentAddress, sendAmount, sendAssetType, excessAddress, druidInfo, txIns);
}
