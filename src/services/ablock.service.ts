import axios from 'axios';

import {
    IAPIRoute,
    IAssetItem,
    IAssetToken,
    IClientConfig,
    IClientResponse,
    ICreateTransaction,
    ICreateTransactionEncrypted,
    IDruidExpectation,
    IErrorInternal,
    IGenericKeyPair,
    IKeypairEncrypted,
    IMasterKeyEncrypted,
    INetworkResponse,
    IPendingIbTxDetails,
    IRequestIntercomDelBody,
    IRequestIntercomGetBody,
    IResponseIntercom,
    ISuccessInternal,
} from '../interfaces';
import {
    constructTxInsAddress,
    createPaymentTx,
    createIbTxHalf,
    createItemPayload,
    DEFAULT_HEADERS,
    RECEIPT_DEFAULT,
    SEED_REGEN_THRES,
} from '../mgmt';
import {
    castAPIStatus,
    createIdAndNonceHeaders,
    filterIntercomDataForPredicates,
    filterValidIntercomData,
    formatSingleCustomKeyValuePair,
    generateIntercomDelBody,
    generateIntercomGetBody,
    generateIntercomSetBody,
    initIAssetItem,
    initIAssetToken,
    throwIfErr,
    formatAssetStructures,
    transformCreateTxResponseFromNetwork,
} from '../utils';
import { mgmtClient } from './mgmt.service';
import { ADDRESS_VERSION } from '../mgmt/constants';

export class ABlockWallet {
    /* -------------------------------------------------------------------------- */
    /*                              Member Variables                              */
    /* -------------------------------------------------------------------------- */
    private mempoolHost: string | undefined;
    private storageHost: string | undefined;
    private intercomHost: string | undefined;
    private notaryHost: string | undefined;
    private keyMgmt: mgmtClient | undefined;
    private mempoolRoutesPoW: Map<string, number> | undefined;
    private storageRoutesPoW: Map<string, number> | undefined;

    /* -------------------------------------------------------------------------- */
    /*                                 Constructor                                */
    /* -------------------------------------------------------------------------- */
    constructor() {
        this.mempoolHost = undefined;
        this.storageHost = undefined;
        this.intercomHost = undefined;
        this.notaryHost = undefined;
        this.keyMgmt = undefined;
        this.mempoolRoutesPoW = undefined;
        this.storageRoutesPoW = undefined;
    }

    /**
     * Initialize a new instance of the client without providing a master key or seed phrase
     *
     * @param {IClientConfig} config - Additional configuration parameters
     * @param initOffline - Optionally initialize the client without initializing network settings
     * @return {*}  {IClientResponse}
     * @memberof ABlockWallet
     */
    public async initNew(config: IClientConfig, initOffline = false): Promise<IClientResponse> {
        this.keyMgmt = new mgmtClient();
        const initIResult = this.keyMgmt.initNew(config.passphrase);
        if (!initOffline) {
            const initNetworkIResult = await this.initNetwork(config);
            if (initNetworkIResult.status === 'error') {
                return initNetworkIResult; // Return network error
            }
        }
        if (initIResult.isErr()) {
            return {
                status: 'error',
                reason: initIResult.error, // Return initialization error
            } as IClientResponse;
        } else {
            return {
                status: 'success',
                reason: ISuccessInternal.ClientInitialized,
                content: {
                    initNewResponse: initIResult.value,
                },
            } as IClientResponse;
        }
    }

    /**
     * Initialize an instance of the client with a provided master key
     *
     * @param {IMasterKeyEncrypted} masterKey - Master key
     * @param {IClientConfig} config - Additional configuration parameters
     * @param initOffline - Optionally initialize the client without initializing network settings
     * @return {*}  {IClientResponse}
     * @memberof ABlockWallet
     */
    public async fromMasterKey(
        masterKey: IMasterKeyEncrypted,
        config: IClientConfig,
        initOffline = false,
    ): Promise<IClientResponse> {
        this.keyMgmt = new mgmtClient();
        const initIResult = this.keyMgmt.fromMasterKey(masterKey, config.passphrase);
        if (!initOffline) {
            const initNetworkIResult = await this.initNetwork(config);
            if (initNetworkIResult.status === 'error') {
                return initNetworkIResult; // Return network error
            }
        }

        if (initIResult.isErr()) {
            return {
                status: 'error',
                reason: initIResult.error, // Return initialization error
            } as IClientResponse;
        } else {
            return {
                status: 'success',
                reason: ISuccessInternal.ClientInitialized,
            } as IClientResponse;
        }
    }

    /**
     * Initialize an instance of the wallet with a provided seed phrase
     *
     * @param {string} seedPhrase - Seed phrase
     * @param {IClientConfig} config - Additional configuration parameters
     * @param initOffline - Optionally initialize the client without initializing network settings
     * @return {*}  {IClientResponse}
     * @memberof ABlockWallet
     */
    public async fromSeed(
        seedPhrase: string,
        config: IClientConfig,
        initOffline = false,
    ): Promise<IClientResponse> {
        this.keyMgmt = new mgmtClient();
        const initIResult = this.keyMgmt.fromSeed(seedPhrase, config.passphrase);
        if (!initOffline) {
            const initNetworkIResult = await this.initNetwork(config);
            if (initNetworkIResult.status === 'error') {
                return initNetworkIResult; // Return network error
            }
        }
        if (initIResult.isErr()) {
            return {
                status: 'error',
                reason: initIResult.error, // Return initialization error
            } as IClientResponse;
        } else {
            return {
                status: 'success',
                reason: ISuccessInternal.ClientInitialized,
                content: {
                    fromSeedResponse: initIResult.value,
                },
            } as IClientResponse;
        }
    }

