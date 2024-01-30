export enum ISuccessAll {
    IErrorInternal,
}

export enum ISuccessNetwork {
    FetchWalletInfo = 'Wallet info successfully fetched',
    ExportKeypairs = 'Key-pairs successfully exported',
    ImportKeypairs = 'Key-pairs successfully imported',
    GetPaymentAddress = 'New payment address generated',
    GetDebugData = 'Debug data successfully retrieved',
    GetLatestBlock = 'Current mining block successfully retrieved',
    UTXOAddressesRetrieved = 'UTXO addresses successfully retrieved',
    DataBaseItemsRetrieved = 'Database item(s) successfully retrieved',
    PaymentProcessing = 'Payment processing',
    IpPaymentProcessing = 'IP payment processing',
    DonationRequestSent = 'Donation request sent',
    RunningTotalUpdated = 'Running total updated',
    FetchBalance = 'Balance successfully fetched',
    FetchPendingTransactions = 'Pending transactions successfully fetched',
    CreateReceiptAssets = 'Receipt asset(s) created',
    CreateTransactions = 'Transaction(s) processing',
    ChangeWalletPassphrase = 'Passphrase changed successfully',
    ConstructAddress = 'Address successfully constructed',
}

export enum ISuccessNotary {
    AuthorizationSuccessful = 'Authorization successful',
    BurnAddressFetched = 'Burn address fetched',
}

export enum ISuccessInternal {
    ClientInitialized = 'Client initialized',
    MessageSigned = 'Successfully signed message',
    MessageVirified = 'Successfully verified message',
    IbPaymentProcessing = 'Receipt-based payment processing',
    PendingIbPaymentsFetched = 'Succesfully fetched pending receipt-based transactions',
    AddressesReconstructed = 'Addresses have successfully been reconstructed',
    NewAddressGenerated = 'Successfully generated new address',
    SeedPhraseObtained = 'Successfully obtained seed phrase',
    MasterKeyObtained = 'Successfully obtained master key',
    KeypairDecrypted = 'Successfully decrypted key-pair',
    KeypairSaved = 'Successfully saved key-pair to local storage',
    KeypairObtained = 'Successfully retreived key-pair from local storage',
    RespondedToIbPayment = 'Successfully responded to receipt-based payment',
}
