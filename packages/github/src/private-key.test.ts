import { describe, expect, it } from "vitest";
import { GithubConfigError, parsePrivateKey } from "./private-key.js";

const PEM =
  "-----BEGIN RSA PRIVATE KEY-----\nMIIabc\ndef\n-----END RSA PRIVATE KEY-----\n";

describe("parsePrivateKey", () => {
  it("accepts a key as downloaded", () => {
    expect(parsePrivateKey(PEM)).toBe(PEM);
  });

  it("accepts a key pasted on one line with \\n", () => {
    expect(parsePrivateKey(PEM.trim().replaceAll("\n", "\\n"))).toBe(PEM);
  });

  it.each([[""], ["ghp_notakey"], ["-----BEGIN PUBLIC KEY-----\nabc"]])(
    "rejects %j",
    (value) => {
      expect(() => parsePrivateKey(value)).toThrow(GithubConfigError);
    },
  );
});
