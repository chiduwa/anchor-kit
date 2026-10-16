/**
 * Live TestNet check: `npm run test:testnet` with ANCHOR_TEST_MNEMONIC set to a
 * funded TestNet account. Spends about 0.003 test ALGO per run.
 */
import algosdk from 'algosdk';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../src/hash.js';
import { encodeNote } from '../src/note.js';
import { findAnchor, lookupAnchorTx, type FindResult } from '../src/indexer.js';
import { accountFromMnemonic, algodClient, anchor, buildAnchorTxn, resolvePending, submitSigned, type PendingRecord } from '../src/submit.js';

const DAPP = 'anchor-kit-test';
const net = { network: 'testnet' as const };
const mnemonic = process.env.ANCHOR_TEST_MNEMONIC;
if (!mnemonic) throw new Error('ANCHOR_TEST_MNEMONIC is empty: the TestNet suite needs a funded TestNet account');

async function until<T>(probe: () => Promise<T | null>, label: string, ms = 60_000): Promise<T> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const value = await probe();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 2_000));
  }
  throw new Error(`timed out waiting for ${label}`);
}

describe('TestNet', () => {
  const account = accountFromMnemonic(mnemonic);
  const client = algodClient(net);

  it('anchors, is found through the indexer, and a retry cannot double-anchor', async () => {
    const hash = await sha256Hex(`anchor-kit testnet ${new Date().toISOString()} ${Math.random()}`);
    const subject = { ...net, dapp: DAPP, kind: 'integration', hash, subjectKey: `test:${hash.slice(0, 16)}` };
    const pending: PendingRecord[] = [];

    const result = await anchor({ ...subject, mnemonic, client, onPending: (p) => void pending.push(p) });
    expect(pending).toEqual([{ txid: result.txid, lastValid: result.lastValid, address: account.address }]);
    expect(result.round).toBeGreaterThan(0);

    const found = await until<FindResult & { found: true }>(async () => {
      const r = await findAnchor({ ...net, dapp: DAPP, hash, addresses: [account.address] });
      return r.found ? r : null;
    }, 'indexer to show the anchor');
    expect(found).toMatchObject({ txid: result.txid, round: result.round, address: account.address, kind: 'integration' });
    expect(Math.abs(found.timestamp - Date.now() / 1000)).toBeLessThan(600);

    expect(await lookupAnchorTx({ ...net, txid: result.txid, addresses: [account.address] })).toMatchObject({ hash });
    expect(await resolvePending({ ...net, txid: result.txid, lastValid: result.lastValid, address: account.address, client })).toEqual({
      status: 'confirmed',
      round: result.round,
    });

    // A second transaction for the same subject carries the same lease: the network itself refuses it.
    const again = await buildAnchorTxn({ ...subject, sender: account.address, client });
    expect(again.txid).not.toBe(result.txid);
    await expect(submitSigned({ client, signed: again.txn.signTxn(account.sk), txid: again.txid, waitRounds: 4 })).rejects.toThrow(/lease/i);
  });

  it('ignores a forged note sent TO the anchor address by another account', async () => {
    const forger = algosdk.generateAccount();
    const forgerAddress = forger.addr.toString();
    const forgedHash = await sha256Hex(`forged ${Math.random()}`);
    const params = await client.getTransactionParams().do();

    // Fund a throwaway account, then have it send a fake anchor and close itself back in the same transaction.
    const fund = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: account.address,
      receiver: forgerAddress,
      amount: 102_000,
      suggestedParams: params,
    });
    await submitSigned({ client, signed: fund.signTxn(account.sk), txid: fund.txID() });
    const forge = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: forgerAddress,
      receiver: account.address,
      amount: 0,
      closeRemainderTo: account.address,
      note: encodeNote({ dapp: DAPP, kind: 'integration', hash: forgedHash }),
      suggestedParams: await client.getTransactionParams().do(),
    });
    await submitSigned({ client, signed: forge.signTxn(forger.sk), txid: forge.txID() });

    await until(() => lookupAnchorTx({ ...net, txid: forge.txID(), addresses: [forgerAddress] }), 'indexer to show the forged note');
    expect(await lookupAnchorTx({ ...net, txid: forge.txID(), addresses: [account.address] })).toBeNull();
    expect(await findAnchor({ ...net, dapp: DAPP, hash: forgedHash, addresses: [account.address] })).toEqual({ found: false });
  });
});
