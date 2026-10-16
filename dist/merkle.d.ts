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
export declare function merkle(leaves: readonly string[]): Promise<MerkleTree>;
export declare function rootFromProof(leaf: string, proof: readonly string[]): Promise<string>;
export declare function verifyLeaf({ leaf, proof, root }: {
    leaf: string;
    proof: readonly string[];
    root: string;
}): Promise<boolean>;
