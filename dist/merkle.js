import { assertHash, nodeHash } from './hash.js';
/**
 * Builds the tree over leaf hashes (already leafHash'ed). At each level, pairs
 * are hashed with nodeHash; an unpaired last node moves up unchanged. A single
 * leaf is its own root with an empty proof.
 */
export async function merkle(leaves) {
    if (leaves.length === 0)
        throw new RangeError('merkle: at least one leaf is required');
    leaves.forEach((leaf, i) => assertHash(leaf, `merkle leaf ${i}`));
    const proofs = leaves.map(() => []);
    const position = leaves.map((_, i) => i);
    let level = [...leaves];
    while (level.length > 1) {
        const next = [];
        for (let i = 0; i < level.length; i += 2) {
            const left = level[i];
            const right = level[i + 1];
            next.push(right === undefined ? left : await nodeHash(left, right));
        }
        for (let k = 0; k < position.length; k++) {
            const p = position[k];
            const sibling = level[p ^ 1];
            if (sibling !== undefined)
                proofs[k].push(sibling);
            position[k] = p >> 1;
        }
        level = next;
    }
    return { root: level[0], proofs };
}
export async function rootFromProof(leaf, proof) {
    assertHash(leaf, 'leaf');
    let hash = leaf;
    for (const sibling of proof)
        hash = await nodeHash(hash, sibling);
    return hash;
}
export async function verifyLeaf({ leaf, proof, root }) {
    try {
        return (await rootFromProof(leaf, proof)) === root;
    }
    catch {
        return false;
    }
}
