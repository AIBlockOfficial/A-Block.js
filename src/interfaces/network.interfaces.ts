/* -------------------------------------------------------------------------- */
/*                                 API Routes                                 */
/* -------------------------------------------------------------------------- */

import { ethers } from 'ethers';

import {
    IAssetReceipt,
    IAssetToken,
    ICreateTransaction,
    ICreateTransactionEncrypted,
    IDruidDroplet,
    IDruidExpectation,
    IGenericKeyPair,
    IKeypair,
    IKeypairEncrypted,
    IMasterKeyEncrypted,
    IOutPoint,
    ITransaction,
} from './general.interfaces';

// Response structure returned from `ZenottaInstance` methods
export type IClientResponse = {
    id?: string;
    status: 'success' | 'error' | 'pending' | 'unknown';
    reason?: string;
    content?: IContentType;
};

// `content` field of `IClientResponse`
export type IContentType = {
    newDRUIDResponse?: string;
    newSeedPhraseResponse?: string;
    getSeedPhraseResponse?: string;
    makeRbPaymentResponse?: IMakeRbPaymentResponse;
    newKeypairResponse?: IKeypairEncrypted;
    getMasterKeyResponse?: IMasterKeyEncrypted;
    initNewResponse?: [string, IMasterKeyEncrypted];
    initFromSeedResponse?: IMasterKeyEncrypted;
    regenWalletResponse?: IKeypairEncrypted[];
    signMessageResponse?: IGenericKeyPair<string>;
    decryptKeypairResponse?: IKeypair;
} & IApiContentType;

// Content received from compute node / intercom server API endpoints
export type IApiContentType = {
    fetchUtxoAddressesResponse?: IFetchUtxoAddressesResponse;
    fetchBalanceResponse?: IFetchBalanceResponse;
    fetchPendingDDEResponse?: IFetchPendingDDEResponse;
    createReceiptResponse?: ICreateReceiptResponse;
    fetchPendingRbResponse?: IResponseIntercom<IPendingRbTxDetails>;
    debugDataResponse?: IDebugDataResponse;
    fetchTransactionsResponse?: IFetchTransactionsResponse;
    getNotarySignatureResponse?: INotarySignatureResponse;
    getNotaryBurnAddressResponse?: IGetNotaryBurnAddressResponse;
    makePaymentResponse?: IMakePaymentResponse;
};

export enum IAPIRoute {
    /* ------------------------------- COMPUTE ZNP Routes ------------------------------- */
    DebugData = '/debug_data',
    FetchBalance = '/fetch_balance',
    SignableTransactions = '/signable_transactions' /* NOTE: No implementation */,
    CreateTransactions = '/create_transactions',
    CheckUpdate = '/check_update',
    AddressConstruction = '/address_construction' /* NOTE: No implementation */,
    GetUtxoAddressList = '/utxo_addresses',
    CreateReceiptAsset = '/create_receipt_asset',
    FetchPending = '/fetch_pending' /* NOTE: Currently not available */,
    /* --------------------------- Storage ZNP Routes --------------------------- */
    BlockchainEntry = '/blockchain_entry',
    Transactions = '/transactions_by_key',
    /* ----------------------------- Intercom Routes ---------------------------- */
    IntercomSet = '/set_data',
    IntercomGet = '/get_data',
    IntercomDel = '/del_data',
    /* -------------------------- Notary Service Routes ------------------------- */
    GetNotarySignature = '/get_signature',
    GetNotaryBurnAddress = '/get_burn_address',
}

/* -------------------------------------------------------------------------- */
/*                               ZNP Interfaces                               */
/* -------------------------------------------------------------------------- */

/* --------------------------- Response Structures -------------------------- */

// Response structure received from compute API endpoints
export type INetworkResponse = {
    id?: string;
    status: 'Success' | 'Error' | 'InProgress' | 'Unknown';
    reason?: string;
    route?: string;
    content?: IApiContentType;
};

