<div id="top"></div>

<!-- PROJEKTLOGO -->
<br />

<div align="center">
  <a>
    <img src="https://github.com/ABlockOfficial/A-Block.js/blob/develop/assets/hero.svg" alt="Logo" style="width: 150px">
  </a>

  <h3 align="center">A-Block.js</h3>

  <div>
  <img src="https://img.shields.io/github/actions/workflow/status/ABlock/ABlockJS/.github/workflows/codeql-analysis.yml?branch=main" alt="Pipeline Status" style="display:inline-block"/>
  <img src="https://img.shields.io/npm/v/@a-block/a-blockjs" alt="Pipeline Status" style="display:inline-block"/>
  </div>

  <p align="center">
    Ein JavaScript-Modul, das die Interaktion mit dem A-Block-Blockchain-Netzwerk erleichtert.
    <br />
    <br />
    <a href="https://a-block.io"><strong>Offizielle Dokumentation »</strong></a>
    <br />
    <br />
  </p>
</div>

<!-- INHALTSVERZEICHNIS -->
<details>
  <summary>Inhaltsverzeichnis</summary>
  <ol>
    <li>
      <a href="#über-das-projekt">Über das Projekt</a>
    </li>
    <li>
      <a href="#installation">Installation</a>
    </li>
    <li>
      <a href="#erste-schritte">Erste Schritte</a>
    </li>
     <li>
      <a href="#verwendung">Verwendung</a>
      <ul>
        <li><a href="#generieren-und-testen-von-seed-phrasen">Generieren und Testen von Seed-Phrasen</a></li>
        <li><a href="#generieren-von-schlüsselpaaren">Generieren von Schlüsselpaaren</a></li>
        <li><a href="#aktualisieren-des-kontostands">Aktualisieren des Kontostands</a></li>
        <li><a href="#erstellen-von-empfangsassets">Erstellen von Empfangsassets</a></li>
        <li><a href="#ausgeben-von-tokens">Ausgeben von Tokens</a></li>
        <li><a href="#ausgeben-von-quittungen">Ausgeben von Quittungen</a></li>
        <li><a href="#abrufen-ausstehender-zahlungen-basierend-auf-quittungen">Abrufen ausstehender Zahlungen basierend auf Quittungen</a></li>
        <li><a href="#reaktion-auf-ausstehende-zahlungen-auf-basis-des-belegs">Reaktion auf ausstehende Zahlungen auf Basis des Belegs</a></li>
      </ul>
    </li>
    <li>
      <a href="#client-antworttyp">Client-Antworttyp</a>
    </li>
  </ol>
</details>

<!-- Über das Projekt -->

## Über das Projekt

Dieses Modul zielt darauf ab, die Entwicklung von Wallet-Anwendungen zu erleichtern, die mit dem ABlock-Netzwerk interagieren.

Spezifische Schwerpunkte sind:

-   Generierung von Schlüsselpaaren durch die Verwendung der BIP39-Mnemonic-Implementierung.
-   Verschlüsselung und Entschlüsselung von Schlüsselpaaren während sicherer Operationen.
-   Vereinfachte Transaktionen und andere komplexe Netzwerkinteraktionen.

<p align="right">(<a href="#top">zurück zum Anfang</a>)</p>

<!-- LOS GEHT'S -->

## Installation

Installieren Sie das Modul in Ihr Projekt:

-   npm

    ```sh
    npm install @a-block/a-blockjs
    ```

-   yarn

    ```sh
    yarn add @a-block/a-blockjs
    ```

<p align="right">(<a href="#top">zurück zum Anfang</a>)</p>

## Erste Schritte

-   `initNew`

    ```typescript
    import { ABlockWallet } from '@a-block/a-blockjs';

    const MEMPOOL_HOST = 'beispiel.berechnung.host.com';
    const INTERCOM_HOST = 'beispiel.intercom.host.com';
    const PASSPHRASE = 'ein sicheres Passwort';

    // Erstellen Sie das Client-Objekt
    const client = new ABlockWallet();

    // Initialisieren Sie den Client mit der benötigten Konfiguration
    // HINWEIS: Dies ist ein asynchroner Aufruf
    client
        .initNew({
            mempoolHost: MEMPOOL_HOST,
            intercomHost: INTERCOM_HOST,
            passPhrase: PASSPHRASE,
        })
        .then((initResult) => {
            // Zeigen Sie dem Benutzer die Seed-Phrase zur sicheren Aufbewahrung an
            displaySeedPhrase(initResult.content.initNewResponse[0]);

            // Speichern Sie den verschlüsselten Master-Key sicher
            saveMasterKey(initResult.content.initNewResponse[1]);
        });
    ```

