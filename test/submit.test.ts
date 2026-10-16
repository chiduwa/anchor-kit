import algosdk from 'algosdk';
import { describe, expect, it } from 'vitest';
import { sha256, toHex, utf8 } from '../src/hash.js';
import { decodeNote } from '../src/note.js';
import { accountFromMnemonic, anchor, buildAnchorTxn, DEFAULT_VALID_ROUNDS, leaseFor } from '../src/submit.js';

const hash = 'd'.repeat(64);
const TESTNET_GENESIS = 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=';

function fakeClient(sent: Uint8Array[] = []) {
  return {
    getTransactionParams: () => ({
      do: async () => ({
        fee: 0n,
        minFee: 1000n,
        flatFee: false,
        firstValid: 1000n,
        lastValid: 2000n,
        genesisID: 'testnet-v1.0',
        genesisHash: Buffer.from(TESTNET_GENESIS, 'base64'),
      }),
    }),
    sendRawTransaction: (signed: Uint8Array) => ({
      do: async () => {
        sent.push(signed);
        throw new Error('stop here: offline test');
      },
    }),
  } as unknown as algosdk.Algodv2;
}

describe('buildAnchorTxn', () => {
  it('is a zero-ALGO payment to self carrying the note and the lease', async () => {
    const { addr } = algosdk.generateAccount();
    const sender = addr.toString();
    const subject = { dapp: 'kce-books', kind: 'ledger_close', hash, subjectKey: 'period:p1:v1' };
    const built = await buildAnchorTxn({ ...subject, sender, client: fakeClient() });
    const { txn } = built;
    expect(txn.type).toBe('pay');
    expect(txn.sender.toString()).toBe(sender);
    expect(txn.payment?.receiver.toString()).toBe(sender);
    expect(txn.payment?.amount).toBe(0n);
    expect(decodeNote(txn.note)).toEqual({ dapp: 'kce-books', kind: 'ledger_close', hash });
    expect(toHex(txn.lease!)).toBe(toHex(await sha256(utf8('kce-books|ledger_close|period:p1:v1'))));
    expect(built.lastValid).toBe(1000 + DEFAULT_VALID_ROUNDS);
    expect(built.txid).toBe(txn.txID());
  });

  it('gives a re-anchor of a new version a different lease', async () => {
    const a = await leaseFor({ dapp: 'kce-books', kind: 'ledger_close', subjectKey: 'period:p1:v1' });
    const b = await leaseFor({ dapp: 'kce-books', kind: 'ledger_close', subjectKey: 'period:p1:v2' });
    expect(toHex(a)).not.toBe(toHex(b));
    await expect(leaseFor({ dapp: 'kce-books', kind: 'ledger_close', subjectKey: '' })).rejects.toThrow();
  });
});

describe('mnemonic handling', () => {
  it('loads a valid mnemonic', () => {
    const account = algosdk.generateAccount();
    const mnemonic = algosdk.secretKeyToMnemonic(account.sk);
    expect(accountFromMnemonic(`  ${mnemonic.replace(/ /g, '   ')} `).address).toBe(account.addr.toString());
  });

  it('fails loudly on an empty secret and never echoes the words', () => {
    expect(() => accountFromMnemonic('')).toThrow(/empty.*secrets\./);
    expect(() => accountFromMnemonic(undefined)).toThrow(/empty/);
    const bad = 'abandon '.repeat(24) + 'zoo';
    try {
      accountFromMnemonic(bad);
      throw new Error('should have thrown');
    } catch (error) {
      expect(String((error as Error).message)).not.toContain('abandon');
    }
  });
});

describe('anchor ordering', () => {
  it('persists the pending record before anything is sent, and sends nothing if that fails', async () => {
    const mnemonic = algosdk.secretKeyToMnemonic(algosdk.generateAccount().sk);
    const sent: Uint8Array[] = [];
    const subject = { network: 'testnet' as const, dapp: 'fcs-signals', kind: 'signal_batch', hash, subjectKey: 'batch:x', mnemonic };

    await expect(
      anchor({ ...subject, client: fakeClient(sent), onPending: () => { throw new Error('database down'); } }),
    ).rejects.toThrow('database down');
    expect(sent).toHaveLength(0);

    let pendingTxid = '';
    await expect(
      anchor({ ...subject, client: fakeClient(sent), onPending: (p) => { pendingTxid = p.txid; } }),
    ).rejects.toThrow('offline test');
    expect(sent).toHaveLength(1);
    expect(algosdk.decodeSignedTransaction(sent[0]!).txn.txID()).toBe(pendingTxid);
  });
});
