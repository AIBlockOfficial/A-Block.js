import { SEED } from '../constants';
import { ABlockWallet } from '../../services/ablock.service';

let ablockInstance = new ABlockWallet();

beforeEach(() => {
    ablockInstance = new ABlockWallet();
});

test('init wallet without optional config fields', async () => {

    const config = {
        mempoolHost: 'http://49.12.234.10:3003',
        passphrase: '',
    };

    await ablockInstance.initNew(config).then((res) => {
        expect(res.status).toBe('success');
    });

    await ablockInstance.fetchTransactions([]).then((res) => {
        expect(res.reason).toBe('Error: Storage host not initialized');
    });

    await ablockInstance.fetchPendingRbTransactions([], []).then((res) => {
        expect(res.reason).toBe('Error: Intercom host not initialized');
    });

    await ablockInstance.getNotaryBurnAddress().then((res) => {
        expect(res.reason).toBe('Error: Notary host not initialized');
    });
});

test('init wallet locally and then connect', async () => {
    await ablockInstance.initNew({ passphrase: '' }, true).then((res) => {
        expect(res.status).toBe('success');
    });

    const config = {
        mempoolHost: 'http://49.12.234.10:3003',
        storageHost: 'http://49.12.234.10:3001',
        passphrase: '',
    };

    await ablockInstance.initNetwork(config).then((res) => {
        expect(res.status).toBe('success');
    });
});

test('handles key-pair re-generation from wallet seed phrase', async () => {
    const utxoAddressList = [
        /* TEMP_ADDRESS_VERSION = 99999 */
        '8532c5b5581aa926c1bdcc250cf2c66ad6eee4eb05970473b8beb1636f2bdc0d',
        'f16d40ce818c98ea61a850a7f4b9aa2caad5308cb7f373c2037f00fb56b7d151',
        'f2a2a932e0a937de00dad8e36a2d9a11b824018e65aae1427e611bf1324fe24a',

        /* ADDRESS_VERSION = 1 */
        'e93d4a67609baf6a76ce61e7a3b53e9509a1472ff135892e42bf4cf456274a96',
        '41d769523c31a44090b69a233f552009314fa9a4efcc312d3faf56c627743f40',
        '28a7de5c30f8271be690db7a979e1be33d31f6b6aebaa3c82888354ba214c24d',
    ];

    await ablockInstance.fromSeed(SEED, { passphrase: '' }, true,);

    const foundAddresses = await ablockInstance.regenAddresses(SEED, utxoAddressList, 6);

    // Test to see if we have a success response from the client
    expect(foundAddresses.status).toBe('success');

    // Test to see if we have the regenerated addresses
    expect(foundAddresses.content?.regenWalletResponse).toBeDefined();
    if (foundAddresses.content?.regenWalletResponse)
        // eslint-disable-next-line jest/no-conditional-expect
        expect(
            foundAddresses.content.regenWalletResponse.map(
                (encryptedAddress) => encryptedAddress.address,
            ),
        ).toEqual(utxoAddressList);
});

test('sign message with given keypairs', async () => {
    const config = {
        mempoolHost: 'http://49.12.234.10:3003',
        passphrase: '',
    };
    const MSG = 'hello, world';

    await ablockInstance.initNew(config).then((res) => {
        expect(res.status).toBe('success');
    });

    const kp = ablockInstance.getNewKeypair([]).content?.newKeypairResponse;
    const kpAddr = kp?.address;

    expect(kp).toBeDefined();
    expect(kpAddr).toBeDefined();

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const kp1 = ablockInstance.getNewKeypair([kpAddr!]).content?.newKeypairResponse;

    expect(kp1).toBeDefined();

    const keypairs = [kp!, kp1!];

    expect(keypairs).toBeDefined();

    const signatures = ablockInstance.signMessage(keypairs, MSG).content?.signMessageResponse;

    expect(signatures).toBeDefined();

    const result = ablockInstance.verifyMessage(MSG, signatures!, keypairs)

    expect(result.status).toBe('success');

    const kp2 = ablockInstance.getNewKeypair([kpAddr!, kp1!.address]).content?.newKeypairResponse;

    expect(kp2).toBeDefined();

    const keypairs1 = [kp!, kp2!];

    const result1 = ablockInstance.verifyMessage(MSG, signatures!, keypairs1)
    console.log('RESULT 1: ', result1)
    expect(result1.status).toBe('error');

    // if (kp.content?.newKeypairResponse && kp1?.content?.newKeypairResponse)
    //     keypairs = [kp.content.newKeypairResponse, kp1.content.newKeypairResponse];

    //     if (keypairs) {
    //         const signatures = await ablockInstance.signMessage(keypairs, MSG);
    // ¨       const result = await ablockInstance.verifyMessage(MSG, signatures.content?.signMessageResponse, keypairs);
    //         console.log(result)
    //     }

    // const kp = ablockInstance.getNewKeypair([]);

    // await ablockInstance.signMessage(,)
});
