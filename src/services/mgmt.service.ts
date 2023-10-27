import * as bitcoreLib from 'bitcore-lib';
import { base64ToBytes, bytesToBase64 } from 'byte-base64';
import { err, ok } from 'neverthrow';
import nacl from 'tweetnacl';
import { v4 as uuidv4 } from 'uuid';

import {
    ICreateTransaction,
    ICreateTransactionEncrypted,
    IErrorInternal,
    IGenericKeyPair,
    IKeypair,
    IKeypairEncrypted,
    IMasterKey,
    IMasterKeyEncrypted,
    INewWalletResponse,
    IResult,
} from '../interfaces';
import {
    ADDRESS_VERSION,
    constructAddress,
    generateDRUID,
    generateMasterKey,
    generateNewKeypairAndAddress,
    generateSeed,
    getAddressVersion,
    getNextDerivedKeypair,
    getPassphraseBuffer,
    KEYPAIR_LOCAL_STORAGE,
    SEED_REGEN_THRES,
    TEMP_ADDRESS_VERSION,
} from '../mgmt';
import { concatTypedArrays, getBytesString, getStringBytes, truncateByBytesUTF8 } from '../utils';
import { getBytesHexString, getHexStringBytes } from '../utils/general.utils';

export class mgmtClient {
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

    constructor() {
        this.passphraseKey = new Uint8Array();
        this.masterKey = undefined;
    }

    /**
     * Init the client without providing a master key or seed phrase
     *
     * @param {string} passphraseKey
     * @return {*}  {IResult<[string, IMasterKeyEncrypted]>}
     * @memberof mgmtClient
     */
    public initNew(passphraseKey: string): IResult<INewWalletResponse> {
        const passphrase = getPassphraseBuffer(passphraseKey);
        if (passphrase.isErr()) return err(passphrase.error);
        this.passphraseKey = passphrase.value;
        const generatedSeed = generateSeed();
        if (generatedSeed.isErr()) return err(generatedSeed.error);
        // Generate a new master key and seed phrase
        const newMasterKey = generateMasterKey(generatedSeed.value);
        if (newMasterKey.isErr()) return err(newMasterKey.error);
        this.masterKey = newMasterKey.value;
        const saveIResult = this.encryptMasterKey(newMasterKey.value, passphrase.value);
        if (saveIResult && saveIResult.isErr()) return err(saveIResult.error);
        this.seedPhrase = generatedSeed.value;
        return ok({ seedphrase: generatedSeed.value, masterKey: saveIResult.value });
    }

    /**
     * Init the client with a provided master key
     *
     * @param {IMasterKeyEncrypted} masterKey
     * @param {string} passphraseKey
     * @return {*}  {IResult<void>}
     * @memberof mgmtClient
     */
    public fromMasterKey(masterKey: IMasterKeyEncrypted, passphraseKey: string): IResult<void> {
        const passphrase = getPassphraseBuffer(passphraseKey);
        if (passphrase.isErr()) return err(passphrase.error);
        this.passphraseKey = passphrase.value;
        // Decrypt the existing master key
        const decryptedMasterKey = this.decryptMasterKey(masterKey, passphrase.value);
        if (decryptedMasterKey.isErr()) return err(decryptedMasterKey.error);
        else this.masterKey = decryptedMasterKey.value;
        return ok(undefined);
    }

    /**
     * Init the client with a provided seed phrase
     *
     * @param {string} seedPhrase
     * @param {string} passphraseKey
     * @return {*}  {IResult<IMasterKeyEncrypted>}
     * @memberof mgmtClient
     */
    public fromSeed(seedPhrase: string, passphraseKey: string): IResult<IMasterKeyEncrypted> {
        const passphrase = getPassphraseBuffer(passphraseKey);
        if (passphrase.isErr()) return err(passphrase.error);
        this.passphraseKey = passphrase.value;
        const newMasterKey = generateMasterKey(seedPhrase);
        if (newMasterKey.isErr()) return err(newMasterKey.error);
        this.masterKey = newMasterKey.value;
        const saveIResult = this.encryptMasterKey(newMasterKey.value, passphrase.value);
        if (saveIResult && saveIResult.isErr()) return err(saveIResult.error);
        this.seedPhrase = seedPhrase;
        return ok(saveIResult.value);
    }

