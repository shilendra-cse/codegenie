/**
 * Collects a byte stream up to `maxBytes`. Once over the limit it keeps the first and
 * last maxBytes/2 bytes, since the end of output (e.g. test failures) usually matters most.
 */
export class CappedBuffer {
  private head: Buffer[] = [];
  private headBytes = 0;
  private tail: Buffer[] = [];
  private tailBytes = 0;
  private dropped = 0;

  constructor(private readonly maxBytes: number) {}

  push(chunk: Buffer) {
    const half = Math.floor(this.maxBytes / 2);
    if (this.headBytes < half) {
      const take = Math.min(half - this.headBytes, chunk.length);
      this.head.push(chunk.subarray(0, take));
      this.headBytes += take;
      chunk = chunk.subarray(take);
    }
    if (chunk.length === 0) return;
    this.tail.push(chunk);
    this.tailBytes += chunk.length;
    while (this.tailBytes > half) {
      const first = this.tail[0]!;
      const excess = this.tailBytes - half;
      if (first.length <= excess) {
        this.tail.shift();
        this.tailBytes -= first.length;
        this.dropped += first.length;
      } else {
        this.tail[0] = first.subarray(excess);
        this.tailBytes -= excess;
        this.dropped += excess;
      }
    }
  }

  get truncated() {
    return this.dropped > 0;
  }

  get droppedBytes() {
    return this.dropped;
  }

  toString() {
    if (!this.truncated) {
      // Decode as one buffer so multi-byte characters spanning head/tail stay intact.
      return Buffer.concat([...this.head, ...this.tail]).toString("utf8");
    }
    const head = Buffer.concat(this.head).toString("utf8");
    const tail = Buffer.concat(this.tail).toString("utf8");
    return `${head}\n… [${this.dropped} bytes omitted] …\n${tail}`;
  }
}
