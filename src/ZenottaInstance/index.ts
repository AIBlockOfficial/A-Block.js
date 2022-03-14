/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: Refactor this file to be more readable
import {
    CreateRbTxHalf,
    createReceiptPayload,
    CreateTokenPaymentTx,
    SEED_REGEN_THRES,
} from '../mgmt';
import axios, { AxiosInstance } from 'axios';
import { mgmtClient } from './mgmtClient';
import { castAPIStatus } from '../utils';
import { constructTxInsAddress } from '../mgmt/scriptMgmt';
import { generateIntercomDelBody, validateRbData } from '../utils/intercomUtils';
import {
    ICreateTransactionEncrypted,
    IMakeRbPaymentResponse,
    IMasterKeyEncrypted,
} from '../interfaces/index';
import {
    IFetchPendingRbResponse,
    IPendingRbTxData,
    IRequestGetBody,
    ICreateTransaction,
    IRequestDelBody,
    IErrorInternal,
    IKeypairEncrypted,
} from '../interfaces';
import {
    IFetchUtxoAddressesResponse,
    IFetchBalanceResponse,
    IFetchPendingDDEResponse,
    ICreateReceiptResponse,
    IAPIRoute,
} from '../interfaces';
import {
    generateIntercomGetBody,
    generateIntercomSetBody,
    getRbDataForDruid,
} from '../utils/intercomUtils';

/* -------------------------------------------------------------------------- */
/*                                 Interfaces                                 */
/* -------------------------------------------------------------------------- */

// Config needed for initialization
export type IClientConfig = {
    computeHost: string;
    intercomHost: string;
    passPhrase: string;
    timeout?: number;
};

// Response structure received from compute API endpoints
type INetworkResponse = {
    id?: string;
    status: 'Success' | 'Error' | 'InProgress' | 'Unknown';
    reason?: string;
    route?: string;
    content?: IApiContentType;
};

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
} & IApiContentType;

// Content received from compute node API endpoints
export type IApiContentType = {
    fetchUtxoAddressesResponse?: IFetchUtxoAddressesResponse;
    fetchBalanceResponse?: IFetchBalanceResponse;
    fetchPendingDDEResponse?: IFetchPendingDDEResponse;
    createReceiptResponse?: ICreateReceiptResponse;
    fetchPendingRbResponse?: IFetchPendingRbResponse;
};

export class ZenottaInstance {
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
     * Initialize a new instance of the client without providing a master key or seed phrase
     *
     * @param {IClientConfig} config
     * @return {*}  {IClientResponse}
     * @memberof ZenottaInstance
     */
    public initNew(config: IClientConfig): IClientResponse {
        this.initCommon(config);
        this.keyMgmt = new mgmtClient();
        const initResult = this.keyMgmt.initNew(config.passPhrase);
        if (initResult.isErr()) {
            return {
                status: 'error',
                reason: initResult.error,
            } as IClientResponse;
        } else {
            return {
                status: 'success',
                reason: 'ZNP client initialized',
                content: {
                    initNewResponse: initResult.value,
                },
            } as IClientResponse;
        }
    }

    /**
     * Initialize an instance of the client with a provided master key
     *
     * @param {IClientConfig} config
     * @param {IMasterKeyEncrypted} masterKey
     * @return {*}  {IClientResponse}
     * @memberof ZenottaInstance
     */
    public initFromMasterKey(
        config: IClientConfig,
        masterKey: IMasterKeyEncrypted,
    ): IClientResponse {
        this.initCommon(config);
        this.keyMgmt = new mgmtClient();
        const initResult = this.keyMgmt.initFromMasterKey(config.passPhrase, masterKey);
        if (initResult.isErr()) {
            return {
                status: 'error',
                reason: initResult.error,
            } as IClientResponse;
        } else {
            return {
                status: 'success',
                reason: 'ZNP client initialized',
            } as IClientResponse;
        }
    }

