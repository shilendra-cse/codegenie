import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { type MessageSubscriber, RunEventHub } from "./run-event-hub";

function fakeSubscriber(options: { failSubscribe?: boolean } = {}) {
  const emitter = new EventEmitter();
  const calls: string[] = [];
  const subscriber: MessageSubscriber = {
    subscribe(channel) {
      calls.push(`subscribe ${channel}`);
      return options.failSubscribe
        ? Promise.reject(new Error("Connection is closed."))
        : Promise.resolve(1);
    },
    unsubscribe(channel) {
      calls.push(`unsubscribe ${channel}`);
      return Promise.resolve(0);
    },
    on(event, listener) {
      return emitter.on(event, listener);
    },
  };
  const publish = (channel: string, message: string) =>
    emitter.emit("message", channel, message);
  return { subscriber, calls, publish };
}

describe("RunEventHub", () => {
  it("subscribes once per run, fans messages out, and unsubscribes after the last viewer", async () => {
    const { subscriber, calls, publish } = fakeSubscriber();
    const hub = new RunEventHub(subscriber);
    const first: string[] = [];
    const second: string[] = [];
    const other: string[] = [];

    const stopFirst = await hub.listen("r1", (m) => first.push(m));
    const stopSecond = await hub.listen("r1", (m) => second.push(m));
    await hub.listen("r2", (m) => other.push(m));
    publish("run:r1", "a");
    await stopFirst();
    publish("run:r1", "b");
    await stopSecond();
    publish("run:r1", "c");

    expect(first).toEqual(["a"]);
    expect(second).toEqual(["a", "b"]);
    expect(other).toEqual([]);
    expect(calls).toEqual([
      "subscribe run:r1",
      "subscribe run:r2",
      "unsubscribe run:r1",
    ]);
  });

  it("subscribes again for a viewer who arrives as the last one leaves", async () => {
    const { subscriber, calls, publish } = fakeSubscriber();
    const hub = new RunEventHub(subscriber);
    const received: string[] = [];

    const stop = await hub.listen("r1", () => {});
    const leaving = stop();
    const arriving = hub.listen("r1", (m) => received.push(m));
    await Promise.all([leaving, arriving]);
    publish("run:r1", "a");

    expect(received).toEqual(["a"]);
    expect(calls).toEqual([
      "subscribe run:r1",
      "unsubscribe run:r1",
      "subscribe run:r1",
    ]);
  });

  it("forgets a viewer whose subscription failed", async () => {
    const { subscriber, publish } = fakeSubscriber({ failSubscribe: true });
    const hub = new RunEventHub(subscriber);
    const received: string[] = [];

    await expect(hub.listen("r1", (m) => received.push(m))).rejects.toThrow(
      "Connection is closed.",
    );
    publish("run:r1", "a");

    expect(received).toEqual([]);
  });
});
