/** Domain separation: a leaf can never be passed off as an inner node, or the reverse. */
export declare const LEAF_PREFIX = 0;
export declare const NODE_PREFIX = 1;
export declare function utf8(text: string): Uint8Array;
export declare function toHex(bytes: Uint8Array): string;
export declare function fromHex(hex: string): Uint8Array;
export declare function isHash(value: unknown): value is string;
export declare function assertHash(value: unknown, label?: string): asserts value is string;
/** SHA-256 through WebCrypto, so the same code runs in Node 20+, Workers and browsers. */
export declare function sha256(bytes: Uint8Array): Promise<Uint8Array>;
export declare function sha256Hex(input: string | Uint8Array): Promise<string>;
/** Leaf = SHA-256(0x00 || bytes). */
export declare function leafHash(bytes: Uint8Array): Promise<string>;
/** Leaf for a JSON record: strict check, RFC 8785 canonical form, UTF-8, then leafHash. */
export declare function jsonLeaf(record: unknown): Promise<string>;
/** Leaf for a file, given the file's own SHA-256 (hex). The leaf covers the 32 raw digest bytes. */
export declare function fileLeaf(fileSha256: string): Promise<string>;
/** Node = SHA-256(0x01 || min(a,b) || max(a,b)). Sorting the pair means proofs need no left/right flags. */
export declare function nodeHash(a: string, b: string): Promise<string>;
