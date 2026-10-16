import { assertHashable, canonicalize } from './canonicalize.js';
/** Domain separation: a leaf can never be passed off as an inner node, or the reverse. */
export const LEAF_PREFIX = 0x00;
export const NODE_PREFIX = 0x01;
const HEX32 = /^[0-9a-f]{64}$/;
const encoder = new TextEncoder();
export function utf8(text) {
    return encoder.encode(text);
}
export function toHex(bytes) {
    let out = '';
    for (const byte of bytes)
        out += byte.toString(16).padStart(2, '0');
    return out;
}
export function fromHex(hex) {
    if (!/^(?:[0-9a-fA-F]{2})*$/.test(hex))
        throw new TypeError('fromHex: not an even-length hex string');
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++)
        out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
}
export function isHash(value) {
    return typeof value === 'string' && HEX32.test(value);
}
export function assertHash(value, label = 'hash') {
    if (!isHash(value))
        throw new TypeError(`${label}: expected 64 lowercase hex characters`);
}
function concat(...parts) {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
}
/** SHA-256 through WebCrypto, so the same code runs in Node 20+, Workers and browsers. */
export async function sha256(bytes) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return new Uint8Array(digest);
}
export async function sha256Hex(input) {
    return toHex(await sha256(typeof input === 'string' ? utf8(input) : input));
}
/** Leaf = SHA-256(0x00 || bytes). */
export async function leafHash(bytes) {
    return toHex(await sha256(concat(Uint8Array.of(LEAF_PREFIX), bytes)));
}
/** Leaf for a JSON record: strict check, RFC 8785 canonical form, UTF-8, then leafHash. */
export async function jsonLeaf(record) {
    assertHashable(record);
    return leafHash(utf8(canonicalize(record)));
}
/** Leaf for a file, given the file's own SHA-256 (hex). The leaf covers the 32 raw digest bytes. */
export async function fileLeaf(fileSha256) {
    assertHash(fileSha256, 'fileLeaf');
    return leafHash(fromHex(fileSha256));
}
/** Node = SHA-256(0x01 || min(a,b) || max(a,b)). Sorting the pair means proofs need no left/right flags. */
export async function nodeHash(a, b) {
    assertHash(a, 'nodeHash');
    assertHash(b, 'nodeHash');
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    return toHex(await sha256(concat(Uint8Array.of(NODE_PREFIX), fromHex(lo), fromHex(hi))));
}
