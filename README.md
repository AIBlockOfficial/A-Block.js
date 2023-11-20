<div id="top"></div>

<!-- PROJECT LOGO -->
<br />

<div align="center">
  <a>
    <img src="https://github.com/ABlockOfficial/A-Block.js/blob/main/assets/hero.svg" alt="Logo" style="width: 150px">
  </a>

  <h3 align="center">A-Block.js</h3>

  <div>
  <img src="https://img.shields.io/github/actions/workflow/status/ABlockOfficial/A-Block.js/.github/workflows/codeql-analysis.yml?branch=main" alt="Pipeline Status" style="display:inline-block"/>
  <img src="https://img.shields.io/npm/v/@a-block/a-blockjs" alt="Pipeline Status" style="display:inline-block"/>
  </div>

  <p align="center">
    JavaScript/TypeScript API wrapper to help interact with the A-Block blockchain network.
    <br />
    <br />
    <a href="https://a-block.io"><strong>Official documentation »</strong></a>
    <br />
    <br />
  </p>

[Français](https://github.com/ABlockOfficial/A-Block.js/blob/main/README-FR.md) | [Deutsch](https://github.com/ABlockOfficial/A-Block.js/blob/main/README-DE.md)

</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
    </li>
    <li>
      <a href="#installation">Installation</a>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
    </li>
     <li>
      <a href="#usage">Usage</a>
      <ul>
        <li><a href="#generating-and-testing-seed-phrases">Generating and Testing Seed Phrases</a></li>
        <li><a href="#generating-key-pairs">Generating Key-pairs</a></li>
        <li><a href="#updating-the-balance">Updating the Balance</a></li>
        <li><a href="#creating-receipt-assets">Creating Receipt Assets</a></li>
        <li><a href="#spending-tokens">Spending Tokens</a></li>
        <li><a href="#spending-receipts">Spending Receipts</a></li>
        <li><a href="#fetching-pending-receipt-based-payments">Fetching Pending Receipt-based Payments</a></li>
        <li><a href="#responding-to-pending-receipt-based-payments">Responding to Pending Receipt-based Payments</a></li>
      </ul>
    </li>
    <li>
      <a href="#client-response-type">Client Response Type</a>
    </li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->

## About The Project

This module aims to ease the development of wallet applications that interact with the ABlock network.

Specific areas of focus include:

-   Key-pair generation through the use of BIP39 mnemonic implementation.
-   Encryption and decryption of key-pairs during operations safely.
-   Transactions and other complex network interactions simplified.

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- GETTING STARTED -->

## Installation

Install the module to your project:

-   npm

    ```sh
    npm install @a-block/a-blockjs
    ```

-   yarn

    ```sh
    yarn add @a-block/a-blockjs
    ```

<p align="right">(<a href="#top">back to top</a>)</p>

## Getting Started

-   `initNew`

```typescript
import { ABlockWallet } from '@a-block/a-blockjs';

const CONFIG = {
  mempoolHost: 'example.mempool.host.com',
  passphrase: 'a secure passphrase',
/* Optional, subject to certain requests not being usable.
  storageHost: example.storage.host.com;
  intercomHost: example.intercom.host.com;
  notaryHost: example.notary.host.com;
*/
};

// Create the wallet object
const wallet = new ABlockWallet();
// Initialize the wallet with the needed configuration
// NOTE: This is an async call
wallet
    .initNew(CONFIG)
    .then((res) => {
        // Display the seed phrase to the user for safe keeping
        display(res.content.initNewResponse.seedphrase);
        // Store the encrypted master key safely
        saveMasterKey(res.content.initNewResponse.masterKey);
    });
```

When the wallet is initialized without a pre-generated seed phrase or existing master key, the `initNew` function is used to initialize the wallet. This type of initialization will in return provide a generated seed phrase as well as its corresponding master key in an encrypted format. It is then up to the developer to store this master key somewhere safe, and to display the seed phrase at least once to the user for safe-keeping. This seed phrase can be used to re-construct lost key-pairs if the need should arise.

Some arguments during the initialization are optional, such as the `initOffline`- which is used to initialize the wallet in an offline state.

The `computeHost` and `intercomHost` interface elements are used to determine the API endpoints for the Compute node, and ABlock Intercom server the wallet is supposed to connect to, respectively.

A user-defined `passPhrase` needs to be supplied to the wallet during initialization, as this passphrase will be used to encrypt/decrypt data during operations.

-   `fromMasterKey`

```typescript
// Initialize the wallet with the needed configuration
wallet.fromMasterKey(masterKey, CONFIG);
```

When an existing master key exists, this type of initialization **should** be used. This typically occurs when the wallet has been initialized previously using `initNew` and the encrypted master key has been stored safely. Using an existing master key will ensure that BIP39 key-pair derivation is consistent. This type of initialization does not have a return value.

-   `fromSeed`

```typescript
const sp = 'existing seed phrase';
// Initialize the wallet with the needed configuration
wallet.fromSeed(sp, CONFIG).then((res) => {
  // Store the encrypted master key safely
  saveMasterKey(initResult.content.fromSeedResponse);
});
```

Initialization of the wallet through the use of an existing seed phrase may happen for one of two reasons:

<ol>
<li>
The user has lost their key-pairs and re-generation is needed by providing the seed phrase.
</li>
<li>
A valid seed phrase has been pre-generated due to specific UX design constraints and needs to be used to initialize the wallet.
</li>
</ol>

This type of initialization will return the corresponding master key (in an encrypted format) which was created using the provided seed phrase. This master key needs to be stored safely in the same manner as initialization using `initNew`.

<details>
<summary>Offline Initialization</summary>
<br/>

```typescript
import { ABlockWallet } from '@a-block/a-blockjs';

// Create the wallet object
const wallet = new ABlockWallet();

// Initialize the wallet with the needed configuration
const initResult = wallet.initNew({passphrase: 'a secure passphrase'}, true).then((initResult) => {
    const [seedPhrase, masterKeyEncrypted] = initResult.content.initNewResponse;

    // Display the seed phrase to the user for safe keeping
    display(seedPhrase);

    // Store the encrypted master key safely
    saveMasterKey(masterKeyEncrypted);
});

// Configuration
const config = {
  mempoolHost: 'example.mempool.host.com',
  storageHost: 'example.storage.host.com';
  intercomHost: 'example.intercom.host.com';
  notaryHost: 'example.notary.host.com';
};

// Initialize network configuration when required
const initNetworkResult = wallet.initNetwork(config);
```

In some cases, it might be desirable to initialize the wallet without a network connection. This will allow the wallet to be used offline, but will inadvertently prevent the wallet from being able to perform any operations that require interaction with the ABlock network. The following functions are available with an offline configuration:

-   `regenAddresses` - Re-generate lost key-pairs from a list of given addresses.
-   `getNewKeypair` - Generate a new key-pair.
-   `getSeedPhrase` - Get the existing seed phrase from memory (requires initialization from seed phrase).
-   `getMasterKey` - Get the existing master key from memory.

</details>

<details>
<summary>User-defined Methods</summary>
<br/>

```typescript
  function saveMasterKey(masterKeyEncrypter: IMasterKeyEncrypted): void {
    // Write your I/O operations here to safely store the encrypted master key
    ...
  }

  function getMasterKey(): IMasterKeyEncrypted {
    // Write your I/O operations here to safely retrieve
    // the encrypted master key
    ...
  }

  function saveKeypair(keyPair: IKeyPairEncrypted): void {
    // Write your I/O operations here to safely store the key pair
    ...
  }

  function getKeypairs(): IKeyPairEncrypted[] {
    // Write your I/O operations here to safely retrieve
    // the encrypted key pairs
    ...
  }

  function getAllEncryptedTxs(): ICreateTransactionEncrypted[] {
    // Write your I/O operations here to get all encrypted
    // transactions
    ...
  }

  function saveEncryptedTx(druid: string, encryptedTx: ICreateTransactionEncrypted): void {
    // Write your I/O operations here to save the encrypted transaction
    // with its corresponding DRUID value in a key-value format
    ...
  }

```

Many methods will either **require** or **return** different types of data depending on the operation. It is entirely up to the developer to store and retrieve data safely.

</details>
<p align="right">(<a href="#top">back to top</a>)</p>

## Usage

After the wallet has been correctly initialized, the methods provided by the wallet will allow the developer to interact with the ABlock blockchain network.

### Generating and Testing Seed Phrases

-   `generateSeedPhrase`

    ```typescript
    import { generateSeedPhrase } from '@a-block/a-blockjs';

    const seedPhrase = generateSeedPhrase();
    ```

-   `testSeedPhrase`

    ```typescript
    import { testSeedPhrase } from '@a-block/a-blockjs';

    const seedPhrase = 'a seed phrase provided by the user that looks like a bunch of random words';

    const testResult = testSeedPhrase(seedPhrase);
    ```

As seen previously, depending on the scenario, the wallet can be initialized in a number of different ways. If the wallet is initialized using `initNew`, a new seed phrase will be generated automatically. However, in some cases the wallet needs to be initialized using a pre-generated or provided seed phrase.

The `generateSeedPhrase` method is provided by the module to generate valid new seed phrases on the fly. This is especially useful in cases where UX design constraints require a valid seed phrase to be generated and displayed to the user before the wallet is initialized.

Since a seed phrase can be used to reconstruct lost/missing key-pairs, it is customary for the user to be able to provide their own seed phrase should the need arise. To test if the seed phrase is capable of constructing a valid master key, the `testSeedPhrase` method should be used.

### Generating Key-pairs

-   `getNewKeypair`

    ```typescript
    import { ABlockWallet } from '@a-block/a-blockjs';

    const wallet = new ABlockWallet();

    // Initialize the wallet correctly
    ...

    // The array argument can contain existing keypairs to be used
    const newKeypairResult = wallet.getNewKeypair([]);

    const newKeypair: IKeypairEncrypted = newKeypairResult.content.newKeypairResponse;

    // Save the key-pair safely
    saveKeypair(newKeypair);

    // Get the associated address
    const address = newKeypair.address;
    ```

### Updating the Balance

-   `fetchBalance`

    ```typescript
    import { ABlockWallet } from '@a-block/a-blockjs';

    const wallet = new ABlockWallet();

    // Initialize the wallet correctly
    ...

    const allKeypairs = getKeyPairs();

    // We only need the 'address' field of the key-pairs
    const addressList = allKeypairs.map(keypair => keypair.address);

    const balanceResult = await wallet.fetchBalance(addressList);

    const balance: IFetchBalanceResponse = balanceResult.content.fetchBalanceResponse;
    ```

    <details>
    <summary>Response Content</summary>
    <br/>

    ```json
    {
        "total": {
            "tokens": 0,
            "receipts": {
                "default_drs_tx_hash": 1000,
                "g7d07...6704b": 1000
            }
        },
        "address_list": {
            "a0b08...c02e5": [
                {
                    "out_point": {
                        "t_hash": "g3b13...3353f",
                        "n": 0
                    },
                    "value": {
                        "Receipt": {
                            "amount": 1000,
                            "drs_tx_hash": "default_drs_tx_hash"
                        }
                    }
                },
                {
                    "out_point": {
                        "t_hash": "g7d07...6704b",
                        "n": 0
                    },
                    "value": {
                        "Receipt": {
                            "amount": 1000,
                            "drs_tx_hash": "g7d07...6704b"
                        }
                    }
                },
                {
                    "out_point": {
                        "t_hash": "ga070...4df62",
                        "n": 0
                    },
                    "value": {
                        "Token": 60000
                    }
                }
            ]
        }
    }
    ```

    -   `total`: The total balance of all addresses provided
    -   `address_list`: A list of addresses and their previous out-points along with their associated assets

    </details>

### Creating Receipt Assets

Receipts are the NFTs of the ABlock blockchain, but unlike NFTs don't require you to write any Smart Contracts
or complex logic to create.

-   `createReceipts`

| **Argument**     | **Type**            | **Default** | **Required** | **Description**                                                                                                                                                                            |
| ---------------- | ------------------- | ----------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| address          | `IKeypairEncrypted` |             | yes          | The keypair to generate the address that the Receipt assets will be sent to once generated                                                                                                 |
| defaultDrsTxHash | `boolean`           | true        | no           | Setting this to `true` will create generic Receipts, while setting it to `false` will generate a genesis transaction hash unique to these Receipts. Use `false` if you want to create NFTs |
| amount           | `number`            | 1000        | no           | The number of Receipt assets to mint                                                                                                                                                       |
| metadata         | `string`            | null        | no           | Optional metadata that you can attach to the asset                                                                                                                                         |

```typescript
import { ABlockWallet } from '@a-block/a-blockjs';

const wallet = new ABlockWallet();

// Initialize the wallet correctly
...

// Address / key-pair to assign the `Receipt` assets to
const keyPair = getKeypairs()[0];

// Create `Receipt` assets that have the default DRS identifier
const createReceiptResponse = await wallet.createReceipts(keyPair).content.createReceiptResponse;

<!-- --------------------------------- OR ---------------------------------- -->

// Create `Receipt` assets that have a unique DRS identifier
const createReceiptResponse = await wallet.createReceipts(keyPair, false).content.createReceiptResponse;

<!-- --------------------------------- ALL ARGUMENTS VERSION ---------------------------------- -->

const createReceiptResponse = await wallet.createReceipts(
  keyPair,
  false,
  10000,
  "{ 'imageURL': '...', 'description': '...' }"
).content
.createReceiptResponse;

```

`Receipt` assets can either be assigned to the default digital rights signature (DRS) or a unique DRS. When assets have different DRS identifiers they are **not** mutually interchangeable with each other.

  <details>
  <summary>Response Content</summary>
  <br/>

```json
{
    "asset": {
        "asset": {
            "Receipt": {
                "amount": 1000,
                "drs_tx_hash": "g7d07...6704b"
            }
        },
        "metadata": null
    },
    "to_address": "a0b08...c02e5",
    "tx_hash": "g7d07...6704b"
}
```

-   `drs_tx_hash`: The DRS identifier associated with the created `Receipt` assets.

</details>

### Spending Tokens

-   `makeTokenPayment`

| **Argument**   | **Type**               | **Default** | **Required** | **Description**                                                                                                                 |
| -------------- | ---------------------- | ----------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| paymentAddress | `string`               |             | yes          | Address to make the token payment to                                                                                            |
| paymentAmount  | `number`               |             | yes          | Amount of tokens to pay                                                                                                         |
| allKeypairs    | `IKeypairEncrypted []` |             | yes          | Keypairs to use to make the payment. Must have token balance associated with these keypairs in order to process the transaction |
| excessKeypair  | `IKeypairEncrypted`    |             | yes          | Excess keypair to send any remaining balance to                                                                                 |

```typescript
import { ABlockWallet } from '@a-block/a-blockjs';

const wallet = new ABlockWallet();

// Initialize the wallet correctly
...

// All key-pairs
const allKeypairs = getKeyPairs();

// Change/excess key-pair
const changeKeyPair = allKeypairs[0];

await makeTokenPayment(
      "d0e72...85b46", // Payment address
      10,              // Payment amount
      allKeypairs,     // All key-pairs
      changeKeyPair,   // Excess/change address
  );

```

**_NB_**: _The `makeTokenPayment` method will not check validity of the payment address. It is therefore crucial to ensure a valid payment address is used before the payment gets made._

### Spending Receipts

-   `makeReceiptPayment`

| **Argument**   | **Type**               | **Default** | **Required** | **Description**                                                                                                                 |
| -------------- | ---------------------- | ----------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| paymentAddress | `string`               |             | yes          | Address to make the token payment to                                                                                            |
| paymentAmount  | `number`               |             | yes          | Amount of tokens to pay                                                                                                         |
| drsTxHash      | `string`               |             | yes          | The genesis transaction hash of the Receipt asset to spend. This is the unique identifier of the Receipt asset                  |
| allKeypairs    | `IKeypairEncrypted []` |             | yes          | Keypairs to use to make the payment. Must have token balance associated with these keypairs in order to process the transaction |
| excessKeypair  | `IKeypairEncrypted`    |             | yes          | Excess keypair to send any remaining balance to                                                                                 |

```typescript
import { ABlockWallet } from '@a-block/a-blockjs';

const wallet = new ABlockWallet();

// Initialize the wallet correctly
...

// All key-pairs
const keyPairs = getKeypairs();

// Change/excess key-pair
const changeKeyPair = keyPairs[0];

// DRS identifier (the default DRS identifier or a unique DRS identifier)
const drsTxHash = "default_drs_tx_hash";

await makeReceiptPayment(
        "d0e72...85b46", // Payment address
        10,              // Payment amount
        drsTxHash,       // DRS identifier
        allKeypairs,     // All key-pairs
        changeKeyPair,   // Excess/change address
    );

```

**_NB_**: _The `makeReceiptPayment` method is similar to the `makeTokenPayment` in many regards, one of which being the fact that this method will send `Receipt` assets to a payment address in a unidirectional fashion and does not expect any assets in return. It should not be confused with **receipt-based** payments!_

### Making Receipt-based Payments

-   `makeRbPayment`

| **Argument**   | **Type**                       | **Default** | **Required** | **Description**                              |
| -------------- | ------------------------------ | ----------- | ------------ | -------------------------------------------- |
| paymentAddress | `string`                       |             | yes          | Address to make the token payment to         |
| sendingAsset   | `IAssetReceipt \| IAssetToken` |             | yes          | The asset to pay                             |
| receivingAsset | `IAssetReceipt \| IAssetToken` |             | yes          | The asset to receive                         |
| allKeypairs    | `IKeypairEncrypted[]`          |             | yes          | A list of all existing key-pairs (encrypted) |
| receiveAddress | `IKeypairEncrypted`            |             | yes          | A keypair to assign the "receiving" asset to |

```typescript
import { ABlockWallet } from '@a-block/a-blockjs';

const wallet = new ABlockWallet();

// Initialize the wallet correctly
...

// All key-pairs
const allKeypairs = getKeyPairs();

// Receive address (which is also the excess/change address)
const receivingAddress = allKeypairs[0];

// The asset we want to send
const sendingAsset = initIAssetToken({"Token": 10});

// The asset we want to receive
const receivingAsset = initIAssetReceipt({
  "Receipt": {
      "amount": 10,
      "drs_tx_hash": "default_drs_tx_hash"
  }});

const paymentResult = await makeRbPayment(
      "18f70...caeda",  // Payment address
      sendingAsset,     // Payment asset
      receivingAsset,   // Receiving asset
      allKeypairs,      // All key-pairs
      receivingAddress, // Receive address
  );

  const { druid, encryptedTx } = paymentResult.content.makeRbPaymentResponse;

  // Save the encrypted transaction along
  // with it's corresponding DRUID value
  saveEncryptedTx(druid, encryptedTx);

```

**_NB_**: _This type of transaction is a Dual-Double-Entry (DDE) transaction, and requires all parties to reach common consent before their respective transactions are sent to the compute node for processing._

### Fetching Pending Receipt-based Payments

-   `fetchPendingRbTransactions`

    ```typescript
    import { ABlockWallet } from '@a-block/a-blockjs';

    const wallet = new ABlockWallet();

    // Initialize the wallet correctly
    ...

    // ALl key-pairs
    const allKeypairs = getKeyPairs();

    // All encrypted transactions
    const allEncryptedTxs = getAllEncryptedTxs();

    // Fetch pending receipt-based payments
    const pendingRbTransactionsResult = await wallet.fetchPendingRbTransactions(
          allKeypairs,
          allEncryptedTxs:,
      )

    const pendingRbTransactions: IResponseIntercom<IPendingRbTxDetails> = pendingRbTransactionsResult.content.fetchPendingRbResponse;

    ```

    <details>
    <summary>Response Content</summary>
    <br/>

    ```json
    {
        "2a646...f8b98": {
            "timestamp": 1655117144145,
            "value": {
                "druid": "DRUID0xd0f407436f7f1fc494d7aee22939090e",
                "senderExpectation": {
                    "from": "",
                    "to": "2a646...f8b98",
                    "asset": {
                        "Receipt": {
                            "amount": 1,
                            "drs_tx_hash": "default_drs_tx_hash"
                        }
                    }
                },
                "receiverExpectation": {
                    "from": "295b2...8d4fa",
                    "to": "18f70...caeda",
                    "asset": {
                        "Token": 25200
                    }
                },
                "status": "pending",
                "computeHost": "http://127.0.0.1:3003"
            }
        }
    }
    ```

    From this data structure we're able to obtain specific details about the receipt-based payment, such as the unique identifier `DRUID0xd0f407436f7f1fc494d7aee22939090e`, the status of the transaction `status`, the timestamp of the transaction `timestamp`, as well as the address that made the receipt-based payment request- `2a646...f8b98`.

    We are also able to see that in this specific request, the sender expects 1 `Receipt` asset in exchange for 25200 `Token` assets.
    </details>

### Responding to Pending Receipt-based Payments

-   `acceptRbTx` and `rejectRbTx`

    ```typescript
    import { ABlockWallet } from '@a-block/a-blockjs';

    const wallet = new ABlockWallet();

    // Initialize the wallet correctly
    ...

    // Fetch the pending receipt-based payments from the network
    ...
    const pendingRbTransactions: IFetchPendingRbResponse = pendingRbTransactionsResult.content.fetchPendingRbResponse;

    // Fetch all existing key-pairs
    ...
    const allKeypairs = getKeyPairs();

    // Accept a receipt-based payment using its unique `DRUID` identifier
    await wallet.acceptRbTx('DRUID0xd0f407436f7f1fc494d7aee22939090e', pendingRbTransactions, allKeypairs);

    <!-- --------------------------------- OR ---------------------------------- -->

    // Reject a receipt-based payment using its unique `DRUID` identifier
    await wallet.rejectRbTx('DRUID0xd0f407436f7f1fc494d7aee22939090e', pendingRbTransactions, allKeypairs);
    ```

    Receipt-based transactions are accepted **or** rejected by passing their unique DRUID identifier as an argument to the corresponding methods.

<p align="right">(<a href="#top">back to top</a>)</p>

## Client Response Type

All methods provided by the wallet have a return value corresponding to the following interface:

```typescript
export type IClientResponse = {
    id?: string;
    status: 'success' | 'error' | 'pending' | 'unknown';
    reason?: string;
    content?: IContentType;
};
```

, where each field represents the following:

-   `status`: A general indication of success or failure for the method being used

-   `id`: A unique identifier used for network interactions

-   `reason`: Detailed feedback corresponding to the `status` field

-   `content`: Data structures or values returned from the wallet object

<p align="right">(<a href="#top">back to top</a>)</p>
