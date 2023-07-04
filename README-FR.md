<div id="top"></div>

<!-- LOGO DU PROJET -->
<br />

<div align="center">
  <a>
    <img src="https://github.com/Zenotta/ZenottaJS/blob/develop/assets/hero.svg" alt="Logo" style="width: 350px">
  </a>

  <h3 align="center">Zenotta-JS</h3>

  <div>
  <img src="https://img.shields.io/github/actions/workflow/status/Zenotta/ZenottaJS/.github/workflows/codeql-analysis.yml?branch=main" alt="État du pipeline" style="display:inline-block"/>
  <img src="https://img.shields.io/npm/v/@zenotta/zenotta-js" alt="État du pipeline" style="display:inline-block"/>
  </div>

  <p align="center">
    Un module JavaScript pour faciliter l'interaction avec le réseau blockchain Zenotta.
    <br />
    <br />
    <a href="https://zenotta.io"><strong>Documentation officielle »</strong></a>
    <br />
    <br />
  </p>
</div>

<!-- Table des matières -->
<details>
  <summary>Table des matières</summary>
  <ol>
    <li>
      <a href="#à-propos-du-projet">À propos du projet</a>
    </li>
    <li>
      <a href="#installation">Installation</a>
    </li>
    <li>
      <a href="#premiers-pas">Premiers pas</a>
    </li>
     <li>
      <a href="#utilisation">Utilisation</a>
      <ul>
        <li><a href="#génération-et-test-de-phrases-de-départ">Génération et test de phrases de départ</a></li>
        <li><a href="#génération-de-paires-de-clés">Génération de paires de clés</a></li>
        <li><a href="#mise-à-jour-du-solde">Mise à jour du solde</a></li>
        <li><a href="#création-d'actifs-de-reçu">Création d'actifs de reçu</a></li>
        <li><a href="#dépense-de-jetons">Dépense de jetons</a></li>
        <li><a href="#dépense-de-reçus">Dépense de reçus</a></li>
        <li><a href="#récupération-des-paiements-en-attente-basés-sur-les-reçus">Récupération des paiements en attente basés sur les reçus</a></li>
        <li><a href="#réponse-aux-paiements-en-attente-basés-sur-les-reçus">Réponse aux paiements en attente basés sur les reçus</a></li>
      </ul>
    </li>
    <li>
      <a href="#type-de-réponse-du-client">Type de réponse du client</a>
    </li>
  </ol>
</details>

<!-- À propos du projet -->
## À propos du projet

Ce module vise à faciliter le développement d'applications de portefeuille qui interagissent avec le réseau Zenotta.

Les domaines spécifiques d'intérêt comprennent :

* Génération de paires de clés grâce à l'implémentation mnémonique BIP39.
* Chiffrement et déchiffrement sécurisés des paires de clés lors des opérations.
* Simplification des transactions et autres interactions complexes avec le réseau.

<p align="right">(<a href="#top">retour en haut</a>)</p>

<!-- COMMENCER -->
## Installation

Installez le module dans votre projet :

* npm

  ```sh
  npm install @zenotta/zenotta-js
  ```

* yarn

  ```sh
  yarn add @zenotta/zenotta-js
  ```

<p align="right">(<a href="#top">retour en haut</a>)</p>

## Premiers pas

* `initNew`

  ```typescript
  import { ZenottaInstance } from '@zenotta/zenotta-js';

  const COMPUTE_HOST = 'exemple.hote.calcul.com'
  const INTERCOM_HOST = 'exemple.hote.intercom.com'
  const PASSPHRASE = 'une phrase secrète'

  // Créez l'objet client
  const client = new ZenottaInstance();

  // Initialisez le client avec la configuration nécessaire
  // REMARQUE : C'est un appel asynchrone
  client.initNew({
      computeHost: COMPUTE_HOST,
      intercomHost: INTERCOM_HOST,
      passPhrase: PASSPHRASE,
    }
  ).then((initResult) => {
    // Affichez la phrase de récupération à l'utilisateur pour la conserver en sécurité
    displaySeedPhrase(initResult.content.initNewResponse[0]);

    // Enregistrez la clé maître chiffrée en toute sécurité
    saveMasterKey(initResult.content.initNewResponse[1]);
  });
  ```
  
