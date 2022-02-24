/* -------------------------------------------------------------------------- */
/*                            Transaction Utilities                           */
/* -------------------------------------------------------------------------- */

import { err, Ok, ok } from 'neverthrow';
import {
    IFetchBalanceResponse,
    IKeypair,
    SyncResult,
    ICreateTxIn,
    IErrorInternal,
    IDdeValues,
    ICreateTxPayload,
    IAssetToken,
    IAssetReceipt,
    ITxOut,
    ICreateTransaction,
} from '../interfaces';
import { getStringBytes } from '../utils';
import { ZNP_NETWORK_VERSION } from './constants';
import { getAddressVersion } from './keyMgmt';
import { constructSignature, constructTxInSignableData } from './scriptMgmt';

/* -------------------------------------------------------------------------- */
/*                          Transaction Construction                          */
/* -------------------------------------------------------------------------- */

/**
 * Gather TxIn values
 *
 * @export
 * @param {number} paymentAmount
 * @param {('Token' | 'Receipt')} paymentAsset
 * @param {fetchBalanceResponse} fetchBalanceResponse
 * @param {(address: string, passphraseKey: Uint8Array) => Keypair} getKeypairCallback
 * @param {Uint8Array} passphrase
 * @return {*}  {[string[], number, ICreateTxIn[]]}
 */
export function getInputsForTx(
    paymentAmount: number,
    paymentAsset: 'Token' | 'Receipt',
    fetchBalanceResponse: IFetchBalanceResponse,
    getKeypairCallback: (address: string) => SyncResult<IKeypair>,
): SyncResult<[string[], number, ICreateTxIn[]]> {
    // Check to see if there's enough funds
    const enoughRunningTotal =
        paymentAsset == 'Token'
            ? fetchBalanceResponse.total.tokens >= paymentAmount
            : paymentAsset == 'Receipt'
            ? fetchBalanceResponse.total.receipts >= paymentAmount
            : false; /* Incorrect asset type */

    if (enoughRunningTotal) {
        let totalAmountGathered = 0;
        const usedAddresses: string[] = [];
        const inputs = Object.entries(fetchBalanceResponse.address_list).map(
            ([address, outPoints]) => {
                const ICreateTxIn: ICreateTxIn[] = [];
                const keyPair = getKeypairCallback(address);
                if (keyPair.isErr()) return err(keyPair.error);
                let usedOutpointsCount = 0;
                outPoints.forEach(({ out_point, value }) => {
                    if (
                        totalAmountGathered < paymentAmount &&
                        Object.keys(value).indexOf(paymentAsset) !==
                            -1 /* Ensure this `OutPoint` contains the correct asset type */
                    ) {
                        const signableData = constructTxInSignableData(out_point);
                        const signature = signableData
                            ? constructSignature(
                                  getStringBytes(signableData),
                                  keyPair.value.secretKey,
                              )
                            : ok('');
                        const addressVersion = getAddressVersion(keyPair.value.publicKey, address);
                        if (addressVersion.isErr()) return err(addressVersion.error);
                        if (signature.isErr()) return err(signature.error);

                        const ICreateTxInScript = {
                            Pay2PkH: {
                                signable_data: signableData || '',
                                signature: signature.value,
                                public_key: Buffer.from(keyPair.value.publicKey).toString('hex'),
                                address_version: addressVersion.value,
                            },
                        };

                        ICreateTxIn.push({
                            previous_out: out_point,
                            script_signature: ICreateTxInScript,
                        });

                        // Update the amount gathered and used addresses
                        totalAmountGathered += value[paymentAsset];
                        usedOutpointsCount++;
                        if (outPoints.length == usedOutpointsCount) {
                            // We have used all of the inputs this address has to offer,
                            // so we can add this address to the used addresses list
                            usedAddresses.push(address);
                        }
                    }
                    return ok([]);
                });
                return ok(ICreateTxIn);
            },
        );

        if (inputs.every((input) => input.isOk())) {
            const filteredInputs = inputs
                .filter((input): input is Ok<ICreateTxIn[], never> => !!input) /* Filter array */
                .reduce(
                    (accumulator: ICreateTxIn[], val) => accumulator.concat(val.value),
                    [],
                ) /* Flatten array */
                .filter((input): input is ICreateTxIn => !!input); /* Filter array */
            return ok([usedAddresses, totalAmountGathered, filteredInputs]);
        } else {
            //TODO: Change this to return an array of the errors that occured
            return err(IErrorInternal.InvalidInputs);
        }
    } else {
        return err(IErrorInternal.InsufficientFunds);
    }
}

