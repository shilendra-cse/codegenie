import { config } from "@/config";
import { createRateLimits } from "./rate-limits.js";

/** The server's limits, created once so each keeps a single count. Apart from rate-limits.ts, which tests import without the config. */
export const rateLimits = createRateLimits(config.security.rateLimit);
