import { Request, Response } from "express";

export interface ApiResponse {
  status: number;
  message: string;
  data?: unknown;
  type: "success" | "error";
}

export interface AuthenticatedRequest extends Request {
  user: Required<{
    id: string;
    email: string;
  }>;
}

export type PublicController = (
  req: Request,
  res: Response,
) => ApiResponse | Promise<ApiResponse>;

export type AuthenticatedController = (
  req: AuthenticatedRequest,
  res: Response,
) => ApiResponse | Promise<ApiResponse>;

export type AuthenticatedStream = (
  req: AuthenticatedRequest,
  res: Response,
) => Promise<void>;

export type PublicStream = (req: Request, res: Response) => Promise<void>;

export type StreamRoute<Handler> = { kind: "stream"; handler: Handler };

export type SecureHandler =
  AuthenticatedController | StreamRoute<AuthenticatedStream>;

export type PublicHandler = PublicController | StreamRoute<PublicStream>;
