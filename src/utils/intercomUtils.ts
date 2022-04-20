import { err, ok } from 'neverthrow';
import {
    IErrorInternal,
    IFetchPendingRbResponse,
    IKeypair,
    IPendingRbTxData,
    IPendingRbTxDetails,
    IRequestDelBody,
    IRequestGetBody,
    IRequestSetBody,
    SyncResult,
} from '../interfaces/index';
import { createSignature } from '../mgmt';

// TODO: This function may change to accomodate more than just receipt-based payments moving forward
/**
 * Get the receipt-based data for a single DRUID
 *
 * @export
 * @param {string} druid
 * @param {IFetchPendingRbResponse} rbData
 * @return {*}  {SyncResult<{
 *     key: string;
 *     data: IPendingRbTxDetails;
 * }>}
 */
export function getRbDataForDruid(
    druid: string,
    status: 'pending' | 'rejected' | 'accepted',
    rbData: IFetchPendingRbResponse,
): SyncResult<{
    key: string;
    data: IPendingRbTxDetails;
}> {
    try {
        const response = Object.entries(rbData)
            .filter(([, value]) => Object.keys(value.value).includes(druid))
            .filter(([, value]) =>
                Object.values(value.value).every((entry) => entry.status === status),
            )
            .map(([key, value]) => ({
                key: key,
                data: value.value,
            }))
            .reduce(
                (
                    accumulator: {
                        key: string;
                        data: IPendingRbTxData;
                    }[],
                    val,
                ) => accumulator.concat(val),
                [],
            ); /* Flatten array */
        // TODO: This will cause an error if you make receipt-based payments to yourself!
        if (response.length !== 1) throw new Error(IErrorInternal.InvalidDRUIDProvided);
        return ok({
            key: response[0].key,
            data: response[0].data[druid],
        });
    } catch (error) {
        return err(`${error}`);
    }
}

/**
 * Generate the needed request body to retrieve data from the intercom server
 *
 * @export
 * @param {string} addressKey
 * @param {IKeypair} keyPairForKey
 * @return {*}  {IRequestGetBody}
 */
export function generateIntercomGetBody(
    addressKey: string,
    keyPairForKey: IKeypair,
): IRequestGetBody {
    return {
        key: addressKey,
        publicKey: Buffer.from(keyPairForKey.publicKey).toString('hex'),
        signature: Buffer.from(
            createSignature(
                keyPairForKey.secretKey,
                Uint8Array.from(Buffer.from(addressKey, 'hex')),
            ),
        ).toString('hex'),
    } as IRequestGetBody;
}

/**
 * Generate the needed request body to place data on the intercom server
 *
 * @export
 * @template T
 * @param {string} addressKey
 * @param {string} addressField
 * @param {IKeypair} keyPairForField
 * @param {T} value
 * @return {*}  {IRequestSetBody<T>}
 */
export function generateIntercomSetBody<T>(
    addressKey: string,
    addressField: string,
    keyPairForField: IKeypair,
    value: T,
): IRequestSetBody<T> {
    return {
        key: addressKey,
        field: addressField,
        signature: Buffer.from(
            createSignature(
                keyPairForField.secretKey,
                Uint8Array.from(Buffer.from(addressField, 'hex')),
            ),
        ).toString('hex'),
        publicKey: Buffer.from(keyPairForField.publicKey).toString('hex'),
        value,
    } as IRequestSetBody<T>;
}

/**
 * Generate the needed request body to delete data from the intercom server
 *
 * @export
 * @param {string} addressKey
 * @param {string} addressField
 * @param {IKeypair} keyPairForKey
 * @return {*}  {IRequestDelBody}
 */
export function generateIntercomDelBody(
    addressKey: string,
    addressField: string,
    keyPairForKey: IKeypair,
): IRequestDelBody {
    return {
        key: addressKey,
        field: addressField,
        signature: Buffer.from(
            createSignature(
                keyPairForKey.secretKey,
                Uint8Array.from(Buffer.from(addressKey, 'hex')),
            ),
        ).toString('hex'),
        publicKey: Buffer.from(keyPairForKey.publicKey).toString('hex'),
    } as IRequestDelBody;
}

/**
 * Filter and remove garbage entries placed on the intercom server
 *
 * @export
 * @param {IFetchPendingRbResponse} pending
 * @return {*}  {IFetchPendingRbResponse}
 */
export function validateRbData(pending: IFetchPendingRbResponse): IFetchPendingRbResponse {
    // We test against this body structure to ensure that the data is valid
    const emptyDetails: IPendingRbTxDetails = {
        senderAsset: 'Token',
        senderAmount: 0,
        senderAddress: '',
        receiverAsset: 'Receipt',
        receiverAmount: 0,
        receiverAddress: '',
        fromAddr: '',
        status: 'pending',
    };

    const returnValue: IFetchPendingRbResponse = {};
    const filtered = Object.entries(pending).filter(
        ([, value]) =>
            Object.keys(value.value).length === 1 /* Single DRUID value */ &&
            Object.values(value.value).every((entry) =>
                isOfType<IPendingRbTxDetails>(entry, emptyDetails),
            ) /* Has valid structure */,
    );
    filtered.forEach(([key, value]) => (returnValue[key] = value));
    return returnValue;
}

/**
 * Test to see if an object is of a specified interface type
 *
 * @template T
 * @param {*} arg
 * @param {T} testAgainst
 * @return {*}  {arg is T}
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isOfType = <T>(arg: any, testAgainst: any): arg is T =>
    Object.entries(testAgainst).every(
        ([key]) => key in arg && typeof arg[key] === typeof testAgainst[key],
    );
