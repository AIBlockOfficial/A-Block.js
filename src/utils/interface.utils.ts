import { err, ok } from 'neverthrow';
import {
    IAssetToken,
    IAssetItem,
    IDruidExpectation,
    IPendingIbTxDetails,
    IResult,
    IErrorInternal,
    IApiCreateTxResponse,
    IMakePaymentResponse,
} from '../interfaces';

import { DEFAULT_DRS_TX_HASH } from '../mgmt/constants';

/* -------------------------------------------------------------------------- */
/*                      Utilities for Custom Type Guards                      */
/* -------------------------------------------------------------------------- */

/**
 *  Initialize an empty structure of type `IAssetToken`, providing optional additional values
 *
 * @export
 * @param {Partial<IAssetToken>} [options] - Optional additional values to initialize the structure with
 * @return {*}  {IAssetToken}
 */
export function initIAssetToken(options?: Partial<IAssetToken>): IAssetToken {
    const defaults: IAssetToken = {
        Token: 0,
    };

    return {
        ...defaults,
        ...options,
    };
}

/**
 * Initialize an empty structure of type `IAssetItem`, providing optional additional values
 *
 * @export
 * @param {Partial<IAssetItem>} [options] - Optional additional values to initialize the structure with
 * @return {*}  {IAssetItem}
 */
export function initIAssetItem(options?: Partial<IAssetItem>): IAssetItem {
    const defaults: IAssetItem = {
        Item: {
            amount: 0,
            drs_tx_hash: DEFAULT_DRS_TX_HASH,
            metadata: null,
        },
    };

    return {
        ...defaults,
        ...options,
    };
}

/**
 * Initialize an empty structure of type `IDruidExpectation`, providing optional additional values
 *
 * @export
 * @param {Partial<IDruidExpectation>} [options] - Optional additional values to initialize the structure with
 * @return {*}  {IDruidExpectation}
 */
export function initIDruidExpectation(options?: Partial<IDruidExpectation>): IDruidExpectation {
    const defaults: IDruidExpectation = {
        from: '',
        to: '',
        asset: initIAssetToken(),
    };

    return {
        ...defaults,
        ...options,
    };
}

/**
 * Initialize an empty structure of type `IPendingIbTxDetails`, providing optional additional values
 *
 * @export
 * @param {Partial<IPendingIbTxDetails>} [options] - Optional additional values to initialize the structure with
 * @return {*}  {IPendingIbTxDetails}
 */
export function initIPendingIbTxDetails(
    options?: Partial<IPendingIbTxDetails>,
): IPendingIbTxDetails {
    const defaults: IPendingIbTxDetails = {
        druid: '',
        senderExpectation: initIDruidExpectation(),
        receiverExpectation: initIDruidExpectation(),
        status: 'pending',
        mempoolHost: '',
    };

    return {
        ...defaults,
        ...options,
    };
}

/**
 * Add left-hand-side asset to right-hand-side asset
 *
 * @param {(IAssetToken | IAssetItem)} lhs
 * @param {(IAssetToken | IAssetItem)} rhs
 * @return {*}  {(IResult<IAssetToken | IAssetItem>)}
 */
export const addLhsAssetToRhsAsset = (
    lhs: IAssetToken | IAssetItem,
    rhs: IAssetToken | IAssetItem,
): IResult<IAssetToken | IAssetItem> => {
    if (isOfTypeIAssetToken(lhs) && isOfTypeIAssetToken(rhs)) {
        const returnValue: IAssetToken = {
            Token: lhs.Token + rhs.Token,
        };
        return ok(returnValue);
    } else if (
        isOfTypeIAssetItem(lhs) &&
        isOfTypeIAssetItem(rhs) &&
        lhs.Item.drs_tx_hash === rhs.Item.drs_tx_hash
    ) {
        const returnValue: IAssetItem = {
            Item: {
                amount: lhs.Item.amount + rhs.Item.amount,
                drs_tx_hash: lhs.Item.drs_tx_hash,
                metadata: lhs.Item.metadata,
            },
        };
        return ok(returnValue);
    } else {
        return err(IErrorInternal.AssetsIncompatible);
    }
};

/**
 * Subtract the right-hand-side asset from the left-hand-side asset
 *
 * @param {(IAssetToken | IAssetItem)} lhs
 * @param {(IAssetToken | IAssetItem)} rhs
 * @return {*}  {(IResult<IAssetToken | IAssetItem>)}
 */
