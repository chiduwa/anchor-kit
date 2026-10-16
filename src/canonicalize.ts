/**
 * RFC 8785 JSON Canonicalization Scheme (JCS).
 *
 * ECMAScript's own JSON.stringify already produces the RFC's number and string
 * serialization (the RFC is defined in terms of it), so the only work left is
 * sorting object keys by UTF-16 code units, which is what Array#sort does by
 * default. Anything JSON cannot represent exactly throws instead of being
 * silently changed, because a silent change here alters a hash.
 */
export function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError('canonicalize: NaN and Infinity have no JSON form');
      return JSON.stringify(value);
    case 'string':
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) {
        return '[' + value.map((item) => (item === undefined ? 'null' : canonicalize(item))).join(',') + ']';
      }
      const withToJSON = value as { toJSON?: () => unknown };
      if (typeof withToJSON.toJSON === 'function') return canonicalize(withToJSON.toJSON());
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record).filter((key) => record[key] !== undefined).sort();
      return '{' + keys.map((key) => JSON.stringify(key) + ':' + canonicalize(record[key])).join(',') + '}';
    }
    default:
      throw new TypeError(`canonicalize: ${typeof value} has no JSON form`);
  }
}

/**
 * Stricter than JSON: rejects the values that make a hash hard to reproduce in
 * another language. Use it on every object that gets hashed into a leaf.
 *
 * - no non-integer numbers (encode them as fixed-precision strings, "0.6240")
 * - no integers beyond 2^53 (encode pesewas totals that large as strings)
 * - no undefined, bigint, functions, symbols, Dates or class instances
 */
export function assertHashable(value: unknown, path = '$'): void {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(`${path}: ${value} is not a safe integer; encode it as a string`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertHashable(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new TypeError(`${path}: only plain objects can be hashed (got ${proto?.constructor?.name ?? 'unknown'})`);
    }
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) throw new TypeError(`${path}.${key}: undefined; omit the key or use null`);
      assertHashable(item, `${path}.${key}`);
    }
    return;
  }
  throw new TypeError(`${path}: ${typeof value} cannot be hashed`);
}