    /**
     * Common network initialization (retrieval of PoW list for compute and storage)
     *
     * @param {IClientConfig} config - Configuration parameters
     * @return {*}  {IClientResponse}
     * @memberof ABlockWallet
     */
    public async initNetwork(config: IClientConfig): Promise<IClientResponse> {
        this.mempoolHost = config.mempoolHost;
        this.storageHost = config.storageHost;
        this.intercomHost = config.intercomHost;
        this.notaryHost = config.notaryHost;

        if (this.mempoolHost == undefined)
            return {
                status: 'error',
                reason: IErrorInternal.NoComputeHostProvided,
            } as IClientResponse;

        // Initialize routes proof-of-work for compute host
        this.mempoolRoutesPoW = new Map();
        const initComputeResult = await this.initNetworkForHost(
            this.mempoolHost,
            this.mempoolRoutesPoW,
        );
        if (initComputeResult.status == 'error') return initComputeResult;

        // Optional - Initialize routes proof-of-work for storage host
        if (this.storageHost !== undefined) {
            this.storageRoutesPoW = new Map();
            const initStorageResult = await this.initNetworkForHost(
                this.storageHost,
                this.storageRoutesPoW,
            );
            if (initStorageResult.status == 'error') return initStorageResult;
        }

        if (
            this.mempoolHost === undefined &&
            this.storageHost === undefined &&
            this.intercomHost === undefined &&
            this.notaryHost === undefined
        )
            return {
                status: 'error',
                reason: IErrorInternal.NoHostsProvided,
            } as IClientResponse;

        return {
            status: 'success',
        } as IClientResponse;
    }

    /**
     * Common network initialization (retrieval of PoW list)
     *
     * @private
     * @param {IClientConfig} config - Additional configuration parameters
     * @return {*}  {IClientResponse}
     * @memberof ABlockWallet
     */
    private async initNetworkForHost(
        host: string,
        routesPow: Map<string, number>,
    ): Promise<IClientResponse> {
        // Set routes proof-of-work requirements
        const debugData = await this.getDebugData(host);
        if (debugData.status === 'error')
            return {
                status: 'error',
                reason: debugData.reason,
            } as IClientResponse;
        else if (debugData.status === 'success' && debugData.content?.debugDataResponse)
            for (const route in debugData.content.debugDataResponse.routes_pow) {
                routesPow.set(route, debugData.content.debugDataResponse.routes_pow[route]);
            }
        return {
            status: 'success',
        } as IClientResponse;
    }