Lorsque le client est initialisé sans phrase de récupération pré-générée ou clé maître existante, la fonction `initNew` est utilisée pour initialiser le client. Ce type d'initialisation fournira une phrase de récupération générée ainsi que sa clé maître correspondante sous une forme chiffrée. Il incombe ensuite au développeur de stocker cette clé maître en lieu sûr et d'afficher la phrase de récupération au moins une fois à l'utilisateur pour qu'il la conserve en sécurité. Cette phrase de récupération peut être utilisée pour reconstruire des paires de clés perdues si nécessaire.

Certains arguments lors de l'initialisation sont facultatifs, tels que `initOffline`, qui est utilisé pour initialiser le client dans un état hors ligne.

Les éléments d'interface `computeHost` et `intercomHost` sont utilisés pour déterminer les points d'extrémité de l'API pour le nœud de Calcul et le serveur Zenotta Intercom auxquels le client doit se connecter, respectivement.

Une `passPhrase` définie par l'utilisateur doit être fournie au client lors de l'initialisation, car cette phrase sera utilisée pour chiffrer/déchiffrer les données lors des opérations.

* `initFromMasterKey`

  ```typescript
  import { ZenottaInstance } from '@zenotta/zenotta-js';

  const COMPUTE_HOST = 'exemple.hote.calcul.com'
  const INTERCOM_HOST = 'exemple.hote.intercom.com'
  const PASSPHRASE = 'une phrase secrète'

```javascript
// Créez l'objet client
const client = new ZenottaInstance();

// Initialisez le client avec la configuration nécessaire
client.initFromMasterKey({
    computeHost: COMPUTE_HOST,
    intercomHost: INTERCOM_HOST,
    passPhrase: PASSPHRASE,
  },
  masterKey: getMasterKey()
);
```

Lorsqu'une clé maître existante est disponible, ce type d'initialisation **doit** être utilisé. Cela se produit généralement lorsque le client a été initialisé précédemment à l'aide de `initNew` et que la clé maître chiffrée a été stockée en toute sécurité. L'utilisation d'une clé maître existante garantira une dérivation cohérente des paires de clés BIP39. Ce type d'initialisation ne renvoie aucune valeur.

* `initFromSeed`

```typescript
import { ZenottaInstance } from '@zenotta/zenotta-js';

const COMPUTE_HOST = 'example.compute.host.com'
const INTERCOM_HOST = 'example.intercom.host.com'
const PASSPHRASE = 'une phrase secrète sécurisée'
const SEED_PHRASE = 'une phrase de départ qui devrait ressembler à un tas de mots aléatoires'

// Créez l'objet client
const client = new ZenottaInstance();

// Initialisez le client avec la configuration nécessaire
client.initFromSeed({
    computeHost: COMPUTE_HOST,
    intercomHost: INTERCOM_HOST,
    passPhrase: PASSPHRASE,
  },
  seedPhrase: SEED_PHRASE
).then((initResult) => {
  const masterKey = initResult.content.initFromSeedResponse;

  // Stockez la clé maître chiffrée en toute sécurité
  saveMasterKey(initResult.content.initFromSeedResponse);
});
```

L'initialisation du client en utilisant une phrase de départ existante peut se produire pour l'une des deux raisons suivantes :
<ol>
<li>
L'utilisateur a perdu ses paires de clés et une régénération est nécessaire en fournissant la phrase de départ.
</li>
<li>
Une phrase de départ valide a été pré-générée en raison de contraintes spécifiques de conception UX et doit être utilisée pour initialiser le client.
</li>
</ol>

Ce type d'initialisation renverra la clé maître correspondante (sous une forme chiffrée) qui a été créée à l'aide de la phrase de départ fournie. Cette clé maître doit être stockée en toute sécurité de la même manière que lors de l'initialisation à l'aide de `initNew`.

<details>
<summary>Initialisation hors ligne</summary>
<br/>

```typescript
import { ZenottaInstance } from '@zenotta/zenotta-js';

  const COMPUTE_HOST = 'example.compute.host.com'
  const INTERCOM_HOST = 'example.intercom.host.com'
  const PASSPHRASE = 'a secure passphrase'

  // Créez l'objet client
  const client = new ZenottaInstance();

  // Configuration
  const config = {
      computeHost: COMPUTE_HOST,
      intercomHost: INTERCOM_HOST,
      passPhrase: PASSPHRASE,
    };

  // Initialiser le client avec la configuration nécessaire
  const initResult = client.initNew(config, true).then((initResult) => {
    const [seedPhrase, masterKeyEncrypted] = initResult.content.initNewResponse;

    // Afficher la phrase de récupération à l'utilisateur pour une conservation sécurisée
    displaySeedPhrase(seedPhrase);

    // Stocker la clé maître chiffrée en toute sécurité
    saveMasterKey(masterKeyEncrypted);
  });

  // Initialiser la configuration réseau lorsque nécessaire
  const initNetworkResult = client.initNetwork(config);