export type IApiCreateTxResponse = IGenericKeyPair<[string, IApiAsset]>; // Transaction hash - (public key address, asset paid);

export type IApiAsset = {
    asset: IAssetToken | IAssetReceipt;
    metadata: number[] | null;
};

export type IMakePaymentResponse = {
    transactionHash: string;
    paymentAddress: string;
    asset: IAssetToken | IAssetReceipt;
    metadata: number[] | null;
    usedAddresses: string[];
};

export type IFetchTransactionsResponse = (ITransaction | string)[][];

export type IGetNotaryBurnAddressResponse = {
    burnAddress: string;
};

export type INotarySignatureResponse = {
    value: {
        amount: ethers.BigNumberish;
        burnId: ethers.utils.BytesLike;
        to: string;
    };
    sig: ethers.Signature;
};

// `/debug_data` endpoint response
export type IDebugDataResponse = {
    node_type: string;
    node_api: string[];
    node_peers: string[];
    routes_pow: IGenericKeyPair<number>;
};

// `/fetch_balance` endpoint response
export type IFetchBalanceResponse = {
    total: {
        tokens: number;
        receipts: IGenericKeyPair<number>;
    };
    address_list: IGenericKeyPair<{ out_point: IOutPoint; value: IAssetReceipt | IAssetToken }[]>;
};

// `/utxo_addresses` endpoint response
export type IFetchUtxoAddressesResponse = string[];

// `/create_receipt_asset` endpoint response
export type ICreateReceiptResponse = {
    asset: {
        asset: IAssetReceipt;
        metadata: number[] | null;
    };
    to_address: string;
    tx_hash: string;
};

// `/fetch_pending` endpoint response
export type IFetchPendingDDEResponse = {
    pending_transactions: { [key: string]: IDruidDroplet[] };
};

/* --------------------------- Payload Structures --------------------------- */

export enum IDrsTxHashSpecification {
    Create = 'Create',
    Default = 'Default',
}

// `/create_receipt_asset` payload structure
export type IReceiptCreationAPIPayload = {
    receipt_amount: number;
    script_public_key: string;
    public_key: string;
    signature: string;
    version: number | null;
    drs_tx_hash_spec: IDrsTxHashSpecification;
};
// `/create_transactions` payload structure
export type ICreateTxPayload = {
    createTx: ICreateTransaction;
    excessAddressUsed: boolean;
    usedAddresses: string[];
};

/* -------------------------------------------------------------------------- */
/*                         Zenotta Intercom Interfaces                        */
/* -------------------------------------------------------------------------- */

export type IResponseIntercom<T> = {
    // Address that placed the data : IRedisFieldEntry<T>;
    [key: string]: IRedisFieldEntry<T>;
};

export type IRequestIntercomSetBody<T> = {
    key: string;
    field: string;
    publicKey: string;
    signature: string;
    value: T;
};

export type IRequestIntercomDelBody = {
    key: string;
    field: string;
    publicKey: string;
    signature: string;
};

export type IRequestIntercomGetBody = {
    key: string;
    publicKey: string;
    signature: string;
};

export type IRedisFieldEntry<T> = {
    timestamp: number;
    value: T;
};

// NOTE: This data structure can be changed to anything and it will still be supported by the intercom server
export type IPendingRbTxDetails = {
    druid: string; // Value to bind transactions together
    senderExpectation: IDruidExpectation;
    receiverExpectation: IDruidExpectation;
    status: 'pending' | 'rejected' | 'accepted'; // Status of the DDE transaction
    computeHost: string; // Correlation between clients; send txs to the same compute node; chosen by the sender
};

/* -------------------------------------------------------------------------- */
/*                     ZenottaInstance Response Interfaces                    */
/* -------------------------------------------------------------------------- */
// Make receipt-based payment response
export type IMakeRbPaymentResponse = {
    druid: string;
    encryptedTx: ICreateTransactionEncrypted;
};
