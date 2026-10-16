/** Nodely's free public endpoints: no key, OK for production per their docs (adds ~50 ms). */
export const ENDPOINTS = {
    testnet: { algod: 'https://testnet-api.4160.nodely.dev', indexer: 'https://testnet-idx.4160.nodely.dev' },
    mainnet: { algod: 'https://mainnet-api.4160.nodely.dev', indexer: 'https://mainnet-idx.4160.nodely.dev' },
};
export function assertNetwork(network) {
    if (network !== 'testnet' && network !== 'mainnet') {
        throw new TypeError(`network must be "testnet" or "mainnet" (got ${JSON.stringify(network)})`);
    }
}
export function algodUrl(opts) {
    assertNetwork(opts.network);
    return (opts.algodUrl || ENDPOINTS[opts.network].algod).replace(/\/+$/, '');
}
export function indexerUrl(opts) {
    assertNetwork(opts.network);
    return (opts.indexerUrl || ENDPOINTS[opts.network].indexer).replace(/\/+$/, '');
}
/** Public explorer link for a transaction (Lora, AlgoKit's explorer). */
export function explorerTxUrl(txid, network) {
    assertNetwork(network);
    return `https://lora.algokit.io/${network}/transaction/${encodeURIComponent(txid)}`;
}
