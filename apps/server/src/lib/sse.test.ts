import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Response } from "express";
import { afterEach, describe, expect, it } from "vitest";
import { endOpenStreams, openSse } from "./sse";

describe("endOpenStreams", () => {
  let server: Server | undefined;
  afterEach(() => {
    server?.close();
  });

  it("ends open streams, which lets the server close", async () => {
    let aborted = false;
    server = createServer((_req, res) => {
      const stream = openSse(res as Response);
      stream.signal.addEventListener("abort", () => (aborted = true));
      stream.send({ comment: "connected" });
    });
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    const response = await fetch(`http://127.0.0.1:${port}/`);
    const reader = response.body!.getReader();
    await reader.read();
    endOpenStreams();

    let ended = false;
    while (!ended) ended = (await reader.read()).done;
    expect(ended).toBe(true);
    expect(aborted).toBe(true);
  });
});
