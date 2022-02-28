/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: Refactor this file to be more readable
import {
    ADDRESS_VERSION,
    CreateRbTxHalf,
    createReceiptPayload,
    createSignature,
    CreateTokenPaymentTx,
    generateNewKeypairAndAddress,
    SEED_REGEN_THRES,
} from '../mgmt';
import axios, { AxiosInstance } from 'axios';
import { IMgmtCallbacks, mgmtClient } from './mgmtClient';
import { castAPIStatus } from '../utils';
import { constructTxInsAddress } from '../mgmt/scriptMgmt';
import {
    IRequestSetBody,
    IFetchPendingRbResponse,
    IPendingRbTxData,
    IRequestGetBody,
    IKeypair,
    ICreateTransaction,
    IRequestDelBody,
} from '../interfaces';
import {
    IFetchUtxoAddressesResponse,
    IFetchBalanceResponse,
    IFetchPendingDDEResponse,
    ICreateReceiptResponse,
    IAPIRoute,
} from '../interfaces';
import { getRbDataForDruid } from '../utils/intercomUtils';

/* -------------------------------------------------------------------------- */
/*                                 Interfaces                                 */
/* -------------------------------------------------------------------------- */
export type IClientConfig = {
    callbacks: IMgmtCallbacks;
    passPhrase: string;
    seedPhrase?: string;
    computeHost: string;
    intercomHost: string;
    timeout?: number;
};

type INetworkResponse = {
    id?: string;
    status: 'Success' | 'Error' | 'InProgress' | 'Unknown';
    reason?: string;
    route?: string;
    content?: IApiContentType;
};

export type IClientResponse = {
    id?: string;
    status: 'success' | 'error' | 'pending' | 'unknown';
    reason?: string;
    clientContent?: IContentType;
    apiContent?: IApiContentType;
};

export type IContentType = {
    newAddressResponse?: string | null;
    newDRUIDResponse?: string;
    newSeedPhraseResponse?: string;
    getSeedPhraseResponse?: string;
};
export type IApiContentType = {
    fetchUtxoAddressesResponse?: IFetchUtxoAddressesResponse;
    fetchBalanceResponse?: IFetchBalanceResponse;
    fetchPendingDDEResponse?: IFetchPendingDDEResponse;
    createReceiptResponse?: ICreateReceiptResponse;
    fetchPendingRbResponse?: IFetchPendingRbResponse;
};

export class ZnpClient {
    /* -------------------------------------------------------------------------- */
    /*                              Member Variables                              */
    /* -------------------------------------------------------------------------- */
    private intercomHost: string;
    private axiosClient: AxiosInstance | undefined;
    private keyMgmt: mgmtClient | undefined;

    /* -------------------------------------------------------------------------- */
    /*                                 Constructor                                */
    /* -------------------------------------------------------------------------- */
    constructor() {
        this.intercomHost = '';
        this.axiosClient = undefined;
        this.keyMgmt = undefined;
    }

