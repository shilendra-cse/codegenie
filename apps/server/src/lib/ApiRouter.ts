import express, { Router, Request, Response, NextFunction } from "express";
import {
  ControllerFunction,
  AuthenticatedRequest,
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
      : (_req: Request, _res: Response, next: Function) => next();
  }

  private async execute(
    req: Request | AuthenticatedRequest,
    res: Response,
    next: NextFunction,
    controller: ControllerFunction,
  ) {
    try {
      const response = await controller(req, res);
      if (!res.headersSent) {
        res.status(response.status).json(response);
      }
    } catch (error) {
      next(error);
    }
  }

  get(route: string) {
    return {
      authSecure: (controller: ControllerFunction) => {
        return this.router.get(
          route,
          this.authMiddleware("secure"),
          (req, res, next) => {
            this.execute(req as AuthenticatedRequest, res, next, controller);
          },
        );
      },
      noAuth: (controller: ControllerFunction) => {
        return this.router.get(
          route,
          this.authMiddleware("public"),
          (req, res, next) => {
            this.execute(req, res, next, controller);
          },
        );
      },
    };
  }

  post(route: string) {
    return {
      authSecure: (controller: ControllerFunction) => {
        return this.router.post(
          route,
          this.authMiddleware("secure"),
          (req, res, next) => {
            this.execute(req as AuthenticatedRequest, res, next, controller);
          },
        );
      },
      noAuth: (controller: ControllerFunction) => {
        return this.router.post(
          route,
          this.authMiddleware("public"),
          (req, res, next) => {
            this.execute(req, res, next, controller);
          },
        );
      },
    };
  }

  put(route: string) {
    return {
      authSecure: (controller: ControllerFunction) => {
        return this.router.put(
          route,
          this.authMiddleware("secure"),
          (req, res, next) => {
            this.execute(req as AuthenticatedRequest, res, next, controller);
          },
        );
      },
      noAuth: (controller: ControllerFunction) => {
        return this.router.put(
          route,
          this.authMiddleware("public"),
          (req, res, next) => {
            this.execute(req, res, next, controller);
          },
        );
      },
    };
  }

  delete(route: string) {
    return {
      authSecure: (controller: ControllerFunction) => {
        return this.router.delete(
          route,
          this.authMiddleware("secure"),
          (req, res, next) => {
            this.execute(req as AuthenticatedRequest, res, next, controller);
          },
        );
      },
      noAuth: (controller: ControllerFunction) => {
        return this.router.delete(
          route,
          this.authMiddleware("public"),
          (req, res, next) => {
            this.execute(req, res, next, controller);
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
export const createApi = () => apiRouterInstance;
export const routes = apiRouterInstance.getRouter();
