import express, {
  NextFunction,
  Request,
  RequestHandler,
  Response,
  Router,
} from "express";
import type {
  AuthenticatedRequest,
  PublicHandler,
  SecureHandler,
} from "@/types/base.types.js";
import { protect } from "@/middleware/auth.js";
import { logger } from "./logger.js";
import { handleStream } from "./sse.js";

const reportStreamError = (error: unknown, path: string) =>
  logger.error({ error, path }, "Stream failed");

class ApiRouter {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  private authMiddleware(auth: "secure" | "public") {
    return auth === "secure"
      ? protect
      : (_req: Request, _res: Response, next: NextFunction) => next();
  }

  private async executePublic(
    req: Request,
    res: Response,
    next: NextFunction,
    controller: PublicHandler,
  ) {
    if ("kind" in controller) {
      handleStream(controller.handler, reportStreamError)(req, res, next);
      return;
    }
    try {
      const response = await Promise.resolve(controller(req, res));
      if (!res.headersSent) {
        res.status(response.status).json(response);
      }
    } catch (error) {
      next(error);
    }
  }

  private async executeSecure(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
    controller: SecureHandler,
  ) {
    if ("kind" in controller) {
      handleStream(controller.handler, reportStreamError)(req, res, next);
      return;
    }
    try {
      const response = await Promise.resolve(controller(req, res));
      if (!res.headersSent) {
        res.status(response.status).json(response);
      }
    } catch (error) {
      next(error);
    }
  }

  get(route: string) {
    return {
      authSecure: (controller: SecureHandler) => {
        return this.router.get(
          route,
          this.authMiddleware("secure"),
          (req, res, next) => {
            void this.executeSecure(
              req as AuthenticatedRequest,
              res,
              next,
              controller,
            );
          },
        );
      },
      noAuth: (controller: PublicHandler) => {
        return this.router.get(
          route,
          this.authMiddleware("public"),
          (req, res, next) => {
            void this.executePublic(req, res, next, controller);
          },
        );
      },
      raw: (handler: RequestHandler) => this.router.get(route, handler),
    };
  }

  post(route: string) {
    return {
      authSecure: (controller: SecureHandler) => {
        return this.router.post(
          route,
          this.authMiddleware("secure"),
          (req, res, next) => {
            void this.executeSecure(
              req as AuthenticatedRequest,
              res,
              next,
              controller,
            );
          },
        );
      },
      noAuth: (controller: PublicHandler) => {
        return this.router.post(
          route,
          this.authMiddleware("public"),
          (req, res, next) => {
            void this.executePublic(req, res, next, controller);
          },
        );
      },
      raw: (handler: RequestHandler) => this.router.post(route, handler),
    };
  }

  put(route: string) {
    return {
      authSecure: (controller: SecureHandler) => {
        return this.router.put(
          route,
          this.authMiddleware("secure"),
          (req, res, next) => {
            void this.executeSecure(
              req as AuthenticatedRequest,
              res,
              next,
              controller,
            );
          },
        );
      },
      noAuth: (controller: PublicHandler) => {
        return this.router.put(
          route,
          this.authMiddleware("public"),
          (req, res, next) => {
            void this.executePublic(req, res, next, controller);
          },
        );
      },
    };
  }

  delete(route: string) {
    return {
      authSecure: (controller: SecureHandler) => {
        return this.router.delete(
          route,
          this.authMiddleware("secure"),
          (req, res, next) => {
            void this.executeSecure(
              req as AuthenticatedRequest,
              res,
              next,
              controller,
            );
          },
        );
      },
      noAuth: (controller: PublicHandler) => {
        return this.router.delete(
          route,
          this.authMiddleware("public"),
          (req, res, next) => {
            void this.executePublic(req, res, next, controller);
          },
        );
      },
    };
  }

  getRouter(): Router {
    return this.router;
  }
}

const apiRouterInstance = new ApiRouter();
export const api = apiRouterInstance;
export const routes = apiRouterInstance.getRouter();