Wenn der Client ohne vorab generierte Seed-Phrase oder vorhandenen Master-Key initialisiert wird, wird die Funktion `initNew` verwendet, um den Client zu initialisieren. Diese Art der Initialisierung liefert eine generierte Seed-Phrase sowie den entsprechenden Master-Key in verschlüsselter Form zurück. Es liegt dann in der Verantwortung des Entwicklers, diesen Master-Key an einem sicheren Ort zu speichern und die Seed-Phrase mindestens einmal dem Benutzer zur sicheren Aufbewahrung anzuzeigen. Diese Seed-Phrase kann verwendet werden, um verlorene Schlüsselpaare bei Bedarf wiederherzustellen.

Einige Argumente während der Initialisierung sind optional, wie z.B. `initOffline`, das verwendet wird, um den Client im Offline-Modus zu initialisieren.

Die Schnittstellen-Elemente `mempoolHost` und `intercomHost` werden verwendet, um die API-Endpunkte für den Mempool-Knoten bzw. den ABlock Intercom-Server festzulegen, mit denen der Client verbunden werden soll.

Während der Initialisierung muss dem Client ein benutzerdefiniertes `passPhrase` übergeben werden, da dieses Passwort zur Verschlüsselung/Entschlüsselung von Daten während der Operationen verwendet wird.

-   `initFromMasterKey`

    ```typescript
    import { ABlockWallet } from '@a-block/a-blockjs';

    const MEMPOOL_HOST = 'beispiel.berechnung.host.com';
    const INTERCOM_HOST = 'beispiel.intercom.host.com';
    const PASSPHRASE = 'ein sicheres Passwort';
    ```

```typescript
// Erstellen Sie das Client-Objekt
const client = new ABlockWallet();

// Initialisieren Sie den Client mit der benötigten Konfiguration
client.initFromMasterKey({
    mempoolHost: MEMPOOL_HOST,
    intercomHost: INTERCOM_HOST,
    passPhrase: PASSPHRASE,
  },
  masterKey: getMasterKey()
);
```

Wenn bereits ein vorhandener Master-Schlüssel vorhanden ist, sollte diese Art der Initialisierung verwendet werden. Dies tritt in der Regel auf, wenn der Client zuvor mit `initNew` initialisiert wurde und der verschlüsselte Master-Schlüssel sicher gespeichert wurde. Die Verwendung eines vorhandenen Master-Schlüssels gewährleistet eine konsistente BIP39-Schlüsselpaarableitung. Diese Art der Initialisierung hat keinen Rückgabewert.

-   `initFromSeed`

```typescript
import { ABlockWallet } from '@a-block/a-blockjs';

const MEMPOOL_HOST = 'beispiel.mempool.host.com'
const INTERCOM_HOST = 'beispiel.intercom.host.com'
const PASSPHRASE = 'ein sicheres Passwort'
const SEED_PHRASE = 'eine Seed-Phrase, die wie eine Ansammlung zufälliger Wörter aussehen sollte'

// Erstellen Sie das Client-Objekt
const client = new ABlockWallet();

// Initialisieren Sie den Client mit der benötigten Konfiguration
client.initFromSeed({
    mempoolHost: MEMPOOL_HOST,
    intercomHost: INTERCOM_HOST,
    passPhrase: PASSPHRASE,
  },
  seedPhrase: SEED_PHRASE
).then((initResult) => {
  const masterKey = initResult.content.initFromSeedResponse;

  // Speichern Sie den verschlüsselten Master-Schlüssel sicher
  saveMasterKey(initResult.content.initFromSeedResponse);
});
```

Die Initialisierung des Clients durch Verwendung einer vorhandenen Seed-Phrase kann aus einem der folgenden Gründe erfolgen:

<ol>
<li>
Der Benutzer hat seine Schlüsselpaare verloren und eine Neugenerierung ist erforderlich, indem die Seed-Phrase bereitgestellt wird.
</li>
<li>
Eine gültige Seed-Phrase wurde aufgrund bestimmter UX-Designbeschränkungen vorab generiert und muss verwendet werden, um den Client zu initialisieren.
</li>
</ol>

