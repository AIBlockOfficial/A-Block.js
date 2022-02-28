<div id="top"></div>

<!-- PROJECT LOGO -->
<br />

<div align="center">
  <a>
    <img src="https://pbs.twimg.com/profile_images/1398876828295643146/I9HgKjhJ_400x400.jpg" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">Zenotta-JS</h3>

  <p align="center">
    A JavaScript module to help interact with the Zenotta blockchain network.
    <br />
    <br />
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#configuration">Configuration</a></li>
        <li><a href="#generating-and-testing-a-seed-phrase">Generating and Testing a Seed Phrase</a></li>
        <li><a href="#initializing-the-client">Initializing the Client</a></li>
      </ul>
    </li>
     <li>
      <a href="#usage">Usage</a>
      <ul>
        <li><a href="#an-example">An Example</a></li>
        <li><a href="#response-types">Response Types</a></li>
      </ul>
    </li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->
## About The Project

This module aims to ease the development of desktop wallet applications that interact with the Zenotta network.

Specific areas of focus include:

* Key-pair generation through the use of BIP39 mnemonic implementation.
* Encryption, decryption and storing of key-pairs safely.
* Transactions and other complex network interactions simplified.

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- GETTING STARTED -->
## Getting Started

### Installation

Install the module to your project:

* npm

  ```sh
  npm install @zenotta/zenotta-js
  ```

* yarn

  ```sh
  npm yarn add @zenotta/zenotta-js
  ```

<!-- USAGE EXAMPLES -->
### Configuration

Before initializing an object instance, it's important to take note of the interface configuration that needs to be followed:

* `IClientConfig`

```typescript
export type IClientConfig = {
    callbacks: IMgmtCallbacks;
    computeHost: string;
    intercomHost: string;
    passPhrase: string;
    seedPhrase?: string;
    timeout?: number;
};

```

Some interface elements are optional, such as the `seedPhrase` or `timeout`- which are used to derive key-pairs and determine the maximum amount of time the client is allowed to wait for a response from the network, respectively.

* `IMgmtCallbacks`

```typescript
export type IMgmtCallbacks = {
    saveMasterKey: (saveInfo: string) => void;
    getMasterKey: () => string | null;
    saveKeypair: (address: string, saveInfo: string) => void;
    getKeypair: (address: string) => string | null;
    getAddresses: () => string[] | null;
    saveDRUID: (druid: string, saveInfo: string) => void;
    getDRUID: (druid: string) => string | null;
    getDRUIDs: () => string[] | null;
};
```

The `IMgmtCallbacks` interface depicts user-defined methods that need to be passed as callback functions during the client initialization. All of these functions require I/O read/write access. The implementation of these methods are entirely up to you.  

Methods with a single parameter, such as `saveMasterKey` have a single unique field that needs to be stored to disk. Methods with two parameters store values in a *key-value* format, an example of such a method is `saveKeypair`, which stores the public address (`address`) associated with encrypted key-pair information (`saveInfo`) to disk.

All methods that write to disk are assumed error-free, and return `void`. In contrast, methods that read from disk should either always return a `string` or `null` value- depending on whether the required information could be read from disk, or not.

### Generating and Testing a Seed Phrase

As seen above, providing a seed phrase is optional. If this argument is omitted, one will be generated for you automatically. You will be able to retrieve this auto-generated seed phrase using the `getSeedPhrase` method provided by the client object after initialization.

The `generateSeedPhrase` method is provided by the module to generate valid new seed phrases on the fly. These seed phrases can be used to initialize the client correctly.

Since a seed phrase can be used to reconstruct lost/missing key-pairs, it is customary for the user to be able to provide their own seed phrase should the need arise. To test if the seed phrase is valid, the `testSeedPhrase` can be used.

### Initializing the Client

  ```typescript
  const COMPUTE_HOST = 'example.compute.host.com'
  const INTERCOM_HOST = 'example.intercom.host.com'
  const PASSPHRASE = 'my secure passphrase'
  const SEED_PHRASE = 'generated seed phrase that would look like a bunch of random words'

  <!-- ------------------ User-defined I/O callback methods ------------------ -->

  function saveMasterKeyCallback(saveInfo: string): void {
    // Write your I/O write operations here
    ...
  }

  function getMasterKeyCallback(): string | null {
    // Write your I/O read operations here
    ...
  }

  function saveKeypairCallback(address: string, saveInfo: string): void {
    // Write your I/O write operations here
    ...
  }

  function getKeypairCallback(address: string): string | null {
    // Write your I/O read operations here
    ...
  }

  ...

  <!-- ----------- Create client object and initialize the object ------------ -->

  // Create the client object
  const client = new ZnpClient();

  // Initialize the client with the needed configuration
  client.init({
    callbacks: {
        saveMasterKey: saveMasterKeyCallback,
        getMasterKey: getMasterKeyCallback,
        saveKeypair: saveKeypairCallback,
        getKeypair: getKeypairCallback,
        getAddresses: getAddressesCallback,
        saveDRUID: saveDRUIDCallback,
        getDRUID: getDRUIDCallback,
        getDRUIDs: getDRUIDsCallback
      },
      computeHost: COMPUTE_HOST,
      intercomHost: INTERCOM_HOST,
      passPhrase: PASSPHRASE,
      seedPhrase: SEED_PHRASE,
    }
  )
  ```
  
<p align="right">(<a href="#top">back to top</a>)</p>
## Usage

### An Example
After the client has been correctly initialized, the methods provided by the object will allow the user to interact with the Zenotta network.

* Generating key-pairs:

```typescript
client.getNewAddress()
```

* Updating the balance:

```typescript
client.fetchBalance()
```

* Making payments:

```typescript
client.makeTokenPayment(
        /* Payment address */
        '268adaffa51ca67688406301762e46aef2b5b88f913e76627bf6dc7d46ff48f8',
        /* Payment amount */
        5             
    )
```

### Response Types

All methods provided by the client object have an interface corresponding to `IClientResponse`: 

```typescript
export type IClientResponse = {
    status: 'success' | 'error' | 'pending' | 'unknown';
    id?: string;
    reason?: string;
    clientContent?: IContentType;
    apiContent?: IApiContentType;
};
```

, where each field represents the following:

* `status`

A general indication of success or failure for the method being used

* `id`

A unqiue identifier used for network interactions

* `reason`

Feedback corresponding to the `status` field

* `clientContent`

Data structures or values returned from the client object itself

* `apiContent`

Data structures or values returned from interacting with the Zenotta network API endpoints

<p align="right">(<a href="#top">back to top</a>)</p>