    /**
     * Initialize the client with the given config
     *
     * @param {IClientConfig} config
     * @return {*}  {IClientResponse}
     * @memberof ZnpClient
     */
    public init(config: IClientConfig): IClientResponse {
        this.intercomHost = config.intercomHost;
        this.axiosClient = axios.create({
            baseURL: config.computeHost,
            timeout: config.timeout ? config.timeout : 1000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        this.keyMgmt = new mgmtClient(config.callbacks);

        const initResult = this.keyMgmt.init(config.passPhrase, config.seedPhrase);
        if (initResult.isErr()) {
            return {
                status: 'error',
                reason: initResult.error,
            } as IClientResponse;
        } else {
            return {
                status: 'success',
                reason: 'Successfully initialized',
            } as IClientResponse;
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                             Compute API Routes                             */
    /* -------------------------------------------------------------------------- */

    /**
     * Get all the addresses present on the ZNP UTXO set
     *
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZnpClient
     */
    public async getUtxoAddressList(): Promise<IClientResponse> {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error('Client has not been initialized');
            return await this.axiosClient
                .get<INetworkResponse>(IAPIRoute.GetUtxoAddressList)
                .then((response) => {
                    return {
                        status: castAPIStatus(response.data.status),
                        reason: response.data.reason,
                        apiContent: {
                            fetchUtxoAddressesResponse: response.data.content,
                        },
                    } as IClientResponse;
                })
                .catch(async (error) => {
                    throw new Error(error.message);
                });
        } catch (error: any) {
            return {
                status: 'error',
                reason: error.message,
            } as IClientResponse;
        }
    }

    /**
     * Fetch the balance for all existing addresses
     *
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZnpClient
     */
    async fetchBalance(): Promise<IClientResponse> {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error('Client has not been initialized');
            const addresses = this.keyMgmt.getAddresses();
            if (addresses.isErr()) throw new Error(addresses.error);
            const fetchBalanceBody = {
                address_list: addresses.value,
            };
            return await this.axiosClient
                .post<INetworkResponse>(IAPIRoute.FetchBalance, fetchBalanceBody)
                .then((response) => {
                    return {
                        status: castAPIStatus(response.data.status),
                        reason: response.data.reason,
                        apiContent: {
                            fetchBalanceResponse: response.data.content,
                        },
                    } as IClientResponse;
                })
                .catch(async (error) => {
                    throw new Error(error.message);
                });
        } catch (error: any) {
            return {
                status: 'error',
                reason: error.message,
            } as IClientResponse;
        }
    }

    /**
     * Fetches the list of pending transactions based on passed DRUIDs
     *
     * @param {string[]} druids
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZnpClient
     */
    public async fetchPendingDDETransactions(druids: string[]): Promise<IClientResponse> {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error('Client has not been initialized');
            const fetchPendingBody = {
                druid_list: druids,
            };
            return await this.axiosClient
                .post<INetworkResponse>(IAPIRoute.FetchPending, fetchPendingBody)
                .then((response) => {
                    return {
                        status: castAPIStatus(response.data.status),
                        reason: response.data.reason,
                        apiContent: {
                            fetchPendingDDEResponse: response.data.content,
                        },
                    } as IClientResponse;
                })
                .catch(async (error) => {
                    throw new Error(error.message);
                });
        } catch (error: any) {
            return {
                status: 'error',
                reason: error.message,
            } as IClientResponse;
        }
    }

    /**
     * Create receipt assets and assign them to the most recent address
     *
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZnpClient
     */
    public async createReceipts(address?: string): Promise<IClientResponse> {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error('Client has not been initialized');
            let addr: string;
            // No address to assign to has been provided
            if (!address) {
                // Get all existing addresses
                const addresses = this.keyMgmt.getAddresses();
                if (addresses.isErr()) throw new Error(addresses.error);
                if (addresses.value.length === 0) throw new Error('No saved addresses');
                addr = addresses.value[addresses.value.length - 1];
                // An address has been provided to assign the receipts to
            } else {
                addr = address;
            }
            const keyPair = this.keyMgmt.getKeypair(addr);
            if (keyPair.isErr()) throw new Error(keyPair.error);
            // Create receipt-creation transaction
            const createReceiptBody = createReceiptPayload(
                keyPair.value.secretKey,
                keyPair.value.publicKey,
                keyPair.value.version,
            );
            if (createReceiptBody.isErr()) throw new Error(createReceiptBody.error);
            return await this.axiosClient
                .post<INetworkResponse>(
                    `${this.axiosClient.defaults.baseURL}${IAPIRoute.CreateReceiptAsset}`,
                    createReceiptBody.value,
                )
                .then((response) => {
                    return {
                        status: castAPIStatus(response.data.status),
                        reason: response.data.reason,
                        apiContent: {
                            createReceiptResponse: response.data.content,
                        },
                    } as IClientResponse;
                })
                .catch(async (error) => {
                    throw new Error(error.message);
                });
        } catch (error: any) {
            return {
                status: 'error',
                reason: error.message,
            } as IClientResponse;
        }
    }

