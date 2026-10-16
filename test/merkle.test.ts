import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canonicalize } from '../src/canonicalize.js';
import { fileLeaf, jsonLeaf, leafHash, nodeHash, sha256Hex, utf8 } from '../src/hash.js';
import { merkle, rootFromProof, verifyLeaf } from '../src/merkle.js';

// An independent implementation of the published recipe (RECIPE.md), on node:crypto.
const ref = {
  sha: (b: Buffer) => createHash('sha256').update(b).digest(),
  leaf: (bytes: Buffer) => ref.sha(Buffer.concat([Buffer.from([0]), bytes])).toString('hex'),
  node(a: string, b: string) {
    const [lo, hi] = [a, b].sort();
    return ref.sha(Buffer.concat([Buffer.from([1]), Buffer.from(lo!, 'hex'), Buffer.from(hi!, 'hex')])).toString('hex');
  },
  root(leaves: string[]): string {
    let level = leaves;
    while (level.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? ref.node(level[i]!, level[i + 1]!) : level[i]!);
      level = next;
    }
    return level[0]!;
  },
};

async function leaves(n: number): Promise<string[]> {
  return Promise.all(Array.from({ length: n }, (_, i) => jsonLeaf({ i, label: `leaf-${i}` })));
}

describe('hashing', () => {
  it('sha256Hex matches the standard "abc" vector', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('leaf and node hashes match the reference and are domain-separated', async () => {
    const bytes = utf8('{"a":1}');
    expect(await leafHash(bytes)).toBe(ref.leaf(Buffer.from(bytes)));
    expect(await leafHash(bytes)).not.toBe(await sha256Hex(bytes));
    const [a, b] = await leaves(2);
    expect(await nodeHash(a!, b!)).toBe(ref.node(a!, b!));
    expect(await nodeHash(a!, b!)).toBe(await nodeHash(b!, a!));
  });

  it('jsonLeaf hashes the canonical form, whatever the key order', async () => {
    expect(await jsonLeaf({ b: 2, a: 1 })).toBe(await jsonLeaf({ a: 1, b: 2 }));
    expect(await jsonLeaf({ a: 1, b: 2 })).toBe(ref.leaf(Buffer.from(canonicalize({ a: 1, b: 2 }))));
    await expect(jsonLeaf({ score: 0.5 })).rejects.toThrow();
  });

  it('fileLeaf covers the 32 raw digest bytes, not the hex text', async () => {
    const digest = await sha256Hex('file contents');
    expect(await fileLeaf(digest)).toBe(ref.leaf(Buffer.from(digest, 'hex')));
    await expect(fileLeaf('ABC')).rejects.toThrow();
  });
});

describe('merkle', () => {
  for (const n of [1, 2, 3, 4, 5, 7, 8, 13]) {
    it(`${n} leaves: root matches the reference and every proof verifies`, async () => {
      const ls = await leaves(n);
      const tree = await merkle(ls);
      expect(tree.root).toBe(ref.root(ls));
      for (let i = 0; i < n; i++) {
        expect(await verifyLeaf({ leaf: ls[i]!, proof: tree.proofs[i]!, root: tree.root })).toBe(true);
      }
    });
  }

  it('a single leaf is its own root with an empty proof', async () => {
    const [only] = await leaves(1);
    expect(await merkle([only!])).toEqual({ root: only, proofs: [[]] });
  });

  it('promotes the odd node: with 3 leaves the last proof has one step', async () => {
    const tree = await merkle(await leaves(3));
    expect(tree.proofs.map((p) => p.length)).toEqual([2, 2, 1]);
  });

  it('fails for a tampered leaf, a wrong root, a dropped step or reordered steps', async () => {
    const ls = await leaves(8);
    const tree = await merkle(ls);
    const proof = tree.proofs[3]!;
    const tampered = await jsonLeaf({ i: 3, label: 'leaf-3 edited' });
    expect(await verifyLeaf({ leaf: tampered, proof, root: tree.root })).toBe(false);
    expect(await verifyLeaf({ leaf: ls[3]!, proof, root: ls[0]! })).toBe(false);
    expect(await verifyLeaf({ leaf: ls[3]!, proof: proof.slice(1), root: tree.root })).toBe(false);
    expect(await verifyLeaf({ leaf: ls[3]!, proof: [...proof].reverse(), root: tree.root })).toBe(false);
  });

  it('a record made of two child hashes does not hash to their parent node (domain separation)', async () => {
    const [a, b] = (await leaves(2)).sort();
    const forgedRecordBytes = Buffer.concat([Buffer.from(a!, 'hex'), Buffer.from(b!, 'hex')]);
    // Without the 0x00 / 0x01 prefixes these two would be equal, letting an inner node pose as a leaf.
    expect(await leafHash(forgedRecordBytes)).not.toBe(await nodeHash(a!, b!));
    expect(await rootFromProof(a!, [b!])).toBe(await nodeHash(a!, b!));
  });

  it('rejects empty input and malformed hashes', async () => {
    await expect(merkle([])).rejects.toThrow();
    await expect(merkle(['xyz'])).rejects.toThrow();
    expect(await verifyLeaf({ leaf: 'nope', proof: [], root: 'nope' })).toBe(false);
  });
});
