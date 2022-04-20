// TODO: Refactor this file to be more readable
import {
    constructTxInsAddress,
    CreateRbTxHalf,
    createReceiptPayload,
    CreateTokenPaymentTx,
    SEED_REGEN_THRES,
} from '../mgmt';
import axios, { AxiosInstance } from 'axios';
import { mgmtClient } from './mgmtClient';
import { castAPIStatus, createIdAndNonceHeaders, throwIfErr } from '../utils';
import {
    generateIntercomDelBody,
    generateIntercomGetBody,
    generateIntercomSetBody,
    getRbDataForDruid,
    validateRbData,
} from '../utils/intercomUtils';
import {
    IAPIRoute,
    ICreateReceiptResponse,
    ICreateTransaction,
    ICreateTransactionEncrypted,
    IDebugDataResponse,
    IErrorInternal,
    IFetchBalanceResponse,
    IFetchPendingDDEResponse,
    IFetchPendingRbResponse,
    IFetchUtxoAddressesResponse,
    IKeypairEncrypted,
    IMakeRbPaymentResponse,
    IMasterKeyEncrypted,
    IPendingRbTxData,
    IRequestDelBody,
    IRequestGetBody,
} from '../interfaces';

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
    debugDataResponse?: IDebugDataResponse;
};

export class ZenottaInstance {
    /* -------------------------------------------------------------------------- */
    /*                              Member Variables                              */
    /* -------------------------------------------------------------------------- */
    private intercomHost: string;
    private axiosClient: AxiosInstance | undefined;
    private keyMgmt: mgmtClient | undefined;
    private routesPoW: Map<string, number>;

    /* -------------------------------------------------------------------------- */
    /*                                 Constructor                                */
    /* -------------------------------------------------------------------------- */
    constructor() {
        this.intercomHost = '';
        this.axiosClient = undefined;
        this.keyMgmt = undefined;
        this.routesPoW = new Map();
    }

