import { describe, expect, it, vi } from 'vitest';
import { encodeNote, encodeNoteText } from '../src/note.js';
import { findAnchor, fromBase64, latestAnchor, lookupAnchorTx, toBase64 } from '../src/indexer.js';
import { explorerTxUrl } from '../src/network.js';
import { utf8 } from '../src/hash.js';

const OURS = 'OURSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const ATTACKER = 'ATTACKERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const hash = 'b'.repeat(64);
const TXID = (c: string) => c.repeat(52);

function txn(id: string, sender: string, round: number, note: string | Uint8Array, type = 'pay') {
  const bytes = typeof note === 'string' ? utf8(note) : note;
  return { id, sender, 'tx-type': type, 'confirmed-round': round, 'round-time': 1_760_000_000 + round, note: toBase64(bytes) };
}

function mockFetch(pages: Record<string, unknown>[]) {
  const calls: string[] = [];
  const fetch = vi.fn(async (url: string) => {
    calls.push(url);
    const body = pages.shift();
    if (body === undefined) return new Response('', { status: 404 });
    return new Response(JSON.stringify(body), { status: 200 });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

const note = (kind = 'signal_batch') => encodeNote({ dapp: 'fcs-signals', kind, hash });

describe('findAnchor', () => {
  it('ignores a note sent BY someone else, even if it names our hash', async () => {
    const { fetch } = mockFetch([{ transactions: [txn(TXID('A'), ATTACKER, 50, note())] }]);
    expect(await findAnchor({ network: 'testnet', fetch, dapp: 'fcs-signals', hash, addresses: [OURS] })).toEqual({ found: false });
  });

  it('returns the earliest matching anchor across pages', async () => {
    const { fetch, calls } = mockFetch([
      { transactions: [txn(TXID('C'), OURS, 300, note())], 'next-token': 'page2' },
      { transactions: [txn(TXID('B'), OURS, 120, note()), txn(TXID('D'), ATTACKER, 10, note())] },
    ]);
    const result = await findAnchor({ network: 'testnet', fetch, dapp: 'fcs-signals', hash, addresses: [OURS] });
    expect(result).toMatchObject({ found: true, txid: TXID('B'), round: 120, address: OURS, kind: 'signal_batch' });
    expect(calls[0]).toContain('address-role=sender');
    expect(calls[0]).toContain(`note-prefix=${encodeURIComponent(toBase64(utf8(`fcs-signals:j{"h":"${hash}"`)))}`);
    expect(calls[1]).toContain('next=page2');
  });

  it('skips non-canonical notes, other dapps, other kinds and non-payments', async () => {
    const { fetch } = mockFetch([
      {
        transactions: [
          txn(TXID('E'), OURS, 5, `fcs-signals:j{"kind":"signal_batch","h":"${hash}","v":1}`),
          txn(TXID('F'), OURS, 6, encodeNote({ dapp: 'kce-handover', kind: 'handover', hash })),
          txn(TXID('G'), OURS, 7, note('other_kind')),
          txn(TXID('H'), OURS, 8, note(), 'axfer'),
        ],
      },
    ]);
    const r = await findAnchor({ network: 'testnet', fetch, dapp: 'fcs-signals', hash, addresses: [OURS], kind: 'signal_batch' });
    expect(r).toEqual({ found: false });
  });

  it('searches every address the dapp has used (key rotation)', async () => {
    const OLD = 'OLDKEYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const { fetch, calls } = mockFetch([{ transactions: [] }, { transactions: [txn(TXID('J'), OLD, 9, note())] }]);
    const r = await findAnchor({ network: 'mainnet', fetch, dapp: 'fcs-signals', hash, addresses: [OURS, OLD] });
    expect(r).toMatchObject({ found: true, address: OLD });
    expect(calls).toHaveLength(2);
  });
});

describe('lookupAnchorTx and latestAnchor', () => {
  it('returns null on 404 and does not fetch a malformed txid', async () => {
    const { fetch } = mockFetch([]);
    expect(await lookupAnchorTx({ network: 'testnet', fetch, txid: TXID('K'), addresses: [OURS] })).toBeNull();
    const spy = mockFetch([]);
    expect(await lookupAnchorTx({ network: 'testnet', fetch: spy.fetch, txid: 'not-a-txid', addresses: [OURS] })).toBeNull();
    expect(spy.calls).toHaveLength(0);
  });

  it('rejects a looked-up transaction from an unknown sender', async () => {
    const { fetch } = mockFetch([{ transaction: txn(TXID('L'), ATTACKER, 11, note()) }]);
    expect(await lookupAnchorTx({ network: 'testnet', fetch, txid: TXID('L'), addresses: [OURS] })).toBeNull();
  });

  it('latestAnchor picks the newest of our anchors', async () => {
    const other = encodeNoteText({ dapp: 'fcs-signals', kind: 'signal_batch', hash: 'c'.repeat(64) });
    const { fetch } = mockFetch([
      { transactions: [txn(TXID('M'), OURS, 500, other), txn(TXID('N'), OURS, 400, note()), txn(TXID('P'), ATTACKER, 900, note())] },
    ]);
    expect(await latestAnchor({ network: 'testnet', fetch, dapp: 'fcs-signals', address: OURS })).toMatchObject({ txid: TXID('M'), round: 500 });
  });
});

describe('helpers', () => {
  it('base64 round-trips bytes', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });

  it('builds explorer links and rejects unknown networks', () => {
    expect(explorerTxUrl('ABC', 'testnet')).toBe('https://lora.algokit.io/testnet/transaction/ABC');
    expect(() => explorerTxUrl('ABC', 'betanet' as never)).toThrow();
  });
});