    /**
     * @deprecated due to instability.
     *
     * Get all the addresses present on the ABlock network UTXO set
     *
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ABlockWallet
     */
    public async getUtxoAddressList(): Promise<IClientResponse> {
        try {
            if (!this.mempoolHost || !this.keyMgmt || !this.mempoolRoutesPoW)
                throw new Error(IErrorInternal.ClientNotInitialized);
            const headers = this.getRequestIdAndNonceHeadersForRoute(
                this.mempoolRoutesPoW,
                IAPIRoute.GetUtxoAddressList,
            );
            return await axios
                .get<INetworkResponse>(`${this.mempoolHost}${IAPIRoute.GetUtxoAddressList}`, {
                    ...headers,
                    validateStatus: () => true,
                })
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
     * @param {string[]} addressList - A list of public addresses
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ABlockWallet
     */
    async fetchBalance(addressList: string[]): Promise<IClientResponse> {
        try {
            if (!this.mempoolHost || !this.keyMgmt || !this.mempoolRoutesPoW)
                throw new Error(IErrorInternal.ClientNotInitialized);
            const fetchBalanceBody = {
                address_list: addressList,
            };
            const headers = this.getRequestIdAndNonceHeadersForRoute(
                this.mempoolRoutesPoW,
                IAPIRoute.FetchBalance,
            );

            return await axios
                .post<INetworkResponse>(
                    `${this.mempoolHost}${IAPIRoute.FetchBalance}`,
                    fetchBalanceBody,
                    { ...headers, validateStatus: () => true },
                )
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
     * Fetch transactions from the storage host
     *
     * @param {string[]} transactionHashes - An array of transaction hashes
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ABlockWallet
     */
    public async fetchTransactions(transactionHashes: string[]): Promise<IClientResponse> {
        try {
            if (!this.keyMgmt) throw new Error(IErrorInternal.ClientNotInitialized);
            if (!this.storageHost || !this.storageRoutesPoW)
                /* Storage is optional on wallet init, but must be initialized here */
                throw new Error(IErrorInternal.StorageNotInitialized);
            const headers = this.getRequestIdAndNonceHeadersForRoute(
                this.mempoolRoutesPoW,
                IAPIRoute.FetchBalance,
            );
            return await axios
                .post<INetworkResponse>(
                    `${this.storageHost}${IAPIRoute.Transactions}`,
                    transactionHashes,
                    { ...headers, validateStatus: () => true },
                )
                .then((response) => {
                    return {
                        status: castAPIStatus(response.data.status),
                        reason: response.data.reason,
                        content: {
                            fetchTransactionsResponse: response.data.content,
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
     * Fetch pending DDE transaction from the mempool node
     *
     * @deprecated due to security concerns.
     *
     * @param {string[]} druids - A list of DRUID values
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ABlockWallet
     */
    public async fetchPendingDDETransactions(druids: string[]): Promise<IClientResponse> {
        try {
            if (!this.mempoolHost || !this.keyMgmt || !this.mempoolRoutesPoW)
                throw new Error(IErrorInternal.ClientNotInitialized);
            const fetchPendingBody = {
                druid_list: druids,
            };
            const headers = this.getRequestIdAndNonceHeadersForRoute(
                this.mempoolRoutesPoW,
                IAPIRoute.FetchPending,
            );
            return await axios
                .post<INetworkResponse>(
                    `${this.mempoolHost}${IAPIRoute.FetchPending}`,
                    fetchPendingBody,
                    { ...headers, validateStatus: () => true },
                )
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
     *  Create item-assets for a provided address/key-pair
     *
     * @param {IKeypairEncrypted} address - Key-pair to use for the creation of the item-assets
     * @param {boolean} [defaultDrsTxHash=true] - Whether to create `Item` assets that contain the default DRS identifier
     * @param {number} [amount=RECEIPT_DEFAULT] - The amount of `Item` assets to create
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ABlockWallet
     */
    public async createItems(
        address: IKeypairEncrypted,
        defaultDrsTxHash = true,
        amount: number = RECEIPT_DEFAULT,
        metadata: string | null = null,
    ): Promise<IClientResponse> {
        try {
            if (!this.mempoolHost || !this.keyMgmt || !this.mempoolRoutesPoW)
                throw new Error(IErrorInternal.ClientNotInitialized);
            const keyPair = throwIfErr(this.keyMgmt.decryptKeypair(address));
            // Create item-creation transaction
            const createItemBody = throwIfErr(
                createItemPayload(
                    keyPair.secretKey,
                    keyPair.publicKey,
                    keyPair.version,
                    amount,
                    defaultDrsTxHash,
                    metadata,
                ),
            );

            // Generate needed headers
            const headers = this.getRequestIdAndNonceHeadersForRoute(
                this.mempoolRoutesPoW,
                IAPIRoute.CreateItemAsset,
            );

            return await axios
                .post<INetworkResponse>(
                    `${this.mempoolHost}${IAPIRoute.CreateItemAsset}`,
                    createItemBody,
                    { ...headers, validateStatus: () => true },
                )
                .then((response) => {
                    return {
                        status: castAPIStatus(response.data.status),
                        reason: response.data.reason,
                        content: {
                            createItemResponse: response.data.content,
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
     * Get the notary service's burn address
     *
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ABlockWallet
     */
    async getNotaryBurnAddress(): Promise<IClientResponse> {
        try {
            if (!this.keyMgmt) throw new Error(IErrorInternal.ClientNotInitialized);
            if (!this.notaryHost) throw new Error(IErrorInternal.NotaryNotInitialized);
            const headers = this.getRequestIdAndNonceHeadersForRoute(
                new Map(),
                IAPIRoute.GetNotaryBurnAddress,
            );
            return await axios
                .get<INetworkResponse>(`${this.notaryHost}${IAPIRoute.GetNotaryBurnAddress}`, {
                    ...headers,
                    validateStatus: () => true,
                })
                .then((response) => {
                    return {
                        status: castAPIStatus(response.data.status),
                        reason: response.data.reason,
                        content: response.data.content,
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
     * Get the required signature from the notary to mint new Erc20 tokens
     *
     * @param {string} ethAddress - Ethereum address to mint tokens to
     * @param {string} txHash - Transaction hash of the "burn" transaction
     * @param {IGenericKeyPair<string>} signatures
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ABlockWallet
     */
    async getNotarySignature(
        ethAddress: string,
        txHash: string,
        signatures: IGenericKeyPair<string>,
    ): Promise<IClientResponse> {
        try {
            if (!this.keyMgmt) throw new Error(IErrorInternal.ClientNotInitialized);
            if (!this.notaryHost) throw new Error(IErrorInternal.NotaryNotInitialized);
            const headers = this.getRequestIdAndNonceHeadersForRoute(
                new Map(),
                IAPIRoute.GetNotarySignature,
            );
            const body = {
                ethAddress,
                txHash,
                signatures,
            };
            return await axios
                .post<INetworkResponse>(`${this.notaryHost}${IAPIRoute.GetNotarySignature}`, body, {
                    ...headers,
                    validateStatus: () => true,
                })
                .then((response) => {
                    return {
                        status: castAPIStatus(response.data.status),
                        reason: response.data.reason,
                        content: response.data.content,
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
     * Sign a given message with an array of key-pairs
     *
     * @param {IKeypairEncrypted[]} keyPairsToSignWith - Key-pairs to use in the signing process
     * @param {string} message - The message to sign
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ABlockWallet
     */
    signMessage(keyPairsToSignWith: IKeypairEncrypted[], message: string): IClientResponse {
        try {
            if (this.keyMgmt === undefined) throw new Error(IErrorInternal.ClientNotInitialized);
            const keyPairs = throwIfErr(this.keyMgmt.decryptKeypairs(keyPairsToSignWith));
            const signatures = throwIfErr(this.keyMgmt.signMessage(keyPairs, message));
            return {
                status: 'success',
                reason: ISuccessInternal.MessageSigned,
                content: {
                    signMessageResponse: signatures,
                },
            } as IClientResponse;
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            } as IClientResponse;
        }
    }

    verifyMessage(
        message: string,
        signatures: IGenericKeyPair<string>,
        keyPairs: IKeypairEncrypted[],
    ): IClientResponse {
        try {
            if (this.keyMgmt === undefined) throw new Error(IErrorInternal.ClientNotInitialized);
            const keyPairsUnencrypted = throwIfErr(this.keyMgmt.decryptKeypairs(keyPairs));
            throwIfErr(this.keyMgmt.verifyMessage(message, signatures, keyPairsUnencrypted));
            return {
                status: 'success',
                reason: ISuccessInternal.MessageVirified,
            } as IClientResponse;
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
     * @param {string} paymentAddress - Address to make the payment to
     * @param {number} paymentAmount - The amount of `Token` assets to pay
     * @param {IKeypairEncrypted[]} allKeypairs - A list of all existing key-pairs (encrypted)
     * @param {IKeypairEncrypted} excessKeypair - A key-pair provided to assign excess `Token` assets to (encrypted)
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ABlockWallet
     */
    async makeTokenPayment(
        paymentAddress: string,
        paymentAmount: number,
        allKeypairs: IKeypairEncrypted[],
        excessKeypair: IKeypairEncrypted,
    ): Promise<IClientResponse> {
        const paymentAsset = initIAssetToken({ Token: paymentAmount });
        return this.makePayment(paymentAddress, paymentAsset, allKeypairs, excessKeypair);
    }

    /**
     * Make a `Item` payment of a specified amount and `drs_tx_hash`
     *
     * @param {string} paymentAddress - Address to make the payment to
     * @param {number} paymentAmount - Payment amount
     * @param {string} drsTxHash - DRS transaction hash
     * @param {IKeypairEncrypted[]} allKeypairs - A list of all existing key-pairs (encrypted)
     * @param {IKeypairEncrypted} excessKeypair - Key-pair (encrypted) to assign excess funds to
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ABlockWallet
     */
    async makeItemPayment(
        paymentAddress: string,
        paymentAmount: number,
        drsTxHash: string,
        allKeypairs: IKeypairEncrypted[],
        excessKeypair: IKeypairEncrypted,
        metadata: string | null = null,
    ): Promise<IClientResponse> {
        const paymentAsset = initIAssetItem({
            Item: { amount: paymentAmount, drs_tx_hash: drsTxHash, metadata },
        });
        return this.makePayment(paymentAddress, paymentAsset, allKeypairs, excessKeypair);
    }

    /**
     * Make a item-based payment to a specified address
     *
     * @param {string} paymentAddress - Address to make the payment to
     * @param {(IAssetItem | IAssetToken)} sendingAsset - The asset to pay
     * @param {(IAssetItem | IAssetToken)} receivingAsset - The asset to receive
     * @param {IKeypairEncrypted[]} allKeypairs - A list of all existing key-pairs (encrypted)
     * @param {IKeypairEncrypted} receiveAddress - A key-pair to assign the "receiving" asset to
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ABlockWallet
     */
    public async make2WayPayment(
        paymentAddress: string,
        sendingAsset: IAssetItem | IAssetToken,
        receivingAsset: IAssetItem | IAssetToken,
        allKeypairs: IKeypairEncrypted[],
        receiveAddress: IKeypairEncrypted,
    ): Promise<IClientResponse> {
        try {
            if (!this.mempoolHost || !this.keyMgmt || !this.mempoolRoutesPoW)
                throw new Error(IErrorInternal.ClientNotInitialized);
            if (!this.intercomHost) throw new Error(IErrorInternal.IntercomNotInitialized);
            const senderKeypair = throwIfErr(this.keyMgmt.decryptKeypair(receiveAddress));
            const [allAddresses, keyPairMap] = throwIfErr(
                this.keyMgmt.getAllAddressesAndKeypairMap(allKeypairs),
            );

            // Update balance
            const balance = await this.fetchBalance(allAddresses);
            if (balance.status !== 'success' || !balance.content?.fetchBalanceResponse)
                throw new Error(balance.reason);

            if (allAddresses.length === 0) throw new Error(IErrorInternal.NoKeypairsProvided);

            // Generate a DRUID value for this transaction
            const druid = throwIfErr(this.keyMgmt.getNewDRUID());

            const senderExpectation: IDruidExpectation = {
                from: '', // This field needs to be calculated by the other party and populated by us upon acceptance
                to: senderKeypair.address,
                asset: receivingAsset,
            };

            const receiverExpectation: IDruidExpectation = {
                from: '', // This is calculated by us after the transaction is created and then sent to the intercom server
                to: paymentAddress,
                asset: sendingAsset,
            };

            // Create "sender" half transaction with some missing data in DruidExpectations objects (`from`)
            const sendIbTxHalf = throwIfErr(
                createIbTxHalf(
                    balance.content.fetchBalanceResponse,
                    druid,
                    senderExpectation,
                    receiverExpectation,
                    senderKeypair.address,
                    keyPairMap,
                ),
            );

            // Create transaction struct has successfully been created
            // now we encrypt the created transaction for storage
            const encryptedTx = throwIfErr(this.keyMgmt.encryptTransaction(sendIbTxHalf.createTx));

            // Create "sender" details and expectations for intercom server
            receiverExpectation.from = throwIfErr(
                constructTxInsAddress(sendIbTxHalf.createTx.inputs),
            );
            if (sendIbTxHalf.createTx.druid_info === null)
                throw new Error(IErrorInternal.NoDRUIDValues);

            // Generate the values to be placed on the intercom server for the receiving party
            const valuePayload: IPendingIbTxDetails = {
                druid,
                senderExpectation,
                receiverExpectation,
                status: 'pending', // Status of the DDE transaction
                mempoolHost: this.mempoolHost,
            };
            const sendBody = [
                generateIntercomSetBody(
                    paymentAddress,
                    senderKeypair.address,
                    senderKeypair,
                    valuePayload,
                ),
            ];

            // Send the transaction details to the intercom server for the receiving party to inspect
            return await axios
                .post(`${this.intercomHost}${IAPIRoute.IntercomSet}`, sendBody)
                .then(() => {
                    // Payment now getting processed
                    return {
                        status: 'success',
                        reason: ISuccessInternal.IbPaymentProcessing,
                        content: {
                            make2WayPaymentResponse: {
                                druid,
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
     * Accept a item-based payment
     *
     * @param {string} druid - Unique DRUID value associated with a item-based payment
     * @param {IResponseIntercom<IPendingIbTxDetails>} pendingResponse - 2-Way transaction(s) information as received from the intercom server
     * @param {IKeypairEncrypted[]} allKeypairs - A list of all existing key-pairs (encrypted)
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ABlockWallet
     */
    public async accept2WayPayment(
        druid: string,
        pendingResponse: IResponseIntercom<IPendingIbTxDetails>,
        allKeypairs: IKeypairEncrypted[],
    ): Promise<IClientResponse> {
        return this.handleIbTxResponse(druid, pendingResponse, 'accepted', allKeypairs);
    }

    /**
     * Reject a item-based payment
     *
     * @param {string} druid - Unique DRUID value associated with a item-based payment
     * @param {IResponseIntercom<IPendingIbTxDetails>} pendingResponse - 2-Way transaction(s) information as received from the intercom server
     * @param {IKeypairEncrypted[]} allKeypairs - A list of all existing key-pairs (encrypted)
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ABlockWallet
     */

    public async reject2WayPayment(
        druid: string,
        pendingResponse: IResponseIntercom<IPendingIbTxDetails>,
        allKeypairs: IKeypairEncrypted[],
    ): Promise<IClientResponse> {
        return this.handleIbTxResponse(druid, pendingResponse, 'rejected', allKeypairs);
    }

    /**
     * Fetch pending item-based payments from the ABlock Intercom server
     *
     * @param {IKeypairEncrypted[]} allKeypairs - A list of all existing key-pairs (encrypted)
     * @param {ICreateTransactionEncrypted[]} allEncryptedTxs - A list of all existing saved transactions (encrypted)
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ABlockWallet
     */
    public async fetchPending2WayPayments(
        allKeypairs: IKeypairEncrypted[],
        allEncryptedTxs: ICreateTransactionEncrypted[],
    ): Promise<IClientResponse> {
        try {
            if (!this.mempoolHost || !this.keyMgmt || !this.mempoolRoutesPoW)
                throw new Error(IErrorInternal.ClientNotInitialized);
            if (!this.intercomHost) throw new Error(IErrorInternal.IntercomNotInitialized);

            // Generate a key-pair map
            const [allAddresses, keyPairMap] = throwIfErr(
                this.keyMgmt.getAllAddressesAndKeypairMap(allKeypairs),
            );

            // DRUID - Encrypted Transaction Mapping
            const encryptedTxMap = new Map<string, ICreateTransactionEncrypted>();
            allEncryptedTxs.forEach((tx) => encryptedTxMap.set(tx.druid, tx));

            const pendingIntercom: IRequestIntercomGetBody[] = allAddresses
                .map((address) => {
                    if (!this.keyMgmt) return null;
                    const keyPair = keyPairMap.get(address);
                    if (!keyPair) return null;
                    return generateIntercomGetBody(address, keyPair);
                })
                .filter((input): input is IRequestIntercomGetBody => !!input); /* Filter array */

            // Get all pending RB transactions
            let responseData = await axios
                .post<IResponseIntercom<IPendingIbTxDetails>>(
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

            // NB: Validate item-based data and remove garbage entries
            responseData = filterValidIntercomData(responseData);

            // Get accepted and rejected item-based transactions
            const rbDataToDelete: IRequestIntercomDelBody[] = [];
            const [acceptedIbTxs, rejectedIbTxs] = [
                throwIfErr(
                    filterIntercomDataForPredicates(responseData, { status: 'accepted' }, true),
                ),
                throwIfErr(
                    filterIntercomDataForPredicates(responseData, { status: 'rejected' }, true),
                ),
            ];

            // We have accepted item-based payments to send to mempool
            if (Object.entries(acceptedIbTxs).length > 0) {
                const transactionsToSend: ICreateTransaction[] = [];
                for (const acceptedTx of Object.values(acceptedIbTxs)) {
                    // Decrypt transaction stored along with DRUID value
                    const encryptedTx = encryptedTxMap.get(acceptedTx.value.druid);
                    if (!encryptedTx) throw new Error(IErrorInternal.InvalidDRUIDProvided);
                    const decryptedTransaction = throwIfErr(
                        this.keyMgmt.decryptTransaction(encryptedTx),
                    );

                    // Ensure this transaction is actually a DDE transaction
                    if (!decryptedTransaction.druid_info)
                        throw new Error(IErrorInternal.NoDRUIDValues);

                    // Set `from` address value from recipient by setting the entire expectation to the one received from the intercom server
                    decryptedTransaction.druid_info.expectations[0] =
                        acceptedTx.value.senderExpectation; /* There should be only one expectation in a item-based payment */

                    // Add to list of transactions to send to mempool node
                    transactionsToSend.push(decryptedTransaction);
                    const keyPair = keyPairMap.get(acceptedTx.value.senderExpectation.to);
                    if (!keyPair) throw new Error(IErrorInternal.UnableToGetKeypair);

                    rbDataToDelete.push(
                        generateIntercomDelBody(
                            acceptedTx.value.senderExpectation.to,
                            acceptedTx.value.receiverExpectation.to,
                            keyPair,
                        ),
                    );
                }

                // Generate the required headers
                const headers = this.getRequestIdAndNonceHeadersForRoute(
                    this.mempoolRoutesPoW,
                    IAPIRoute.CreateTransactions,
                );

                // Send transactions to mempool for processing
                await axios
                    .post<INetworkResponse>(
                        // NB: Make sure we use the same mempool host when initializing all item-based payments
                        `${this.mempoolHost}${IAPIRoute.CreateTransactions}`,
                        transactionsToSend,
                        { ...headers, validateStatus: () => true },
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

            // Add rejected item-based transactions to delete list as well
            if (Object.entries(rejectedIbTxs).length > 0) {
                for (const rejectedTx of Object.values(rejectedIbTxs)) {
                    const keyPair = keyPairMap.get(rejectedTx.value.senderExpectation.to);
                    if (!keyPair) throw new Error(IErrorInternal.UnableToGetKeypair);

                    rbDataToDelete.push(
                        generateIntercomDelBody(
                            rejectedTx.value.senderExpectation.to,
                            rejectedTx.value.receiverExpectation.to,
                            keyPair,
                        ),
                    );
                }
            }

            // Delete item-based data from intercom since the information is no longer relevant (accepted and rejected txs)
            if (rbDataToDelete.length > 0)
                await axios
                    .post(`${this.intercomHost}${IAPIRoute.IntercomDel}`, rbDataToDelete)
                    .catch(async (error) => {
                        if (error instanceof Error) throw new Error(error.message);
                        else throw new Error(`${error}`);
                    });

            return {
                status: 'success',
                reason: ISuccessInternal.PendingIbPaymentsFetched,
                content: {
                    fetchPendingIbResponse: responseData,
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
     * Regenerates the addresses for a newly imported wallet (from seed phrase)
     *
     * @param seedPhrase
     * @param {string[]} addressList - A list of addresses to regenerate
     * @param {number} [seedRegenThreshold=SEED_REGEN_THRES] - Regeneration threshold
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ABlockWallet
     */
    async regenAddresses(
        seedPhrase: string,
        addressList: string[],
        seedRegenThreshold: number = SEED_REGEN_THRES,
    ): Promise<IClientResponse> {
        try {
            if (!this.keyMgmt) throw new Error(IErrorInternal.ClientNotInitialized);
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
                    reason: ISuccessInternal.AddressesReconstructed,
                    content: {
                        regenWalletResponse: encryptedKeypairs,
                    },
                } as IClientResponse;
            } else throw new Error(IErrorInternal.UnableToFindNonEmptyAddresses);
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            } as IClientResponse;
        }
    }

    /**
     * Generates a new key-pair
     *
     * @param {string[]} allAddresses - A list of all public addresses (used to avoid re-generating the same key-pair)
     * @return {*}  {IClientResponse}
     * @memberof ABlockWallet
     */
    getNewKeypair(
        allAddresses: string[],
        addressVersion: null | number = ADDRESS_VERSION,
    ): IClientResponse {
        try {
            if (!this.keyMgmt) throw new Error(IErrorInternal.ClientNotInitialized);
            return {
                status: 'success',
                reason: ISuccessInternal.NewAddressGenerated,
                content: {
                    newKeypairResponse: throwIfErr(
                        this.keyMgmt.getNewKeypair(allAddresses, addressVersion),
                    ),
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
     * @memberof ABlockWallet
     */
    getSeedPhrase(): IClientResponse {
        try {
            if (!this.keyMgmt) throw new Error(IErrorInternal.ClientNotInitialized);
            return {
                status: 'success',
                reason: ISuccessInternal.SeedPhraseObtained,
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
     * @memberof ABlockWallet
     */
    getMasterKey(): IClientResponse {
        try {
            if (!this.keyMgmt) throw new Error(IErrorInternal.ClientNotInitialized);
            return {
                status: 'success',
                reason: ISuccessInternal.MasterKeyObtained,
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

    /**
     * Decrypt an encrypted key-pair
     *
     * @param {IKeypairEncrypted} encryptedKeypair - Encrypted key-pair to decrypt
     * @return {*}  {IClientResponse}
     * @memberof ABlockWallet
     */
    decryptKeypair(encryptedKeypair: IKeypairEncrypted): IClientResponse {
        try {
            if (!this.keyMgmt) throw new Error(IErrorInternal.ClientNotInitialized);
            return {
                status: 'success',
                reason: ISuccessInternal.KeypairDecrypted,
                content: {
                    decryptKeypairResponse: throwIfErr(
                        this.keyMgmt.decryptKeypair(encryptedKeypair),
                    ),
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
     * Save keypairs to localStorage. (Browser)
     * It is recommended to use user defined methods for I/O operations (see https://github.com/ABlockOfficial/A-Block.js#getting-started)
     *
     * @param {IKeypairEncrypted} encryptedKeypair - Encrypted key-pair to save
     * @return {*} {void}
     */
    saveKeypairs(encryptedKeypair: IKeypairEncrypted[]): IClientResponse {
        try {
            if (!this.keyMgmt) throw new Error(IErrorInternal.ClientNotInitialized);
            throwIfErr(this.keyMgmt.saveKeypairs(encryptedKeypair));
            return {
                status: 'success',
                reason: ISuccessInternal.KeypairSaved,
            };
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            };
        }
    }

    /**
     * Get keypairs from localStorage. (Browser)
     * It is recommended to use user defined methods for I/O operations (see https://github.com/ABlockOfficial/A-Block.js#getting-started)
     *
     * @export
     * @param {string} keypairs IKeypairEncrypted[] flattened to a string
     * @return {*} {void}
     */
    getKeypairs(): IClientResponse {
        try {
            if (!this.keyMgmt) throw new Error(IErrorInternal.ClientNotInitialized);
            return {
                status: 'success',
                reason: ISuccessInternal.KeypairObtained,
                content: {
                    getKeypairsResponse: throwIfErr(this.keyMgmt.getKeypairs()),
                },
            };
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            };
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                                    Utils                                   */

    /* -------------------------------------------------------------------------- */

    /**
     * Make a payment of a certain asset to a specified destination
     *
     * @private
     * @param {string} paymentAddress - Address to make the payment to
     * @param {(IAssetToken | IAssetItem)} paymentAsset - The asset to send
     * @param {IKeypairEncrypted[]} allKeypairs - A list of all existing key-pairs (encrypted)
     * @param {IKeypairEncrypted} excessKeypair - A key-pair (encrypted) to assign excess funds to
     * @return {*}
     * @memberof ABlockWallet
     */
    private async makePayment(
        paymentAddress: string,
        paymentAsset: IAssetToken | IAssetItem,
        allKeypairs: IKeypairEncrypted[],
        excessKeypair: IKeypairEncrypted,
    ) {
        try {
            if (!this.mempoolHost || !this.keyMgmt || !this.mempoolRoutesPoW)
                throw new Error(IErrorInternal.ClientNotInitialized);
            const [allAddresses, keyPairMap] = throwIfErr(
                this.keyMgmt.getAllAddressesAndKeypairMap(allKeypairs),
            );

            // First update balance
            const balance = await this.fetchBalance(allAddresses);
            if (balance.status !== 'success' || !balance.content?.fetchBalanceResponse)
                throw new Error(balance.reason);

            // Get all existing addresses
            if (allKeypairs.length === 0) throw new Error(IErrorInternal.NoKeypairsProvided);

            // Create transaction
            const paymentBody = throwIfErr(
                createPaymentTx(
                    paymentAddress,
                    paymentAsset,
                    excessKeypair.address,
                    balance.content.fetchBalanceResponse,
                    keyPairMap,
                ),
            );

            const { usedAddresses } = paymentBody;

            // Generate the needed headers
            const headers = this.getRequestIdAndNonceHeadersForRoute(
                this.mempoolRoutesPoW,
                IAPIRoute.CreateTransactions,
            );

            // Send transaction to mempool for processing
            return await axios
                .post<INetworkResponse>(
                    `${this.mempoolHost}${IAPIRoute.CreateTransactions}`,
                    [paymentBody.createTx],
                    { ...headers, validateStatus: () => true },
                )
                .then((response) => {
                    return {
                        status: castAPIStatus(response.data.status),
                        reason: response.data.reason,
                        content: {
                            makePaymentResponse: throwIfErr(
                                transformCreateTxResponseFromNetwork(
                                    usedAddresses,
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    response.data.content as any,
                                ),
                            ),
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
     * Handle a item-based payment by either accepting or rejecting the payment
     *
     * @private
     * @param {string} druid - Unique DRUID value associated with this payment
     * @param {IResponseIntercom<IPendingIbTxDetails>} pendingResponse - Pending item-based payments response as received from the intercom server
     * @param {('accepted' | 'rejected')} status - Status to se the payment to
     * @param {IKeypairEncrypted[]} allKeypairs - A list of all existing key-pairs (encrypted)
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ABlockWallet
     */
    private async handleIbTxResponse(
        druid: string,
        pendingResponse: IResponseIntercom<IPendingIbTxDetails>,
        status: 'accepted' | 'rejected',
        allKeypairs: IKeypairEncrypted[],
    ): Promise<IClientResponse> {
        try {
            if (!this.mempoolHost || !this.keyMgmt || !this.mempoolRoutesPoW)
                throw new Error(IErrorInternal.ClientNotInitialized);
            if (!this.intercomHost) throw new Error(IErrorInternal.IntercomNotInitialized);
            const [allAddresses, keyPairMap] = throwIfErr(
                this.keyMgmt.getAllAddressesAndKeypairMap(allKeypairs),
            );

            // Update balance
            const balance = await this.fetchBalance(allAddresses);
            if (balance.status !== 'success' || !balance.content?.fetchBalanceResponse)
                throw new Error(balance.reason);

            // Find specified DRUID value and entry that is still marked as 'pending'
            const rbDataForDruid = throwIfErr(
                filterIntercomDataForPredicates<IPendingIbTxDetails>(pendingResponse, {
                    druid: druid /* Filter for specific DRUID value */,
                    status: 'pending' /* Filter for status which is still 'pending' */,
                }),
            );

            // We assume that the filtered data should contain a single key-value pair since DRUID values are unique
            const rawTxInfo = throwIfErr(formatSingleCustomKeyValuePair(rbDataForDruid)).value.value;
            const txInfo = throwIfErr(formatAssetStructures(rawTxInfo));

            // Get the key-pair assigned to this receiver address
            const receiverKeypair = keyPairMap.get(txInfo.receiverExpectation.to);
            if (!receiverKeypair) throw new Error(IErrorInternal.UnableToGetKeypair);

            // Set the status of the pending request
            txInfo.status = status;

            // Handle case for 'accepted'; create and send transaction to mempool node
            if (status === 'accepted') {
                const sendIbTxHalf = throwIfErr(
                    // Sender expectation and receiver expectation context is switched
                    // in comparison to `make2WayPayment` since we are the receiving party
                    createIbTxHalf(
                        balance.content.fetchBalanceResponse,
                        druid,
                        txInfo.receiverExpectation, // What we expect from the other party
                        txInfo.senderExpectation, // What the other party can expect from us
                        receiverKeypair.address,
                        keyPairMap,
                    ),
                );

                // Construct our 'from` address using our transaction inputs
                txInfo.senderExpectation.from = throwIfErr(
                    constructTxInsAddress(sendIbTxHalf.createTx.inputs),
                );

                // Generate the required headers
                const headers = this.getRequestIdAndNonceHeadersForRoute(
                    this.mempoolRoutesPoW,
                    IAPIRoute.CreateTransactions,
                );

                // Send transaction to mempool to be added to the current DRUID pool
                await axios
                    .post<INetworkResponse>(
                        // We send this transaction to the mempool node specified by the sending party
                        `${txInfo.mempoolHost}${IAPIRoute.CreateTransactions}`,
                        [sendIbTxHalf.createTx],
                        { ...headers, validateStatus: () => true },
                    )
                    .then((response) => {
                        if (castAPIStatus(response.data.status) !== 'success')
                            throw new Error(response.data.reason);
                    })
                    .catch(async (error) => {
                        if (error instanceof Error) throw new Error(error.message);
                        else throw new Error(`${error}`);
                    });
            }

            // Send the updated status of the transaction on the intercom server
            const setBody = [
                generateIntercomSetBody<IPendingIbTxDetails>(
                    txInfo.senderExpectation.to,
                    txInfo.receiverExpectation.to,
                    receiverKeypair,
                    txInfo,
                ),
            ];

            // Update the transaction details on the intercom server
            await axios
                .post(`${this.intercomHost}${IAPIRoute.IntercomSet}`, setBody)
                .catch(async (error) => {
                    if (error instanceof Error) throw new Error(error.message);
                    else throw new Error(`${error}`);
                });

            return {
                status: 'success',
                reason: ISuccessInternal.RespondedToIbPayment,
            } as IClientResponse;
        } catch (error) {
            return {
                status: 'error',
                reason: `${error}`,
            };
        }
    }

    /**
     * Get information regarding the PoW required for all routes
     *
     * @private
     * @param {(string)} host - Host address to retrieve proof-of-work data from
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ABlockWallet
     */
    private async getDebugData(host: string): Promise<IClientResponse> {
        try {
            const routesPow =
                host === this.mempoolHost ? this.mempoolRoutesPoW : this.storageRoutesPoW;
            const headers = this.getRequestIdAndNonceHeadersForRoute(
                routesPow,
                IAPIRoute.DebugData,
            );
            return await axios
                .get<INetworkResponse>(`${host}${IAPIRoute.DebugData}`, {
                    ...headers,
                    validateStatus: () => true,
                })
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
     * Generate a unique request ID as well as the corresponding
     * nonce required for a route
     *
     * @private
     * @param {string} route
     * @return {*}  {{
     *         headers: {
     *             'x-cache-id': string;
     *             'x-nonce': number;
     *         };
     *     }}
     * @memberof ABlockWallet
     */
    private getRequestIdAndNonceHeadersForRoute(
        routesPow: Map<string, number> | undefined,
        route: string,
    ): {
        headers: {
            'x-cache-id': string;
            'x-nonce': number;
        };
    } {
        if (!routesPow) throw new Error(IErrorInternal.ClientNotInitialized);
        const routeDifficulty = routesPow.get(route.slice(1)); // Slice removes the '/' prefix: ;
        return {
            headers: {
                ...DEFAULT_HEADERS.headers,
                ...createIdAndNonceHeaders(routeDifficulty).headers,
            },
        };
    }
}
