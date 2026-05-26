import { Request, Response } from "express";

export interface ApiResponse {
  status: number;
  message: string;
  data?: any;
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
