import { afterEach, describe, expect, it } from "vitest";
import { startHealthServer, type HealthServer } from "./health-server.js";

describe("startHealthServer", () => {
  let server: HealthServer | undefined;
  afterEach(() => server?.close());

  it("answers 200 while the check passes and 503 when it fails", async () => {
    let healthy = true;
    server = await startHealthServer(
      0,
      async () => {
        if (!healthy) throw new Error("Redis is unreachable");
      },
      () => {},
    );
    const url = `http://127.0.0.1:${server.port}/health`;
    expect((await fetch(url)).status).toBe(200);
    healthy = false;
    expect((await fetch(url)).status).toBe(503);
    expect((await fetch(`http://127.0.0.1:${server.port}/other`)).status).toBe(
      404,
    );
  });
});