Diese Art der Initialisierung gibt den entsprechenden Master-Schlüssel (in verschlüsselter Form) zurück, der mithilfe der bereitgestellten Seed-Phrase erstellt wurde. Dieser Master-Schlüssel muss auf die gleiche Weise sicher gespeichert werden wie bei der Initialisierung mit `initNew`.

<details>
<summary>Offline-Initialisierung</summary>
<br/>

```typescript
import { ABlockWallet } from '@a-block/a-blockjs';

const MEMPOOL_HOST = 'example.mempool.host.com';
const INTERCOM_HOST = 'example.intercom.host.com';
const PASSPHRASE = 'a secure passphrase';

// Erstellen Sie das Client-Objekt
const client = new ABlockWallet();

// Konfiguration
const config = {
    mempoolHost: MEMPOOL_HOST,
    intercomHost: INTERCOM_HOST,
    passPhrase: PASSPHRASE,
};

// Initialisieren Sie den Client mit der benötigten Konfiguration
const initResult = client.initNew(config, true).then((initResult) => {
    const [seedPhrase, masterKeyEncrypted] = initResult.content.initNewResponse;

    // Zeigen Sie dem Benutzer die Seed-Phrase zur sicheren Aufbewahrung an
    displaySeedPhrase(seedPhrase);

    // Speichern Sie den verschlüsselten Master-Schlüssel sicher
    saveMasterKey(masterKeyEncrypted);
});

// Initialisieren Sie die Netzwerkkonfiguration bei Bedarf
const initNetworkResult = client.initNetwork(config);
```

In einigen Fällen kann es wünschenswert sein, den Client ohne Netzwerkverbindung zu initialisieren. Dadurch kann der Client offline verwendet werden, verhindert jedoch gleichzeitig, dass der Client Operationen durchführen kann, die eine Interaktion mit dem ABlock-Netzwerk erfordern. Mit einer Offline-Konfiguration stehen die folgenden Funktionen zur Verfügung:

-   `regenAddresses` - Verlorene Schlüsselpaare aus einer Liste von gegebenen Adressen neu generieren.
-   `getNewKeypair` - Ein neues Schlüsselpaar generieren.
-   `getSeedPhrase` - Die vorhandene Seed-Phrase aus dem Speicher abrufen (erfordert eine Initialisierung mit der Seed-Phrase).
-   `getMasterKey` - Den vorhandenen Master-Schlüssel aus dem Speicher abrufen.

</details>

<details>
<summary>Benutzerdefinierte Methoden</summary>
<br/>

```typescript
  function saveMasterKey(masterKeyEncrypter: IMasterKeyEncrypted): void {
    // Schreiben Sie hier Ihre Ein-/Ausgabeoperationen, um den verschlüsselten Master-Schlüssel sicher zu speichern
    ...
  }

  function getMasterKey(): IMasterKeyEncrypted {
    // Schreiben Sie hier Ihre Ein-/Ausgabeoperationen, um den verschlüsselten Master-Schlüssel sicher abzurufen
    ...
  }

  function saveKeypair(keyPair: IKeyPairEncrypted): void {
    // Schreiben Sie hier Ihre Ein-/Ausgabeoperationen, um das Schlüsselpaar sicher zu speichern
    ...
  }

  function getKeypairs(): IKeyPairEncrypted[] {
    // Schreiben Sie hier Ihre Ein-/Ausgabeoperationen, um die verschlüsselten Schlüsselpaare sicher abzurufen
    ...
  }

  function getAllEncryptedTxs(): ICreateTransactionEncrypted[] {
    // Schreiben Sie hier Ihre Ein-/Ausgabeoperationen, um alle verschlüsselten Transaktionen abzurufen
    ...
  }

  function saveEncryptedTx(druid: string, encryptedTx: ICreateTransactionEncrypted): void {
    // Schreiben Sie hier Ihre Ein-/Ausgabeoperationen, um die verschlüsselte Transaktion mit ihrem entsprechenden DRUID-Wert im Schlüssel-Wert-Format zu speichern
    ...
  }

```

Viele Methoden erfordern oder liefern je nach Operation unterschiedliche Arten von Daten. Es liegt vollständig in der Verantwortung des Entwicklers, Daten sicher zu speichern und abzurufen.

