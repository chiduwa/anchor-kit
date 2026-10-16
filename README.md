# anchor-kit

Shared code for publishing tamper-proof fingerprints of records on the Algorand blockchain, used by Frontier Capital Signals, the KCE Dynamics app and the ThriveWorks Ghana app.

This is a verification tool only. It creates no token or asset, holds no one's funds, and sends nothing to anyone: every anchor is a zero-ALGO payment from an anchor account to itself, carrying a hash in its note. The exact recipe, with test vectors, is in [RECIPE.md](RECIPE.md).

## Install

Pin a tag; there is no npm release and no build step on install (`dist/` is committed).

```json
"dependencies": {
  "anchor-kit": "github:chiduwa/anchor-kit#v0.1.0",
  "algosdk": "^3.9.0"
}
```

`algosdk` is needed only by code that imports `anchor-kit/submit`.

## Two entry points

| Import | Runs in | Dependencies | Contains |
|---|---|---|---|
| `anchor-kit` | Node 20+, Cloudflare Workers, browsers | none (WebCrypto + fetch) | `canonicalize`, `jsonLeaf`, `fileLeaf`, `merkle`, `verifyLeaf`, note codec, `findAnchor`, `lookupAnchorTx`, `latestAnchor`, `explorerTxUrl`, `ANCHOR_ADDRESSES` |
| `anchor-kit/submit` | servers; browser for the wallet flow | algosdk | `anchor`, `buildAnchorTxn`, `submitSigned`, `resolvePending`, `accountFromMnemonic` |

Storage is not in the library. Each app keeps its own anchor table (Supabase or D1).

## Anchoring a batch (server)

```ts
import { jsonLeaf, merkle } from 'anchor-kit';
import { anchor, resolvePending } from 'anchor-kit/submit';

const leaves = await Promise.all(records.map((r) => jsonLeaf(r))); // no floats: "0.6240", not 0.624
const { root, proofs } = await merkle(leaves);

const result = await anchor({
  network: process.env.ALGO_NETWORK as 'testnet' | 'mainnet',
  dapp: 'fcs-signals',
  kind: 'signal_batch',
  hash: root,
  subjectKey: `batch:${batchId}`,
  mnemonic: process.env.ANCHOR_MNEMONIC_FCS_SIGNALS,
  // Runs BEFORE sending. Store txid + lastValid as 'pending' here; if this throws, nothing is sent.
  onPending: async ({ txid, lastValid, address }) => { /* insert pending row */ },
});
// On the next run, settle any row still 'pending' with resolvePending(): confirmed, pending, or expired (safe to rebuild).
```

Never double-anchor, never lose one: the txid is stored before sending, a lease of `SHA-256(dapp|kind|subjectKey)` makes the network refuse a duplicate inside the validity window (60 rounds, about 3 minutes), and `resolvePending` tells a crashed run whether its transaction landed.

## Verifying (any runtime)

```ts
import { addressesFor, findAnchor, jsonLeaf, verifyLeaf, explorerTxUrl } from 'anchor-kit';

const leaf = await jsonLeaf(record);
const inBatch = await verifyLeaf({ leaf, proof, root });
const onChain = await findAnchor({ network, dapp: 'fcs-signals', hash: root, addresses: addressesFor('fcs-signals', network) });
// onChain.found, onChain.timestamp (unix s), explorerTxUrl(onChain.txid, network)
```

`findAnchor` only accepts transactions SENT by a listed anchor address. Anyone can send a note to an anchor address, so a received note proves nothing.

## Keys and addresses

- One Ed25519 hot account per dapp. algosdk 3.9 can sign Falcon-1024 transactions only through a raw signer you supply. It has no Falcon key generation or signing of its own, and the network expects Algorand's specific Falcon signature format, so the hot accounts stay Ed25519 for now. A stolen hot key can only write junk notes and spend a tiny balance. Re-check this before MainNet.
- Mnemonics live only in secret stores: `ANCHOR_MNEMONIC_<DAPP>` in GitHub Actions secrets (FCS) or Vercel env (KCE). TestNet mnemonics for local work are in the macOS Keychain, service `anchor-kit-testnet`, one entry per dapp plus `anchor-kit-test`.
- `src/addresses.ts` lists every public address each dapp has used, with dates. On rotation, add the new address, set `to` on the old one, and release a new tag. Never delete an entry.
- The ThriveWorks issuer (`twg-creds`) is a Pera Wallet account; its key never touches a server.

## Development

```sh
npm ci
npm run typecheck && npm test      # unit tests, offline
npm run build                      # writes dist/ (commit it)
ANCHOR_TEST_MNEMONIC="$(security find-generic-password -s anchor-kit-testnet -a anchor-kit-test -w)" npm run test:testnet
```

Release: bump `version`, `npm run build`, commit `dist/`, tag `vX.Y.Z`, push the tag (the TestNet workflow runs on tags). Consumers move to the new tag explicitly.

## Monitoring

`.github/workflows/monitor.yml` runs daily. It checks every active anchor account for at least 60 days of expected fees and, for scheduled dapps, a recent enough anchor. On a problem it exits non-zero (GitHub emails the repo owner) and, if `RESEND_API_KEY` (secret) and `ALERT_TO` (variable) are set, sends one email through Resend.
