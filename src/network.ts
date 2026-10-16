export type Network = 'testnet' | 'mainnet';

/** Nodely's free public endpoints: no key, OK for production per their docs (adds ~50 ms). */
export const ENDPOINTS: Record<Network, { algod: string; indexer: string }> = {
  testnet: { algod: 'https://testnet-api.4160.nodely.dev', indexer: 'https://testnet-idx.4160.nodely.dev' },
  mainnet: { algod: 'https://mainnet-api.4160.nodely.dev', indexer: 'https://mainnet-idx.4160.nodely.dev' },
};

export interface NetworkOptions {
  network: Network;
  /** Override the algod endpoint (for example from an ALGOD_URL env var). */
  algodUrl?: string;
  /** Override the indexer endpoint (for example from an INDEXER_URL env var). */
  indexerUrl?: string;
  /** Injected fetch, for tests or runtimes that need a bound fetch. */
  fetch?: typeof fetch;
}

export function assertNetwork(network: unknown): asserts network is Network {
  if (network !== 'testnet' && network !== 'mainnet') {
    throw new TypeError(`network must be "testnet" or "mainnet" (got ${JSON.stringify(network)})`);
  }
}

export function algodUrl(opts: NetworkOptions): string {
  assertNetwork(opts.network);
  return (opts.algodUrl || ENDPOINTS[opts.network].algod).replace(/\/+$/, '');
}

export function indexerUrl(opts: NetworkOptions): string {
  assertNetwork(opts.network);
  return (opts.indexerUrl || ENDPOINTS[opts.network].indexer).replace(/\/+$/, '');
}

/** Public explorer link for a transaction (Lora, AlgoKit's explorer). */
export function explorerTxUrl(txid: string, network: Network): string {
  assertNetwork(network);
  return `https://lora.algokit.io/${network}/transaction/${encodeURIComponent(txid)}`;
}
