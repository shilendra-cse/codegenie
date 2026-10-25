// Run before the servers start: an empty database and queue, and GitHub back to "not installed".
import { mkdirSync, rmSync } from "node:fs";
import { recreateDatabase } from "@codegenie/db/testing";
import { Redis } from "ioredis";
import { DATABASE_URL, LOG_DIR, REDIS_URL, STATE_DIR } from "./environment.js";

rmSync(STATE_DIR, { recursive: true, force: true });
mkdirSync(LOG_DIR, { recursive: true });

await recreateDatabase(DATABASE_URL);

const redis = new Redis(REDIS_URL);
await redis.flushdb();
await redis.quit();
