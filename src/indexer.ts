import { decodeNote, notePrefixForHash, type AnchorNote } from './note.js';
import { algodUrl, indexerUrl, type NetworkOptions } from './network.js';
import { utf8 } from './hash.js';

export interface AnchorHit extends AnchorNote {
  txid: string;
  round: number;
  /** Unix seconds of the block that confirmed the anchor. */
  timestamp: number;
  /** The anchor account that sent (and so signed) the transaction. */
  address: string;
}

export type FindResult = ({ found: true } & AnchorHit) | { found: false };

interface IndexerTxn {
  id: string;
  sender: string;
  'tx-type': string;
  'confirmed-round'?: number;
  'round-time'?: number;
  note?: string;
}

const MAX_PAGES = 20;

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function getJson<T>(url: string, opts: NetworkOptions): Promise<{ status: number; body: T | null }> {
  const doFetch = opts.fetch ?? globalThis.fetch;
  const response = await doFetch(url, { headers: { accept: 'application/json' } });
  if (response.status === 404) return { status: 404, body: null };
  if (!response.ok) throw new Error(`indexer ${response.status} for ${new URL(url).pathname}`);
  return { status: response.status, body: (await response.json()) as T };
}

/**
 * Turns an indexer transaction into an anchor, or null. Only a transaction SENT
 * by one of `addresses` counts: anyone can send a payment with any note TO an
 * anchor address, so a note alone proves nothing.
 */
function toHit(txn: IndexerTxn, addresses: ReadonlySet<string>): AnchorHit | null {
  if (txn['tx-type'] !== 'pay' || !addresses.has(txn.sender) || !txn.note) return null;
  if (txn['confirmed-round'] === undefined || txn['round-time'] === undefined) return null;
  const note = decodeNote(fromBase64(txn.note));
  if (!note) return null;
  return { ...note, txid: txn.id, round: txn['confirmed-round'], timestamp: txn['round-time'], address: txn.sender };
}

/**
 * Finds the EARLIEST anchor of `hash` under `dapp` sent by any of `addresses`
 * (every address the dapp has ever used, so rotated keys stay verifiable).
 */
export async function findAnchor(
  opts: NetworkOptions & { dapp: string; hash: string; addresses: readonly string[]; kind?: string },
): Promise<FindResult> {
  const prefix = encodeURIComponent(toBase64(notePrefixForHash(opts.dapp, opts.hash)));
  const allowed = new Set(opts.addresses);
  const hits: AnchorHit[] = [];

  for (const address of allowed) {
    let next: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const url =
        `${indexerUrl(opts)}/v2/transactions?address=${address}&address-role=sender&tx-type=pay` +
        `&note-prefix=${prefix}&limit=100${next ? `&next=${encodeURIComponent(next)}` : ''}`;
      const { body } = await getJson<{ transactions?: IndexerTxn[]; 'next-token'?: string }>(url, opts);
      const txns = body?.transactions ?? [];
      for (const txn of txns) {
        const hit = toHit(txn, allowed);
        if (hit && hit.dapp === opts.dapp && hit.hash === opts.hash && (!opts.kind || hit.kind === opts.kind)) hits.push(hit);
      }
      next = body?.['next-token'];
      if (!next || txns.length === 0) break;
    }
  }

  if (hits.length === 0) return { found: false };
  hits.sort((a, b) => a.round - b.round || a.txid.localeCompare(b.txid));
  return { found: true, ...(hits[0] as AnchorHit) };
}

/** Looks up one anchor by txid. Null if the indexer has no such transaction or it is not a valid anchor from `addresses`. */
export async function lookupAnchorTx(
  opts: NetworkOptions & { txid: string; addresses: readonly string[] },
): Promise<AnchorHit | null> {
  if (!/^[A-Z2-7]{52}$/.test(opts.txid)) return null;
  const { body } = await getJson<{ transaction?: IndexerTxn }>(`${indexerUrl(opts)}/v2/transactions/${opts.txid}`, opts);
  return body?.transaction ? toHit(body.transaction, new Set(opts.addresses)) : null;
}

/** The newest anchor under `dapp` from `address`, or null. Used by the freshness monitor. */
export async function latestAnchor(opts: NetworkOptions & { dapp: string; address: string }): Promise<AnchorHit | null> {
  const prefix = encodeURIComponent(toBase64(utf8(`${opts.dapp}:j`)));
  const url =
    `${indexerUrl(opts)}/v2/transactions?address=${opts.address}&address-role=sender&tx-type=pay` +
    `&note-prefix=${prefix}&limit=50`;
  const { body } = await getJson<{ transactions?: IndexerTxn[] }>(url, opts);
  const allowed = new Set([opts.address]);
  const hits = (body?.transactions ?? []).map((t) => toHit(t, allowed)).filter((h): h is AnchorHit => h?.dapp === opts.dapp);
  hits.sort((a, b) => b.round - a.round);
  return hits[0] ?? null;
}

/** The indexer's latest round, to know whether it has caught up past a transaction's validity window. */
export async function indexerRound(opts: NetworkOptions): Promise<number> {
  const { body } = await getJson<{ round?: number }>(`${indexerUrl(opts)}/health`, opts);
  if (typeof body?.round !== 'number') throw new Error('indexer /health returned no round');
  return body.round;
}

/** Spendable and minimum balance (microAlgos) from algod, which is fresher than the indexer. */
export async function accountBalance(opts: NetworkOptions & { address: string }): Promise<{ amount: number; minBalance: number }> {
  const { body } = await getJson<{ amount?: number; 'min-balance'?: number }>(
    `${algodUrl(opts)}/v2/accounts/${opts.address}?exclude=all`,
    opts,
  );
  return { amount: body?.amount ?? 0, minBalance: body?.['min-balance'] ?? 0 };
}

