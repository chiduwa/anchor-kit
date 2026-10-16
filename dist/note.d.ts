/** ARC-2: the dApp name is 5 to 32 characters. */
export declare const DAPP_PATTERN: RegExp;
export declare const KIND_PATTERN: RegExp;
export declare const DAPPS: readonly ["fcs-signals", "kce-handover", "kce-books", "twg-creds"];
export type Dapp = (typeof DAPPS)[number];
export declare const NOTE_VERSION = 1;
export interface AnchorNote {
    dapp: string;
    kind: string;
    hash: string;
}
/**
 * `<dapp>:j{"h":"<hex>","kind":"<kind>","v":1}`. The JSON part is canonical
 * (keys sorted), which puts the hash first: an indexer note-prefix search on
 * `<dapp>:j{"h":"<hex>"` finds an anchor without knowing its kind.
 */
export declare function encodeNoteText(note: AnchorNote): string;
export declare function encodeNote(note: AnchorNote): Uint8Array;
/** The bytes every anchor of `hash` under `dapp` starts with. */
export declare function notePrefixForHash(dapp: string, hash: string): Uint8Array;
/** Decodes a note, or returns null if it is not exactly the canonical form this library writes. */
export declare function decodeNote(note: Uint8Array | string): AnchorNote | null;
