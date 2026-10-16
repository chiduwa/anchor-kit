# How to check an anchored record yourself

Frontier Capital Signals, KCE Dynamics and ThriveWorks Ghana publish a fingerprint (a SHA-256 hash) of their records on the public Algorand blockchain. The fingerprint proves that a record existed at that time and has not changed since. It does not prove that the record was right.

You do not need to trust our websites to check this. Everything below works with any SHA-256 tool and any Algorand explorer or indexer.

## 1. Fingerprint of a record (a "leaf")

- **A JSON record** (a signal, a credential): write it in RFC 8785 canonical form (keys sorted, no spaces), encode it as UTF-8, then compute `SHA-256(0x00 || bytes)`. The records contain no fractional numbers; decimals are written as strings such as `"0.6240"`.
- **A file** (a handover document): compute the file's ordinary SHA-256 (32 bytes), then `SHA-256(0x00 || those 32 bytes)`.

## 2. Combining fingerprints (the Merkle tree)

- Two fingerprints `a` and `b` combine into `SHA-256(0x01 || min(a,b) || max(a,b))`, comparing the raw bytes.
- Pair them left to right at each level. An unpaired last one moves up unchanged. A single fingerprint is its own root.
- A proof is the list of fingerprints you combine with, from the bottom up. Because pairs are sorted, a proof needs no left or right markers.

The `0x00` and `0x01` prefixes mean a leaf can never be passed off as a combined fingerprint.

## 3. The on-chain note

The root is written in the note of a zero-ALGO payment that an anchor account sends to itself:

```
<dapp>:j{"h":"<root hex>","kind":"<kind>","v":1}
```

| dapp | Who | kinds |
|---|---|---|
| `fcs-signals` | Frontier Capital Signals | `signal_batch` |
| `kce-handover` | KCE Dynamics | `handover` |
| `kce-books` | KCE accounting module | `ledger_close` |
| `twg-creds` | ThriveWorks Ghana | `issue`, `revoke` |

**Only a transaction SENT by a published anchor address counts.** Anyone can send a payment with any note to an anchor address, so a note received from someone else proves nothing. The published addresses are listed in `src/addresses.ts`, including old ones after a key rotation.

The block's timestamp is the time the record is proven to have existed.

## 4. Test vectors

Records, in this order:

```
{"asset":"BTC","direction":"up","score":"0.6240"}
{"asset":"ETH","direction":"down","score":"0.5100"}
{"asset":"SOL","direction":"up","score":"0.7000"}
```

| | value |
|---|---|
| leaf 0 | `dead4c8bf62a9d4c398ab47be51dad7ef50c289f9bf0e83d1187392b1690aa90` |
| leaf 1 | `0bb81b33133f798b9cdedbdf8b7dd4b7273018c80140d575e1d20a4ed00143dc` |
| leaf 2 | `84b2e435913534d49ea9b3d27a6d76ccfb6c352a6c06b4518de798b49f2a256e` |
| root | `56cc174fd84d2bd84d1fa4a353765a21d9e77d112efc9bf618df05a1279282af` |
| proof for leaf 2 | `["bd31c07c13fa4b4af5d23a34cf9d613e47ef187b24061ee4c971f5192c948fd2"]` |
| note | `fcs-signals:j{"h":"56cc174fd84d2bd84d1fa4a353765a21d9e77d112efc9bf618df05a1279282af","kind":"signal_batch","v":1}` |

File vector: the bytes `hello handover` have SHA-256 `89002e3b2a733ec919d6cf3a775db47bb66b9415194d27719f3c4eb6c763f986` and file leaf `c5da664742332cf4f3d1f0e4a566e26dfe49059a5a8e87e731ce73c4a07d2cbe`.

## 5. A standalone check (Node 20+, no packages)

```js
// node check.mjs <leafHex> <rootHex> <txid> <anchorAddress> [testnet|mainnet] [proofHex,proofHex,...]
import { createHash } from 'node:crypto';
const [leaf, root, txid, address, network = 'mainnet', proofArg = ''] = process.argv.slice(2);
const node = (a, b) => { const [lo, hi] = [a, b].sort();
  return createHash('sha256').update(Buffer.concat([Buffer.from([1]), Buffer.from(lo, 'hex'), Buffer.from(hi, 'hex')])).digest('hex'); };
const computed = proofArg ? proofArg.split(',').reduce(node, leaf) : leaf;
console.log('proof leads to root:', computed === root);
const idx = `https://${network}-idx.4160.nodely.dev`;
const { transaction: t } = await (await fetch(`${idx}/v2/transactions/${txid}`)).json();
const note = Buffer.from(t.note, 'base64').toString('utf8');
console.log('sent by the anchor address:', t.sender === address);
console.log('note carries the root:', note.includes(`"h":"${root}"`), note);
console.log('anchored at:', new Date(t['round-time'] * 1000).toISOString(), 'round', t['confirmed-round']);
```