export const subRhsAssetFromLhsAsset = (
    lhs: IAssetToken | IAssetItem,
    rhs: IAssetToken | IAssetItem,
): IResult<IAssetToken | IAssetItem> => {
    const lhsAssetGreaterOrEq = lhsAssetIsEqOrGreaterThanRhsAsset(lhs, rhs);
    // Assets are incompatible due to different asset types or to lhs < rhs (we cannot have a negative asset amount)
    if (lhsAssetGreaterOrEq.isErr()) return err(IErrorInternal.AssetsIncompatible);
    if (lhsAssetGreaterOrEq.isOk() && !lhsAssetGreaterOrEq.value)
        err(IErrorInternal.AssetsIncompatible);
    if (isOfTypeIAssetToken(lhs) && isOfTypeIAssetToken(rhs) && lhsAssetGreaterOrEq.value) {
        const returnValue: IAssetToken = {
            Token: lhs.Token - rhs.Token,
        };
        return ok(returnValue);
    } else if (
        isOfTypeIAssetItem(lhs) &&
        isOfTypeIAssetItem(rhs) &&
        lhs.Item.drs_tx_hash === rhs.Item.drs_tx_hash &&
        lhsAssetGreaterOrEq.value
    ) {
        const returnValue: IAssetItem = {
            Item: {
                amount: lhs.Item.amount - rhs.Item.amount,
                drs_tx_hash: lhs.Item.drs_tx_hash,
                metadata: lhs.Item.metadata,
            },
        };
        return ok(returnValue);
    } else return err(IErrorInternal.AssetsIncompatible);
};

/**
 * Determine whether the left-hand-side asset is equal to, or greater than the right-hand-side asset
 *
 * @param {(IAssetToken | IAssetItem)} lhs
 * @param {(IAssetToken | IAssetItem)} rhs
 * @return {*}  {IResult<boolean>}
 */
export const lhsAssetIsEqOrGreaterThanRhsAsset = (
    lhs: IAssetToken | IAssetItem,
    rhs: IAssetToken | IAssetItem,
): IResult<boolean> => {
    if (isOfTypeIAssetToken(lhs) && isOfTypeIAssetToken(rhs)) return ok(lhs.Token >= rhs.Token);
    else if (
        isOfTypeIAssetItem(lhs) &&
        isOfTypeIAssetItem(rhs) &&
        lhs.Item.drs_tx_hash === rhs.Item.drs_tx_hash
    )
        return ok(lhs.Item.amount >= rhs.Item.amount);
    else return err(IErrorInternal.AssetsIncompatible);
};

/**
 * Determine whether the left-hand-side asset is greater than the right-hand-side asset
 *
 * @param {(IAssetToken | IAssetItem)} lhs
 * @param {(IAssetToken | IAssetItem)} rhs
 * @return {*}  {IResult<boolean>}
 */
export const lhsAssetIsGreaterThanRhsAsset = (
    lhs: IAssetToken | IAssetItem,
    rhs: IAssetToken | IAssetItem,
): IResult<boolean> => {
    if (isOfTypeIAssetToken(lhs) && isOfTypeIAssetToken(rhs)) return ok(lhs.Token > rhs.Token);
    else if (
        isOfTypeIAssetItem(lhs) &&
        isOfTypeIAssetItem(rhs) &&
        lhs.Item.drs_tx_hash === rhs.Item.drs_tx_hash
    )
        return ok(lhs.Item.amount > rhs.Item.amount);
    else return err(IErrorInternal.AssetsIncompatible);
};

/**
 * Determine whether the left-hand-side asset is less than the right-hand-side asset
 *
 * @param {(IAssetToken | IAssetItem)} lhs
 * @param {(IAssetToken | IAssetItem)} rhs
 * @return {*}  {IResult<boolean>}
 */
export const lhsAssetIsLessThanRhsAsset = (
    lhs: IAssetToken | IAssetItem,
    rhs: IAssetToken | IAssetItem,
): IResult<boolean> => {
    if (isOfTypeIAssetToken(lhs) && isOfTypeIAssetToken(rhs)) return ok(lhs.Token < rhs.Token);
    else if (
        isOfTypeIAssetItem(lhs) &&
        isOfTypeIAssetItem(rhs) &&
        lhs.Item.drs_tx_hash === rhs.Item.drs_tx_hash
    )
        return ok(lhs.Item.amount < rhs.Item.amount);
    else return err(IErrorInternal.AssetsIncompatible);
};