</details>
<p align="right">(<a href="#top">zurück zum Anfang</a>)</p>

## Verwendung

Nachdem der Client korrekt initialisiert wurde, ermöglichen die vom Client bereitgestellten Methoden dem Entwickler die Interaktion mit dem ABlock-Blockchain-Netzwerk.

### Generieren und Testen von Seed-Phrasen

-   `generateSeedPhrase`

    ```typescript
    import { generateSeedPhrase } from '@a-block/a-blockjs';

    const seedPhrase = generateSeedPhrase();
    ```

-   `testSeedPhrase`

    ```typescript
    import { testSeedPhrase } from '@a-block/a-blockjs';

    const seedPhrase =
        'eine vom Benutzer bereitgestellte Seed-Phrase, die wie eine Ansammlung zufälliger Wörter aussieht';

    const testResult = testSeedPhrase(seedPhrase);
    ```

Wie bereits erwähnt, kann der Client je nach Szenario auf verschiedene Arten initialisiert werden. Wenn der Client mit `initNew` initialisiert wird, wird automatisch eine neue Seed-Phrase generiert. In einigen Fällen muss der Client jedoch mit einer vorab generierten oder bereitgestellten Seed-Phrase initialisiert werden.

Die Methode `generateSeedPhrase` wird vom Modul bereitgestellt, um gültige neue Seed-Phrasen dynamisch zu generieren. Dies ist besonders nützlich, wenn UX-Design-Einschränkungen erfordern, dass eine gültige Seed-Phrase generiert und dem Benutzer angezeigt wird, bevor der Client initialisiert wird.

Da eine Seed-Phrase verwendet werden kann, um verlorene/fehlende Schlüsselpaare wiederherzustellen, ist es üblich, dass der Benutzer bei Bedarf seine eigene Seed-Phrase angeben kann. Um zu überprüfen, ob die Seed-Phrase in der Lage ist, einen gültigen Master-Schlüssel zu erstellen, sollte die Methode `testSeedPhrase` verwendet werden.

### Generieren von Schlüsselpaaren

-   `getNewKeypair`

    ```typescript
    import { ABlockWallet } from '@a-block/a-blockjs';

    const client = new ABlockWallet();

    // Initialisiere den Client korrekt
    ...

    // Das Array-Argument kann vorhandene Schlüsselpaare enthalten, die verwendet werden sollen
    const newKeypairResult = client.getNewKeypair([]);

    const newKeypair: IKeypairEncrypted = newKeypairResult.content.newKeypairResponse;

    // Speichere das Schlüsselpaar sicher
    saveKeypair(newKeypair);

    // Erhalte die zugehörige Adresse
    const address = newKeypair.address;
    ```

### Aktualisieren des Kontostands

-   `fetchBalance`

    ```typescript
    import { ABlockWallet } from '@a-block/a-blockjs';

    const client = new ABlockWallet();

    // Initialisiere den Client korrekt
    ...

    const allKeypairs = getAllKeypairs();

    // Wir benötigen nur das 'address'-Feld der Schlüsselpaare
    const addressList = allKeypairs.map(keypair => keypair.address);

    const balanceResult = await client.fetchBalance(addressList);

    const balance: IFetchBalanceResponse = balanceResult.content.fetchBalanceResponse;
    ```

    <details>
    <summary>Inhalt der Antwort</summary>
    <br/>

    ```json
    {
        "total": {
            "tokens": 0,
            "items": {
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
                        "Item": {
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
                        "Item": {
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

    -   `total`: Der Gesamtsaldo aller angegebenen Adressen
    -   `address_list`: Eine Liste von Adressen und ihren vorherigen Ausgabepunkten sowie den zugehörigen Assets

    </details>

### Erstellen von Empfangsassets

Empfangsassets sind die NFTs der ABlock-Blockchain, erfordern jedoch im Gegensatz zu NFTs keine Smart Contracts oder komplexe Logik zum Erstellen.

-   `createItems`

| **Argument**     | **Typ**             | **Standardwert** | **Erforderlich** | **Beschreibung**                                                                                                                                                                                                                                       |
| ---------------- | ------------------- | ---------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| address          | `IKeypairEncrypted` |                  | ja               | Das Schlüsselpaar, um die Adresse zu generieren, an die die Empfangsassets gesendet werden, sobald sie generiert wurden                                                                                                                                |
| defaultDrsTxHash | `boolean`           | true             | nein             | Wenn dies auf `true` gesetzt ist, werden generische Empfangsassets erstellt. Wenn es auf `false` gesetzt ist, wird ein eindeutiger Genesis-Transaktionshash für diese Empfangsassets generiert. Verwenden Sie `false`, wenn Sie NFTs erstellen möchten |
| amount           | `number`            | 1000             | nein             | Die Anzahl der zu erstellenden Empfangsassets                                                                                                                                                                                                          |
| metadata         | `string`            | null             | nein             | Optionale Metadaten, die Sie dem Asset anhängen können                                                                                                                                                                                                 |

```typescript
import { ABlockWallet } from '@a-block/a-blockjs';

