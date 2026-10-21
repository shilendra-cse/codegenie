import { randomInt, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { type Db, ensureUser, getInstallation } from "@codegenie/db";
import { testDatabaseOrSkip } from "@codegenie/db/testing";
import express from "express";
import { afterAll, describe, expect, it } from "vitest";
import { createInstallCallbackHandler } from "./github.install-callback";

const database = await testDatabaseOrSkip("GitHub install callback");
const frontendUrl = "http://web.test";

describe.skipIf(!database)("GitHub install callback", () => {
  const db = database?.db as Db;
  const userId = randomUUID();
  const usersInstallation = randomInt(1, 2 ** 31);
  let signedIn: string | null = userId;
  let token: string | null = "ghu_user";

  const githubFetch: typeof fetch = (input) => {
    const response = new Response(
      JSON.stringify({
        total_count: 1,
        installations: [
          {
            id: usersInstallation,
            account: { login: "acme", type: "Organization" },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
    const url = input instanceof Request ? input.url : input.toString();
    Object.defineProperty(response, "url", { value: url });
    return Promise.resolve(response);
  };

  const app = express();
  app.get(
    "/callback",
    createInstallCallbackHandler({
      db,
      frontendUrl,
      currentUserId: () => Promise.resolve(signedIn),
      githubToken: () => Promise.resolve(token),
      fetch: githubFetch,
    }),
  );
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/callback`;

  afterAll(async () => {
    server.close();
    await database?.drop();
  });

  async function callback(query: string) {
    const response = await fetch(`${base}?${query}`, { redirect: "manual" });
    return response.headers.get("location");
  }

  it("records an installation the user can access and sends them back", async () => {
    await ensureUser(db, {
      id: userId,
      name: "Ada",
      email: `${userId}@example.com`,
    });

    expect(
      await callback(
        `installation_id=${usersInstallation}&setup_action=install`,
      ),
    ).toBe(`${frontendUrl}/build?github=installed`);
    expect(await getInstallation(db, usersInstallation)).toMatchObject({
      accountLogin: "acme",
      accountType: "organization",
      installedByUserId: userId,
    });
  });

  it("refuses an installation id the user can't access", async () => {
    const someoneElses = randomInt(1, 2 ** 31);

    expect(await callback(`installation_id=${someoneElses}`)).toBe(
      `${frontendUrl}/build?github=not-found`,
    );
    expect(await getInstallation(db, someoneElses)).toBeNull();
  });

  it("sends someone who isn't signed in, or has no GitHub token, to sign in", async () => {
    signedIn = null;
    expect(await callback(`installation_id=${usersInstallation}`)).toBe(
      `${frontendUrl}/signin`,
    );
    signedIn = userId;
    token = null;
    expect(await callback(`installation_id=${usersInstallation}`)).toBe(
      `${frontendUrl}/signin`,
    );
    token = "ghu_user";
  });

  it("goes back without an installation when it was only requested or cancelled", async () => {
    expect(await callback("setup_action=request")).toBe(
      `${frontendUrl}/build?github=requested`,
    );
    expect(await callback("")).toBe(`${frontendUrl}/build?github=cancelled`);
  });
});