```

Dans certains cas, il peut être souhaitable d'initialiser le client sans connexion réseau. Cela permettra d'utiliser le client hors ligne, mais empêchera par inadvertance le client d'effectuer des opérations nécessitant une interaction avec le réseau Zenotta. Les fonctions suivantes sont disponibles avec une configuration hors ligne :

* `regenAddresses` - Régénère les paires de clés perdues à partir d'une liste d'adresses données.
* `getNewKeypair` - Génère une nouvelle paire de clés.
* `getSeedPhrase` - Obtient la phrase de récupération existante à partir de la mémoire (nécessite une initialisation à partir de la phrase de récupération).
* `getMasterKey` - Obtient la clé maître existante à partir de la mémoire.

</details>

<details>
<summary>Méthodes définies par l'utilisateur</summary>
<br/>

```typescript
  function saveMasterKey(masterKeyEncrypter: IMasterKeyEncrypted): void {
    // Écrire ici vos opérations d'E/S pour stocker en toute sécurité la clé maître chiffrée
    ...
  }

  function getMasterKey(): IMasterKeyEncrypted {
    // Écrire ici vos opérations d'E/S pour récupérer en toute sécurité la clé maître chiffrée
    ...
  }

  function saveKeypair(keyPair: IKeyPairEncrypted): void {
    // Écrire ici vos opérations d'E/S pour stocker en toute sécurité la paire de clés
    ...
  }

  function getKeypairs(): IKeyPairEncrypted[] {
    // Écrire ici vos opérations d'E/S pour récupérer en toute sécurité les paires de clés chiffrées
    ...
  }

  function getAllEncryptedTxs(): ICreateTransactionEncrypted[] {
    // Écrire ici vos opérations d'E/S pour obtenir toutes les transactions chiffrées
    ...
  }

  function saveEncryptedTx(druid: string, encryptedTx: ICreateTransactionEncrypted): void {
    // Écrire ici vos opérations d'E/S pour enregistrer la transaction chiffrée avec sa valeur DRUID correspondante dans un format clé-valeur
    ...
  }

