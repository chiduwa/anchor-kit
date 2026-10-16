// The published test vectors in RECIPE.md. If one of these changes, every past
// anchor stops verifying: change the recipe only with a new note version.
import { describe, expect, it } from 'vitest';
import { fileLeaf, jsonLeaf, merkle, encodeNoteText, sha256Hex } from '../src/index.js';

const records = [
  { asset: 'BTC', direction: 'up', score: '0.6240' },
  { asset: 'ETH', direction: 'down', score: '0.5100' },
  { asset: 'SOL', direction: 'up', score: '0.7000' },
];

describe('RECIPE.md vectors', () => {
  it('leaves, root, proofs and note', async () => {
    const leaves = await Promise.all(records.map((r) => jsonLeaf(r)));
    expect(leaves).toEqual([
      'dead4c8bf62a9d4c398ab47be51dad7ef50c289f9bf0e83d1187392b1690aa90',
      '0bb81b33133f798b9cdedbdf8b7dd4b7273018c80140d575e1d20a4ed00143dc',
      '84b2e435913534d49ea9b3d27a6d76ccfb6c352a6c06b4518de798b49f2a256e',
    ]);
    const tree = await merkle(leaves);
    expect(tree.root).toBe('56cc174fd84d2bd84d1fa4a353765a21d9e77d112efc9bf618df05a1279282af');
    expect(tree.proofs[2]).toEqual(['bd31c07c13fa4b4af5d23a34cf9d613e47ef187b24061ee4c971f5192c948fd2']);
    expect(encodeNoteText({ dapp: 'fcs-signals', kind: 'signal_batch', hash: tree.root })).toBe(
      'fcs-signals:j{"h":"56cc174fd84d2bd84d1fa4a353765a21d9e77d112efc9bf618df05a1279282af","kind":"signal_batch","v":1}',
    );
  });

  it('file leaf', async () => {
    const digest = await sha256Hex('hello handover');
    expect(digest).toBe('89002e3b2a733ec919d6cf3a775db47bb66b9415194d27719f3c4eb6c763f986');
    expect(await fileLeaf(digest)).toBe('c5da664742332cf4f3d1f0e4a566e26dfe49059a5a8e87e731ce73c4a07d2cbe');
  });
});
