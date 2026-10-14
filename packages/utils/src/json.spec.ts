import { describe, it, expect } from 'vitest';
import { canonicalJsonStringify } from './json.js';

describe('canonicalJsonStringify', () => {
  it('handles primitive values identically to JSON.stringify', () => {
    expect(canonicalJsonStringify(42)).toBe('42');
    expect(canonicalJsonStringify('hello')).toBe('"hello"');
    expect(canonicalJsonStringify(true)).toBe('true');
    expect(canonicalJsonStringify(false)).toBe('false');
    expect(canonicalJsonStringify(null)).toBe('null');
  });

  it('sorts object keys alphabetically regardless of declaration order', () => {
    const objA = { z: 1, a: 2, m: 3 };
    const objB = { a: 2, m: 3, z: 1 };
    expect(canonicalJsonStringify(objA)).toBe('{"a":2,"m":3,"z":1}');
    expect(canonicalJsonStringify(objA)).toBe(canonicalJsonStringify(objB));
  });

  it('recursively canonicalizes nested objects and arrays', () => {
    const nestedA = {
      user: { name: 'Alice', age: 30 },
      tags: [
        { id: 2, name: 'b' },
        { id: 1, name: 'a' },
      ],
    };
    const nestedB = {
      tags: [
        { name: 'b', id: 2 },
        { id: 1, name: 'a' },
      ],
      user: { age: 30, name: 'Alice' },
    };
    expect(canonicalJsonStringify(nestedA)).toBe(canonicalJsonStringify(nestedB));
    expect(canonicalJsonStringify(nestedA)).toBe(
      '{"tags":[{"id":2,"name":"b"},{"id":1,"name":"a"}],"user":{"age":30,"name":"Alice"}}',
    );
  });

  it('omits undefined and function values in objects', () => {
    const obj = {
      a: 1,
      b: undefined,
      c: () => {},
      d: 2,
    };
    expect(canonicalJsonStringify(obj)).toBe('{"a":1,"d":2}');
  });
});