    /**
     * Initialize a new instance of the client without providing a master key or seed phrase
     *
     * @param {IClientConfig} config
     * @return {*}  {IClientResponse}
     * @memberof ZenottaInstance
     */
    public async initNew(config: IClientConfig): Promise<IClientResponse> {
        this.keyMgmt = new mgmtClient();
        const initResult = this.keyMgmt.initNew(config.passPhrase);
        const initCommonResult = await this.initCommon(config);
        if (initCommonResult.status === 'error') {
            return initCommonResult; // Return network error
        } else if (initResult.isErr()) {
            return {
                status: 'error',
                reason: initResult.error, // Return initialization error
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
    public async initFromMasterKey(
        config: IClientConfig,
        masterKey: IMasterKeyEncrypted,
    ): Promise<IClientResponse> {
        this.keyMgmt = new mgmtClient();
        const initResult = this.keyMgmt.initFromMasterKey(config.passPhrase, masterKey);
        const initCommonResult = await this.initCommon(config);
        if (initCommonResult.status === 'error') {
            return initCommonResult; // Return network error
        } else if (initResult.isErr()) {
            return {
                status: 'error',
                reason: initResult.error, // Return initialization error
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
    public async initFromSeed(config: IClientConfig, seedPhrase: string): Promise<IClientResponse> {
        this.keyMgmt = new mgmtClient();
        const initResult = this.keyMgmt.initFromSeed(config.passPhrase, seedPhrase);
        const initCommonResult = await this.initCommon(config);
        if (initCommonResult.status === 'error') {
            return initCommonResult; // Return network error
        } else if (initResult.isErr()) {
            return {
                status: 'error',
                reason: initResult.error, // Return initialization error
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
    private async initCommon(config: IClientConfig): Promise<IClientResponse> {
        this.intercomHost = config.intercomHost;
        this.axiosClient = axios.create({
            baseURL: config.computeHost,
            timeout: config.timeout ? config.timeout : 1000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        // Set routes proof-of-work requirements
        const debugData = await this.getDebugData();
        if (debugData.status === 'error')
            return {
                status: 'error',
                reason: debugData.reason,
            } as IClientResponse;
        else if (debugData.status === 'success' && debugData.content?.debugDataResponse)
            for (const route in debugData.content.debugDataResponse.routes_pow) {
                this.routesPoW.set(route, debugData.content.debugDataResponse.routes_pow[route]);
            }
        return {
            status: 'success',
        } as IClientResponse;
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
            const headers = this.getRequestIdAndNonceForRoute(IAPIRoute.GetUtxoAddressList);
            return await this.axiosClient
                .get<INetworkResponse>(IAPIRoute.GetUtxoAddressList, headers)
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
                    if (error instanceof Error) throw new Error(error.message);
                    else throw new Error(`${error}`);
                });
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
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
            const headers = this.getRequestIdAndNonceForRoute(IAPIRoute.FetchBalance);
            return await this.axiosClient
                .post<INetworkResponse>(IAPIRoute.FetchBalance, fetchBalanceBody, headers)
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
                    if (error instanceof Error) throw new Error(error.message);
                    else throw new Error(`${error}`);
                });
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
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
            const headers = this.getRequestIdAndNonceForRoute(IAPIRoute.FetchPending);
            return await this.axiosClient
                .post<INetworkResponse>(IAPIRoute.FetchPending, fetchPendingBody, headers)
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
                    if (error instanceof Error) throw new Error(error.message);
                    else throw new Error(`${error}`);
                });
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
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
            const keyPair = throwIfErr(this.keyMgmt.decryptKeypair(address));
            // Create receipt-creation transaction
            const createReceiptBody = throwIfErr(
                createReceiptPayload(keyPair.secretKey, keyPair.publicKey, keyPair.version),
            );
            const headers = this.getRequestIdAndNonceForRoute(IAPIRoute.CreateReceiptAsset);
            return await this.axiosClient
                .post<INetworkResponse>(
                    `${this.axiosClient.defaults.baseURL}${IAPIRoute.CreateReceiptAsset}`,
                    createReceiptBody,
                    headers,
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
                    if (error instanceof Error) throw new Error(error.message);
                    else throw new Error(`${error}`);
                });
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
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
            const paymentBody = throwIfErr(
                CreateTokenPaymentTx(
                    paymentAmount,
                    paymentAddress,
                    excessKeypair.address,
                    balance.content.fetchBalanceResponse,
                    keyPairMap,
                ),
            );
            const headers = this.getRequestIdAndNonceForRoute(IAPIRoute.CreateTransactions);
            // Create transaction struct has successfully been created
            return await this.axiosClient
                .post<INetworkResponse>(
                    IAPIRoute.CreateTransactions,
                    [paymentBody.createTx],
                    headers,
                )
                .then((response) => {
                    const responseData = response.data as INetworkResponse;
                    return {
                        status: castAPIStatus(responseData.status),
                        reason: responseData.reason,
                    } as IClientResponse;
                })
                .catch(async (error) => {
                    if (error instanceof Error) throw new Error(error.message);
                    else throw new Error(`${error}`);
                });
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
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
            const senderKeypair = throwIfErr(this.keyMgmt.decryptKeypair(receiveAddress));
            const [allAddresses, keyPairMap] =
                this.keyMgmt.getAllAddressesAndKeypairMap(allKeypairs);
            // Update balance
            const balance = await this.fetchBalance(allAddresses);
            if (balance.status !== 'success' || !balance.content?.fetchBalanceResponse)
                throw new Error(balance.reason);
            if (allAddresses.length === 0) throw new Error('No existing key-pairs provided');

            // Generate a DRUID value for this transaction
            const druidValue = throwIfErr(this.keyMgmt.getNewDRUID());

            const sendRbTxHalf = throwIfErr(
                CreateRbTxHalf(
                    balance.content.fetchBalanceResponse,
                    paymentAddress,
                    druidValue,
                    '' /* No TxIns address from receiving party */,
                    tokenAmount,
                    'Token',
                    1,
                    'Receipt',
                    senderKeypair.address,
                    senderKeypair.address,
                    keyPairMap,
                ),
            );
            // Create transaction struct has successfully been created
            const encryptedTx = throwIfErr(this.keyMgmt.encryptTransaction(sendRbTxHalf.createTx));

            const senderFromAddr = throwIfErr(constructTxInsAddress(sendRbTxHalf.createTx.inputs));
            if (sendRbTxHalf.createTx.druid_info === null)
                throw new Error(IErrorInternal.NoDRUIDValues);
            const valuePayload: IPendingRbTxData = {};
            valuePayload[druidValue] = {
                senderAsset: 'Token',
                senderAmount: tokenAmount,
                senderAddress: senderKeypair.address,
                receiverAsset: 'Receipt',
                receiverAmount: 1,
                receiverAddress: paymentAddress,
                fromAddr: senderFromAddr,
                status: 'pending',
            };
            const sendBody = [
                generateIntercomSetBody<IPendingRbTxData>(
                    paymentAddress,
                    senderKeypair.address,
                    senderKeypair,
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
                                druid: druidValue,
                                encryptedTx: encryptedTx,
                            },
                        },
                    } as IClientResponse;
                })
                .catch(async (error) => {
                    if (error instanceof Error) throw new Error(error.message);
                    else throw new Error(`${error}`);
                });
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
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
            const rbDataForDruid = throwIfErr(getRbDataForDruid(druid, 'pending', pendingResponse));
            const txInfo = rbDataForDruid.data;
            // Get the key-pair assigned to this receiver address
            const receiverKeypair = keyPairMap.get(txInfo.receiverAddress);
            if (!receiverKeypair) throw new Error('Unable to retrieve key-pair from map');
            // Set the status of the pending request
            txInfo.status = status;
            if (status === 'accepted') {
                const sendRbTxHalf = throwIfErr(
                    CreateRbTxHalf(
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
                    ),
                );

                txInfo.fromAddr = throwIfErr(constructTxInsAddress(sendRbTxHalf.createTx.inputs));

                // Send transaction to compute if accepted
                const headers = this.getRequestIdAndNonceForRoute(IAPIRoute.CreateTransactions);
                await this.axiosClient
                    .post<INetworkResponse>(
                        IAPIRoute.CreateTransactions,
                        [sendRbTxHalf.createTx],
                        headers,
                    )
                    .then((response) => {
                        const responseData = response.data as INetworkResponse;
                        if (castAPIStatus(responseData.status) !== 'success')
                            throw new Error(responseData.reason);
                    })
                    .catch(async (error) => {
                        if (error instanceof Error) throw new Error(error.message);
                        else throw new Error(`${error}`);
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
                    if (error instanceof Error) throw new Error(error.message);
                    else throw new Error(`${error}`);
                });

            return {
                status: 'success',
                reason: 'Successfully responded to receipt-based payment',
            } as IClientResponse;
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
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
                    if (error instanceof Error) throw new Error(error.message);
                    else throw new Error(`${error}`);
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
                    const decryptedTransaction = throwIfErr(
                        this.keyMgmt.decryptTransaction(encryptedTx),
                    );
                    if (!decryptedTransaction.druid_info)
                        throw new Error(IErrorInternal.NoDRUIDValues);
                    // Set `TxIns` address value from receipient
                    decryptedTransaction.druid_info.expectations[0].from =
                        fromAddr; /* There should be only one expectation in a receipt-based payment */
                    transactionsToSend.push(decryptedTransaction);
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
                const headers = this.getRequestIdAndNonceForRoute(IAPIRoute.CreateTransactions);
                await this.axiosClient
                    .post<INetworkResponse>(
                        IAPIRoute.CreateTransactions,
                        transactionsToSend,
                        headers,
                    )
                    .then(async (response) => {
                        if (castAPIStatus(response.data.status) === 'error')
                            throw new Error(response.data.reason);
                    })
                    .catch(async (error) => {
                        if (error instanceof Error) throw new Error(error.message);
                        else throw new Error(`${error}`);
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
                        if (error instanceof Error) throw new Error(error.message);
                        else throw new Error(`${error}`);
                    });

            return {
                status: 'success',
                reason: 'Succesfully fetched pending receipt-based transactions',
                content: {
                    fetchPendingRbResponse: responseData,
                },
            } as IClientResponse;
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            } as IClientResponse;
        }
    }

