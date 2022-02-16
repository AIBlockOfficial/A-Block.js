import { GenericKeyPair, IOutPoint, IDruidDroplet, ICreateTransaction } from '../mgmt';

/* -------------------------------------------------------------------------- */
/*                                 Interfaces                                 */
/* -------------------------------------------------------------------------- */

export enum IAPIRoute {
    FetchBalance = '/fetch_balance',
    SignableTransactions = '/signable_transactions',
    CreateTransactions = '/create_transactions',
    CheckUpdate = '/check_update',
    AddressConstruction = '/address_construction',
    GetUtxoAddressList = '/utxo_addresses',
    CreateReceiptAsset = '/create_receipt_asset',
    FetchPending = '/fetch_pending',
}

/* -------------------------------------------------------------------------- */
/*                               Response Types                               */
/* -------------------------------------------------------------------------- */

export type IFetchUtxoAddressesResponse = string[];

export type ICreateReceiptResponse = string;

export interface IFetchBalanceResponse {
    total: {
        tokens: number;
        receipts: number;
    };
    address_list: GenericKeyPair<{ out_point: IOutPoint; value: GenericKeyPair<number> }[]>;
}

export interface IFetchPendingResponse {
    pending_transactions: { [key: string]: IDruidDroplet[] };
}

/* -------------------------------------------------------------------------- */
/*                                  Payloads                                  */
/* -------------------------------------------------------------------------- */

export interface IReceiptCreationAPIPayload {
    receipt_amount: number;
    script_public_key: string;
    public_key: string;
    signature: string;
    version: number | null;
}

export interface ICreateTxPayload {
    createTx: ICreateTransaction;
    excessAddressUsed: boolean;
    usedAddresses: string[];
}
