import { assertHash, nodeHash } from './hash.js';

export interface MerkleTree {
  root: string;
  /** proofs[i] is the sibling path for leaves[i], bottom-up. */
  proofs: string[][];
}

/**
 * Builds the tree over leaf hashes (already leafHash'ed). At each level, pairs
 * are hashed with nodeHash; an unpaired last node moves up unchanged. A single
 * leaf is its own root with an empty proof.
 */
export async function merkle(leaves: readonly string[]): Promise<MerkleTree> {
  if (leaves.length === 0) throw new RangeError('merkle: at least one leaf is required');
  leaves.forEach((leaf, i) => assertHash(leaf, `merkle leaf ${i}`));

  const proofs: string[][] = leaves.map(() => []);
  const position = leaves.map((_, i) => i);
  let level = [...leaves];

  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i] as string;
      const right = level[i + 1];
      next.push(right === undefined ? left : await nodeHash(left, right));
    }
    for (let k = 0; k < position.length; k++) {
      const p = position[k] as number;
      const sibling = level[p ^ 1];
      if (sibling !== undefined) (proofs[k] as string[]).push(sibling);
      position[k] = p >> 1;
    }
    level = next;
  }

  return { root: level[0] as string, proofs };
}

export async function rootFromProof(leaf: string, proof: readonly string[]): Promise<string> {
  assertHash(leaf, 'leaf');
  let hash = leaf;
  for (const sibling of proof) hash = await nodeHash(hash, sibling);
  return hash;
}

export async function verifyLeaf({ leaf, proof, root }: { leaf: string; proof: readonly string[]; root: string }): Promise<boolean> {
  try {
    return (await rootFromProof(leaf, proof)) === root;
  } catch {
    return false;
  }
}
