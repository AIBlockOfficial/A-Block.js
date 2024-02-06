import { err, ok } from 'neverthrow';

import {
    IAssetItem,
    ICreateTxPayload,
    IDdeValues,
    IDrsTxHashSpecification,
    IDruidExpectation,
    IFetchBalanceResponse,
    IKeypair,
    IItemCreationAPIPayload,
    IResult,
} from '../interfaces';
import { getStringBytes } from '../utils';
import { RECEIPT_DEFAULT } from './constants';
import { constructAddress, createSignature } from './key.mgmt';
import { constructTxInSignableAssetHash } from './script.mgmt';
import { createTx, getInputsForTx } from './tx.mgmt';

/* -------------------------------------------------------------------------- */
/*                            Transaction Creation                            */
/* -------------------------------------------------------------------------- */

/**
 * Create a payload needed to create item assets which is suitable for processing by a mempool node
 *
 * @export
 * @param {Uint8Array} secretKey - Secret key as Uint8Array
 * @param {Uint8Array} pubKey - Public key as Uint8Array
 * @param {(number | null)} version - Address version
 * @param {number} [amount=RECEIPT_DEFAULT] - Amount of the asset to create
 * @param {boolean} [default_drs_tx_hash=true] - Whether to use the default DRS transaction hash
 * @param {string | null} [metadata=null] - Metadata to be included in the asset
 * @return {*}  {IResult<IItemCreationAPIPayload>}
 */
export function createItemPayload(
    secretKey: Uint8Array,
    pubKey: Uint8Array,
    version: number | null,
    amount: number = RECEIPT_DEFAULT,
    default_drs_tx_hash = true,
    metadata: string | null = null,
): IResult<IItemCreationAPIPayload> {
    const address = constructAddress(pubKey, version);
    if (address.isErr()) return err(address.error);
    const asset: IAssetItem = {
        Item: {
            amount,
            drs_tx_hash: '', // TODO: Change this if signable data for creating item assets changes; currently not used to create signable data
            metadata,
        },
    };
    const signableAssetHash = constructTxInSignableAssetHash(asset);
    const signature = createSignature(secretKey, getStringBytes(signableAssetHash));
    return ok({
        item_amount: amount,
        script_public_key: address.value,
        public_key: Buffer.from(pubKey).toString('hex'),
        signature: Buffer.from(signature).toString('hex'),
        version: version,
        drs_tx_hash_spec: default_drs_tx_hash
            ? IDrsTxHashSpecification.Default
            : IDrsTxHashSpecification.Create,
        metadata,
    });
}

/**
 * Create one "half" of a item-based payment
 *
 * @export
 * @param {IFetchBalanceResponse} fetchBalanceResponse - Balance as received from the mempool node
 * @param {string} druid - Unique DRUID value associated with this transaction; needs to match the other "half" of this item-based payment
 * @param {IDruidExpectation} senderExpectation - Expectation for the sender of this transaction
 * @param {IDruidExpectation} receiverExpectation - Expectation for the receiver of this transaction
 * @param {string} excessAddress - Address to send excess funds to (owned by sender of this "half" of the transaction)
 * @param {Map<string, IKeypair>} allKeypairs - Map of all keypairs
 * @return {*}  {IResult<ICreateTxPayload>}
 */
export function createIbTxHalf(
    fetchBalanceResponse: IFetchBalanceResponse,
    druid: string,
    senderExpectation: IDruidExpectation,
    receiverExpectation: IDruidExpectation,
    excessAddress: string,
    allKeypairs: Map<string, IKeypair>,
): IResult<ICreateTxPayload> {
    // Gather `TxIn` values
    const txIns = getInputsForTx(receiverExpectation.asset, fetchBalanceResponse, allKeypairs);

    // Return error if gathering of `TxIn` values failed
    if (txIns.isErr()) return err(txIns.error); /* Inputs for this payment could not be found */

    // Construct DRUID info
    const druidInfo: IDdeValues = {
        druid,
        participants: 2 /* This is a item-based payment, hence two participants */,
        expectations: [senderExpectation],
    };

    // Create the transaction
    return createTx(
        receiverExpectation.to,
        receiverExpectation.asset,
        excessAddress,
        druidInfo,
        txIns.value,
    );
}
