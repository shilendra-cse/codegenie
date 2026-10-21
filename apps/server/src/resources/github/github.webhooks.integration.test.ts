import { createHmac, randomInt, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { account, type Db, ensureUser, getInstallation } from "@codegenie/db";
import { testDatabaseOrSkip } from "@codegenie/db/testing";
import express from "express";
import { afterAll, describe, expect, it } from "vitest";
import { keepRawBody } from "@/lib/raw-body";
import { createGithubWebhookHandler } from "./github.webhooks";

const database = await testDatabaseOrSkip("GitHub webhooks");
const secret = "test-webhook-secret";

describe.skipIf(!database)("GitHub webhook endpoint", () => {
  const db = database?.db as Db;
  const logs: string[] = [];
  const app = express();
  app.use(express.json({ verify: keepRawBody }));
  app.post(
    "/webhooks",
    createGithubWebhookHandler({
      db,
      secret,
      log: (_level, message) => logs.push(message),
    }),
  );
  const server = app.listen(0);
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/webhooks`;

  afterAll(async () => {
    server.close();
    await database?.drop();
  });

  async function deliver(
    event: string,
    payload: unknown,
    options: { deliveryId?: string; signWith?: string } = {},
  ) {
    const body = JSON.stringify(payload);
    const signature = `sha256=${createHmac("sha256", options.signWith ?? secret)
      .update(body)
      .digest("hex")}`;
    return fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": event,
        "x-github-delivery": options.deliveryId ?? randomUUID(),
        "x-hub-signature-256": signature,
      },
      body,
    });
  }

  async function signedInGithubUser() {
    const userId = randomUUID();
    const githubId = randomInt(1, 2 ** 31);
    await ensureUser(db, {
      id: userId,
      name: "Ada",
      email: `${userId}@example.com`,
    });
    await db.insert(account).values({
      id: randomUUID(),
      accountId: String(githubId),
      providerId: "github",
      userId,
      updatedAt: new Date(),
    });
    return { userId, githubId };
  }

  const installation = (action: string, id: number, senderId: number) => ({
    action,
    installation: { id, account: { login: "acme", type: "Organization" } },
    sender: { id: senderId, login: "ada" },
  });

  it("rejects a delivery with the wrong signature", async () => {
    const id = randomInt(1, 2 ** 31);
    const response = await deliver(
      "installation",
      installation("created", id, 1),
      {
        signWith: "someone-else",
      },
    );

    expect(response.status).toBe(401);
    expect(await getInstallation(db, id)).toBeNull();
  });

  it("records an installation by a signed-in user", async () => {
    const { userId, githubId } = await signedInGithubUser();
    const id = randomInt(1, 2 ** 31);

    const response = await deliver(
      "installation",
      installation("created", id, githubId),
    );

    expect(response.status).toBe(200);
    expect(await getInstallation(db, id)).toMatchObject({
      accountLogin: "acme",
      accountType: "organization",
      installedByUserId: userId,
    });
  });

  it("skips an installation by someone who hasn't signed in", async () => {
    const id = randomInt(1, 2 ** 31);

    const response = await deliver(
      "installation",
      installation("created", id, randomInt(1, 2 ** 31)),
    );

    expect(response.status).toBe(200);
    expect(await getInstallation(db, id)).toBeNull();
    expect(logs).toContain("Installed by a GitHub user who hasn't signed in");
  });

  it("follows suspend, unsuspend and uninstall", async () => {
    const { githubId } = await signedInGithubUser();
    const id = randomInt(1, 2 ** 31);
    await deliver("installation", installation("created", id, githubId));

    await deliver("installation", installation("suspend", id, githubId));
    expect((await getInstallation(db, id))?.suspendedAt).toBeInstanceOf(Date);
    await deliver("installation", installation("unsuspend", id, githubId));
    expect((await getInstallation(db, id))?.suspendedAt).toBeNull();
    await deliver("installation", installation("deleted", id, githubId));
    expect((await getInstallation(db, id))?.uninstalledAt).toBeInstanceOf(Date);
  });

  it("processes a delivery once", async () => {
    const { githubId } = await signedInGithubUser();
    const id = randomInt(1, 2 ** 31);
    const deliveryId = randomUUID();
    await deliver("installation", installation("created", id, githubId), {
      deliveryId,
    });
    await deliver("installation", installation("suspend", id, githubId));

    const again = await deliver(
      "installation",
      installation("created", id, githubId),
      { deliveryId },
    );

    expect(await again.json()).toEqual({ duplicate: true });
    expect((await getInstallation(db, id))?.suspendedAt).toBeInstanceOf(Date);
  });

  it("answers 500 for a delivery it can't process, and processes its redelivery", async () => {
    const { githubId } = await signedInGithubUser();
    const id = randomInt(1, 2 ** 31);
    const deliveryId = randomUUID();

    const failed = await deliver(
      "installation",
      { action: "created", installation: { id } },
      { deliveryId },
    );
    const redelivered = await deliver(
      "installation",
      installation("created", id, githubId),
      { deliveryId },
    );

    expect(failed.status).toBe(500);
    expect(redelivered.status).toBe(200);
    expect(await getInstallation(db, id)).not.toBeNull();
  });

  it("accepts events it doesn't act on", async () => {
    const response = await deliver("ping", { zen: "Design for failure." });
    expect(response.status).toBe(200);
  });
});
