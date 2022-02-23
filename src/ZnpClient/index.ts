/* eslint-disable @typescript-eslint/no-explicit-any */
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
    IMakeTokenPaymentConfig,
    IKeypair,
    ICreateTransaction,
} from '../interfaces';
import {
    IFetchUtxoAddressesResponse,
    IFetchBalanceResponse,
    IFetchPendingDDEResponse,
    ICreateReceiptResponse,
    IAPIRoute,
} from '../interfaces';

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
            // Get all existing addresses
            const addresses = this.keyMgmt.getAddresses();
            if (addresses.isErr()) throw new Error(addresses.error);
            if (addresses.value.length === 0) throw new Error('No saved addresses');
            // Get most recent key-pair
            const addr = address ? address : addresses.value[addresses.value.length - 1];
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
        config?: IMakeTokenPaymentConfig,
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
            if (config?.excessAddress) {
                const keyPair = this.keyMgmt.getKeypair(config.excessAddress);
                if (keyPair.isErr()) throw new Error(keyPair.error);
                [excessKeypair, excessAddr] = [keyPair.value, config.excessAddress];
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
                            if (!config?.excessAddress) {
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
            let receiveKeypair: IKeypair;
            let receiveAddr: string;
            // A receive address was provided
            if (receiveAddress) {
                const keyPair = this.keyMgmt.getKeypair(receiveAddress);
                if (keyPair.isErr()) throw new Error(keyPair.error);
                [receiveKeypair, receiveAddr] = [keyPair.value, receiveAddress];
                // Generate a receive address
            } else {
                const keyPair = generateNewKeypairAndAddress(
                    this.keyMgmt.masterKey,
                    ADDRESS_VERSION,
                    addresses.value,
                );
                if (keyPair.isErr()) throw new Error(keyPair.error);
                [receiveKeypair, receiveAddr] = keyPair.value;
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
                receiveAddr,
                receiveAddr,
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
                senderAddress: receiveAddr,
                receiverAsset: 'Receipt',
                receiverAmount: 1,
                receiverAddress: paymentAddress,
                fromAddr: senderFromAddr.value,
                status: 'pending',
            };
            const sendBody: IRequestSetBody[] = [
                {
                    key: paymentAddress,
                    field: receiveAddr,
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
                        const saveResult = this.keyMgmt.saveKeypair(receiveKeypair, receiveAddr);
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

    public async acceptRbTx(
        druid: string,
        pendingResponse: IFetchPendingRbResponse,
    ): Promise<IClientResponse> {
        try {
            if (!this.axiosClient || !this.keyMgmt)
                throw new Error('Client has not been initialized');
            // Update balance
            const balance = await this.fetchBalance();
            if (balance.status !== 'success' || !balance.apiContent?.fetchBalanceResponse)
                throw new Error(balance.reason);
            // Filter DRUID values
            const filteredArray = Object.values(pendingResponse).filter((pending) =>
                Object.keys(pending).includes(druid),
            );
            if (filteredArray.length !== 1) throw new Error('Invalid DRUID value provided');
            const filtered = filteredArray[0]; /* There should be a single DRUID key */

            const sendRbTxHalf = CreateRbTxHalf(
                balance.apiContent.fetchBalanceResponse,
                filtered[druid].senderAddress,
                druid,
                // 'Sender' fromAddr is their TxIns address
                filtered[druid].fromAddr /* TxIns received from sending party */,
                filtered[druid].receiverAmount,
                filtered[druid].receiverAsset,
                filtered[druid].senderAmount,
                filtered[druid].senderAsset,
                filtered[druid].receiverAddress,
                filtered[druid].receiverAddress,
                this.keyMgmt.getKeypair.bind(this.keyMgmt),
            );

            if (sendRbTxHalf.isErr()) throw new Error(sendRbTxHalf.error);

            // Update entries to notify "sender" of receipt-based transaction's new status
            const fromAddr = constructTxInsAddress(sendRbTxHalf.value.createTx.inputs);
            if (fromAddr.isErr()) throw new Error(fromAddr.error);
            filtered[druid].fromAddr = fromAddr.value;
            filtered[druid].status = 'accepted';
            const sendBody: IRequestSetBody[] = [
                {
                    key: filtered[druid].senderAddress,
                    field: filtered[druid].receiverAddress,
                    value: filtered,
                },
            ];

            // Send to intercom
            await axios
                .post(`${this.intercomHost}${IAPIRoute.IntercomSet}`, sendBody)
                .catch(async (error) => {
                    throw new Error(error.message);
                });

            // Send transaction to compute
            return await this.axiosClient
                .post<INetworkResponse>(IAPIRoute.CreateTransactions, [sendRbTxHalf.value.createTx])
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
        } catch (error: any) {
            return {
                status: 'error',
                reason: error.message,
            };
        }
    }

    /**
     * Fetch any pending receipt-based payment data from the intercom network
     * and process any transactions that have been approved/accepted
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
            const pendingIntercom: IRequestGetBody[] = addresses.value
                .map((address) => {
                    if (!this.keyMgmt) return null;
                    const keyPair = this.keyMgmt.getKeypair(address);
                    if (keyPair.isErr()) return null;
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

            const responseData = await axios
                .post(`${this.intercomHost}${IAPIRoute.IntercomGet}`, pendingIntercom)
                .then((response) => {
                    const responseData: IFetchPendingRbResponse = response.data;
                    return responseData;
                })
                .catch(async (error) => {
                    throw new Error(error.message);
                });

            const acceptedRbTxs = Object.values(responseData).filter((response) =>
                Object.values(response).every((val) => val.status === 'accepted'),
            ); /* 'every' can be used here because there should only be a single DRUID key */

            // We have accepted receipt-based payments to send to compute
            if (acceptedRbTxs.length > 0) {
                const transactionsToSend: ICreateTransaction[] = [];
                for (const acceptedTx of acceptedRbTxs) {
                    const druid =
                        Object.keys(acceptedTx)[0]; /* There should only be one DRUID key */
                    const fromAddr =
                        Object.values(acceptedTx)[0]
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
