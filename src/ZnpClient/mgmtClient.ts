import { bytesToBase64, base64ToBytes } from 'byte-base64';
import nacl from 'tweetnacl';
import {
    IMasterKeyEncrypted,
    IKeypairEncrypted,
    IMasterKey,
    IKeypair,
    TEMP_ADDRESS_VERSION,
    ADDRESS_VERSION,
    SEED_REGEN_THRES,
    generateDRUID,
} from '../mgmt';
import { truncateByBytesUTF8, getStringBytes, getBytesString, concatTypedArrays } from '../utils';
import { v4 as uuidv4 } from 'uuid';
import * as bitcoreLib from 'bitcore-lib';
import {
    constructAddress,
    generateMasterKey,
    generateNewKeypairAndAddress,
    generateSeed,
    getNextDerivedKeypair,
    getPassphraseBuffer,
} from '../mgmt/keyMgmt';

export interface IMgmtCallbacks {
    saveMasterKey: (saveInfo: string) => void;
    getMasterKey: () => string | null;
    saveKeypair: (address: string, saveInfo: string) => void;
    getKeypair: (address: string) => string | null;
    getAddresses: () => string[] | null;
    saveDRUID: (druid: string) => void;
    getDRUIDs: () => string[] | null;
}

export class mgmtClient {
    private callBacks: IMgmtCallbacks;
    private passphraseKey: Uint8Array;
    private _seedPhrase: string | null;
    public get seedPhrase(): string | null {
        return this._seedPhrase;
    }
    public set seedPhrase(value: string | null) {
        this._seedPhrase = value;
    }
    private _masterKey: IMasterKey;
    public get masterKey(): IMasterKey {
        return this._masterKey;
    }
    public set masterKey(value: IMasterKey) {
        this._masterKey = value;
    }

    constructor(callbacks: IMgmtCallbacks, passphraseKey: string, seedPhrase?: string) {
        this.callBacks = callbacks;
        this.passphraseKey = getPassphraseBuffer(passphraseKey);
        [this._seedPhrase, this._masterKey] = this.initMasterKey(passphraseKey, seedPhrase);
    }

    private initMasterKey(passphraseKey: string, seedPhrase?: string): [string | null, IMasterKey] {
        const passphrase = getPassphraseBuffer(passphraseKey);
        const masterKey = this.getMasterKey(passphrase);
        if (masterKey != null) {
            return [null, masterKey];
        } else {
            const seed: string = seedPhrase && seedPhrase.length != 0 ? seedPhrase : generateSeed();
            const newMasterKey = generateMasterKey(seed);
            this.saveMasterKey(newMasterKey, passphrase);
            return [seed, newMasterKey];
        }
    }

    public getNewAddress(): string {
        const allAddresses = this.getAddresses();
        const addresses = allAddresses === null ? [] : allAddresses;
        const [keypair, address] = generateNewKeypairAndAddress(
            this.masterKey,
            ADDRESS_VERSION,
            addresses,
        );
        this.saveKeypair(keypair, address);
        return address;
    }

    public getNewSeedPhrase(): string {
        return generateSeed();
    }

    public getSeedPhrase(): string {
        return this._seedPhrase === null ? generateSeed() : this._seedPhrase;
    }

    public saveMasterKey(masterKey: IMasterKey, passphrase?: Uint8Array): void {
        const nonce = truncateByBytesUTF8(uuidv4(), 24);
        const secretKey = getStringBytes(masterKey.secret.xprivkey);
        const save = nacl.secretbox(
            secretKey,
            getStringBytes(nonce),
            passphrase ? passphrase : this.passphraseKey,
        );

        const saveInfo = JSON.stringify({
            nonce,
            save: bytesToBase64(save),
        });
        this.callBacks.saveMasterKey(saveInfo);
    }

    public getMasterKey(passphrase?: Uint8Array): IMasterKey | null {
        const ret = this.callBacks.getMasterKey();
        if (ret) {
            const result = JSON.parse(ret) as IMasterKeyEncrypted;
            const savedDetails = base64ToBytes(result.save);
            const save = nacl.secretbox.open(
                savedDetails,
                getStringBytes(result.nonce),
                passphrase ? passphrase : this.passphraseKey,
            );

            if (save) {
                const kRaw = getBytesString(save);
                const privKey = new bitcoreLib.HDPrivateKey(kRaw);

                return {
                    secret: privKey,
                    seed: '',
                };
            }

            return null;
        }

        return null;
    }