    /**
     * Initialize an instance of the wallet with a provided seed phrase
     *
     * @param {IClientConfig} config
     * @param {string} seedPhrase
     * @return {*}  {IClientResponse}
     * @memberof ZenottaInstance
     */
    public initFromSeed(config: IClientConfig, seedPhrase: string): IClientResponse {
        this.initCommon(config);
        this.keyMgmt = new mgmtClient();
        const initResult = this.keyMgmt.initFromSeed(config.passPhrase, seedPhrase);
        if (initResult.isErr()) {
            return {
                status: 'error',
                reason: initResult.error,
            } as IClientResponse;
        } else {
            return {
                status: 'success',
                reason: 'ZNP client initialized',
                content: {
                    initFromSeedResponse: initResult.value,
                },
            } as IClientResponse;
        }
    }

    /**
     * Common initialization
     *
     * @private
     * @param {IClientConfig} config
     * @memberof ZenottaInstance
     */
    private initCommon(config: IClientConfig) {
        this.intercomHost = config.intercomHost;
        this.axiosClient = axios.create({
            baseURL: config.computeHost,
            timeout: config.timeout ? config.timeout : 1000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    /**
     * Get all the addresses present on the ZNP UTXO set
     *
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZenottaInstance
     */
    public async getUtxoAddressList(): Promise<IClientResponse> {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error(IErrorInternal.ClientNotInitialized);
            return await this.axiosClient
                .get<INetworkResponse>(IAPIRoute.GetUtxoAddressList)
                .then((response) => {
                    return {
                        status: castAPIStatus(response.data.status),
                        reason: response.data.reason,
                        content: {
                            fetchUtxoAddressesResponse: response.data.content,
                        },
                    } as IClientResponse;
                })
                .catch(async (error) => {
                    throw new Error(error.message);
                });
        } catch (e) {
            return {
                status: 'error',
                reason: `${e}`,
            } as IClientResponse;
        }
    }

    /**
     * Fetch balance for an address list from the UTXO set
     *
     * @param {string[]} addressList
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZenottaInstance
     */
    async fetchBalance(addressList: string[]): Promise<IClientResponse> {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error(IErrorInternal.ClientNotInitialized);
            const fetchBalanceBody = {
                address_list: addressList,
            };
            return await this.axiosClient
                .post<INetworkResponse>(IAPIRoute.FetchBalance, fetchBalanceBody)
                .then((response) => {
                    return {
                        status: castAPIStatus(response.data.status),
                        reason: response.data.reason,
                        content: {
                            fetchBalanceResponse: response.data.content,
                        },
                    } as IClientResponse;
                })
                .catch(async (error) => {
                    throw new Error(error.message);
                });
        } catch (e) {
            return {
                status: 'error',
                reason: `${e}`,
            } as IClientResponse;
        }
    }

    /**
     * Fetch pending DDE transaction from the compute node
     *
     * @param {string[]} druids
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZenottaInstance
     */
    public async fetchPendingDDETransactions(druids: string[]): Promise<IClientResponse> {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error(IErrorInternal.ClientNotInitialized);
            const fetchPendingBody = {
                druid_list: druids,
            };
            return await this.axiosClient
                .post<INetworkResponse>(IAPIRoute.FetchPending, fetchPendingBody)
                .then((response) => {
                    return {
                        status: castAPIStatus(response.data.status),
                        reason: response.data.reason,
                        content: {
                            fetchPendingDDEResponse: response.data.content,
                        },
                    } as IClientResponse;
                })
                .catch(async (error) => {
                    throw new Error(error.message);
                });
        } catch (e) {
            return {
                status: 'error',
                reason: `${e}`,
            } as IClientResponse;
        }
    }