```

De nombreuses méthodes nécessiteront ou renverront différents types de données en fonction de l'opération. Il incombe entièrement au développeur de stocker et de récupérer les données en toute sécurité.
</details>
<p align="right">(<a href="#top">retour en haut</a>)</p>

## Utilisation

Une fois que le client a été correctement initialisé, les méthodes fournies par le client permettront au développeur d'interagir avec le réseau blockchain Zenotta.

### Génération et test de phrases de récupération

* `generateSeedPhrase`

  ```typescript
  import { generateSeedPhrase } from '@zenotta/zenotta-js';

  const seedPhrase = generateSeedPhrase();
  ```

* `testSeedPhrase`

  ```typescript
  import { testSeedPhrase } from '@zenotta/zenotta-js';

  const seedPhrase = "une phrase de récupération fournie par l'utilisateur qui ressemble à un tas de mots aléatoires";

  const testResult = testSeedPhrase(seedPhrase);
  ```

Comme nous l'avons vu précédemment, en fonction du scénario, le client peut être initialisé de différentes manières. Si le client est initialisé à l'aide de `initNew`, une nouvelle phrase de récupération sera générée automatiquement. Cependant, dans certains cas, le client doit être initialisé à l'aide d'une phrase de récupération pré-générée ou fournie.

La méthode `generateSeedPhrase` est fournie par le module pour générer dynamiquement de nouvelles phrases de récupération valides. Cela est particulièrement utile dans les cas où les contraintes de conception UX nécessitent qu'une phrase de récupération valide soit générée et affichée à l'utilisateur avant l'initialisation du client.

Étant donné qu'une phrase de départ peut être utilisée pour reconstruire des paires de clés perdues ou manquantes, il est courant que l'utilisateur puisse fournir sa propre phrase de départ si nécessaire. Pour tester si la phrase de départ est capable de construire une clé maître valide, la méthode `testSeedPhrase` doit être utilisée.

### Génération de paires de clés

* `getNewKeypair`

  ```typescript
  import { ZenottaInstance } from '@zenotta/zenotta-js';

  const client = new ZenottaInstance();

  // Initialiser correctement le client
  ...

  // L'argument du tableau peut contenir des paires de clés existantes à utiliser
  const newKeypairResult = client.getNewKeypair([]);

  const newKeypair: IKeypairEncrypted = newKeypairResult.content.newKeypairResponse;

  // Enregistrer la paire de clés en toute sécurité
  saveKeypair(newKeypair);

  // Obtenir l'adresse associée
  const address = newKeypair.address;
  ```

### Mise à jour du solde

* `fetchBalance`

  ```typescript
  import { ZenottaInstance } from '@zenotta/zenotta-js';

  const client = new ZenottaInstance();

  // Initialiser correctement le client
  ...

  const allKeypairs = getAllKeypairs();

  // Nous avons seulement besoin du champ 'address' des paires de clés
  const addressList = allKeypairs.map(keypair => keypair.address);

  const balanceResult = await client.fetchBalance(addressList);

  const balance: IFetchBalanceResponse = balanceResult.content.fetchBalanceResponse;
  ```
  
  <details>
  <summary>Contenu de la réponse</summary>
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

  * `total`: Le solde total de toutes les adresses fournies
  * `address_list`: Une liste d'adresses et de leurs points de sortie précédents ainsi que leurs actifs associés
  
  </details>

### Création d'actifs de reçu

Les reçus sont les NFT (jetons non fongibles) de la blockchain Zenotta, mais contrairement aux NFT, ils ne nécessitent pas l'écriture de contrats Intelligents ou de logique complexe pour être créés.

* `createReceipts`

| **Argument**     | **Type**            | **Default** | **Requis** | **Description**                                                                                                                                                                              |
|------------------|---------------------|-------------|-------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| address          | `IKeypairEncrypted` |             | oui         | La paire de clés pour générer l'adresse à laquelle les actifs de reçu seront envoyés une fois générés                                                                                       |
| defaultDrsTxHash | `boolean`           | true        | non         | En définissant cette valeur sur `true`, des reçus génériques seront créés, tandis qu'en la définissant sur `false`, un hachage de transaction de genèse unique à ces reçus sera généré. Utilisez `false` si vous souhaitez créer des NFT |
| amount           | `number`            | 1000        | non         | Le nombre d'actifs de reçu à créer                                                                                                                                                           |
| metadata         | `string`            | null        | non         | Métadonnées facultatives que vous pouvez attacher à l'actif                                                                                                                                  |

  ``` typescript
  import { ZenottaInstance } from '@zenotta/zenotta-js';
  
  const client = new ZenottaInstance();

  
  // Initialiser correctement le client
  ...
  
  // Adresse / paire de clés pour attribuer les actifs `Receipt`
  const keyPair = getAllKeypairs()[0];
  
  // Créer des actifs `Receipt` avec l'identifiant DRS par défaut
  const createReceiptResponse = await client.createReceipts(keyPair).content.createReceiptResponse;
  
  <!-- --------------------------------- OU ---------------------------------- -->
  
  // Créer des actifs `Receipt` avec un identifiant DRS unique
  const createReceiptResponse = await client.createReceipts(keyPair, false).content.createReceiptResponse;

  <!-- --------------------------------- VERSION AVEC TOUS LES ARGUMENTS ---------------------------------- -->

  const createReceiptResponse = await client.createReceipts(
    keyPair,
    false,
    10000,
    "{ 'imageURL': '...', 'description': '...' }"
  ).content
  .createReceiptResponse;
  
  ```

  Les actifs `Receipt` peuvent être attribués soit à la signature numérique des droits (DRS) par défaut, soit à un DRS unique. Lorsque les actifs ont des identifiants DRS différents, ils ne sont **pas** interchangeables entre eux.
  
  <details>
  <summary>Contenu de la réponse</summary>
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

  * `drs_tx_hash`: L'identifiant DRS associé aux actifs `Receipt` créés.
  
</details>

### Dépense de jetons

* `makeTokenPayment`

| **Argument**   | **Type**               | **Default** | **Requis** | **Description**                                                                                                                  |
|----------------|------------------------|-------------|--------------|----------------------------------------------------------------------------------------------------------------------------------|
| paymentAddress | `string`               |             | oui          | Adresse à laquelle effectuer le paiement en jetons                                                                                             |
| paymentAmount  | `number`               |             | oui          | Montant de jetons à payer                                                                                                          |
| allKeypairs    | `IKeypairEncrypted []` |             | oui          | Paires de clés à utiliser pour effectuer le paiement. Ces paires de clés doivent avoir un solde de jetons associé pour pouvoir traiter la transaction |
| excessKeypair  | `IKeypairEncrypted`    |             | oui          | Paire de clés excédentaire pour envoyer tout solde restant                                                                                  |

  ```typescript
  import { ZenottaInstance } from '@zenotta/zenotta-js';

  const client = new ZenottaInstance();

  // Initialiser correctement le client
  ...

  // Toutes les paires de clés
  const allKeypairs = getAllKeypairs();

  // Paire de clés de changement/excédentaire
  const changeKeyPair = allKeypairs[0];

  await makeTokenPayment(
        "d0e72...85b46", // Adresse de paiement
        10,              // Montant du paiement
        allKeypairs,     // Toutes les paires de clés
        changeKeyPair,   // Adresse de changement/excédentaire
    );

  ```

  ***NB***: *La méthode `makeTokenPayment` ne vérifiera pas la validité de l'adresse de paiement. Il est donc crucial de s'assurer qu'une adresse de paiement valide est utilisée avant que le paiement ne soit effectué.*

### Dépense de reçus

* `makeReceiptPayment`

| **Argument**   | **Type**               | **Default** | **Requis** | **Description**                                                                                                                  |
|----------------|------------------------|-------------|--------------|----------------------------------------------------------------------------------------------------------------------------------|
| paymentAddress | `string`               |             | oui          | Adresse à laquelle effectuer le paiement en jetons                                                                                             |
| paymentAmount  | `number`               |             | oui          | Montant de jetons à payer                                                                                                          |
| drsTxHash      | `string`               |             | oui          | Le hachage de transaction génésis de l'actif Receipt à dépenser. Il s'agit de l'identifiant unique de l'actif Receipt                  |
| allKeypairs    | `IKeypairEncrypted []` |             | oui          | Paires de clés à utiliser pour effectuer le paiement. Ces paires de clés doivent avoir un solde de jetons associé pour pouvoir traiter la transaction |
| excessKeypair  | `IKeypairEncrypted`    |             | oui          | Paire de clés excédentaire pour envoyer tout solde restant                                                                                  |

``` typescript
import { ZenottaInstance } from '@zenotta/zenotta-js';

