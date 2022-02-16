import {
    ADDRESS_VERSION,
    createReceiptPayload,
    CreateTokenPaymentTx,
    generateNewKeypairAndAddress,
    SEED_REGEN_THRES,
} from '../mgmt';
import axios, { AxiosInstance } from 'axios';
import {
    IAPIRoute,
    ICreateReceiptResponse,
    IFetchBalanceResponse,
    IFetchPendingResponse,
    IFetchUtxoAddressesResponse,
} from './apiInterfaces';
import { IMgmtCallbacks, mgmtClient } from './mgmtClient';
import { castAPIStatus } from '../utils';

export * from './apiInterfaces';
export interface IClientConfig {
    callbacks: IMgmtCallbacks;
    passphraseKey: string;
    host: string;
    tls?: boolean;
    seedPhrase?: string;
    port?: number;
    timeout?: number;
}

interface INetworkResponse {
    id?: string;
    status: 'Success' | 'Error' | 'InProgress' | 'Unknown';
    reason?: string;
    route?: string;
    content?: IApiContentType;
}

export interface IClientResponse {
    id?: string;
    status: 'success' | 'error' | 'pending' | 'unknown';
    reason?: string;
    clientContent?: IContentType;
    apiContent?: IApiContentType;
}

export interface IContentType {
    newAddressResponse?: string | null;
    newDRUIDResponse?: string;
    newSeedPhraseResponse?: string;
    getSeedPhraseResponse?: string;
}
export interface IApiContentType {
    FetchUtxoAddressesResponse?: IFetchUtxoAddressesResponse;
    FetchBalanceResponse?: IFetchBalanceResponse;
    FetchPendingResponse?: IFetchPendingResponse;
    CreateReceiptResponse?: ICreateReceiptResponse;
}

export class ZnpClient {
    /* -------------------------------------------------------------------------- */
    /*                              Member Variables                              */
    /* -------------------------------------------------------------------------- */
    private axiosClient: AxiosInstance;
    private keyMgmt: mgmtClient;

    /* -------------------------------------------------------------------------- */
    /*                                 Constructor                                */
    /* -------------------------------------------------------------------------- */
    constructor(config: IClientConfig) {
        this.axiosClient = axios.create({
            baseURL: config.port
                ? `${config.tls ? 'https' : 'http'}://${config.host}:${config.port}`
                : config.host,
            timeout: config.timeout ? config.timeout : 1000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        this.keyMgmt = new mgmtClient(config.callbacks, config.passphraseKey, config.seedPhrase);
    }

    /* -------------------------------------------------------------------------- */
    /*                                 API Routes                                 */
    /* -------------------------------------------------------------------------- */

    /**
     * Get all the addresses present on the ZNP UTXO set
     */
    public async getUtxoAddressList(): Promise<IClientResponse> {
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
     * Fetches the balance for the passed addresses from ZNP UTXO set
     *
     * @param addresses {string[]}
     */
    async fetchBalance(): Promise<IClientResponse> {
        const addresses = this.keyMgmt.getAddresses();

        const fetchBalanceBody = {
            address_list: addresses,
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
     * @param druids {string[]}
     */
    public async fetchPendingDDETransactions(druids: string[]): Promise<IClientResponse> {
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
     * Sends a request to create new receipts
     */
    public async createReceipts(): Promise<IClientResponse> {
        const addresses = this.keyMgmt.getAddresses();
        if (addresses === null) {
            return {
                status: 'error',
                reason: 'No saved addresses found',
            } as IClientResponse;
        }
        const mostRecent = addresses[addresses.length - 1];
        const mostRecentKeypair = this.keyMgmt.getKeypair(mostRecent);
        if (mostRecentKeypair != null) {
            const createReceiptBody = createReceiptPayload(
                mostRecentKeypair.secretKey,
                mostRecentKeypair.publicKey,
                mostRecentKeypair.version,
            );
            try {
                return (await this.axiosClient
                    .post<INetworkResponse>(
                        `${this.axiosClient.defaults.baseURL}${IAPIRoute.CreateReceiptAsset}`,
                        JSON.stringify(createReceiptBody),
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
                reason: 'Error fetching key-pair to assign receipt asset to',
            } as IClientResponse;
        }
    }

    /**
     * Make a payment of a specified token amount
     *
     * @param {string} paymentAddress
     * @param {number} paymentAmount
     *
     */
    async makeTokenPayment(
        paymentAddress: string,
        paymentAmount: number,
    ): Promise<IClientResponse> {
        // First update balance
        const balance = await this.fetchBalance();
        const addresses = this.keyMgmt.getAddresses();
        if (addresses === null) {
            return {
                status: 'error',
                reason: 'No saved addresses found',
            } as IClientResponse;
        }
        if (balance.status == 'success' && balance.apiContent?.FetchBalanceResponse) {
            // Generate excess address and accompanying keypair
            const [excessKeypair, excessAddress] = generateNewKeypairAndAddress(
                this.keyMgmt.masterKey,
                ADDRESS_VERSION,
                addresses,
            );

            const paymentBody = CreateTokenPaymentTx(
                paymentAmount,
                paymentAddress,
                excessAddress,
                balance.apiContent.FetchBalanceResponse,
                this.keyMgmt.getKeypair,
            );

            // Create transaction struct has successfully been created
            if (paymentBody) {
                try {
                    return (await this.axiosClient
                        .post(
                            `${this.axiosClient.defaults.baseURL}${IAPIRoute.CreateTransactions}`,
                            JSON.stringify([paymentBody.createTx]),
                        )
                        .then((response) => {
                            const responseData = response.data as INetworkResponse;
                            if (castAPIStatus(responseData.status) === 'success') {
                                // Payment now getting processed
                                // TODO: Should we do something with the used addresses?
                                if (paymentBody?.excessAddressUsed) {
                                    // Save excess keypair to wallet
                                    this.keyMgmt.saveKeypair(excessKeypair, excessAddress);
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
            }
        }
        return {
            status: 'error',
            reason: 'Error creating payment transaction: balance not found',
        } as IClientResponse;
    }

    /* -------------------------------------------------------------------------- */
    /*                                    Utils                                   */
    /* -------------------------------------------------------------------------- */

    /**
     * Regenerates the addresses for a newly imported wallet (from seed phrase)
     *
     * @param {number} [seedRegenThreshold=SEED_REGEN_THRES]
     */
    async regenAddresses(
        addressList: string[],
        seedRegenThreshold: number = SEED_REGEN_THRES,
    ): Promise<IClientResponse> {
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

    getNewAddress(): IClientResponse {
        const result = this.keyMgmt.getNewAddress();
        return {
            status: 'success',
            reason: 'Successfully generated new address',
            clientContent: {
                newAddressResponse: result,
            },
        } as IClientResponse;
    }

    getNewDRUID(save = true): IClientResponse {
        return {
            status: 'success',
            reason: 'Successfully generated new DRUID',
            clientContent: {
                newDRUIDResponse: this.keyMgmt.getNewDRUID(save),
            },
        } as IClientResponse;
    }

    getNewSeedPhrase(): IClientResponse {
        return {
            status: 'success',
            reason: 'Successfully generated new seed phrase',
            clientContent: {
                newSeedPhraseResponse: this.keyMgmt.getNewSeedPhrase(),
            },
        };
    }

    getSeedPhrase(): IClientResponse {
        return {
            status: 'success',
            reason: 'Successfully obtained seed phrase',
            clientContent: {
                getSeedPhraseResponse: this.keyMgmt.getSeedPhrase(),
            },
        };
    }
}
