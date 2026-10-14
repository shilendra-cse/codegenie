import { describe, expect, it } from "vitest";
import { CappedBuffer } from "./capped-buffer.js";

function collect(maxBytes: number, ...chunks: string[]) {
  const buffer = new CappedBuffer(maxBytes);
  for (const chunk of chunks) buffer.push(Buffer.from(chunk));
  return buffer;
}

describe("CappedBuffer", () => {
  it("returns everything when under the cap", () => {
    const buffer = collect(100, "hello ", "world");
    expect(buffer.truncated).toBe(false);
    expect(buffer.toString()).toBe("hello world");
  });

  it("does not truncate output exactly at the cap", () => {
    const buffer = collect(10, "ABCDE", "FGHIJ");
    expect(buffer.truncated).toBe(false);
    expect(buffer.toString()).toBe("ABCDEFGHIJ");
  });

  it("keeps head and tail and reports omitted bytes when over the cap", () => {
    const buffer = collect(10, "ABCDEFGH", "IJKLMNOP");
    expect(buffer.truncated).toBe(true);
    expect(buffer.droppedBytes).toBe(6);
    expect(buffer.toString()).toBe("ABCDE\n… [6 bytes omitted] …\nLMNOP");
  });

  it("keeps the most recent tail across many small chunks", () => {
    const buffer = collect(4, ..."abcdefghij".split(""));
    expect(buffer.toString()).toBe("ab\n… [6 bytes omitted] …\nij");
  });

  it("keeps a multi-byte character intact when it spans head and tail", () => {
    // "é" is 2 bytes in UTF-8. With an 8-byte cap the head holds 4 bytes,
    // so the first byte of "é" lands in the head and the second in the tail.
    const bytes = Buffer.from("abcé");
    const buffer = new CappedBuffer(8);
    buffer.push(bytes.subarray(0, 4));
    buffer.push(bytes.subarray(4));
    expect(buffer.toString()).toBe("abcé");
  });
});