    /**
     * Get a new address
     *
     * @param {string[]} allAddresses
     * @return {*}  {IResult<IKeypairEncrypted>}
     * @memberof mgmtClient
     */
    public getNewKeypair(
        allAddresses: string[],
        addressVersion: null | number = ADDRESS_VERSION,
    ): IResult<IKeypairEncrypted> {
        if (this.masterKey === undefined) return err(IErrorInternal.UnableToGetExistingMasterKey);
        const newKeyPairIResult = generateNewKeypairAndAddress(
            this.masterKey,
            addressVersion,
            allAddresses,
        );
        if (newKeyPairIResult.isErr()) return err(newKeyPairIResult.error);
        const keypair = newKeyPairIResult.value;
        return this.encryptKeypair(keypair);
    }

    /**
     * Generate a new seed phrase
     *
     * @return {*}  {IResult<string>}
     * @memberof mgmtClient
     */
    public getNewSeedPhrase(): IResult<string> {
        return generateSeed();
    }

    /**
     * Get the existing seed phrase from the client
     *
     * @return {*}  {IResult<string>}
     * @memberof mgmtClient
     */
    public getSeedPhrase(): IResult<string> {
        if (this.seedPhrase) return ok(this.seedPhrase);
        else return err(IErrorInternal.UnableToGetExistingSeed);
    }

    /**
     * Test a seed phrase to see if it's valid
     *
     * @param {string} seedPhrase
     * @return {*}  {IResult<void>}
     * @memberof mgmtClient
     */
    public testSeedPhrase(seedPhrase: string): IResult<void> {
        const IResult = generateMasterKey(seedPhrase);
        if (IResult.isErr()) return err(IResult.error);
        else return ok(undefined);
    }

    /**
     * Encrypt the master key using the passphrase
     *
     * @param {IMasterKey} masterKey
     * @param {Uint8Array} [passphrase]
     * @return {*}  {IResult<IMasterKeyEncrypted>}
     * @memberof mgmtClient
     */
    public encryptMasterKey(
        masterKey: IMasterKey,
        passphrase?: Uint8Array,
    ): IResult<IMasterKeyEncrypted> {
        try {
            const nonce = truncateByBytesUTF8(uuidv4(), 24);
            const secretKey = getStringBytes(masterKey.secret.xprivkey);
            const save = nacl.secretbox(
                secretKey,
                getStringBytes(nonce),
                passphrase ? passphrase : this.passphraseKey,
            );

            return ok({
                nonce,
                save: bytesToBase64(save),
            } as IMasterKeyEncrypted);
        } catch {
            return err(IErrorInternal.UnableToEncryptMasterKey);
        }
    }