const client = new ZenottaInstance();

// Initialiser correctement le client
...

// Toutes les paires de clés
const keyPairs = getAllKeypairs();

// Changer/ajouter une paire de clés
const changeKeyPair = keyPairs[0];

// Identifiant DRS (l'identifiant DRS par défaut ou un identifiant DRS unique)
const drsTxHash = "default_drs_tx_hash";

await makeReceiptPayment(
        "d0e72...85b46", // Adresse de paiement
        10,              // Montant du paiement
        drsTxHash,       // Identifiant DRS
        allKeypairs,     // Toutes les paires de clés
        changeKeyPair,   // Adresse de changement/excédent
    );

```

***NB***: *La méthode `makeReceiptPayment` est similaire à la méthode `makeTokenPayment` à bien des égards, dont le fait que cette méthode enverra des actifs `Receipt` à une adresse de paiement de manière unidirectionnelle et n'attend aucun actif en retour. Il ne faut pas la confondre avec les paiements basés sur les reçus !*

### Réalisation de paiements basés sur les reçus

* `makeRbPayment`

| **Argument**   | **Type**                       | **Default** | **Required** | **Description**                              |
|----------------|--------------------------------|-------------|--------------|----------------------------------------------|
| paymentAddress | `string`                       |             | oui          | Adresse pour effectuer le paiement du jeton   |
| sendingAsset   | `IAssetReceipt \| IAssetToken` |             | oui          | L'actif à payer                              |
| receivingAsset | `IAssetReceipt \| IAssetToken` |             | oui          | L'actif à recevoir                           |
| allKeypairs    | `IKeypairEncrypted[]`          |             | oui          | Une liste de toutes les paires de clés existantes (chiffrées) |
| receiveAddress | `IKeypairEncrypted`            |             | oui          | Une paire de clés pour attribuer l'actif "reçu" |

```typescript
import { ZenottaInstance } from '@zenotta/zenotta-js';

const client = new ZenottaInstance();

// Initialiser correctement le client
...

// Toutes les paires clé-valeur
const toutesLesPaires = getAllKeypairs();

// Adresse de réception (qui est également l'adresse d'excédent/changement)
const adresseReception = toutesLesPaires[0];

// L'actif que nous voulons envoyer
const actifEnvoi = initIAssetToken({"Token": 10});

