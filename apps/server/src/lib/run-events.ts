import { createRedisSubscriber } from "./redis";
import { logger } from "./logger";
import { RunEventHub } from "./run-event-hub";

const subscriber = createRedisSubscriber();
subscriber.on("error", (err) => {
  logger.error({ err }, "Run events Redis connection error");
});

export const runEventHub = new RunEventHub(subscriber);

export async function closeRunEventHub() {
  await subscriber.quit();
}
