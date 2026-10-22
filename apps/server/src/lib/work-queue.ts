import { WORK_QUEUE } from "@codegenie/shared";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { config } from "@/config";
import { logger } from "./logger";

// Without the offline queue, adding work fails at once while Redis is down instead of hanging.
const connection = new Redis(config.redis.url, {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
});
connection.on("error", (err) => {
  logger.error({ err }, "Work queue Redis connection error");
});

export const workQueue = new Queue(WORK_QUEUE, { connection });

export async function closeWorkQueue() {
  await workQueue.close();
  await connection.quit();
}