    /**
     * Get information regarding the PoW required for all routes
     *
     * @private
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZenottaInstance
     */
    private async getDebugData(): Promise<IClientResponse> {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error(IErrorInternal.ClientNotInitialized);
            const headers = this.getRequestIdAndNonceForRoute(IAPIRoute.DebugData);
            return await this.axiosClient
                .get<INetworkResponse>(IAPIRoute.DebugData, headers)
                .then(async (response) => {
                    return {
                        status: castAPIStatus(response.data.status),
                        reason: response.data.reason,
                        content: {
                            debugDataResponse: response.data.content,
                        },
                    } as IClientResponse;
                })
                .catch(async (error) => {
                    if (error instanceof Error) throw new Error(error.message);
                    else throw new Error(`${error}`);
                });
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            } as IClientResponse;
        }
    }

    /**
     * Generate a unique request ID as well as the corresponding required
     * nonce for a route
     *
     * @private
     * @param {string} route
     * @return {*}  {{
     *         headers: {
     *             'x-request-id': string;
     *             'x-nonce': number;
     *         };
     *     }}
     * @memberof ZenottaInstance
     */
    private getRequestIdAndNonceForRoute(route: string): {
        headers: {
            'x-request-id': string;
            'x-nonce': number;
        };
    } {
        const routeDifficulty = this.routesPoW.get(route.slice(1)); // Slice removes the '/' prefix
        return createIdAndNonceHeaders(routeDifficulty);
    }

    /* -------------------------------------------------------------------------- */
    /*                                    Utils                                   */
    /* -------------------------------------------------------------------------- */

    /**
     * Regenerates the addresses for a newly imported wallet (from seed phrase)
     *
     * @param seedPhrase
     * @param {string[]} addressList
     * @param {number} [seedRegenThreshold=SEED_REGEN_THRES]
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZenottaInstance
     */
    async regenAddresses(
        seedPhrase: string,
        addressList: string[],
        seedRegenThreshold: number = SEED_REGEN_THRES,
    ): Promise<IClientResponse> {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error(IErrorInternal.ClientNotInitialized);
            const foundAddr = throwIfErr(
                this.keyMgmt.regenAddresses(seedPhrase, addressList, seedRegenThreshold),
            );
            if (foundAddr.length !== 0) {
                const encryptedKeypairs: IKeypairEncrypted[] = [];
                for (const addr of foundAddr) {
                    const encryptedKeypair = throwIfErr(this.keyMgmt.encryptKeypair(addr));
                    encryptedKeypairs.push(encryptedKeypair);
                }
                return {
                    status: 'success',
                    reason: 'Addresses have successfully been reconstructed',
                    content: {
                        regenWalletResponse: encryptedKeypairs,
                    },
                } as IClientResponse;
            } else throw new Error('Address reconstruction failed');
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
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
            return {
                status: 'success',
                reason: 'Successfully generated new address',
                content: {
                    newKeypairResponse: throwIfErr(this.keyMgmt.getNewKeypair(allAddresses)),
                },
            } as IClientResponse;
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
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
            return {
                status: 'success',
                reason: 'Successfully obtained seed phrase',
                content: {
                    getSeedPhraseResponse: throwIfErr(this.keyMgmt.getSeedPhrase()),
                },
            };
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
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
            return {
                status: 'success',
                reason: 'Successfully obtained master key',
                content: {
                    getMasterKeyResponse: throwIfErr(this.keyMgmt.getMasterKey()),
                },
            };
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            };
        }
    }
}
