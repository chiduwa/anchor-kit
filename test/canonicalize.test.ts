import { describe, expect, it } from 'vitest';
import { assertHashable, canonicalize } from '../src/canonicalize.js';

describe('canonicalize (RFC 8785)', () => {
  it('matches the RFC 8785 section 3.2.2 example', () => {
    const input = JSON.parse(
      '{"numbers":[333333333.33333329,1E30,4.50,2e-3,0.000000000000000000000000001],' +
        '"string":"\\u20ac$\\u000F\\u000aA\'\\u0042\\u0022\\u005c\\\\\\"\\/","literals":[null,true,false]}',
    );
    expect(canonicalize(input)).toBe(
      '{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],' +
        '"string":"€$\\u000f\\nA\'B\\"\\\\\\\\\\"/"}',
    );
  });

  it('sorts keys by UTF-16 code units (RFC 8785 section 3.2.3 example)', () => {
    const input = JSON.parse(
      '{"\\u20ac":"Euro Sign","\\r":"Carriage Return","\\ufb33":"Hebrew Letter Dalet With Dagesh","1":"One",' +
        '"\\ud83d\\ude00":"Emoji: Grinning Face","\\u0080":"Control","\\u00f6":"Latin Small Letter O With Diaeresis"}',
    );
    // Compare the string itself: Object.keys would reorder the integer-like key "1".
    const order = ['\r', '1', '\u0080', 'ö', '€', '😀', 'דּ'];
    const expected = '{' + order.map((k) => `${JSON.stringify(k)}:${JSON.stringify(input[k])}`).join(',') + '}';
    expect(canonicalize(input)).toBe(expected);
  });

  it('serializes numbers the ECMAScript way', () => {
    expect(canonicalize([0, -0, 5e-324, 1.7976931348623157e308, 9007199254740992, 1e21, 1e-7, 0.1])).toBe(
      '[0,0,5e-324,1.7976931348623157e+308,9007199254740992,1e+21,1e-7,0.1]',
    );
  });

  it('is independent of key insertion order and nesting', () => {
    expect(canonicalize({ b: [{ z: 1, a: 2 }], a: { y: null, x: 'x' } })).toBe(canonicalize({ a: { x: 'x', y: null }, b: [{ a: 2, z: 1 }] }));
    expect(canonicalize({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it('drops undefined object members and nulls undefined array items, like JSON', () => {
    expect(canonicalize({ a: undefined, b: [undefined] })).toBe('{"b":[null]}');
  });

  it('refuses values JSON cannot represent', () => {
    expect(() => canonicalize(Number.NaN)).toThrow();
    expect(() => canonicalize(Infinity)).toThrow();
    expect(() => canonicalize(10n)).toThrow();
    expect(() => canonicalize(() => 1)).toThrow();
  });
});

describe('assertHashable', () => {
  it('accepts plain JSON with integers', () => {
    expect(() => assertHashable({ a: [1, 'x', null, true, { b: -5 }] })).not.toThrow();
  });

  it('rejects floats, unsafe integers, undefined, bigint, Dates and class instances', () => {
    expect(() => assertHashable({ score: 0.62 })).toThrow(/score.*string/);
    expect(() => assertHashable({ n: 2 ** 53 })).toThrow();
    expect(() => assertHashable({ a: undefined })).toThrow(/undefined/);
    expect(() => assertHashable({ a: 1n })).toThrow();
    expect(() => assertHashable({ at: new Date(0) })).toThrow(/plain objects/);
    expect(() => assertHashable(new Map())).toThrow(/plain objects/);
  });
});