// L'actif que nous voulons recevoir
const actifReception = initIAssetReceipt({
  "Receipt":{
      "montant": 10,
      "drs_tx_hash": "default_drs_tx_hash"
  }});

const resultatPaiement = await makeRbPayment(
      "18f70...caeda",  // Adresse de paiement
      actifEnvoi,     // Actif de paiement
      actifReception,   // Actif de réception
      toutesLesPaires,      // Toutes les paires clé-valeur
      adresseReception, // Adresse de réception
  );

const { druid, encryptedTx } = paymentResult.content.makeRbPaymentResponse;

// Enregistrer la transaction chiffrée avec sa valeur DRUID correspondante
saveEncryptedTx(druid, encryptedTx);

```

***NB***: *Ce type de transaction est une transaction à double entrée double (DDE) et nécessite que toutes les parties parviennent à un consentement commun avant que leurs transactions respectives ne soient envoyées au nœud de calcul pour traitement.*

### Récupération des paiements en attente basés sur les reçus

* `fetchPendingRbTransactions`
  
  ```typescript
  import { ZenottaInstance } from '@zenotta/zenotta-js';

  const client = new ZenottaInstance();

  // Initialiser correctement le client
  ...

  // Toutes les paires de clés
  const allKeypairs = getAllKeypairs();

  // Toutes les transactions chiffrées
  const allEncryptedTxs = getAllEncryptedTxs();

  // Récupérer les paiements en attente basés sur les reçus
  const pendingRbTransactionsResult = await client.fetchPendingRbTransactions(
        allKeypairs,
        allEncryptedTxs:,
    )

  const pendingRbTransactions: IResponseIntercom<IPendingRbTxDetails> = pendingRbTransactionsResult.content.fetchPendingRbResponse;

  ```

  <details>
  <summary>Antwortinhalt</summary>
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
    À partir de cette structure de données, nous sommes en mesure d'obtenir des détails spécifiques sur le paiement basé sur le reçu, tels que l'identifiant unique `DRUID0xd0f407436f7f1fc494d7aee22939090e`, le statut de la transaction `status`, l'horodatage de la transaction `timestamp`, ainsi que l'adresse qui a effectué la demande de paiement basée sur le reçu - `2a646...f8b98`.

  Nous pouvons également voir que dans cette demande spécifique, l'expéditeur s'attend à recevoir 1 actif `Receipt` en échange de 25200 actifs `Token`.
  </details>
  
### Répondre aux paiements basés sur le reçu en attente

* `acceptRbTx` et `rejectRbTx`

  ```typescript
  import { ZenottaInstance } from '@zenotta/zenotta-js';
  
  const client = new ZenottaInstance();
  
  // Initialiser correctement le client
  ...
  
  // Récupérer les paiements en attente basés sur les reçus depuis le réseau
  ...
  const pendingRbTransactions: IFetchPendingRbResponse = pendingRbTransactionsResult.content.fetchPendingRbResponse;
  
  // Récupérer toutes les paires de clés existantes
  ...
  const allKeypairs = getAllKeypairs();
  
  // Accepter un paiement basé sur un reçu en utilisant son identifiant unique `DRUID`
  await client.acceptRbTx('DRUID0xd0f407436f7f1fc494d7aee22939090e', pendingRbTransactions, allKeypairs);
  
  <!-- --------------------------------- OR ---------------------------------- -->
  
  // Rejeter un paiement basé sur un reçu en utilisant son identifiant unique `DRUID`
  await client.rejectRbTx('DRUID0xd0f407436f7f1fc494d7aee22939090e', pendingRbTransactions, allKeypairs);
  ```

  Les transactions basées sur les reçus sont acceptées **ou** rejetées en passant leur identifiant DRUID unique en tant qu'argument aux méthodes correspondantes.
  
<p align="right">(<a href="#top">back to top</a>)</p>

## Client Response Type

Toutes les méthodes fournies par le client ont une valeur de retour correspondant à l'interface suivante:

```typescript
export type IClientResponse = {
    id?: string;
    status: 'success' | 'error' | 'pending' | 'unknown';
    reason?: string;
    content?: IContentType;
};
```

, où chaque champ représente ce qui suit :

* `status` : Une indication générale de la réussite ou de l'échec de la méthode utilisée

* `id` : Un identifiant unique utilisé pour les interactions réseau

* `reason` : Un retour d'information détaillé correspondant au champ `status`

* `content` : Des structures de données ou des valeurs renvoyées par l'objet client

<p align="right">(<a href="#top">retour en haut</a>)</p>