const client = new ABlockWallet();


// Initialisieren Sie den Client korrekt
...

// Adresse / Schlüsselpaar, um die `Item`-Vermögenswerte zuzuweisen
const keyPair = getAllKeypairs()[0];

// Erstellen Sie `Item`-Vermögenswerte mit dem Standard-DRS-Identifier
const createItemResponse = await client.createItems(keyPair).content.createItemResponse;

<!-- --------------------------------- ODER ---------------------------------- -->

// Erstellen Sie `Item`-Vermögenswerte mit einem eindeutigen DRS-Identifier
const createItemResponse = await client.createItems(keyPair, false).content.createItemResponse;

<!-- --------------------------------- VERSION MIT ALLEN ARGUMENTEN ---------------------------------- -->

const createItemResponse = await client.createItems(
  keyPair,
  false,
  10000,
  "{ 'imageURL': '...', 'description': '...' }"
).content
.createItemResponse;

```

`Item`-Vermögenswerte können entweder dem Standard-Digital Rights Signature (DRS) oder einem eindeutigen DRS zugeordnet werden. Wenn Vermögenswerte unterschiedliche DRS-Identifier haben, sind sie **nicht** gegenseitig austauschbar.

  <details>
  <summary>Inhalt der Antwort</summary>
  <br/>

```json
{
    "asset": {
        "asset": {
            "Item": {
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

-   `drs_tx_hash`: Der DRS-Identifier, der den erstellten `Item`-Vermögenswerten zugeordnet ist.

</details>

### Ausgeben von Tokens

-   `makeTokenPayment`

| **Argument**   | **Typ**                | **Standard** | **Erforderlich** | **Beschreibung**                                                                                                                                   |
| -------------- | ---------------------- | ------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| paymentAddress | `string`               |              | ja               | Adresse, an die die Token-Zahlung erfolgen soll                                                                                                    |
| paymentAmount  | `number`               |              | ja               | Anzahl der zu zahlenden Tokens                                                                                                                     |
| allKeypairs    | `IKeypairEncrypted []` |              | ja               | Schlüsselpaare, die zur Zahlung verwendet werden sollen. Diese Schlüsselpaare müssen einen Token-Guthaben haben, um die Transaktion zu verarbeiten |
| excessKeypair  | `IKeypairEncrypted`    |              | ja               | Überschüssiges Schlüsselpaar, an das ein eventueller Restbetrag gesendet werden soll                                                               |

```typescript
import { ABlockWallet } from '@a-block/a-blockjs';

const client = new ABlockWallet();

// Initialisiere den Client korrekt
...

// Alle Schlüsselpaare
const allKeypairs = getAllKeypairs();

// Änderungs-/Überschuss-Schlüsselpaar
const changeKeyPair = allKeypairs[0];

await makeTokenPayment(
      "d0e72...85b46", // Zahlungsadresse
      10,              // Zahlungsbetrag
      allKeypairs,     // Alle Schlüsselpaare
      changeKeyPair,   // Änderungsadresse
  );

```

**_NB_**: _Die Methode `makeTokenPayment` überprüft nicht die Gültigkeit der Zahlungsadresse. Es ist daher wichtig, eine gültige Zahlungsadresse zu verwenden, bevor die Zahlung erfolgt._

### Ausgeben von Quittungen

-   `makeItemPayment`

| **Argument**   | **Typ**                | **Standard** | **Erforderlich** | **Beschreibung**                                                                                                                                   |
| -------------- | ---------------------- | ------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| paymentAddress | `string`               |              | ja               | Adresse, an die die Token-Zahlung erfolgen soll                                                                                                    |
| paymentAmount  | `number`               |              | ja               | Anzahl der zu zahlenden Tokens                                                                                                                     |
| drsTxHash      | `string`               |              | ja               | Der Genesis-Transaktionshash des Quittungs-Assets, das ausgegeben werden soll. Dies ist der eindeutige Bezeichner des Quittungs-Assets             |
| allKeypairs    | `IKeypairEncrypted []` |              | ja               | Schlüsselpaare, die zur Zahlung verwendet werden sollen. Diese Schlüsselpaare müssen einen Token-Guthaben haben, um die Transaktion zu verarbeiten |
| excessKeypair  | `IKeypairEncrypted`    |              | ja               | Überschüssiges Schlüsselpaar, an das ein eventueller Restbetrag gesendet werden soll                                                               |

```typescript
import { ABlockWallet } from '@a-block/a-blockjs';

const client = new ABlockWallet();

// Initialisiere den Client korrekt
...

// Alle Schlüsselpaare
const keyPairs = getAllKeypairs();

// Ändere/überschüssiges Schlüsselpaar
const changeKeyPair = keyPairs[0];

// DRS-Identifier (der Standard-DRS-Identifier oder ein eindeutiger DRS-Identifier)
const drsTxHash = "default_drs_tx_hash";

await makeItemPayment(
        "d0e72...85b46", // Zahlungsadresse
        10,              // Zahlungsbetrag
        drsTxHash,       // DRS-Identifier
        allKeypairs,     // Alle Schlüsselpaare
        changeKeyPair,   // Überschüssige/ändernde Adresse
    );

```

**_NB_**: _Die Methode `makeItemPayment` ist in vielerlei Hinsicht ähnlich der Methode `makeTokenPayment`, unter anderem darin, dass diese Methode `Item`-Vermögenswerte in unidirektionaler Weise an eine Zahlungsadresse sendet und keine Vermögenswerte als Gegenleistung erwartet. Sie sollte nicht mit **quittungsbasierten** Zahlungen verwechselt werden!_

### Quittungsbasierte Zahlungen durchführen

-   `make2WayPayment`

| **Argument**   | **Typ**                        | **Standard** | **Erforderlich** | **Beschreibung**                                                         |
| -------------- | ------------------------------ | ------------ | ---------------- | ------------------------------------------------------------------------ |
| paymentAddress | `string`                       |              | ja               | Adresse, an die die Token-Zahlung erfolgen soll                          |
| sendingAsset   | `IAssetItem \| IAssetToken` |              | ja               | Das zu zahlende Vermögen                                                 |
| receivingAsset | `IAssetItem \| IAssetToken` |              | ja               | Das zu empfangende Vermögen                                              |
| allKeypairs    | `IKeypairEncrypted[]`          |              | ja               | Eine Liste aller vorhandenen Schlüsselpaare (verschlüsselt)              |
| receiveAddress | `IKeypairEncrypted`            |              | ja               | Ein Schlüsselpaar, dem das "empfangende" Vermögen zugewiesen werden soll |

```typescript
import { ABlockWallet } from '@a-block/a-blockjs';

const client = new ABlockWallet();

// Initialisiere den Client korrekt
...

// Alle Schlüsselpaare
const alleSchlüsselpaare = getAllKeypairs();

// Empfangsadresse (die auch die Überschuss-/Wechseladresse ist)
const empfangsadresse = alleSchlüsselpaare[0];

// Das Asset, das wir senden möchten
const sendendesAsset = initIAssetToken({"Token": 10});

// Das Asset, das wir empfangen möchten
const empfangenesAsset = initIAssetItem({
  "Item": {
      "amount": 10,
      "drs_tx_hash": "default_drs_tx_hash"
  }});

const zahlungsergebnis = await make2WayPayment(
      "18f70...caeda",  // Zahlungsadresse
      sendendesAsset,     // Zahlungsasset
      empfangenesAsset,   // Empfangsasset
      alleSchlüsselpaare,      // Alle Schlüsselpaare
      empfangsadresse, // Empfangsadresse
  );

  const { druid, encryptedTx } = zahlungsergebnis.content.make2WayPaymentResponse;

  // Speichern der verschlüsselten Transaktion zusammen
  // mit dem entsprechenden DRUID-Wert
  saveEncryptedTx(druid, encryptedTx);

```

**_NB_**: _Diese Art von Transaktion ist eine Dual-Double-Entry (DDE) Transaktion und erfordert, dass alle Parteien eine gemeinsame Zustimmung erreichen, bevor ihre jeweiligen Transaktionen zur Verarbeitung an den Berechnungsknoten gesendet werden._

### Abrufen ausstehender Zahlungen basierend auf Quittungen

-   `fetchPending2WayPayments`

    ```typescript
    import { ABlockWallet } from '@a-block/a-blockjs';

    const client = new ABlockWallet();

    // Initialisieren Sie den Client korrekt
    ...

    // Alle Schlüsselpaare
    const allKeypairs = getAllKeypairs();

    // Alle verschlüsselten Transaktionen
    const allEncryptedTxs = getAllEncryptedTxs();

    // FAusstehende Zahlungen basierend auf Quittungen abrufen
    const pendingIbTransactionsResult = await client.fetchPending2WayPayments(
          allKeypairs,
          allEncryptedTxs:,
      )

    const pendingIbTransactions: IResponseIntercom<IPendingIbTxDetails> = pendingIbTransactionsResult.content.fetchPendingIbResponse;

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
                        "Item": {
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
                "mempoolHost": "http://127.0.0.1:3003"
            }
        }
    }
    ```

    Aus dieser Datenstruktur können wir spezifische Details über die Zahlung auf Basis des Belegs erhalten, wie beispielsweise die eindeutige Kennung `DRUID0xd0f407436f7f1fc494d7aee22939090e`, den Status der Transaktion `status`, den Zeitstempel der Transaktion `timestamp` sowie die Adresse, die den Zahlungsanforderung auf Basis des Belegs gestellt hat - `2a646...f8b98`.

    Wir können auch sehen, dass in dieser spezifischen Anfrage der Absender 1 `Item`-Asset im Austausch gegen 25200 `Token`-Assets erwartet.
    </details>

### Reaktion auf ausstehende Zahlungen auf Basis des Belegs

-   `accept2WayPayment` und `reject2WayPayment`

    ```typescript
    import { ABlockWallet } from '@a-block/a-blockjs';

    const client = new ABlockWallet();

    // Initialisiere den Client korrekt
    ...

    // Hole die ausstehenden Zahlungen basierend auf Belegen vom Netzwerk ab
    ...
    const pendingIbTransactions: IFetchPendingIbResponse = pendingIbTransactionsResult.content.fetchPendingIbResponse;

    // Hole alle vorhandenen Schlüsselpaare
    ...
    const allKeypairs = getAllKeypairs();

    // Akzeptiere eine belegbasierte Zahlung anhand ihrer eindeutigen `DRUID`-Kennung
    await client.accept2WayPayment('DRUID0xd0f407436f7f1fc494d7aee22939090e', pendingIbTransactions, allKeypairs);

    <!-- --------------------------------- OR ---------------------------------- -->

    // Lehne eine belegbasierte Zahlung anhand ihrer eindeutigen `DRUID`-Kennung ab
    await client.reject2WayPayment('DRUID0xd0f407436f7f1fc494d7aee22939090e', pendingIbTransactions, allKeypairs);
    ```

    Belegbasierte Transaktionen werden akzeptiert **oder** abgelehnt, indem ihre eindeutige DRUID-Kennung als Argument an die entsprechenden Methoden übergeben wird.

<p align="right">(<a href="#top">back to top</a>)</p>

## Client-Antworttyp

Alle vom Client bereitgestellten Methoden haben einen Rückgabewert, der der folgenden Schnittstelle entspricht:

```typescript
export type IClientResponse = {
    id?: string;
    status: 'success' | 'error' | 'pending' | 'unknown';
    reason?: string;
    content?: IContentType;
};
```

, wobei jedes Feld Folgendes repräsentiert:

-   `status`: Eine allgemeine Angabe über den Erfolg oder Misserfolg der verwendeten Methode

-   `id`: Ein eindeutiger Bezeichner, der für Netzwerkvorgänge verwendet wird

-   `reason`: Detailliertes Feedback, das dem `status`-Feld entspricht

-   `content`: Datenstrukturen oder Werte, die vom Client-Objekt zurückgegeben werden

<p align="right">(<a href="#top">Zurück zum Anfang</a>)</p>
