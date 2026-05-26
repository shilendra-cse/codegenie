import express, { NextFunction, Request, Response, Router } from "express";
import type {
  AuthenticatedController,
  AuthenticatedRequest,
  PublicController,
} from "@/types/base.types.js";
import { protect } from "@/middleware/auth.js";

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
    controller: PublicController,
  ) {
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
    controller: AuthenticatedController,
  ) {
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
      authSecure: (controller: AuthenticatedController) => {
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
      noAuth: (controller: PublicController) => {
        return this.router.get(
          route,
          this.authMiddleware("public"),
          (req, res, next) => {
            void this.executePublic(req, res, next, controller);
          },
        );
      },
    };
  }

  post(route: string) {
    return {
      authSecure: (controller: AuthenticatedController) => {
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
      noAuth: (controller: PublicController) => {
        return this.router.post(
          route,
          this.authMiddleware("public"),
          (req, res, next) => {
            void this.executePublic(req, res, next, controller);
          },
        );
      },
    };
  }

  put(route: string) {
    return {
      authSecure: (controller: AuthenticatedController) => {
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
      noAuth: (controller: PublicController) => {
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
      authSecure: (controller: AuthenticatedController) => {
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
      noAuth: (controller: PublicController) => {
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
