import { bytesToBase64, base64ToBytes } from 'byte-base64';
import nacl from 'tweetnacl';
import { TEMP_ADDRESS_VERSION, ADDRESS_VERSION, SEED_REGEN_THRES, generateDRUID } from '../mgmt';
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
import {
    IErrorInternal,
    IKeypair,
    IKeypairEncrypted,
    IMasterKey,
    IMasterKeyEncrypted,
    SyncResult,
} from '../interfaces';
import { err, ok } from 'neverthrow';

export type IMgmtCallbacks = {
    saveMasterKey: (saveInfo: string) => void;
    getMasterKey: () => string | null;
    saveKeypair: (address: string, saveInfo: string) => void;
    getKeypair: (address: string) => string | null;
    getAddresses: () => string[] | null;
    saveDRUID: (druid: string) => void;
    getDRUIDs: () => string[] | null;
};

export class mgmtClient {
    private callBacks: IMgmtCallbacks;
    private passphraseKey: Uint8Array;
    private _seedPhrase: string | undefined;
    public get seedPhrase(): string | undefined {
        return this._seedPhrase;
    }
    public set seedPhrase(value: string | undefined) {
        this._seedPhrase = value;
    }
    private _masterKey: IMasterKey | undefined;
    public get masterKey(): IMasterKey | undefined {
        return this._masterKey;
    }
    public set masterKey(value: IMasterKey | undefined) {
        this._masterKey = value;
    }

    constructor(callbacks: IMgmtCallbacks) {
        this.callBacks = callbacks;
        this.passphraseKey = new Uint8Array();
        this.masterKey = undefined;
    }

    /**
     * Initialize the management client
     *
     * @param {string} passphraseKey
     * @param {string} [seedPhrase]
     * @return {*}  {SyncResult<void>}
     * @memberof mgmtClient
     */
    public init(passphraseKey: string, seedPhrase?: string): SyncResult<void> {
        const passphrase = getPassphraseBuffer(passphraseKey);
        if (passphrase.isErr()) return err(passphrase.error);
        this.passphraseKey = passphrase.value;
        /* There is an existing master key */
        const masterKey = this.getMasterKey(passphrase.value);
        if (masterKey.isOk()) {
            this.seedPhrase = undefined;
            this.masterKey = masterKey.value;
        }
        /* There is no existing master key, so generate one */
        if (masterKey.isErr()) {
            const generatedSeed = generateSeed();
            if (generatedSeed.isErr()) return err(generatedSeed.error);
            /* Either generate a new seed phrase or use the supplied one */
            const seed: string =
                seedPhrase && seedPhrase.length != 0 ? seedPhrase : generatedSeed.value;
            const newMasterKey = generateMasterKey(seed);
            if (newMasterKey.isErr()) return err(newMasterKey.error);
            this.masterKey = newMasterKey.value;
            this.seedPhrase = seed;
            const saveResult = this.saveMasterKey(newMasterKey.value, passphrase.value);
            if (saveResult.isErr()) return err(saveResult.error);
        }
        return ok(undefined);
    }

    /**
     * Generate a new address and save it using the `saveKeypair` callback
     *
     * @return {*}  {SyncResult<string>}
     * @memberof mgmtClient
     */
    public getNewAddress(): SyncResult<string> {
        const allAddresses = this.getAddresses();
        if (allAddresses.isErr()) return err(allAddresses.error);
        const newKeyPairResult = generateNewKeypairAndAddress(
            this.masterKey,
            ADDRESS_VERSION,
            allAddresses.value,
        );
        if (newKeyPairResult.isErr()) return err(newKeyPairResult.error);
        const [keypair, address] = newKeyPairResult.value;
        const saveResult = this.saveKeypair(keypair, address);
        if (saveResult.isErr()) return err(saveResult.error);
        return ok(address);
    }

    /**
     * Generate a new seed phrase
     *
     * @return {*}  {SyncResult<string>}
     * @memberof mgmtClient
     */
    public getNewSeedPhrase(): SyncResult<string> {
        return generateSeed();
    }

    /**
     * Either generate a new seed phrase if there's not an existing one
     * , or return the existing one
     *
     * @return {*}  {SyncResult<string>}
     * @memberof mgmtClient
     */
    public getSeedPhrase(): SyncResult<string> {
        const generatedSeedPhrase = generateSeed();
        if (generatedSeedPhrase.isErr()) return err(generatedSeedPhrase.error);
        return ok(this._seedPhrase === undefined ? generatedSeedPhrase.value : this._seedPhrase);
    }

    /**
     * Test a seed phrase to see if it's valid
     *
     * @param {string} seedPhrase
     * @return {*}  {SyncResult<void>}
     * @memberof mgmtClient
     */
    public testSeedPhrase(seedPhrase: string): SyncResult<void> {
        const result = generateMasterKey(seedPhrase);
        if (result.isErr()) return err(result.error);
        else return ok(undefined);
    }

    /**
     * Save the master key
     *
     * @param {IMasterKey} masterKey
     * @param {Uint8Array} [passphrase]
     * @return {*}  {SyncResult<void>}
     * @memberof mgmtClient
     */
    public saveMasterKey(masterKey: IMasterKey, passphrase?: Uint8Array): SyncResult<void> {
        try {
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
        } catch {
            return err(IErrorInternal.UnableToSaveMasterKey);
        }
        return ok(undefined);
    }

