import { betterAuth } from "better-auth";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import { schema } from "@hobai/db";
import { config } from "@/config";

export const auth = betterAuth({
  baseURL: config.betterAuth.url,
  secret: config.betterAuth.secret,

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),

  socialProviders: {
    github: {
      clientId: config.github.clientId,
      clientSecret: config.github.clientSecret,
      redirectURI: `${config.betterAuth.url}/api/auth/callback/github`,
    },
  },

  account: {
    accountLinking: {
      enabled: true,
    },
  },

  trustedOrigins: [process.env.FRONTEND_URL || "http://localhost:3000"],
});

export async function currentUserId(req: Request): Promise<string | null> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  return session?.user.id ?? null;
}
