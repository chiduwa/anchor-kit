/**
 * Building, signing and sending anchors. Depends on algosdk (a peer dependency).
 * Runs on servers (FCS build, KCE API routes) and in the browser for the
 * ThriveWorks wallet flow, where only buildAnchorTxn is used and Pera signs.
 *
 * Never log a mnemonic or a secret key, and never put one in an error message.
 */
import algosdk from 'algosdk';
import { type AnchorNote } from './note.js';
import { type NetworkOptions } from './network.js';
/** About 3 minutes at ~2.8 s per round: short, so an anchor that never landed can be retried soon. */
export declare const DEFAULT_VALID_ROUNDS = 60;
export interface AnchorSubject extends AnchorNote {
    /**
     * What is being anchored, unique per anchor: for example `batch:20261016T141733Z`
     * or `period:<uuid>:v2`. Include the version so a re-anchor gets a new lease.
     */
    subjectKey: string;
}
export interface BuiltAnchor {
    txn: algosdk.Transaction;
    /** Known before sending: persist it first (see anchor()). */
    txid: string;
    lastValid: number;
}
export interface PendingRecord {
    txid: string;
    lastValid: number;
    address: string;
}
export declare function algodClient(opts: NetworkOptions): algosdk.Algodv2;
/** Lease = SHA-256(dapp|kind|subjectKey): the network refuses a second transaction with the same sender and lease inside the validity window. */
export declare function leaseFor({ dapp, kind, subjectKey }: Pick<AnchorSubject, 'dapp' | 'kind' | 'subjectKey'>): Promise<Uint8Array>;
/** Loads an account from its 25-word mnemonic. The error never repeats the words. */
export declare function accountFromMnemonic(mnemonic: string | undefined): {
    address: string;
    sk: Uint8Array;
};
/** Builds the unsigned zero-ALGO payment to self that carries the note. */
export declare function buildAnchorTxn(subject: AnchorSubject & {
    sender: string;
    client: algosdk.Algodv2;
    validRounds?: number;
}): Promise<BuiltAnchor>;
/** Sends a signed anchor and waits for confirmation (Algorand finality is immediate once confirmed). */
export declare function submitSigned({ client, signed, txid, waitRounds, }: {
    client: algosdk.Algodv2;
    signed: Uint8Array;
    txid: string;
    waitRounds?: number;
}): Promise<{
    txid: string;
    round: number;
}>;
/**
 * Anchors one hash from a hot account. `onPending` runs BEFORE anything is sent;
 * store the txid and lastValid there. If it throws, nothing is sent. That order
 * is what makes a crash safe: on restart, resolvePending() says whether the
 * stored txid landed, so an anchor is never lost and never sent twice.
 */
export declare function anchor(subject: AnchorSubject & NetworkOptions & {
    mnemonic: string | undefined;
    onPending?: (pending: PendingRecord) => Promise<void> | void;
    validRounds?: number;
    client?: algosdk.Algodv2;
}): Promise<{
    txid: string;
    round: number;
    lastValid: number;
    address: string;
}>;
export type PendingStatus = {
    status: 'confirmed';
    round: number;
} | {
    status: 'pending';
} | {
    status: 'expired';
};
/**
 * Settles a stored pending anchor.
 * - confirmed: it landed; mark it confirmed, do not resend.
 * - expired: the indexer is past lastValid and has no such transaction, so it can never land; build a fresh one.
 * - pending: too early to tell; check again later.
 */
export declare function resolvePending(opts: NetworkOptions & {
    txid: string;
    lastValid: number;
    address: string;
    client?: algosdk.Algodv2;
}): Promise<PendingStatus>;
