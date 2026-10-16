export type Network = 'testnet' | 'mainnet';
/** Nodely's free public endpoints: no key, OK for production per their docs (adds ~50 ms). */
export declare const ENDPOINTS: Record<Network, {
    algod: string;
    indexer: string;
}>;
export interface NetworkOptions {
    network: Network;
    /** Override the algod endpoint (for example from an ALGOD_URL env var). */
    algodUrl?: string;
    /** Override the indexer endpoint (for example from an INDEXER_URL env var). */
    indexerUrl?: string;
    /** Injected fetch, for tests or runtimes that need a bound fetch. */
    fetch?: typeof fetch;
}
export declare function assertNetwork(network: unknown): asserts network is Network;
export declare function algodUrl(opts: NetworkOptions): string;
export declare function indexerUrl(opts: NetworkOptions): string;
/** Public explorer link for a transaction (Lora, AlgoKit's explorer). */
export declare function explorerTxUrl(txid: string, network: Network): string;
