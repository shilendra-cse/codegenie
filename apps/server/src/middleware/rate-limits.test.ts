import type { AddressInfo } from "node:net";
import express, { type RequestHandler } from "express";
import helmet from "helmet";
import { afterEach, describe, expect, it } from "vitest";
import { config } from "@/config";
import type { AuthenticatedRequest } from "@/types/base.types";
import { createRateLimits } from "./rate-limits";

const servers: (() => void)[] = [];
afterEach(() => servers.splice(0).forEach((close) => close()));

const ok: RequestHandler = (_req, res) => {
  res.json({ ok: true });
};

/** A small app wired like ours, with low limits; `x-user` stands in for the session. */
async function serve(limits = { flood: 100, signIn: 100, user: 100 }) {
  const rateLimits = createRateLimits(limits);
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet(config.security.helmet));
  app.use(rateLimits.flood);
  app.use("/api/auth/sign-in", rateLimits.signIn);
  app.post("/api/auth/sign-in/social", ok);
  app.get("/health", ok);
  app.post("/api/github/webhooks", ok);
  app.get("/api/public", ok);
  app.get(
    "/api/me",
    (req, _res, next) => {
      (req as AuthenticatedRequest).user = {
        id: req.header("x-user") ?? "",
      } as AuthenticatedRequest["user"];
      next();
    },
    rateLimits.user,
    ok,
  );
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  servers.push(() => server.close());
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return (
    path: string,
    {
      ip = "203.0.113.1",
      user,
      method = "GET",
    }: { ip?: string; user?: string; method?: string } = {},
  ) =>
    fetch(`${base}${path}`, {
      method,
      headers: { "x-forwarded-for": ip, ...(user && { "x-user": user }) },
    });
}

const times = async (n: number, send: () => Promise<Response>) => {
  for (let i = 0; i < n; i++) await send();
};

describe("rate limits", () => {
  it("refuses an address over the flood guard, in the API's error shape", async () => {
    const send = await serve({ flood: 2, signIn: 100, user: 100 });
    await times(2, () => send("/api/public"));

    const refused = await send("/api/public");

    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({
      status: 429,
      message: "Too many requests. Try again in a minute.",
      type: "error",
      code: "RATE_LIMITED",
    });
    expect(refused.headers.get("ratelimit-policy")).toContain("2");
    expect((await send("/api/public", { ip: "203.0.113.2" })).status).toBe(200);
  });

  it("limits starting sign-in per address, on its own count", async () => {
    const send = await serve({ flood: 100, signIn: 1, user: 100 });
    await send("/api/auth/sign-in/social", { method: "POST" });

    expect(
      (await send("/api/auth/sign-in/social", { method: "POST" })).status,
    ).toBe(429);
    expect((await send("/api/public")).status).toBe(200);
  });

  it("counts signed-in use per account, so people on one network don't share a count", async () => {
    const send = await serve({ flood: 100, signIn: 100, user: 2 });
    await times(2, () => send("/api/me", { user: "ada" }));

    expect((await send("/api/me", { user: "ada" })).status).toBe(429);
    expect((await send("/api/me", { user: "grace" })).status).toBe(200);
  });

  it("never limits health checks or GitHub's webhooks", async () => {
    const send = await serve({ flood: 1, signIn: 100, user: 100 });
    await times(3, () => send("/health"));
    await times(3, () => send("/api/github/webhooks", { method: "POST" }));

    expect((await send("/health")).status).toBe(200);
    expect(
      (await send("/api/github/webhooks", { method: "POST" })).status,
    ).toBe(200);
  });

  it("sends security headers", async () => {
    const send = await serve();

    const res = await send("/api/public");

    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-powered-by")).toBeNull();
  });
});
