import { type AnchorNote } from './note.js';
import { type NetworkOptions } from './network.js';
export interface AnchorHit extends AnchorNote {
    txid: string;
    round: number;
    /** Unix seconds of the block that confirmed the anchor. */
    timestamp: number;
    /** The anchor account that sent (and so signed) the transaction. */
    address: string;
}
export type FindResult = ({
    found: true;
} & AnchorHit) | {
    found: false;
};
export declare function toBase64(bytes: Uint8Array): string;
export declare function fromBase64(text: string): Uint8Array;
/**
 * Finds the EARLIEST anchor of `hash` under `dapp` sent by any of `addresses`
 * (every address the dapp has ever used, so rotated keys stay verifiable).
 */
export declare function findAnchor(opts: NetworkOptions & {
    dapp: string;
    hash: string;
    addresses: readonly string[];
    kind?: string;
}): Promise<FindResult>;
/** Looks up one anchor by txid. Null if the indexer has no such transaction or it is not a valid anchor from `addresses`. */
export declare function lookupAnchorTx(opts: NetworkOptions & {
    txid: string;
    addresses: readonly string[];
}): Promise<AnchorHit | null>;
/** The newest anchor under `dapp` from `address`, or null. Used by the freshness monitor. */
export declare function latestAnchor(opts: NetworkOptions & {
    dapp: string;
    address: string;
}): Promise<AnchorHit | null>;
/** The indexer's latest round, to know whether it has caught up past a transaction's validity window. */
export declare function indexerRound(opts: NetworkOptions): Promise<number>;
/** Spendable and minimum balance (microAlgos) from algod, which is fresher than the indexer. */
export declare function accountBalance(opts: NetworkOptions & {
    address: string;
}): Promise<{
    amount: number;
    minBalance: number;
}>;
