import { createRedisSubscriber } from "./redis";
import { logger } from "./logger";
import { EventHub } from "./event-hub";

const subscriber = createRedisSubscriber();
subscriber.on("error", (err) => {
  logger.error({ err }, "Events Redis connection error");
});

export const eventHub = new EventHub(subscriber);

export async function closeEventHub() {
  await subscriber.quit();
}
