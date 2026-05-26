import { ok } from "@/lib/api-response";
import type {
  ApiResponse,
  AuthenticatedRequest,
  PublicController,
} from "@/types/base.types";
import {
  createExampleItem,
  getExampleHealth,
  getExampleItemById,
  listExampleItems,
} from "./example.service";
import { createExampleItemSchema } from "./example.types";

/** Public route — no session required. Sync handler; no I/O in this demo. */
export const getHealth: PublicController = (_req, _res) => {
  return ok(200, "OK", { health: getExampleHealth() });
};

/** Secure route — `protect` sets `req.user`; use `async` + `await` when the service hits DB/API. */
export function listItems(req: AuthenticatedRequest): ApiResponse {
  const items = listExampleItems(req.user.id);
  return ok(200, "OK", { items });
}

export function createItem(req: AuthenticatedRequest): ApiResponse {
  const body = createExampleItemSchema.parse(req.body);
  const item = createExampleItem(req.user.id, body);
  return ok(201, "Created", { item });
}

export function getItem(req: AuthenticatedRequest): ApiResponse {
  const itemId = String(req.params.itemId ?? "");
  const item = getExampleItemById(req.user.id, itemId);
  return ok(200, "OK", { item });
}