    /**
     * Create receipt-assets for a provided address/key-pair
     *
     * @param {IKeypairEncrypted} address
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZenottaInstance
     */
    public async createReceipts(address: IKeypairEncrypted): Promise<IClientResponse> {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error(IErrorInternal.ClientNotInitialized);
            const keyPair = this.keyMgmt.decryptKeypair(address);
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
                        content: {
                            createReceiptResponse: response.data.content,
                        },
                    } as IClientResponse;
                })
                .catch(async (error) => {
                    throw new Error(error.message);
                });
        } catch (e) {
            return {
                status: 'error',
                reason: `${e}`,
            } as IClientResponse;
        }
    }

    /**
     * Make a payment of a specified token amount to a payment address
     *
     * @param {string} paymentAddress
     * @param {number} paymentAmount
     * @param {IKeypairEncrypted[]} allKeypairs
     * @param {IKeypairEncrypted} excessKeypair
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZenottaInstance
     */
    async makeTokenPayment(
        paymentAddress: string,
        paymentAmount: number,
        allKeypairs: IKeypairEncrypted[],
        excessKeypair: IKeypairEncrypted,
    ): Promise<IClientResponse> {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error(IErrorInternal.ClientNotInitialized);
            const [allAddresses, keyPairMap] =
                this.keyMgmt.getAllAddressesAndKeypairMap(allKeypairs);

            // First update balance
            const balance = await this.fetchBalance(allAddresses);
            if (balance.status !== 'success' || !balance.content?.fetchBalanceResponse)
                throw new Error(balance.reason);
            // Get all existing addresses
            if (allKeypairs.length === 0) throw new Error('No existing key-pairs provided');
            // Create transaction
            const paymentBody = CreateTokenPaymentTx(
                paymentAmount,
                paymentAddress,
                excessKeypair.address,
                balance.content.fetchBalanceResponse,
                keyPairMap,
            );
            if (paymentBody.isErr()) throw new Error(paymentBody.error);
            // Create transaction struct has successfully been created
            return await this.axiosClient
                .post<INetworkResponse>(IAPIRoute.CreateTransactions, [paymentBody.value.createTx])
                .then((response) => {
                    const responseData = response.data as INetworkResponse;
                    return {
                        status: castAPIStatus(responseData.status),
                        reason: responseData.reason,
                    } as IClientResponse;
                })
                .catch(async (error) => {
                    throw new Error(error.message);
                });
        } catch (e) {
            return {
                status: 'error',
                reason: `${e}`,
            } as IClientResponse;
        }
    }

    /**
     * Create the "send" portion of a receipt-based payment
     *
     * @param {string} paymentAddress
     * @param {number} tokenAmount
     * @param {IKeypairEncrypted} receiveAddress
     * @param {IKeypairEncrypted[]} allKeypairs
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZenottaInstance
     */
    public async makeRbPayment(
        paymentAddress: string,
        tokenAmount: number,
        allKeypairs: IKeypairEncrypted[],
        receiveAddress: IKeypairEncrypted,
    ): Promise<IClientResponse> {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error(IErrorInternal.ClientNotInitialized);
            const senderKeypair = this.keyMgmt.decryptKeypair(receiveAddress);
            if (senderKeypair.isErr()) throw new Error(senderKeypair.error);
            const [allAddresses, keyPairMap] =
                this.keyMgmt.getAllAddressesAndKeypairMap(allKeypairs);
            // Update balance
            const balance = await this.fetchBalance(allAddresses);
            if (balance.status !== 'success' || !balance.content?.fetchBalanceResponse)
                throw new Error(balance.reason);
            if (allAddresses.length === 0) throw new Error('No existing key-pairs provided');

            // Generate a DRUID value for this transaction
            const druidValue = this.keyMgmt.getNewDRUID();
            if (druidValue.isErr()) throw new Error(druidValue.error);

            const sendRbTxHalf = CreateRbTxHalf(
                balance.content.fetchBalanceResponse,
                paymentAddress,
                druidValue.value,
                '' /* No TxIns address from receiving party */,
                tokenAmount,
                'Token',
                1,
                'Receipt',
                senderKeypair.value.address,
                senderKeypair.value.address,
                keyPairMap,
            );
            if (sendRbTxHalf.isErr()) throw new Error(sendRbTxHalf.error);
            // Create transaction struct has successfully been created
            const encryptedTx = this.keyMgmt.encryptTransaction(sendRbTxHalf.value.createTx);
            if (encryptedTx.isErr()) throw new Error(encryptedTx.error);

            const senderFromAddr = constructTxInsAddress(sendRbTxHalf.value.createTx.inputs);
            if (senderFromAddr.isErr()) throw new Error(senderFromAddr.error);
            if (sendRbTxHalf.value.createTx.druid_info === null)
                throw new Error(IErrorInternal.NoDRUIDValues);
            const valuePayload: IPendingRbTxData = {};
            valuePayload[druidValue.value] = {
                senderAsset: 'Token',
                senderAmount: tokenAmount,
                senderAddress: senderKeypair.value.address,
                receiverAsset: 'Receipt',
                receiverAmount: 1,
                receiverAddress: paymentAddress,
                fromAddr: senderFromAddr.value,
                status: 'pending',
            };
            const sendBody = [
                generateIntercomSetBody<IPendingRbTxData>(
                    paymentAddress,
                    senderKeypair.value.address,
                    senderKeypair.value,
                    valuePayload,
                ),
            ];
            return await axios
                .post(`${this.intercomHost}${IAPIRoute.IntercomSet}`, sendBody)
                .then(() => {
                    // Payment now getting processed
                    return {
                        status: 'success',
                        reason: 'Receipt-based payment processing',
                        content: {
                            makeRbPaymentResponse: {
                                druid: druidValue.value,
                                encryptedTx: encryptedTx.value,
                            },
                        },
                    } as IClientResponse;
                })
                .catch(async (error) => {
                    throw new Error(error.message);
                });
        } catch (e) {
            return {
                status: 'error',
                reason: `${e}`,
            } as IClientResponse;
        }
    }

    /**
     * Respond to a pending receipt-based payment
     *
     * @private
     * @param {string} druid
     * @param {IFetchPendingRbResponse} pendingResponse
     * @param {('accepted' | 'rejected')} status
     * @param {IKeypairEncrypted[]} allKeypairs
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZenottaInstance
     */
    private async handleRbTxResponse(
        druid: string,
        pendingResponse: IFetchPendingRbResponse,
        status: 'accepted' | 'rejected',
        allKeypairs: IKeypairEncrypted[],
    ): Promise<IClientResponse> {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error(IErrorInternal.ClientNotInitialized);
            const [allAddresses, keyPairMap] =
                this.keyMgmt.getAllAddressesAndKeypairMap(allKeypairs);

            // Update balance
            const balance = await this.fetchBalance(allAddresses);
            if (balance.status !== 'success' || !balance.content?.fetchBalanceResponse)
                throw new Error(balance.reason);
            // Filter DRUID values to find specified DRUID value and entry that is still marked as 'pending'
            const rbDataForDruid = getRbDataForDruid(druid, 'pending', pendingResponse);
            if (rbDataForDruid.isErr()) throw new Error(rbDataForDruid.error);
            const txInfo = rbDataForDruid.value.data;
            // Get the key-pair assigned to this receiver address
            const receiverKeypair = keyPairMap.get(txInfo.receiverAddress);
            if (!receiverKeypair) throw new Error('Unable to retrieve key-pair from map');
            // Set the status of the pending request
            txInfo.status = status;
            if (status === 'accepted') {
                const sendRbTxHalf = CreateRbTxHalf(
                    balance.content.fetchBalanceResponse,
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
                    keyPairMap,
                );

                if (sendRbTxHalf.isErr()) throw new Error(sendRbTxHalf.error);
                const fromAddr = constructTxInsAddress(sendRbTxHalf.value.createTx.inputs);
                if (fromAddr.isErr()) throw new Error(fromAddr.error);
                txInfo.fromAddr = fromAddr.value;

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

            const value: IPendingRbTxData = {};
            value[druid] = txInfo;
            const setBody = [
                generateIntercomSetBody<IPendingRbTxData>(
                    txInfo.senderAddress,
                    txInfo.receiverAddress,
                    receiverKeypair,
                    value,
                ),
            ];

            // Update 'sender' bucket value
            await axios
                .post(`${this.intercomHost}${IAPIRoute.IntercomSet}`, setBody)
                .catch(async (error) => {
                    throw new Error(error.message);
                });

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
     * @param {IKeypairEncrypted[]} allKeypairs
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZenottaInstance
     */
    public async acceptRbTx(
        druid: string,
        pendingResponse: IFetchPendingRbResponse,
        allKeypairs: IKeypairEncrypted[],
    ): Promise<IClientResponse> {
        return this.handleRbTxResponse(druid, pendingResponse, 'accepted', allKeypairs);
    }

    /**
     * Reject a pending receipt-based payment
     *
     * @param {string} druid
     * @param {IFetchPendingRbResponse} pendingResponse
     * @param {IKeypairEncrypted[]} allKeypairs
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZenottaInstance
     */
    public async rejectRbTx(
        druid: string,
        pendingResponse: IFetchPendingRbResponse,
        allKeypairs: IKeypairEncrypted[],
    ): Promise<IClientResponse> {
        return this.handleRbTxResponse(druid, pendingResponse, 'rejected', allKeypairs);
    }

    /**
     * Fetch pending receipt-based payments from the Zenotta Intercom server
     *
     * @param {IKeypairEncrypted[]} allKeypairs
     * @param {ICreateTransactionEncrypted[]} allEncryptedTxs
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZenottaInstance
     */
    public async fetchPendingRbTransactions(
        allKeypairs: IKeypairEncrypted[],
        allEncryptedTxs: ICreateTransactionEncrypted[],
    ): Promise<IClientResponse> {
        try {
            // TODO: Refactor complex pieces of code to separate functions
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error(IErrorInternal.ClientNotInitialized);

            const [allAddresses, keyPairMap] =
                this.keyMgmt.getAllAddressesAndKeypairMap(allKeypairs);

            const encryptedTxMap = new Map<string, ICreateTransactionEncrypted>();
            allEncryptedTxs.forEach((tx) => encryptedTxMap.set(tx.druid, tx));

            const pendingIntercom: IRequestGetBody[] = allAddresses
                .map((address) => {
                    if (!this.keyMgmt) return null;
                    const keyPair = keyPairMap.get(address);
                    if (!keyPair) return null;
                    return generateIntercomGetBody(address, keyPair);
                })
                .filter((input): input is IRequestGetBody => !!input); /* Filter array */

            // Get all pending RB transactions
            let responseData = await axios
                .post<IFetchPendingRbResponse>(
                    `${this.intercomHost}${IAPIRoute.IntercomGet}`,
                    pendingIntercom,
                )
                .then((response) => {
                    return response.data;
                })
                .catch(async (error) => {
                    throw new Error(error.message);
                });

            // NB: Validate receipt-based data and remove garbage entries
            responseData = validateRbData(responseData);

            // Get accepted and rejected receipt-based transactions
            const rbDataToDelete: IRequestDelBody[] = [];
            const [acceptedRbTxs, rejectedRbTxs] = [
                Object.values(responseData).filter((response) =>
                    Object.values(response.value).every((val) => val.status === 'accepted'),
                ),
                Object.values(responseData).filter((response) =>
                    Object.values(response.value).every((val) => val.status === 'rejected'),
                ),
            ]; /* 'every' can be used here because there should only be a single DRUID key */
            // We have accepted receipt-based payments to send to compute
            if (acceptedRbTxs.length > 0) {
                const transactionsToSend: ICreateTransaction[] = [];
                for (const acceptedTx of acceptedRbTxs) {
                    const druid = Object.keys(
                        acceptedTx.value,
                    )[0]; /* There should only be one unique DRUID key */
                    const fromAddr = Object.values(acceptedTx.value)[0].fromAddr;
                    // Decrypt transaction stored along with DRUID value
                    const encryptedTx = encryptedTxMap.get(druid);
                    if (!encryptedTx) throw new Error(IErrorInternal.InvalidDRUIDProvided);
                    const decryptedTransaction = this.keyMgmt.decryptTransaction(encryptedTx);
                    if (decryptedTransaction.isErr()) throw new Error(decryptedTransaction.error);
                    if (!decryptedTransaction.value.druid_info)
                        throw new Error(IErrorInternal.NoDRUIDValues);
                    // Set `TxIns` address value from receipient
                    decryptedTransaction.value.druid_info.expectations[0].from =
                        fromAddr; /* There should be only one expectation in a receipt-based payment */
                    transactionsToSend.push(decryptedTransaction.value);
                    const keyPair = keyPairMap.get(
                        Object.values(acceptedTx.value)[0].senderAddress,
                    );
                    if (!keyPair) throw new Error(IErrorInternal.UnableToGetKeypair);

                    rbDataToDelete.push(
                        generateIntercomDelBody(
                            Object.values(acceptedTx.value)[0].senderAddress,
                            Object.values(acceptedTx.value)[0].receiverAddress,
                            keyPair,
                        ),
                    );
                }

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

            // Add rejected receipt-based transactions to the delete list as well!
            if (rejectedRbTxs.length > 0) {
                for (const rejectedTx of rejectedRbTxs) {
                    const keyPair = keyPairMap.get(
                        Object.values(rejectedTx.value)[0].senderAddress,
                    );
                    if (!keyPair) throw new Error(IErrorInternal.UnableToGetKeypair);

                    rbDataToDelete.push(
                        generateIntercomDelBody(
                            Object.values(rejectedTx.value)[0].senderAddress,
                            Object.values(rejectedTx.value)[0].receiverAddress,
                            keyPair,
                        ),
                    );
                }
            }

            // Delete receipt-based data from intercom (accepted and rejected txs)
            if (rbDataToDelete.length > 0)
                await axios
                    .post(`${this.intercomHost}${IAPIRoute.IntercomDel}`, rbDataToDelete)
                    .catch(async (error) => {
                        throw new Error(error.message);
                    });

            return {
                status: 'success',
                reason: 'Succesfully fetched pending receipt-based transactions',
                content: {
                    fetchPendingRbResponse: responseData,
                },
            } as IClientResponse;
        } catch (e) {
            return {
                status: 'error',
                reason: `${e}`,
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
     * @memberof ZenottaInstance
     */
    async regenAddresses(
        passPhrase: string,
        addressList: string[],
        seedRegenThreshold: number = SEED_REGEN_THRES,
    ): Promise<IClientResponse> {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error(IErrorInternal.ClientNotInitialized);
            const foundAddr = this.keyMgmt.regenAddresses(
                passPhrase,
                addressList,
                seedRegenThreshold,
            );
            if (foundAddr.isErr()) throw new Error(foundAddr.error);
            if (foundAddr.value.length !== 0) {
                const encryptedKeypairs: IKeypairEncrypted[] = [];
                for (const addr of foundAddr.value) {
                    const encryptedKeypair = this.keyMgmt.encryptKeypair(addr);
                    if (encryptedKeypair.isErr()) throw new Error(encryptedKeypair.error);
                    encryptedKeypairs.push(encryptedKeypair.value);
                }
                return {
                    status: 'success',
                    reason: 'Addresses have successfully been reconstructed',
                    content: {
                        regenWalletResponse: encryptedKeypairs,
                    },
                } as IClientResponse;
            } else throw new Error('Address reconstruction failed');
        } catch (e) {
            return {
                status: 'error',
                reason: `${e}`,
            } as IClientResponse;
        }
    }

    /**
     * Generates a new key-pair and address
     * , then saves it to the wallet
     *
     * @return {*}  {IClientResponse}
     * @memberof ZenottaInstance
     */
    getNewKeypair(allAddresses: string[]): IClientResponse {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error(IErrorInternal.ClientNotInitialized);
            const result = this.keyMgmt.getNewKeypair(allAddresses);
            if (result.isErr()) throw new Error(result.error);
            return {
                status: 'success',
                reason: 'Successfully generated new address',
                content: {
                    newKeypairResponse: result.value,
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
     * Get the existing seed phrase, or generate a new one
     *
     * @return {*}  {IClientResponse}
     * @memberof ZenottaInstance
     */
    getSeedPhrase(): IClientResponse {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error(IErrorInternal.ClientNotInitialized);
            const seedPhrase = this.keyMgmt.getSeedPhrase();
            if (seedPhrase.isErr()) throw new Error(seedPhrase.error);
            return {
                status: 'success',
                reason: 'Successfully obtained seed phrase',
                content: {
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

    /**
     * Get the existing master key in an encrypted format
     *
     * @return {*}  {IClientResponse}
     * @memberof ZenottaInstance
     */
    getMasterKey(): IClientResponse {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error(IErrorInternal.ClientNotInitialized);
            const masterKey = this.keyMgmt.getMasterKey();
            if (masterKey.isErr()) throw new Error(masterKey.error);
            return {
                status: 'success',
                reason: 'Successfully obtained master key',
                content: {
                    getMasterKeyResponse: masterKey.value,
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
