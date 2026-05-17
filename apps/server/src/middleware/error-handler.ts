import { isDevelopment } from "@/config";
import { HttpError } from "@/lib/http-error";
import { logger } from "@/lib/logger";
import type { ApiResponse } from "@/types/base.types";
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  //handles if the response has already been sent
  if (res.headersSent) {
    return next(err);
  }

  // Handles http errors
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      status: err.status,
      message: err.message,
      type: "error",
      ...(err.data !== undefined && { data: err.data }),
    });
  }

  //handles validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      status: 400,
      message: "Validation failed",
      type: "error",
      data: err.flatten(),
    } satisfies ApiResponse);
  }

  logger.error({ error: err }, "Unhandled error:");

  //handles unknown errors
  return res.status(500).json({
    status: 500,
    message: "Internal Server Error",
    type: "error",
    ...(isDevelopment &&
      err instanceof Error && { data: { detail: err.message } }),
  } satisfies ApiResponse);
};
