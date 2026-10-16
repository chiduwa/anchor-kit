/**
 * Building, signing and sending anchors. Depends on algosdk (a peer dependency).
 * Runs on servers (FCS build, KCE API routes) and in the browser for the
 * ThriveWorks wallet flow, where only buildAnchorTxn is used and Pera signs.
 *
 * Never log a mnemonic or a secret key, and never put one in an error message.
 */
import algosdk from 'algosdk';
import { sha256, utf8 } from './hash.js';
import { encodeNote } from './note.js';
import { algodUrl } from './network.js';
import { indexerRound, lookupAnchorTx } from './indexer.js';
/** About 3 minutes at ~2.8 s per round: short, so an anchor that never landed can be retried soon. */
export const DEFAULT_VALID_ROUNDS = 60;
export function algodClient(opts) {
    return new algosdk.Algodv2('', algodUrl(opts), '');
}
/** Lease = SHA-256(dapp|kind|subjectKey): the network refuses a second transaction with the same sender and lease inside the validity window. */
export async function leaseFor({ dapp, kind, subjectKey }) {
    if (!subjectKey)
        throw new TypeError('leaseFor: subjectKey is required');
    return sha256(utf8(`${dapp}|${kind}|${subjectKey}`));
}
/** Loads an account from its 25-word mnemonic. The error never repeats the words. */
export function accountFromMnemonic(mnemonic) {
    if (!mnemonic || !mnemonic.trim())
        throw new Error('anchor mnemonic is empty: check the secret name and that it is read via secrets., not vars.');
    try {
        const account = algosdk.mnemonicToSecretKey(mnemonic.trim().replace(/\s+/g, ' '));
        return { address: account.addr.toString(), sk: account.sk };
    }
    catch {
        throw new Error('anchor mnemonic is not a valid 25-word Algorand mnemonic');
    }
}
/** Builds the unsigned zero-ALGO payment to self that carries the note. */
export async function buildAnchorTxn(subject) {
    const params = await subject.client.getTransactionParams().do();
    const firstValid = BigInt(params.firstValid);
    const lastValid = firstValid + BigInt(subject.validRounds ?? DEFAULT_VALID_ROUNDS);
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: subject.sender,
        receiver: subject.sender,
        amount: 0,
        note: encodeNote(subject),
        lease: await leaseFor(subject),
        suggestedParams: { ...params, firstValid, lastValid },
    });
    return { txn, txid: txn.txID(), lastValid: Number(lastValid) };
}
/** Sends a signed anchor and waits for confirmation (Algorand finality is immediate once confirmed). */
export async function submitSigned({ client, signed, txid, waitRounds = 10, }) {
    try {
        await client.sendRawTransaction(signed).do();
    }
    catch (error) {
        // A resend of a transaction that already landed is not a failure.
        if (!/already in ledger/i.test(String(error?.message)))
            throw error;
    }
    const confirmed = await algosdk.waitForConfirmation(client, txid, waitRounds);
    if (confirmed.confirmedRound === undefined)
        throw new Error(`anchor ${txid} was not confirmed`);
    return { txid, round: Number(confirmed.confirmedRound) };
}
/**
 * Anchors one hash from a hot account. `onPending` runs BEFORE anything is sent;
 * store the txid and lastValid there. If it throws, nothing is sent. That order
 * is what makes a crash safe: on restart, resolvePending() says whether the
 * stored txid landed, so an anchor is never lost and never sent twice.
 */
export async function anchor(subject) {
    const account = accountFromMnemonic(subject.mnemonic);
    const client = subject.client ?? algodClient(subject);
    const built = await buildAnchorTxn({ ...subject, sender: account.address, client });
    await subject.onPending?.({ txid: built.txid, lastValid: built.lastValid, address: account.address });
    const signed = built.txn.signTxn(account.sk);
    const result = await submitSigned({ client, signed, txid: built.txid });
    return { ...result, lastValid: built.lastValid, address: account.address };
}
/**
 * Settles a stored pending anchor.
 * - confirmed: it landed; mark it confirmed, do not resend.
 * - expired: the indexer is past lastValid and has no such transaction, so it can never land; build a fresh one.
 * - pending: too early to tell; check again later.
 */
export async function resolvePending(opts) {
    const client = opts.client ?? algodClient(opts);
    try {
        const info = await client.pendingTransactionInformation(opts.txid).do();
        if (info.confirmedRound !== undefined && info.confirmedRound > 0n)
            return { status: 'confirmed', round: Number(info.confirmedRound) };
        if (!info.poolError)
            return { status: 'pending' };
    }
    catch {
        // algod forgets transactions after a while; the indexer is the record of truth.
    }
    const hit = await lookupAnchorTx({ ...opts, addresses: [opts.address] });
    if (hit)
        return { status: 'confirmed', round: hit.round };
    return (await indexerRound(opts)) > opts.lastValid ? { status: 'expired' } : { status: 'pending' };
}
