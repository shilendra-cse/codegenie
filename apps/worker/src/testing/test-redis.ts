import { randomBytes } from "node:crypto";
import { Redis } from "ioredis";
import { SHORT_NAME } from "@hobai/shared/brand";

export type TestRedis = {
  /** A key prefix of this test file's own, so tests never touch other queues. */
  prefix: string;
  connect(): Redis;
  close(): Promise<void>;
};

/** TEST_REDIS_URL, or the development Redis. Returns null when it isn't reachable, and fails in CI. */
export async function testRedisOrSkip(
  suite: string,
): Promise<TestRedis | null> {
  const url = process.env.TEST_REDIS_URL ?? "redis://localhost:6380";
  const admin = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    retryStrategy: () => null,
  });
  try {
    await admin.connect();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (process.env.CI) {
      throw new Error(`${suite} tests need Redis in CI: ${reason}`, {
        cause: error,
      });
    }
    console.warn(`Skipping ${suite} tests: Redis isn't reachable (${reason})`);
    return null;
  }

  const prefix = `${SHORT_NAME}-test-${randomBytes(4).toString("hex")}`;
  const connections = [admin];
  return {
    prefix,
    connect() {
      const connection = new Redis(url, { maxRetriesPerRequest: null });
      connections.push(connection);
      return connection;
    },
    async close() {
      const keys = await admin.keys(`${prefix}:*`);
      if (keys.length > 0) await admin.del(...keys);
      await Promise.all(connections.map((c) => c.quit()));
    },
  };
}