    /**
     * Decrypt the master key using the passphrase
     *
     * @param {IMasterKeyEncrypted} masterKeyEncrypted
     * @param {Uint8Array} [passphrase]
     * @return {*}  {IResult<IMasterKey>}
     * @memberof mgmtClient
     */
    public decryptMasterKey(
        masterKeyEncrypted: IMasterKeyEncrypted,
        passphrase?: Uint8Array,
    ): IResult<IMasterKey> {
        try {
            const savedDetails = base64ToBytes(masterKeyEncrypted.save);
            const save = nacl.secretbox.open(
                savedDetails,
                getStringBytes(masterKeyEncrypted.nonce),
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

    /**
     * Encrypt a key-pair using the passphrase
     *
     * @param {IKeypair} keypair
     * @return {*}  {IResult<IKeypairEncrypted>}
     * @memberof mgmtClient
     */
    public encryptKeypair(keypair: IKeypair): IResult<IKeypairEncrypted> {
        try {
            const nonce = truncateByBytesUTF8(uuidv4(), 24);
            const pubPriv = concatTypedArrays(keypair.publicKey, keypair.secretKey);
            const save = nacl.secretbox(pubPriv, getStringBytes(nonce), this.passphraseKey);
            return ok({
                address: keypair.address,
                nonce,
                version: keypair.version,
                save: bytesToBase64(save),
            } as IKeypairEncrypted);
        } catch {
            return err(IErrorInternal.UnableToEncryptKeypair);
        }
    }

    /**
     * Decrypt an array of encrypted key-pairs
     *
     * @param {IKeypairEncrypted[]} keypairs - Encrypted key-pair array
     * @return {*}  {IResult<IKeypair[]>}
     * @memberof mgmtClient
     */
    public decryptKeypairs(keypairs: IKeypairEncrypted[]): IResult<IKeypair[]> {
        const decryptedKeypairs: IKeypair[] = [];
        for (const keypair of keypairs) {
            const decryptedKeypair = this.decryptKeypair(keypair);
            if (decryptedKeypair.isErr()) return err(decryptedKeypair.error);
            decryptedKeypairs.push(decryptedKeypair.value);
        }
        return ok(decryptedKeypairs);
    }

    /**
     * Decrypt a key-pair using the passphrase
     *
     * @param {IKeypairEncrypted} keypair
     * @return {*}  {IResult<IKeypair>}
     * @memberof mgmtClient
     */
    public decryptKeypair(keypair: IKeypairEncrypted): IResult<IKeypair> {
        try {
            const savedDetails = base64ToBytes(keypair.save);
            const save = nacl.secretbox.open(
                savedDetails,
                getStringBytes(keypair.nonce),
                this.passphraseKey,
            );
            let publicKey: Uint8Array = new Uint8Array();
            let secretKey: Uint8Array = new Uint8Array();

            if (save != null) {
                publicKey = save.slice(0, 32);
                secretKey = save.slice(32);
            } else {
                return err(IErrorInternal.UnableToDecryptKeypair);
            }

            // Handle the case where the version doesn't exist in DB (TEMP ADDRESS STRUCTURE) (pre v1.0.4)
            // TODO: Depreciate this code once the temporary addresses have retired
            const version = getAddressVersion(publicKey, keypair.address);
            if (version.isErr()) return err(version.error);
            const addrVersion =
                keypair.version === null && version.value === TEMP_ADDRESS_VERSION
                    ? TEMP_ADDRESS_VERSION
                    : ADDRESS_VERSION;
            return ok({
                address: keypair.address,
                version: addrVersion,
                publicKey,
                secretKey,
            });
        } catch {
            return err(IErrorInternal.UnableToDecryptKeypair);
        }
    }

    /**
     * Generate a new DRUID value
     *
     * @return {*}  {IResult<string>}
     * @memberof mgmtClient
     */
    public getNewDRUID(): IResult<string> {
        const newDRUID = generateDRUID();
        if (newDRUID.isErr()) return err(newDRUID.error);
        return newDRUID;
    }

    /**
     * Encrypt a transaction using the passphrase
     *
     * @param {ICreateTransaction} transaction
     * @return {*}  {IResult<ICreateTransactionEncrypted>}
     * @memberof mgmtClient
     */
    public encryptTransaction(
        transaction: ICreateTransaction,
    ): IResult<ICreateTransactionEncrypted> {
        try {
            const nonce = truncateByBytesUTF8(uuidv4(), 24);
            const save = nacl.secretbox(
                Buffer.from(JSON.stringify(transaction)),
                getStringBytes(nonce),
                this.passphraseKey,
            );
            return ok({
                druid: transaction.druid_info?.druid,
                nonce,
                save: bytesToBase64(save),
            } as ICreateTransactionEncrypted);
        } catch {
            return err(IErrorInternal.UnableToEncryptTransaction);
        }
    }

    /**
     * Return a `[string[], Map<string, IKeypair>]` object from
     * an array of encrypted keypairs
     *
     * @param {IKeypairEncrypted[]} allKeypairs
     * @return {*}  {[string[], Map<string, IKeypair>]}
     * @memberof mgmtClient
     */
    public getAllAddressesAndKeypairMap(
        allKeypairs: IKeypairEncrypted[],
    ): IResult<[string[], Map<string, IKeypair>]> {
        const allAddresses = Object.values(allKeypairs).map((keypair) => keypair.address);
        const keyPairMap = new Map<string, IKeypair>();
        for (const keypair of allKeypairs) {
            const keyPair = this.decryptKeypair(keypair);
            if (keyPair.isErr()) return err(keyPair.error);
            keyPairMap.set(keypair.address, keyPair.value);
        }
        return ok([allAddresses, keyPairMap]);
    }

    /**
     * Decrypt a transaction using the passphrase
     *
     * @param {ICreateTransactionEncrypted} encryptedTx
     * @return {*}  {IResult<ICreateTransaction>}
     * @memberof mgmtClient
     */
    public decryptTransaction(
        encryptedTx: ICreateTransactionEncrypted,
    ): IResult<ICreateTransaction> {
        try {
            const savedDetails = base64ToBytes(encryptedTx.save);
            const save = nacl.secretbox.open(
                savedDetails,
                getStringBytes(encryptedTx.nonce),
                this.passphraseKey,
            );

            if (save === null) return err(IErrorInternal.UnableToDecryptTransaction);
            const transaction = JSON.parse(Buffer.from(save).toString()) as ICreateTransaction;
            return ok(transaction);
        } catch {
            return err(IErrorInternal.UnableToDecryptTransaction);
        }
    }

    /**
     * Regenerate addresses from a seed phrase and a set of addresses from UTXO set
     *
     * @param seedPhrase - Seed phrase
     * @param {string[]} addressList
     * @param {number} [seedRegenThreshold=SEED_REGEN_THRES]
     * @return {*}  {IResult<Set<string>>}
     * @memberof mgmtClient
     */
    public regenAddresses(
        seedPhrase: string,
        addressList: string[],
        seedRegenThreshold: number = SEED_REGEN_THRES,
    ): IResult<IKeypair[]> {
        const masterKey = generateMasterKey(seedPhrase);
        if (masterKey.isErr()) return err(masterKey.error);
        this.seedPhrase = seedPhrase;
        this.masterKey = masterKey.value;
        let depthCounter = 0;
        let threshCounter = 0;
        const foundAddr = new Map<string, IKeypair>();

        // Use a `Set` for better indexing performance
        const addrSet: Set<string> = new Set(addressList);

        while (threshCounter < seedRegenThreshold) {
            const nextDerived = getNextDerivedKeypair(masterKey.value, depthCounter);
            if (nextDerived.isErr()) return err(nextDerived.error);
            const currentAddr = constructAddress(nextDerived.value.publicKey, ADDRESS_VERSION);
            const currentAddrDefault = constructAddress(
                nextDerived.value.publicKey,
                TEMP_ADDRESS_VERSION,
            );
            if (currentAddr.isErr()) return err(currentAddr.error);
            if (currentAddrDefault.isErr()) return err(currentAddrDefault.error);
            if (addrSet.has(currentAddr.value) && !foundAddr.get(currentAddr.value)) {
                const keypair = {
                    address: currentAddr.value,
                    secretKey: nextDerived.value.secretKey,
                    publicKey: nextDerived.value.publicKey,
                    version: ADDRESS_VERSION,
                };
                foundAddr.set(currentAddr.value, keypair);
                threshCounter = 0;
                //TODO: Depreciate once temporary address structure is removed
            } else if (
                addrSet.has(currentAddrDefault.value) &&
                !foundAddr.get(currentAddrDefault.value)
            ) {
                const keypair = {
                    address: currentAddrDefault.value,
                    secretKey: nextDerived.value.secretKey,
                    publicKey: nextDerived.value.publicKey,
                    version: TEMP_ADDRESS_VERSION,
                };
                foundAddr.set(currentAddrDefault.value, keypair);
                threshCounter = 0;
            } else {
                threshCounter++;
            }
            depthCounter++;
        }
        if (foundAddr.size === 0) return err(IErrorInternal.UnableToRegenAddresses);
        return ok(Array.from(foundAddr.values()));
    }

    /**
     * Sign a given message with an array of keypairs
     *
     * @param {IKeypair[]} keypairs
     * @param {string} message
     * @return {*}  {IResult<IGenericKeyPair<string>>}
     * @memberof mgmtClient
     */
    public signMessage(keypairs: IKeypair[], message: string): IResult<IGenericKeyPair<string>> {
        if (keypairs.length < 1)
            return err(IErrorInternal.InvalidInputs);
        const signatures: IGenericKeyPair<string> = {};
        for (const keypair of keypairs) {
            const signature = nacl.sign.detached(Buffer.from(message), keypair.secretKey);
            signatures[getBytesHexString(keypair.publicKey)] = getBytesHexString(signature);
        }
        if (Object.keys(signatures).length < 1) return err(IErrorInternal.UnableToSignMessage);
        return ok(signatures);
    }

    public verifyMessage(message: string, signatures: IGenericKeyPair<string>, keypairs: IKeypair[]): IResult<boolean> {
        console.log(keypairs.length, Object.keys(signatures).length)
        if (keypairs.length < 1 || Object.keys(signatures).length != keypairs.length)
            return err(IErrorInternal.InvalidInputs);
        for (const keypair of keypairs) {
            const sig = signatures[getBytesHexString(keypair.publicKey)]
            if (!sig || !nacl.sign.detached.verify(Buffer.from(message), getHexStringBytes(sig), keypair.publicKey))
                return err(IErrorInternal.UnableToVerifyMessage);
        }
        return ok(true);
    }

    /**
     * Get the existing master key from the client
     *
     * @return {*}  {IResult<IMasterKeyEncrypted>}
     * @memberof mgmtClient
     */
    public getMasterKey(): IResult<IMasterKeyEncrypted> {
        if (!this.masterKey) return err(IErrorInternal.UnableToGetExistingMasterKey);
        const encryptedMasterKey = this.encryptMasterKey(this.masterKey);
        if (encryptedMasterKey.isErr()) return err(encryptedMasterKey.error);
        return ok(encryptedMasterKey.value);
    }

    /**
    * Save keypairs to localStorage. (Browser)
    * 
    * @export
    * @param {string} keypairs IKeypairEncrypted[] flattened to a string
    * @return {*} {void} address of saved keypair
    */
    public saveKeypairs(keypairs: IKeypairEncrypted[]): IResult<void> {
        console.log(window);
        console.log(window.localStorage)
        if (!keypairs || typeof window !== 'undefined') {
            const flattened = JSON.stringify(keypairs);
            window.localStorage.setItem(KEYPAIR_LOCAL_STORAGE, flattened);
            return ok(undefined)
        }
        return err(IErrorInternal.UnableToSaveKeypairLocal)
    }

    /**
    * Save keypairs to localStorage. (Browser)
    * 
    * @export
    * @return {*} {IKeypairEncrypted[]}
    */
    public getKeypairs(): IResult<IKeypairEncrypted[]> {
        let result = null;
        if (typeof window !== 'undefined')
            result = window.localStorage.getItem(KEYPAIR_LOCAL_STORAGE);
        if (result != null)
            return ok(JSON.parse(result))
        return err(IErrorInternal.UnableToGetLocalKeypair)
    }
}
