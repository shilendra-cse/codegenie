import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { config } from "@/config";

export const auth = betterAuth({
  baseURL: config.betterAuth.url,
  secret: config.betterAuth.secret,

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, //will set to true later when otp is implemented
    minPasswordLength: 8,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirectURI: `${process.env.BACKEND_URL || "http://localhost:3001"}/api/auth/callback/google`,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      redirectURI: `${process.env.BACKEND_URL || "http://localhost:3001"}/api/auth/callback/github`,
    },
  },

  account: {
    accountLinking: {
      enabled: true,
    },
  },

  trustedOrigins: [process.env.FRONTEND_URL || "http://localhost:3000"],
});
