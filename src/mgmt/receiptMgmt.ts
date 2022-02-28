import { CreateTx, getInputsForTx } from './txMgmt';
import { getStringBytes } from '../utils';
import { RECEIPT_DEFAULT } from './constants';
import { constructAddress, createSignature } from './keyMgmt';
import { err, ok } from 'neverthrow';
import { constructTxInSignableAssetHash } from './scriptMgmt';
import {
    SyncResult,
    IReceiptCreationAPIPayload,
    IFetchBalanceResponse,
    IKeypair,
    ICreateTxPayload,
    IDruidExpectation,
    IDdeValues,
} from '../interfaces';

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
): SyncResult<IReceiptCreationAPIPayload> {
    const address = constructAddress(pubKey, version);
    if (address.isErr()) return err(address.error);
    const signableAssetHash = constructTxInSignableAssetHash('Receipt', amount);
    const signature = createSignature(secretKey, getStringBytes(signableAssetHash));
    return ok({
        receipt_amount: amount,
        script_public_key: address.value,
        public_key: Buffer.from(pubKey).toString('hex'),
        signature: Buffer.from(signature).toString('hex'),
        version: version,
    });
}

/**
 *  Creates one half of a receipt-based payment to send to compute
 *
 * @export
 * @param {fetchBalanceResponse} fetchBalanceResponse
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
    getKeypairCallback: (address: string) => SyncResult<IKeypair>,
): SyncResult<ICreateTxPayload> {
    const txIns = getInputsForTx(
        sendAmount,
        sendAssetType,
        fetchBalanceResponse,
        getKeypairCallback,
    );

    if (txIns.isErr()) return err(txIns.error);

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

    return CreateTx(
        paymentAddress,
        sendAmount,
        sendAssetType,
        excessAddress,
        druidInfo,
        txIns.value,
    );
}
