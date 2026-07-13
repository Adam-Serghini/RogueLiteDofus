import { describe, it, expect } from "vitest";
import { stringifyCanonique, hashContenu } from "./canonical.mjs";

describe("stringifyCanonique", () => {
  it("trie les clés récursivement et termine par un newline", () => {
    const s = stringifyCanonique({ b: 1, a: { d: [{ z: 1, a: 2 }], c: 3 } });
    expect(s).toBe('{\n  "a": {\n    "c": 3,\n    "d": [\n      {\n        "a": 2,\n        "z": 1\n      }\n    ]\n  },\n  "b": 1\n}\n');
  });
  it("est stable : deux objets égaux à ordre de clés près donnent la même chaîne", () => {
    expect(stringifyCanonique({ x: 1, y: 2 })).toBe(stringifyCanonique({ y: 2, x: 1 }));
  });
});

describe("hashContenu", () => {
  it("est insensible à l'ordre des clés, sensible aux valeurs", () => {
    const a = hashContenu({ f1: { x: 1 }, f2: { y: 2 } });
    expect(hashContenu({ f2: { y: 2 }, f1: { x: 1 } })).toBe(a);
    expect(hashContenu({ f1: { x: 1 }, f2: { y: 3 } })).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