/**
 * Determine whether an asset is of type `IAssetToken`
 *
 * @param {*} value
 * @return {*}  {value is IAssetToken}
 */
export const isOfTypeIAssetToken = (value: any): value is IAssetToken =>
    isOfType<IAssetToken>(value, initIAssetToken());

/**
 *  Determine whether an asset is of type `IAssetItem`
 *
 * @param {*} value
 * @return {*}  {value is IAssetItem}
 */
export const isOfTypeIAssetItem = (value: any): value is IAssetItem =>
    isOfType<IAssetItem>(value, initIAssetItem());

/**
 *   Determine whether the provided value is of type `IPendingIbTxDetails`
 *
 * @param {*} value
 * @return {*}  {value is IPendingIbTxDetails}
 */
export const isOfTypeIPendingIbTxDetails = (value: any): value is IPendingIbTxDetails =>
    isOfType<IPendingIbTxDetails>(value, initIPendingIbTxDetails());

/**
 *
 *
 * @template T
 * @param {*} arg
 * @param {*} testAgainst
 * @return {*}  {arg is T}
 */
export const isOfType = <T>(arg: any, testAgainst: any): arg is T =>
    Object.entries(testAgainst).every(
        ([key]) => key in arg && typeof arg[key] === typeof testAgainst[key],
    );

/**
 * Determine whether two assets are of type `IAssetToken`
 *
 * @param {(IAssetToken | IAssetItem)} lhs
 * @param {(IAssetToken | IAssetItem)} rhs
 * @return {*}  {IResult<[IAssetToken, IAssetToken]>}
 */
export const assetsAreBothTokens = (
    lhs: IAssetToken | IAssetItem,
    rhs: IAssetToken | IAssetItem,
): IResult<[IAssetToken, IAssetToken]> => {
    if (isOfTypeIAssetToken(lhs) && isOfTypeIAssetToken(rhs)) return ok([lhs, rhs]);
    else return err(IErrorInternal.AssetsIncompatible);
};

/**
 * Determine wheter two assets are `IAssetItem` assets which are compatible based on their DRS transaction hash
 *
 * @param {(IAssetToken | IAssetItem)} lhs
 * @param {(IAssetToken | IAssetItem)} rhs
 * @return {*}  {IResult<[IAssetItem, IAssetItem]>}
 */
export const assetsAreBothCompatibleItems = (
    lhs: IAssetToken | IAssetItem,
    rhs: IAssetToken | IAssetItem,
): IResult<[IAssetItem, IAssetItem]> => {
    if (
        isOfTypeIAssetItem(lhs) &&
        isOfTypeIAssetItem(rhs) &&
        lhs.Item.drs_tx_hash === rhs.Item.drs_tx_hash
    )
        return ok([lhs, rhs]);
    else return err(IErrorInternal.AssetsIncompatible);
};

/**
 * Determine whether or not two assets are compatible
 *
 * @param {(IAssetToken | IAssetItem)} lhs
 * @param {(IAssetToken | IAssetItem)} rhs
 * @return {*}  {boolean}
 */
export const assetsAreCompatible = (
    lhs: IAssetToken | IAssetItem,
    rhs: IAssetToken | IAssetItem,
): boolean => {
    return assetsAreBothTokens(lhs, rhs).isOk() || assetsAreBothCompatibleItems(lhs, rhs).isOk();
};

/**
 * Create an `ICreateTransactionResponse` object from a response received by the network (network response is terrible to digest)
 *
 * @param {string[]} usedAddresses
 * @param {IApiCreateTxResponse} networkResponse
 * @return {*}  {IResult<IMakePaymentResponse>}
 */
export const transformCreateTxResponseFromNetwork = (
    usedAddresses: string[],
    networkResponse: IApiCreateTxResponse,
): IResult<IMakePaymentResponse> => {
    try {
        const transactionHash = Object.keys(networkResponse).pop();
        if (transactionHash === undefined) return err(IErrorInternal.InvalidNetworkResponse);
        const [paymentAddress, asset] = [
            networkResponse[transactionHash][0],
            networkResponse[transactionHash][1],
        ];
        return ok({
            transactionHash,
            paymentAddress,
            asset: asset.asset,
            metadata: asset.metadata,
            usedAddresses,
        });
    } catch (e) {
        return err(IErrorInternal.InvalidNetworkResponse);
    }
};
