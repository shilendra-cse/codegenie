import type { Request } from "express";
import { rateLimit } from "express-rate-limit";
import { config } from "@/config";
import type { AuthenticatedRequest } from "@/types/base.types";

export type RateLimitOptions = {
  /** Requests per minute. */
  flood: number;
  signIn: number;
  user: number;
};

// The host's alive checks, and GitHub's servers (each delivery is verified by its signature).
const UNLIMITED = new Set(["/health", "/api/github/webhooks"]);

const limit = (
  perMinute: number,
  options: Partial<Parameters<typeof rateLimit>[0]> = {},
) =>
  rateLimit({
    windowMs: 60_000,
    limit: perMinute,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        status: 429,
        message: "Too many requests. Try again in a minute.",
        type: "error",
        code: "RATE_LIMITED",
      });
    },
    ...options,
  });

export function createRateLimits({ flood, signIn, user }: RateLimitOptions) {
  return {
    /** Every request, per address: stops a script, signed in or not. */
    flood: limit(flood, { skip: (req: Request) => UNLIMITED.has(req.path) }),
    /** Starting sign-in and GitHub's callback, per address. */
    signIn: limit(signIn),
    /**
     * Signed-in routes, per account: people sharing one network each get their own count.
     * Runs after the session check, so the user is already known.
     */
    user: limit(user, {
      keyGenerator: (req: Request) => (req as AuthenticatedRequest).user.id,
    }),
  };
}

export const rateLimits = createRateLimits(config.security.rateLimit);
