import { randomInt, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { Db } from "../../client.js";
import { testDatabaseOrSkip } from "../../testing/index.js";
import { ensureUser } from "../auth/users-queries.js";
import {
  getInstallation,
  getInstallationById,
  markInstallationUninstalled,
  recordInstallation,
  setInstallationSuspended,
} from "./installations-queries.js";
import {
  forgetWebhookDelivery,
  recordWebhookDelivery,
} from "./webhook-deliveries-queries.js";

const database = await testDatabaseOrSkip("github queries");

describe.skipIf(!database)("github queries against Postgres", () => {
  const db = database?.db as Db;
  afterAll(() => database?.drop());

  async function installed() {
    const userId = randomUUID();
    await ensureUser(db, {
      id: userId,
      name: "Ada",
      email: `${userId}@example.com`,
    });
    const values = {
      installationId: randomInt(1, 2 ** 31),
      accountLogin: "acme",
      accountType: "organization" as const,
      installedByUserId: userId,
    };
    return { values, installation: await recordInstallation(db, values) };
  }

  it("records an installation and finds it by GitHub's id", async () => {
    const { values, installation } = await installed();

    expect(installation).toMatchObject({
      ...values,
      suspendedAt: null,
      uninstalledAt: null,
    });
    expect(await getInstallation(db, values.installationId)).toMatchObject({
      id: installation.id,
    });
    expect(await getInstallation(db, randomInt(1, 2 ** 31))).toBeNull();
    expect(await getInstallationById(db, installation.id)).toMatchObject({
      installationId: values.installationId,
    });
    expect(await getInstallationById(db, randomUUID())).toBeNull();
  });

  it("suspends and unsuspends an installation", async () => {
    const { values } = await installed();

    expect(
      await setInstallationSuspended(db, values.installationId, true),
    ).toBe(true);
    expect(
      (await getInstallation(db, values.installationId))?.suspendedAt,
    ).toBeInstanceOf(Date);
    await setInstallationSuspended(db, values.installationId, false);
    expect(
      (await getInstallation(db, values.installationId))?.suspendedAt,
    ).toBeNull();
    expect(
      await setInstallationSuspended(db, randomInt(1, 2 ** 31), true),
    ).toBe(false);
  });

  it("marks an uninstalled installation instead of deleting it, and a reinstall clears it", async () => {
    const { values, installation } = await installed();

    expect(await markInstallationUninstalled(db, values.installationId)).toBe(
      true,
    );
    expect(await getInstallation(db, values.installationId)).toMatchObject({
      id: installation.id,
      uninstalledAt: expect.any(Date),
    });

    const again = await recordInstallation(db, {
      ...values,
      accountLogin: "acme-renamed",
    });
    expect(again).toMatchObject({
      id: installation.id,
      accountLogin: "acme-renamed",
      uninstalledAt: null,
    });
  });

  it("tells whether a webhook delivery is new", async () => {
    const deliveryId = randomUUID();

    expect(await recordWebhookDelivery(db, deliveryId, "installation")).toBe(
      true,
    );
    expect(await recordWebhookDelivery(db, deliveryId, "installation")).toBe(
      false,
    );

    await forgetWebhookDelivery(db, deliveryId);
    expect(await recordWebhookDelivery(db, deliveryId, "installation")).toBe(
      true,
    );
  });
});
