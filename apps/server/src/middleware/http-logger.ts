// apps/server/src/middleware/http-logger.ts
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Request } from "express";
import pinoHttp from "pino-http";
import { logger } from "@/lib/logger.js";

/** Paths that should not clutter logs (kube/Docker health probes) */
const QUIET_PATHS = new Set(["/health", "/favicon.ico"]);

export const httpLogger = pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => {
      const url = req.url?.split("?")[0] ?? "";
      return QUIET_PATHS.has(url);
    },
  },

  // Stable request id for tracing (client can send x-request-id)
  genReqId: (req, res) => {
    const header = req.headers["x-request-id"];
    const id =
      (typeof header === "string" ? header : header?.[0]) ?? randomUUID();
    res.setHeader("x-request-id", id);
    return id;
  },

  customLogLevel(req, res, err) {
    if (err) return "error";
    if (res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    if (req.url?.startsWith("/api/auth")) return "debug";
    return "info";
  },

  customSuccessMessage(req, _res) {
    return `${req.method} ${req.url} completed`;
  },

  customErrorMessage(req, _res, err) {
    return `${req.method} ${req.url} failed: ${err.message}`;
  },

  customProps(req, _res) {
    const expressReq = req as Request;
    return {
      requestId: req.id,
      userId: (expressReq as Request & { user?: { id?: string } }).user?.id,
    };
  },

  // Don’t log huge bodies; redact secrets
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['set-cookie']",
      "req.body.password",
      "req.body.token",
    ],
    censor: "[REDACTED]",
  },

  serializers: {
    req(req: IncomingMessage & { id?: string }) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
        remoteAddress: req.socket?.remoteAddress,
      };
    },
    res(res: ServerResponse) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
});
