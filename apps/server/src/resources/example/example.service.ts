import { randomUUID } from "node:crypto";
import { HttpError } from "@/lib/http-error";
import type { CreateExampleItemInput, ExampleItem } from "./example.types";

/** In-memory store for demo only — real resources use Drizzle + DB. */
const itemsByUser = new Map<string, ExampleItem[]>();

function getUserItems(userId: string): ExampleItem[] {
  if (!itemsByUser.has(userId)) {
    itemsByUser.set(userId, []);
  }
  return itemsByUser.get(userId)!;
}

export function getExampleHealth(): { status: "up"; timestamp: string } {
  return {
    status: "up",
    timestamp: new Date().toISOString(),
  };
}

export function listExampleItems(userId: string): ExampleItem[] {
  return getUserItems(userId);
}

export function createExampleItem(
  userId: string,
  input: CreateExampleItemInput,
): ExampleItem {
  const item: ExampleItem = {
    id: randomUUID(),
    userId,
    name: input.name,
    createdAt: new Date().toISOString(),
  };

  getUserItems(userId).push(item);
  return item;
}

export function getExampleItemById(
  userId: string,
  itemId: string,
): ExampleItem {
  const item = getUserItems(userId).find((row) => row.id === itemId);
  if (!item) {
    throw new HttpError(404, "Example item not found", "EXAMPLE_ITEM_NOT_FOUND");
  }
  return item;
}
