import {
    ADDRESS_VERSION,
    createReceiptPayload,
    CreateTokenPaymentTx,
    generateNewKeypairAndAddress,
    SEED_REGEN_THRES,
} from '../mgmt';
import axios, { AxiosInstance } from 'axios';
import { IMgmtCallbacks, mgmtClient } from './mgmtClient';
import { castAPIStatus } from '../utils';
import { IErrorInternal } from '../interfaces';
import {
    IFetchUtxoAddressesResponse,
    IFetchBalanceResponse,
    IFetchPendingResponse,
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
    host: string;
    tls?: boolean;
    port?: number;
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
    FetchUtxoAddressesResponse?: IFetchUtxoAddressesResponse;
    FetchBalanceResponse?: IFetchBalanceResponse;
    FetchPendingResponse?: IFetchPendingResponse;
    CreateReceiptResponse?: ICreateReceiptResponse;
};

export class ZnpClient {
    /* -------------------------------------------------------------------------- */
    /*                              Member Variables                              */
    /* -------------------------------------------------------------------------- */
    private axiosClient: AxiosInstance | undefined;
    private keyMgmt: mgmtClient | undefined;

    /* -------------------------------------------------------------------------- */
    /*                                 Constructor                                */
    /* -------------------------------------------------------------------------- */
    constructor() {
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
        this.axiosClient = axios.create({
            baseURL: config.port
                ? `${config.tls ? 'https' : 'http'}://${config.host}:${config.port}`
                : config.host,
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
    /*                                 API Routes                                 */
    /* -------------------------------------------------------------------------- */

    /**
     * Get all the addresses present on the ZNP UTXO set
     *
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZnpClient
     */
    public async getUtxoAddressList(): Promise<IClientResponse> {
        if (!this.axiosClient || !this.keyMgmt) {
            return {
                status: 'error',
                reason: 'Client has not been initialized',
            } as IClientResponse;
        }
        try {
            return (await this.axiosClient
                .get<INetworkResponse>(IAPIRoute.GetUtxoAddressList)
                .then((response) => {
                    return {
                        status: castAPIStatus(response.data.status),
                        reason: response.data.reason,
                        apiContent: {
                            FetchUtxoAddressesResponse: response.data.content,
                        },
                    } as IClientResponse;
                })
                .catch(async (error) => ({
                    status: 'error',
                    reason: `Network error: ${error.response.status}}`,
                }))) as IClientResponse;
        } catch {
            return {
                status: 'error',
                reason: 'Unable to connect',
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
        if (!this.axiosClient || !this.keyMgmt) {
            return {
                status: 'error',
                reason: 'Client has not been initialized',
            } as IClientResponse;
        }

        const addresses = this.keyMgmt.getAddresses();
        if (addresses.isErr()) {
            return {
                status: 'error',
                reason: addresses.error,
            } as IClientResponse;
        }
        const fetchBalanceBody = {
            address_list: addresses.value,
        };
        try {
            return (await this.axiosClient
                .post<INetworkResponse>(IAPIRoute.FetchBalance, JSON.stringify(fetchBalanceBody))
                .then((response) => {
                    return {
                        status: castAPIStatus(response.data.status),
                        reason: response.data.reason,
                        apiContent: {
                            FetchBalanceResponse: response.data.content,
                        },
                    } as IClientResponse;
                })
                .catch(async (error) => ({
                    status: 'error',
                    reason: `Network error: ${error.response.status}}`,
                }))) as IClientResponse;
        } catch {
            return {
                status: 'error',
                reason: 'Unable to connect',
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
        if (!this.axiosClient || !this.keyMgmt) {
            return {
                status: 'error',
                reason: 'Client has not been initialized',
            } as IClientResponse;
        }

        // const druids = this.keyMgmt.get
        const fetchPendingBody = {
            druid_list: druids,
        };
        try {
            return (await this.axiosClient
                .post<INetworkResponse>(IAPIRoute.FetchPending, JSON.stringify(fetchPendingBody))
                .then((response) => {
                    return {
                        status: castAPIStatus(response.data.status),
                        reason: response.data.reason,
                        apiContent: {
                            FetchPendingResponse: response.data.content,
                        },
                    } as IClientResponse;
                })
                .catch(async (error) => ({
                    status: 'error',
                    reason: `Network error: ${error.response.status}}`,
                }))) as IClientResponse;
        } catch {
            return {
                status: 'error',
                reason: 'Unable to connect',
            } as IClientResponse;
        }
    }

    /**
     * Create receipt assets and assign them to a new address
     *
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZnpClient
     */
    public async createReceipts(): Promise<IClientResponse> {
        if (!this.axiosClient || !this.keyMgmt) {
            return {
                status: 'error',
                reason: 'Client has not been initialized',
            } as IClientResponse;
        }

        const addresses = this.keyMgmt.getAddresses();
        if (addresses.isErr()) {
            return {
                status: 'error',
                reason: 'No saved addresses found',
            } as IClientResponse;
        }
        const mostRecent = addresses.value[addresses.value.length - 1];
        const mostRecentKeypair = this.keyMgmt.getKeypair(mostRecent);
        if (mostRecentKeypair.isErr()) {
            return {
                status: 'error',
                reason: mostRecentKeypair.error,
            } as IClientResponse;
        }
        if (mostRecentKeypair != null) {
            const createReceiptBody = createReceiptPayload(
                mostRecentKeypair.value.secretKey,
                mostRecentKeypair.value.publicKey,
                mostRecentKeypair.value.version,
            );
            if (createReceiptBody.isErr()) {
                return {
                    status: 'error',
                    reason: createReceiptBody.error,
                } as IClientResponse;
            }
            try {
                return (await this.axiosClient
                    .post<INetworkResponse>(
                        `${this.axiosClient.defaults.baseURL}${IAPIRoute.CreateReceiptAsset}`,
                        JSON.stringify(createReceiptBody.value),
                    )
                    .then((response) => {
                        return {
                            status: castAPIStatus(response.data.status),
                            reason: response.data.reason,
                            apiContent: {
                                CreateReceiptResponse: response.data.content,
                            },
                        } as IClientResponse;
                    })
                    .catch(async (error) => {
                        return {
                            status: 'error',
                            reason: `Network error: ${error.response.status}}`,
                        };
                    })) as IClientResponse;
            } catch {
                return {
                    status: 'error',
                    reason: 'Unable to connect',
                } as IClientResponse;
            }
        } else {
            return {
                status: 'error',
                reason: IErrorInternal.UnableToRetrieveKeypair,
            } as IClientResponse;
        }
    }

    /**
     * Make a payment of a specified token amount to a specified address
     *
     * @param {string} paymentAddress
     * @param {number} paymentAmount
     * @return {*}  {Promise<IClientResponse>}
     * @memberof ZnpClient
     */
    async makeTokenPayment(
        paymentAddress: string,
        paymentAmount: number,
    ): Promise<IClientResponse> {
        if (!this.axiosClient || !this.keyMgmt) {
            return {
                status: 'error',
                reason: 'Client has not been initialized',
            } as IClientResponse;
        }

        // First update balance
        const balance = await this.fetchBalance();
        if (balance.status == 'success' && balance.apiContent?.FetchBalanceResponse) {
            const addresses = this.keyMgmt.getAddresses();
            if (addresses.isErr()) {
                return {
                    status: 'error',
                    reason: 'No saved addresses found',
                } as IClientResponse;
            }
            // Generate excess address and accompanying keypair
            const newKeypairResult = generateNewKeypairAndAddress(
                this.keyMgmt.masterKey,
                ADDRESS_VERSION,
                addresses.value,
            );

            if (newKeypairResult.isErr()) {
                return {
                    status: 'error',
                    reason: newKeypairResult.error,
                } as IClientResponse;
            }

            const [excessKeypair, excessAddress] = newKeypairResult.value;

            const paymentBody = CreateTokenPaymentTx(
                paymentAmount,
                paymentAddress,
                excessAddress,
                balance.apiContent.FetchBalanceResponse,
                this.keyMgmt.getKeypair,
            );

            if (paymentBody.isErr()) {
                return {
                    status: 'error',
                    reason: paymentBody.error,
                } as IClientResponse;
            }

            // Create transaction struct has successfully been created
            try {
                return (await this.axiosClient
                    .post(
                        `${this.axiosClient.defaults.baseURL}${IAPIRoute.CreateTransactions}`,
                        JSON.stringify([paymentBody.value.createTx]),
                    )
                    .then((response) => {
                        const responseData = response.data as INetworkResponse;
                        if (castAPIStatus(responseData.status) === 'success') {
                            // Payment now getting processed
                            // TODO: Should we do something with the used addresses?
                            if (paymentBody?.value.excessAddressUsed) {
                                // Save excess keypair to wallet
                                if (!this.keyMgmt) {
                                    return {
                                        status: 'error',
                                        reason: 'Client has not been initialized',
                                    } as IClientResponse;
                                }

                                const saveResult = this.keyMgmt.saveKeypair(
                                    excessKeypair,
                                    excessAddress,
                                );
                                if (saveResult.isErr()) {
                                    return {
                                        status: 'error',
                                        reason: saveResult.error,
                                    } as IClientResponse;
                                }
                            }
                        }
                        return {
                            status: castAPIStatus(responseData.status),
                            reason: responseData.reason,
                            apiContent: {
                                MakePaymentResponse: responseData.content,
                            },
                        } as IClientResponse;
                    })
                    .catch(async (error) => {
                        return {
                            status: 'error',
                            reason: `Network error: ${error.response.status}`,
                        };
                    })) as IClientResponse;
            } catch {
                return {
                    status: 'error',
                    reason: 'Unable to connect',
                } as IClientResponse;
            }
        } else {
            return {
                status: 'error',
                reason: 'Unable to fetch balance',
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
        if (!this.axiosClient || !this.keyMgmt) {
            return {
                status: 'error',
                reason: 'Client has not been initialized',
            } as IClientResponse;
        }
        const foundAddr = this.keyMgmt.regenAddresses(addressList, seedRegenThreshold);
        if (foundAddr) {
            return {
                status: 'success',
                reason: 'Addresses have successfully been reconstructed',
            } as IClientResponse;
        } else {
            return {
                status: 'error',
                reason: 'Address reconstruction failed',
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
        if (!this.axiosClient || !this.keyMgmt) {
            return {
                status: 'error',
                reason: 'Client has not been initialized',
            } as IClientResponse;
        }
        const result = this.keyMgmt.getNewAddress();
        if (result.isErr()) {
            return {
                status: 'error',
                reason: result.error,
            } as IClientResponse;
        }
        return {
            status: 'success',
            reason: 'Successfully generated new address',
            clientContent: {
                newAddressResponse: result.value,
            },
        } as IClientResponse;
    }

    /**
     * Generates a new DRUID value
     * and stores it to the wallet
     *
     * @param {boolean} [save=true]
     * @return {*}  {IClientResponse}
     * @memberof ZnpClient
     */
    getNewDRUID(save = true): IClientResponse {
        if (!this.axiosClient || !this.keyMgmt) {
            return {
                status: 'error',
                reason: 'Client has not been initialized',
            } as IClientResponse;
        }
        const newDruid = this.keyMgmt.getNewDRUID(save);
        if (newDruid.isErr()) {
            return {
                status: 'error',
                reason: newDruid.error,
            } as IClientResponse;
        }
        return {
            status: 'success',
            reason: 'Successfully generated new DRUID',
            clientContent: {
                newDRUIDResponse: newDruid.value,
            },
        } as IClientResponse;
    }

    /**
     * Generates a new seed phrase
     *
     * @return {*}  {IClientResponse}
     * @memberof ZnpClient
     */
    getNewSeedPhrase(): IClientResponse {
        if (!this.axiosClient || !this.keyMgmt) {
            return {
                status: 'error',
                reason: 'Client has not been initialized',
            } as IClientResponse;
        }
        const newSeedPhrase = this.keyMgmt.getNewSeedPhrase();
        if (newSeedPhrase.isErr()) {
            return {
                status: 'error',
                reason: newSeedPhrase.error,
            } as IClientResponse;
        }
        return {
            status: 'success',
            reason: 'Successfully generated new seed phrase',
            clientContent: {
                newSeedPhraseResponse: newSeedPhrase.value,
            },
        };
    }

    /**
     * Get the existing seed phrase, or generate a new one
     *
     * @return {*}  {IClientResponse}
     * @memberof ZnpClient
     */
    getSeedPhrase(): IClientResponse {
        if (!this.axiosClient || !this.keyMgmt) {
            return {
                status: 'error',
                reason: 'Client has not been initialized',
            } as IClientResponse;
        }
        const seedPhrase = this.keyMgmt.getSeedPhrase();
        if (seedPhrase.isErr()) {
            return {
                status: 'error',
                reason: seedPhrase.error,
            } as IClientResponse;
        }
        return {
            status: 'success',
            reason: 'Successfully obtained seed phrase',
            clientContent: {
                getSeedPhraseResponse: seedPhrase.value,
            },
        };
    }

    /**
     * Test a seed phrase to see if it is valid
     *
     * @param {string} seedPhrase
     * @return {*}  {IClientResponse}
     * @memberof ZnpClient
     */
    testSeedPhrase(seedPhrase: string): IClientResponse {
        if (!this.axiosClient || !this.keyMgmt) {
            return {
                status: 'error',
                reason: 'Client has not been initialized',
            } as IClientResponse;
        }
        const result = this.keyMgmt.testSeedPhrase(seedPhrase);
        if (result.isErr()) {
            return {
                status: 'error',
                reason: result.error,
            } as IClientResponse;
        }
        return {
            status: 'success',
            reason: 'Seed phrase is valid',
        };
    }
}
