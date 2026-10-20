import { describe, expect, it } from "vitest";
import { createSerialQueue } from "./serial-queue.js";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("createSerialQueue", () => {
  it("runs tasks one at a time, in the order they were added", async () => {
    const queue = createSerialQueue();
    const log: string[] = [];
    for (const [name, ms] of [
      ["a", 30],
      ["b", 0],
      ["c", 10],
    ] as const) {
      queue.add(async () => {
        log.push(`${name} start`);
        await delay(ms);
        log.push(`${name} end`);
      });
    }
    await queue.drain();
    expect(log).toEqual([
      "a start",
      "a end",
      "b start",
      "b end",
      "c start",
      "c end",
    ]);
  });

  it("keeps going after a failure and reports the first one on drain", async () => {
    const queue = createSerialQueue();
    const ran: string[] = [];
    queue.add(async () => {
      throw new Error("first");
    });
    queue.add(async () => {
      throw new Error("second");
    });
    queue.add(async () => {
      ran.push("after");
    });
    await expect(queue.drain()).rejects.toThrow("first");
    expect(ran).toEqual(["after"]);
  });

  it("reports a failure even when the thrown value is undefined", async () => {
    const queue = createSerialQueue();
    queue.add(() => Promise.reject(undefined));
    await expect(queue.drain()).rejects.toBeUndefined();
  });
});