    /**
     * Make a payment of a specified token amount to a specified address
     *
     * @param {string} paymentAddress
     * @param {number} paymentAmount
     * @param {IMakeTokenPaymentConfig} [config]
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZnpClient
     */
    async makeTokenPayment(
        paymentAddress: string,
        paymentAmount: number,
        excessAddress?: string,
    ): Promise<IClientResponse> {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error('Client has not been initialized');
            // First update balance
            const balance = await this.fetchBalance();
            if (balance.status !== 'success' || !balance.apiContent?.fetchBalanceResponse)
                throw new Error(balance.reason);
            // Get all existing addresses
            const addresses = this.keyMgmt.getAddresses();
            if (addresses.isErr()) throw new Error(addresses.error);
            if (addresses.value.length === 0) throw new Error('No saved addresses found');
            // Declare excess key-pair and excess address
            let excessKeypair: IKeypair;
            let excessAddr: string;
            // Configuration has provided a custom excess address
            if (excessAddress) {
                const keyPair = this.keyMgmt.getKeypair(excessAddress);
                if (keyPair.isErr()) throw new Error(keyPair.error);
                [excessKeypair, excessAddr] = [keyPair.value, excessAddress];
            } else {
                // Generate excess address and accompanying keypair
                const newKeypairResult = generateNewKeypairAndAddress(
                    this.keyMgmt.masterKey,
                    ADDRESS_VERSION,
                    addresses.value,
                );
                if (newKeypairResult.isErr()) throw new Error(newKeypairResult.error);
                [excessKeypair, excessAddr] = newKeypairResult.value;
            }
            // Create transaction
            const paymentBody = CreateTokenPaymentTx(
                paymentAmount,
                paymentAddress,
                excessAddr,
                balance.apiContent.fetchBalanceResponse,
                this.keyMgmt.getKeypair.bind(this.keyMgmt),
            );
            if (paymentBody.isErr()) throw new Error(paymentBody.error);
            // Create transaction struct has successfully been created
            return await this.axiosClient
                .post<INetworkResponse>(IAPIRoute.CreateTransactions, [paymentBody.value.createTx])
                .then((response) => {
                    const responseData = response.data as INetworkResponse;
                    if (castAPIStatus(responseData.status) === 'success') {
                        // Payment now getting processed
                        // TODO: Should we do something with the used addresses?
                        if (paymentBody?.value.excessAddressUsed) {
                            if (!this.axiosClient || !this.keyMgmt)
                                throw new Error('Client has not been initialized');
                            // Save excess keypair to wallet if an existing excess address
                            // was not provided
                            if (!excessAddress) {
                                const saveResult = this.keyMgmt.saveKeypair(
                                    excessKeypair,
                                    excessAddr,
                                );
                                if (saveResult.isErr()) throw new Error(saveResult.error);
                            }
                        }
                    }
                    return {
                        status: castAPIStatus(responseData.status),
                        reason: responseData.reason,
                    } as IClientResponse;
                })
                .catch(async (error) => {
                    throw new Error(error.message);
                });
        } catch (error: any) {
            return {
                status: 'error',
                reason: error.message,
            } as IClientResponse;
        }
    }

    public async createRbSendTx(
        paymentAddress: string,
        tokenAmount: number,
        receiveAddress?: string,
    ): Promise<IClientResponse> {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error('Client has not been initialized');
            // Update balance
            const balance = await this.fetchBalance();
            if (balance.status !== 'success' || !balance.apiContent?.fetchBalanceResponse)
                throw new Error(balance.reason);
            // Get all existing addresses
            const addresses = this.keyMgmt.getAddresses();
            if (addresses.isErr()) throw new Error(addresses.error);
            if (addresses.value.length === 0) throw new Error('No saved addresses found');
            // Determine receive address
            let senderKeypair: IKeypair;
            let senderAddr: string;
            // A receive address was provided
            if (receiveAddress) {
                const keyPair = this.keyMgmt.getKeypair(receiveAddress);
                if (keyPair.isErr()) throw new Error(keyPair.error);
                [senderKeypair, senderAddr] = [keyPair.value, receiveAddress];
            } else {
                // Generate a receive address
                const keyPair = generateNewKeypairAndAddress(
                    this.keyMgmt.masterKey,
                    ADDRESS_VERSION,
                    addresses.value,
                );
                if (keyPair.isErr()) throw new Error(keyPair.error);
                [senderKeypair, senderAddr] = keyPair.value;
            }

            // Generate a DRUID value for this transaction
            const druidValue = this.keyMgmt.getNewDRUID();
            if (druidValue.isErr()) throw new Error(druidValue.error);

            const sendRbTxHalf = CreateRbTxHalf(
                balance.apiContent.fetchBalanceResponse,
                paymentAddress,
                druidValue.value,
                '' /* No TxIns address from receiving party */,
                tokenAmount,
                'Token',
                1,
                'Receipt',
                senderAddr,
                senderAddr,
                this.keyMgmt.getKeypair.bind(this.keyMgmt),
            );
            if (sendRbTxHalf.isErr()) throw new Error(sendRbTxHalf.error);
            // Create transaction struct has successfully been created
            // TODO: Save encrypted TX to database for usage when RB transaction is accepted
            const encryptedTx = this.keyMgmt.encryptTransaction(sendRbTxHalf.value.createTx);
            if (encryptedTx.isErr()) throw new Error(encryptedTx.error);
            // Save encrypted transaction along with druid value if we are the initiators of this Tx
            const saveResult = this.keyMgmt.saveDRUIDInfo(druidValue.value, encryptedTx.value);
            if (saveResult.isErr()) throw new Error(saveResult.error);

            const senderFromAddr = constructTxInsAddress(sendRbTxHalf.value.createTx.inputs);
            if (senderFromAddr.isErr()) throw new Error(senderFromAddr.error);
            if (sendRbTxHalf.value.createTx.druid_info === null)
                throw new Error('DRUID values are null');
            const valuePayload: IPendingRbTxData = {};
            valuePayload[druidValue.value] = {
                senderAsset: 'Token',
                senderAmount: tokenAmount,
                senderAddress: senderAddr,
                receiverAsset: 'Receipt',
                receiverAmount: 1,
                receiverAddress: paymentAddress,
                fromAddr: senderFromAddr.value,
                status: 'pending',
            };
            const sendBody: IRequestSetBody[] = [
                {
                    key: paymentAddress,
                    field: senderAddr,
                    signature: Buffer.from(
                        createSignature(
                            senderKeypair.secretKey,
                            Uint8Array.from(Buffer.from(senderAddr, 'hex')),
                        ),
                    ).toString('hex'),
                    publicKey: Buffer.from(senderKeypair.publicKey).toString('hex'),
                    value: valuePayload,
                },
            ];
            return await axios
                .post(`${this.intercomHost}${IAPIRoute.IntercomSet}`, sendBody)
                .then(() => {
                    // Payment now getting processed
                    // TODO: Should we do something with the used addresses?
                    // Save excess keypair to wallet
                    if (!this.keyMgmt) throw new Error('Client has not been initialized');
                    // Since an existing address was not provided, we need to save the newly generated one
                    if (!receiveAddress) {
                        const saveResult = this.keyMgmt.saveKeypair(senderKeypair, senderAddr);
                        if (saveResult.isErr()) throw new Error(saveResult.error);
                    }
                    return {
                        status: 'success',
                    } as IClientResponse;
                })
                .catch(async (error) => {
                    throw new Error(error.message);
                });
        } catch (error: any) {
            return {
                status: 'error',
                reason: error.message,
            } as IClientResponse;
        }
    }

    /**
     * Reject a pending receipt-based payment
     *
     * @param {string} druid
     * @param {IFetchPendingRbResponse} pendingResponse
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZnpClient
     */
    private async handleRbTxResponse(
        druid: string,
        pendingResponse: IFetchPendingRbResponse,
        status: 'accepted' | 'rejected',
    ): Promise<IClientResponse> {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error('Client has not been initialized');
            // Update balance
            const balance = await this.fetchBalance();
            if (balance.status !== 'success' || !balance.apiContent?.fetchBalanceResponse)
                throw new Error(balance.reason);
            // Filter DRUID values to find specified DRUID value and entry that is still marked as 'pending'
            const rbDataForDruid = getRbDataForDruid(druid, pendingResponse);
            if (rbDataForDruid.isErr()) throw new Error(rbDataForDruid.error);
            const txInfo = rbDataForDruid.value.data;
            // Get the key-pair assigned to this receiver address
            const receiverKeypair = this.keyMgmt.getKeypair(txInfo.receiverAddress);
            if (receiverKeypair.isErr()) throw new Error(receiverKeypair.error);
            // Set the status of the pending request
            txInfo.status = status;
            if (status === 'accepted') {
                const sendRbTxHalf = CreateRbTxHalf(
                    balance.apiContent.fetchBalanceResponse,
                    txInfo.senderAddress,
                    druid,
                    // 'Sender' fromAddr is their TxIns address
                    txInfo.fromAddr /* TxIns received from sending party */,
                    txInfo.receiverAmount,
                    txInfo.receiverAsset,
                    txInfo.senderAmount,
                    txInfo.senderAsset,
                    txInfo.receiverAddress,
                    txInfo.receiverAddress,
                    this.keyMgmt.getKeypair.bind(this.keyMgmt),
                );

                if (sendRbTxHalf.isErr()) throw new Error(sendRbTxHalf.error);
                const fromAddr = constructTxInsAddress(sendRbTxHalf.value.createTx.inputs);
                if (fromAddr.isErr()) throw new Error(fromAddr.error);
                txInfo.fromAddr = fromAddr.value;
                const value: IPendingRbTxData = {};
                value[druid] = txInfo;
                const setBody: IRequestSetBody[] = [
                    {
                        key: txInfo.senderAddress,
                        field: txInfo.receiverAddress,
                        signature: Buffer.from(
                            createSignature(
                                receiverKeypair.value.secretKey,
                                Uint8Array.from(Buffer.from(txInfo.receiverAddress, 'hex')),
                            ),
                        ).toString('hex'),
                        publicKey: Buffer.from(receiverKeypair.value.publicKey).toString('hex'),
                        value: value,
                    },
                ];

                // Update 'sender' bucket value
                await axios
                    .post(`${this.intercomHost}${IAPIRoute.IntercomSet}`, setBody)
                    .catch(async (error) => {
                        throw new Error(error.message);
                    });

                // Send transaction to compute if accepted
                await this.axiosClient
                    .post<INetworkResponse>(IAPIRoute.CreateTransactions, [
                        sendRbTxHalf.value.createTx,
                    ])
                    .then((response) => {
                        const responseData = response.data as INetworkResponse;
                        if (castAPIStatus(responseData.status) !== 'success')
                            throw new Error(responseData.reason);
                    })
                    .catch(async (error) => {
                        throw new Error(error.message);
                    });
            }

            return {
                status: 'success',
                reason: 'Successfully responded to receipt-based payment',
            } as IClientResponse;
        } catch (error: any) {
            return {
                status: 'error',
                reason: error.message,
            };
        }
    }

    /**
     * Accept a pending receipt-based payment
     *
     * @param {string} druid
     * @param {IFetchPendingRbResponse} pendingResponse
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZnpClient
     */
    public async acceptRbTx(
        druid: string,
        pendingResponse: IFetchPendingRbResponse,
    ): Promise<IClientResponse> {
        return this.handleRbTxResponse(druid, pendingResponse, 'accepted');
    }

    /**
     * Reject a pending receipt-based payment
     *
     * @param {string} druid
     * @param {IFetchPendingRbResponse} pendingResponse
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZnpClient
     */
    public async rejectRbTx(
        druid: string,
        pendingResponse: IFetchPendingRbResponse,
    ): Promise<IClientResponse> {
        return this.handleRbTxResponse(druid, pendingResponse, 'rejected');
    }

    /**
     * Fetch any pending receipt-based payment data from the intercom network
     * and process any transactions that have been accepted/rejected
     *
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZnpClient
     */
    public async fetchPendingRbTransactions(): Promise<IClientResponse> {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error('Client has not been initialized');

            const addresses = this.keyMgmt.getAddresses();
            if (addresses.isErr()) throw new Error(addresses.error);
            const allKeyPairs: { keyPair: IKeypair; address: string }[] = [];
            const pendingIntercom: IRequestGetBody[] = addresses.value
                .map((address) => {
                    if (!this.keyMgmt) return null;
                    const keyPair = this.keyMgmt.getKeypair(address);
                    if (keyPair.isErr()) return null;
                    allKeyPairs.push({ keyPair: keyPair.value, address: address });
                    return {
                        key: address,
                        publicKey: Buffer.from(keyPair.value.publicKey).toString('hex'),
                        signature: Buffer.from(
                            createSignature(
                                keyPair.value.secretKey,
                                Uint8Array.from(Buffer.from(address, 'hex')),
                            ),
                        ).toString('hex'),
                    } as IRequestGetBody;
                })
                .filter((input): input is IRequestGetBody => !!input); /* Filter array */

            // Get all pending RB transactions
            const responseData = await axios
                .post(`${this.intercomHost}${IAPIRoute.IntercomGet}`, pendingIntercom)
                .then((response) => {
                    const responseData: IFetchPendingRbResponse = response.data;
                    return responseData;
                })
                .catch(async (error) => {
                    throw new Error(error.message);
                });
            // Get accepted and rejected receipt-based transactions
            //TODO: Do something with rejected transactions (they will expire on the intercom server in a few days anyways)
            // const [acceptedRbTxs, rejectedRbTxs];
            const [acceptedRbTxs] = [
                Object.values(responseData).filter((response) =>
                    Object.values(response.value).every((val) => val.status === 'accepted'),
                ),
                Object.values(responseData).filter((response) =>
                    Object.values(response.value).every((val) => val.status === 'rejected'),
                ),
            ]; /* 'every' can be used here because there should only be a single DRUID key */
            // TODO: Delete locally stored encrypted transactions
            // We have accepted receipt-based payments to send to compute
            if (acceptedRbTxs.length > 0) {
                const rbDataToDelete: IRequestDelBody[] = [];
                const transactionsToSend: ICreateTransaction[] = [];
                for (const acceptedTx of acceptedRbTxs) {
                    const druid = Object.keys(
                        acceptedTx.value,
                    )[0]; /* There should only be one DRUID key */
                    const fromAddr = Object.values(acceptedTx.value)[0]
                        .fromAddr; /* There should only be one DRUID key */
                    // Decrypt transaction stored along with DRUID value
                    const decryptedTransaction = this.keyMgmt.getDRUIDInfo(druid);
                    if (decryptedTransaction.isErr()) throw new Error(decryptedTransaction.error);
                    if (!decryptedTransaction.value.druid_info)
                        throw new Error('DRUID values are null');
                    // Set `TxIns` address value from receipient
                    decryptedTransaction.value.druid_info.expectations[0].from =
                        fromAddr; /* There should be only one expectation in a receipt-based payment */
                    transactionsToSend.push(decryptedTransaction.value);
                    rbDataToDelete.push({
                        key: Object.values(acceptedTx.value)[0].senderAddress,
                        field: Object.values(acceptedTx.value)[0].receiverAddress,
                        publicKey: Buffer.from(
                            allKeyPairs.filter(
                                (keyPair) =>
                                    keyPair.address ===
                                    Object.values(acceptedTx.value)[0].senderAddress,
                            )[0].keyPair.publicKey,
                        ).toString('hex'),
                        signature: Buffer.from(
                            createSignature(
                                allKeyPairs.filter(
                                    (keyPair) =>
                                        keyPair.address ===
                                        Object.values(acceptedTx.value)[0].senderAddress,
                                )[0].keyPair.secretKey,
                                Uint8Array.from(
                                    Buffer.from(
                                        allKeyPairs.filter(
                                            (keyPair) =>
                                                keyPair.address ===
                                                Object.values(acceptedTx.value)[0].senderAddress,
                                        )[0].address,
                                        'hex',
                                    ),
                                ),
                            ),
                        ).toString('hex'),
                    });
                }

                // Delete receipt-based data from intercom
                // Update 'sender' bucket value
                await axios
                    .post(`${this.intercomHost}${IAPIRoute.IntercomDel}`, rbDataToDelete)
                    .catch(async (error) => {
                        throw new Error(error.message);
                    });

                // Send transactions to compute for processing
                await this.axiosClient
                    .post<INetworkResponse>(IAPIRoute.CreateTransactions, transactionsToSend)
                    .then(async (response) => {
                        if (castAPIStatus(response.data.status) === 'error')
                            throw new Error(response.data.reason);
                    })
                    .catch(async (error) => {
                        throw new Error(error.message);
                    });
            }
            return {
                status: 'success',
                reason: 'Succesfully fetched pending receipt-based transactions',
                apiContent: {
                    fetchPendingRbResponse: responseData,
                },
            } as IClientResponse;
        } catch (error: any) {
            return {
                status: 'error',
                reason: error.message,
            } as IClientResponse;
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                                    Utils                                   */
    /* -------------------------------------------------------------------------- */

    /**
     * Regenerates the addresses for a newly imported wallet (from seed phrase)
     *
     * @param {string[]} addressList
     * @param {number} [seedRegenThreshold=SEED_REGEN_THRES]
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZnpClient
     */
    async regenAddresses(
        addressList: string[],
        seedRegenThreshold: number = SEED_REGEN_THRES,
    ): Promise<IClientResponse> {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error('Client has not been initialized');
            const foundAddr = this.keyMgmt.regenAddresses(addressList, seedRegenThreshold);
            if (foundAddr.isErr()) throw new Error(foundAddr.error);
            if (foundAddr.value.size !== 0) {
                return {
                    status: 'success',
                    reason: 'Addresses have successfully been reconstructed',
                } as IClientResponse;
            } else throw new Error('Address reconstruction failed');
        } catch (error: any) {
            return {
                status: 'error',
                reason: error.message,
            } as IClientResponse;
        }
    }

    /**
     * Generates a new key-pair and address
     * , then saves it to the wallet
     *
     * @return {*}  {IClientResponse}
     * @memberof ZnpClient
     */
    getNewAddress(): IClientResponse {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error('Client has not been initialized');
            const result = this.keyMgmt.getNewAddress();
            if (result.isErr()) throw new Error(result.error);
            return {
                status: 'success',
                reason: 'Successfully generated new address',
                clientContent: {
                    newAddressResponse: result.value,
                },
            } as IClientResponse;
        } catch (error: any) {
            return {
                status: 'error',
                reason: error.message,
            };
        }
    }

    /**
     * Generates a new seed phrase
     *
     * @return {*}  {IClientResponse}
     * @memberof ZnpClient
     */
    getNewSeedPhrase(): IClientResponse {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error('Client has not been initialized');
            const newSeedPhrase = this.keyMgmt.getNewSeedPhrase();
            if (newSeedPhrase.isErr()) throw new Error(newSeedPhrase.error);
            return {
                status: 'success',
                reason: 'Successfully generated new seed phrase',
                clientContent: {
                    newSeedPhraseResponse: newSeedPhrase.value,
                },
            };
        } catch (error: any) {
            return {
                status: 'error',
                reason: error.message,
            };
        }
    }

    /**
     * Get the existing seed phrase, or generate a new one
     *
     * @return {*}  {IClientResponse}
     * @memberof ZnpClient
     */
    getSeedPhrase(): IClientResponse {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error('Client has not been initialized');
            const seedPhrase = this.keyMgmt.getSeedPhrase();
            if (seedPhrase.isErr()) throw new Error(seedPhrase.error);
            return {
                status: 'success',
                reason: 'Successfully obtained seed phrase',
                clientContent: {
                    getSeedPhraseResponse: seedPhrase.value,
                },
            };
        } catch (error: any) {
            return {
                status: 'error',
                reason: error.message,
            };
        }
    }
}