/**
 * Creates a transaction structure for sending to the network.
 *
 *  This function will return the `CreateTransaction` struct the,
 *  used addresses as well as an indication of whether there
 *  was an excess. It will return undefined if creating the structure
 *  was unsuccessful.
 *
 *
 * @export
 * @param {string} paymentAddress
 * @param {number} amount
 * @param {('Token' | 'Receipt')} assetType
 * @param {string} excessAddress
 * @param {(IDdeValues | null)} druidInfo
 * @param {([string[], number, ICreateTxIn[]] | undefined)} txIns
 * @return {*}  {(ICreateTxPayload | undefined)}
 */
export function CreateTx(
    paymentAddress: string,
    amount: number,
    assetType: 'Token' | 'Receipt',
    excessAddress: string,
    druidInfo: IDdeValues | null,
    txIns: [string[], number, ICreateTxIn[]],
): SyncResult<ICreateTxPayload> {
    // Inputs obtained for payment from `fetch_balance` response
    const [usedAddresses, totalAmountGathered, inputs] = txIns;

    // If there are no inputs, then we can't create a transaction
    if (inputs.length === 0) {
        return err(IErrorInternal.NoInputs);
    }

    // Amount to pay
    const paymentAmount: IAssetToken | IAssetReceipt =
        assetType == 'Token'
            ? { Token: Number(amount) }
            : { Receipt: Number(amount) }; /* Assume receipt asset type */

    // TxOut to payment address
    const outputs: ITxOut[] = [
        {
            value: paymentAmount,
            locktime: 0,
            drs_tx_hash: null,
            drs_block_hash: null,
            script_public_key: paymentAddress,
        },
    ];

    // If the total amount gathered is more than the amount requested,
    // then we need to create a change/excess TxOut
    const hasExcess = totalAmountGathered > amount;
    if (hasExcess) {
        const excessAmount = totalAmountGathered - amount;
        const excess: IAssetToken | IAssetReceipt =
            assetType == 'Token'
                ? { Token: Number(excessAmount) }
                : { Receipt: Number(excessAmount) };

        outputs.push({
            value: excess,
            locktime: 0,
            drs_tx_hash: null,
            drs_block_hash: null,
            script_public_key: excessAddress,
        });
    }

    const createTransaction: ICreateTransaction = {
        inputs: inputs,
        outputs: outputs,
        version: ZNP_NETWORK_VERSION,
        druid_info: druidInfo,
    };

    const returnValue: ICreateTxPayload = {
        createTx: createTransaction,
        excessAddressUsed: hasExcess,
        usedAddresses: usedAddresses,
    };

    return ok(returnValue);
}

/**
 * Used to construct a regular token payment transaction to send to compute
 *
 * @export
 * @param {number} amount
 * @param {string} paymentAddress
 * @param {string} excessAddress
 * @param {IFetchBalanceResponse} fetchBalanceResponse
 * @param {(address: string) => IKeypair} getKeypairCallback
 * @param {Uint8Array} passphrase
 * @return {*} {(ICreateTxPayload | undefined)}
 */
export function CreateTokenPaymentTx(
    amount: number,
    paymentAddress: string,
    excessAddress: string,
    fetchBalanceResponse: IFetchBalanceResponse,
    getKeypairCallback: (address: string) => SyncResult<IKeypair>,
): SyncResult<ICreateTxPayload> {
    const txIns = getInputsForTx(amount, 'Token', fetchBalanceResponse, getKeypairCallback);
    if (txIns.isErr()) return err(txIns.error);

    return CreateTx(paymentAddress, amount, 'Token', excessAddress, null, txIns.value);
}
