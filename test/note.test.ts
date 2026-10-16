import { describe, expect, it } from 'vitest';
import { sha256Hex, utf8 } from '../src/hash.js';
import { DAPPS, decodeNote, encodeNote, encodeNoteText, notePrefixForHash } from '../src/note.js';

const hash = 'a'.repeat(64);

describe('ARC-2 note codec', () => {
  it('writes the canonical form with the hash first', () => {
    expect(encodeNoteText({ dapp: 'fcs-signals', kind: 'signal_batch', hash })).toBe(
      `fcs-signals:j{"h":"${hash}","kind":"signal_batch","v":1}`,
    );
  });

  it('round-trips through bytes', async () => {
    const real = await sha256Hex('x');
    const note = { dapp: 'kce-books', kind: 'ledger_close', hash: real };
    expect(decodeNote(encodeNote(note))).toEqual(note);
  });

  it('every production dapp name is valid ARC-2 (5 to 32 characters)', () => {
    for (const dapp of DAPPS) expect(() => encodeNoteText({ dapp, kind: 'k', hash })).not.toThrow();
  });

  it('rejects names the v2 handoff used, which ARC-2 does not allow', () => {
    for (const dapp of ['fcs', 'kce', 'sika', 'a'.repeat(33), '-leading']) {
      expect(() => encodeNoteText({ dapp, kind: 'k', hash })).toThrow(/ARC-2/);
    }
  });

  it('rejects bad kinds and hashes', () => {
    expect(() => encodeNoteText({ dapp: 'fcs-signals', kind: 'Bad Kind', hash })).toThrow();
    expect(() => encodeNoteText({ dapp: 'fcs-signals', kind: 'k', hash: hash.toUpperCase() })).toThrow();
    expect(() => encodeNoteText({ dapp: 'fcs-signals', kind: 'k', hash: 'ab' })).toThrow();
  });

  it('decodes only the exact canonical form', () => {
    expect(decodeNote(`fcs-signals:j{"kind":"k","h":"${hash}","v":1}`)).toBeNull(); // keys out of order
    expect(decodeNote(`fcs-signals:j{"h":"${hash}","kind":"k","v":2}`)).toBeNull(); // unknown version
    expect(decodeNote(`fcs-signals:j{"h":"${hash}","kind":"k","v":1,"x":1}`)).toBeNull(); // extra field
    expect(decodeNote(`fcs-signals:j {"h":"${hash}","kind":"k","v":1}`)).toBeNull(); // whitespace
    expect(decodeNote(`fcs:j{"h":"${hash}","kind":"k","v":1}`)).toBeNull(); // short dapp
    expect(decodeNote('not a note')).toBeNull();
    expect(decodeNote(Uint8Array.of(0xff, 0xfe))).toBeNull(); // not UTF-8
  });

  it('the hash prefix is a prefix of every note for that hash', () => {
    const prefix = new TextDecoder().decode(notePrefixForHash('twg-creds', hash));
    for (const kind of ['issue', 'revoke']) expect(encodeNoteText({ dapp: 'twg-creds', kind, hash }).startsWith(prefix)).toBe(true);
    expect(utf8(encodeNoteText({ dapp: 'twg-creds', kind: 'issue', hash })).length).toBeLessThan(1024);
  });
});