    public saveKeypair(keypair: IKeypair, address: string): void {
        const nonce = truncateByBytesUTF8(uuidv4(), 24);
        const pubPriv = concatTypedArrays(keypair.publicKey, keypair.secretKey);
        const save = nacl.secretbox(pubPriv, getStringBytes(nonce), this.passphraseKey);
        const saveInfo = JSON.stringify({
            nonce,
            version: keypair.version,
            save: bytesToBase64(save),
        });
        this.callBacks.saveKeypair(address, saveInfo);
    }

    public getKeypair(address: string): IKeypair | null {
        const ret = this.callBacks.getKeypair(address);
        if (ret) {
            const result = JSON.parse(ret) as IKeypairEncrypted;
            // Handle the case where the version doesn't exist (pre v1.0.4)
            if (!result.version) {
                const saveInfo = JSON.stringify({
                    nonce: result.nonce,
                    version: TEMP_ADDRESS_VERSION,
                    save: result.save,
                });
                this.callBacks.saveKeypair(saveInfo, address);
            }
            const savedDetails = base64ToBytes(result.save);
            const save = nacl.secretbox.open(
                savedDetails,
                getStringBytes(result.nonce),
                this.passphraseKey,
            );
            let publicKey: Uint8Array = new Uint8Array();
            let secretKey: Uint8Array = new Uint8Array();

            if (save != null) {
                publicKey = save.slice(0, 32);
                secretKey = save.slice(32);
            } else {
                return null;
            }

            return { publicKey, secretKey, version: result.version };
        }
        return null;
    }

    public getAddresses(): string[] | null {
        return this.callBacks.getAddresses();
    }

    public getNewDRUID(save = true): string {
        const newDRUID = generateDRUID();
        if (save) {
            this.callBacks.saveDRUID(newDRUID);
        }
        return newDRUID;
    }

    /**
     * Regenerate addresses from master key and a given set of addresses from UTXO set
     *
     * @export
     * @param {string[]} addressList
     * @param {number} [seedRegenThreshold=SEED_REGEN_THRES]
     * @param {(keypair: IKeypair, address:string) => void} saveKeyPairCallback
     * @param {(IMasterKey | null)} masterKey
     * @return {*}  {(Set<string> | undefined)}
     */
    public regenAddresses(
        addressList: string[],
        seedRegenThreshold: number = SEED_REGEN_THRES,
    ): Set<string> | undefined {
        let depthCounter = 0;
        let threshCounter = 0;
        const foundAddr = new Set<string>();

        // Use a `Set` for better indexing performance
        const addrSet: Set<string> = new Set(addressList);

        while (threshCounter < seedRegenThreshold) {
            if (this.masterKey != null) {
                const nextDerived = getNextDerivedKeypair(this.masterKey, depthCounter);
                const currentAddr = constructAddress(nextDerived.publicKey, ADDRESS_VERSION);
                const currentAddrDefault = constructAddress(
                    nextDerived.publicKey,
                    TEMP_ADDRESS_VERSION,
                );
                if (addrSet.has(currentAddr) && !foundAddr.has(currentAddr)) {
                    const keypair = {
                        secretKey: nextDerived.secretKey,
                        publicKey: nextDerived.publicKey,
                        version: ADDRESS_VERSION,
                    };
                    this.saveKeypair(keypair, currentAddr);
                    foundAddr.add(currentAddr);
                    threshCounter = 0;
                    //TODO: Depreciate once temporary address structure is removed
                } else if (addrSet.has(currentAddrDefault) && !foundAddr.has(currentAddrDefault)) {
                    const keypair = {
                        secretKey: nextDerived.secretKey,
                        publicKey: nextDerived.publicKey,
                        version: TEMP_ADDRESS_VERSION,
                    };
                    this.saveKeypair(keypair, currentAddrDefault);
                    foundAddr.add(currentAddrDefault);
                    threshCounter = 0;
                } else {
                    threshCounter++;
                }
                depthCounter++;
            }
            return foundAddr;
        }
    }
}
