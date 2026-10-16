/**
 * RFC 8785 JSON Canonicalization Scheme (JCS).
 *
 * ECMAScript's own JSON.stringify already produces the RFC's number and string
 * serialization (the RFC is defined in terms of it), so the only work left is
 * sorting object keys by UTF-16 code units, which is what Array#sort does by
 * default. Anything JSON cannot represent exactly throws instead of being
 * silently changed, because a silent change here alters a hash.
 */
export declare function canonicalize(value: unknown): string;
/**
 * Stricter than JSON: rejects the values that make a hash hard to reproduce in
 * another language. Use it on every object that gets hashed into a leaf.
 *
 * - no non-integer numbers (encode them as fixed-precision strings, "0.6240")
 * - no integers beyond 2^53 (encode pesewas totals that large as strings)
 * - no undefined, bigint, functions, symbols, Dates or class instances
 */
export declare function assertHashable(value: unknown, path?: string): void;
