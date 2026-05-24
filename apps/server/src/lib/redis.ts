import { config } from "@/config/index.js";
import Redis from "ioredis";
import { logger } from "./logger.js";

export const redis = new Redis(config.redis.url);

redis.on("error", (err) => {
  logger.error({ err }, "❌ Redis connection error");
});

redis.on("connect", () => {
  logger.info("✅ Redis connection established");
});

export function createRedisSubscriber() {
  return new Redis(config.redis.url);
}
