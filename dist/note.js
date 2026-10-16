import { canonicalize } from './canonicalize.js';
import { assertHash, isHash, utf8 } from './hash.js';
/** ARC-2: the dApp name is 5 to 32 characters. */
export const DAPP_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_/@.-]{4,31}$/;
export const KIND_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
export const DAPPS = ['fcs-signals', 'kce-handover', 'kce-books', 'twg-creds'];
export const NOTE_VERSION = 1;
function check({ dapp, kind, hash }) {
    if (!DAPP_PATTERN.test(dapp))
        throw new TypeError(`note: dapp "${dapp}" must be 5 to 32 characters (ARC-2)`);
    if (!KIND_PATTERN.test(kind))
        throw new TypeError(`note: kind "${kind}" must be lowercase letters, digits or _`);
    assertHash(hash, 'note hash');
}
/**
 * `<dapp>:j{"h":"<hex>","kind":"<kind>","v":1}`. The JSON part is canonical
 * (keys sorted), which puts the hash first: an indexer note-prefix search on
 * `<dapp>:j{"h":"<hex>"` finds an anchor without knowing its kind.
 */
export function encodeNoteText(note) {
    check(note);
    return `${note.dapp}:j${canonicalize({ h: note.hash, kind: note.kind, v: NOTE_VERSION })}`;
}
export function encodeNote(note) {
    return utf8(encodeNoteText(note));
}
/** The bytes every anchor of `hash` under `dapp` starts with. */
export function notePrefixForHash(dapp, hash) {
    if (!DAPP_PATTERN.test(dapp))
        throw new TypeError(`note: dapp "${dapp}" must be 5 to 32 characters (ARC-2)`);
    assertHash(hash, 'note hash');
    return utf8(`${dapp}:j{"h":"${hash}"`);
}
/** Decodes a note, or returns null if it is not exactly the canonical form this library writes. */
export function decodeNote(note) {
    let text;
    try {
        text = typeof note === 'string' ? note : new TextDecoder('utf-8', { fatal: true }).decode(note);
    }
    catch {
        return null;
    }
    const split = text.indexOf(':j');
    if (split < 0)
        return null;
    const dapp = text.slice(0, split);
    if (!DAPP_PATTERN.test(dapp))
        return null;
    let body;
    try {
        body = JSON.parse(text.slice(split + 2));
    }
    catch {
        return null;
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body))
        return null;
    const { h, kind, v } = body;
    if (v !== NOTE_VERSION || !isHash(h) || typeof kind !== 'string' || !KIND_PATTERN.test(kind))
        return null;
    const decoded = { dapp, kind, hash: h };
    return encodeNoteText(decoded) === text ? decoded : null;
}