    /**
     * Get the master key
     *
     * @param {Uint8Array} [passphrase]
     * @return {*}  {SyncResult<IMasterKey>}
     * @memberof mgmtClient
     */
    public getMasterKey(passphrase?: Uint8Array): SyncResult<IMasterKey> {
        const ret = this.callBacks.getMasterKey();
        if (ret && this.passphraseKey) {
            try {
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

                    return ok({
                        secret: privKey,
                        seed: '',
                    });
                } else return err(IErrorInternal.MasterKeyCorrupt);
            } catch {
                return err(IErrorInternal.MasterKeyCorrupt);
            }
        }
        return err(IErrorInternal.UnableToRetrieveMasterKey);
    }

    /**
     * Save a key-pair
     *
     * @param {IKeypair} keypair
     * @param {string} address
     * @return {*}  {SyncResult<void>}
     * @memberof mgmtClient
     */
    public saveKeypair(keypair: IKeypair, address: string): SyncResult<void> {
        try {
            const nonce = truncateByBytesUTF8(uuidv4(), 24);
            const pubPriv = concatTypedArrays(keypair.publicKey, keypair.secretKey);
            const save = nacl.secretbox(pubPriv, getStringBytes(nonce), this.passphraseKey);
            const saveInfo = JSON.stringify({
                nonce,
                version: keypair.version,
                save: bytesToBase64(save),
            });
            this.callBacks.saveKeypair(address, saveInfo);
        } catch {
            return err(IErrorInternal.UnableToSaveKeyPair);
        }
        return ok(undefined);
    }

    /**
     * Get a key-pair
     *
     * @param {string} address
     * @return {*}  {SyncResult<IKeypair>}
     * @memberof mgmtClient
     */
    public getKeypair(address: string): SyncResult<IKeypair> {
        const ret = this.callBacks.getKeypair(address);
        if (ret) {
            try {
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
                    return err(IErrorInternal.UnableToRetrieveKeypair);
                }
                return ok({ publicKey, secretKey, version: result.version });
            } catch {
                return err(IErrorInternal.UnableToRetrieveKeypair);
            }
        }
        return err(IErrorInternal.UnableToRetrieveKeypair);
    }

    /**
     * Get an array of all the existing addresses
     * using the `getAddresses` callback
     *
     * @return {*}  {SyncResult<string[]>}
     * @memberof mgmtClient
     */
    public getAddresses(): SyncResult<string[]> {
        const addresses = this.callBacks.getAddresses();
        if (addresses) {
            return ok(addresses);
        } else {
            return err(IErrorInternal.UnableToRetrieveAddresses);
        }
    }

    /**
     * Generate and save a new DRUID value
     *
     * @param {boolean} [save=true]
     * @return {*}  {SyncResult<string>}
     * @memberof mgmtClient
     */
    public getNewDRUID(save = true): SyncResult<string> {
        const newDRUID = generateDRUID();
        if (newDRUID.isErr()) return err(newDRUID.error);
        if (save) {
            this.callBacks.saveDRUID(newDRUID.value);
        }
        return newDRUID;
    }

    /**
     * Regenerate addresses from master key and a given set of addresses from UTXO set
     *
     * @param {string[]} addressList
     * @param {number} [seedRegenThreshold=SEED_REGEN_THRES]
     * @return {*}  {SyncResult<Set<string>>}
     * @memberof mgmtClient
     */
    public regenAddresses(
        addressList: string[],
        seedRegenThreshold: number = SEED_REGEN_THRES,
    ): SyncResult<Set<string>> {
        let depthCounter = 0;
        let threshCounter = 0;
        const foundAddr = new Set<string>();

        // Use a `Set` for better indexing performance
        const addrSet: Set<string> = new Set(addressList);

        while (threshCounter < seedRegenThreshold) {
            if (this.masterKey !== undefined) {
                const nextDerived = getNextDerivedKeypair(this.masterKey, depthCounter);
                if (nextDerived.isErr()) return err(nextDerived.error);
                const currentAddr = constructAddress(nextDerived.value.publicKey, ADDRESS_VERSION);
                const currentAddrDefault = constructAddress(
                    nextDerived.value.publicKey,
                    TEMP_ADDRESS_VERSION,
                );
                if (currentAddr.isErr()) return err(currentAddr.error);
                if (currentAddrDefault.isErr()) return err(currentAddrDefault.error);
                if (addrSet.has(currentAddr.value) && !foundAddr.has(currentAddr.value)) {
                    const keypair = {
                        secretKey: nextDerived.value.secretKey,
                        publicKey: nextDerived.value.publicKey,
                        version: ADDRESS_VERSION,
                    };
                    const saveResult = this.saveKeypair(keypair, currentAddr.value);
                    if (saveResult.isErr()) return err(saveResult.error);
                    foundAddr.add(currentAddr.value);
                    threshCounter = 0;
                    //TODO: Depreciate once temporary address structure is removed
                } else if (
                    addrSet.has(currentAddrDefault.value) &&
                    !foundAddr.has(currentAddrDefault.value)
                ) {
                    const keypair = {
                        secretKey: nextDerived.value.secretKey,
                        publicKey: nextDerived.value.publicKey,
                        version: TEMP_ADDRESS_VERSION,
                    };
                    const saveResult = this.saveKeypair(keypair, currentAddrDefault.value);
                    if (saveResult.isErr()) return err(saveResult.error);
                    foundAddr.add(currentAddrDefault.value);
                    threshCounter = 0;
                } else {
                    threshCounter++;
                }
                depthCounter++;
            }
        }
        if (foundAddr.size === 0) {
            return err(IErrorInternal.UnableToRegenAddresses);
        } else {
            return ok(foundAddr);
        }
    }
}
