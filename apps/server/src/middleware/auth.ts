import { NextFunction, Response } from "express";
import { auth } from "@/lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { AuthenticatedRequest } from "@/types/base.types";
import { logger } from "@/lib/logger";

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      res.status(401).json({
        status: 401,
        message: "Unauthorized",
        type: "error",
      });
      return;
    }

    req.user = session.user;

    next();
  } catch (error) {
    logger.error({ error }, "Failed to authenticate user:");
    res.status(401).json({
      status: 401,
      message: "Unauthorized",
      type: "error",
    });
  }
};

export const protect = requireAuth;
