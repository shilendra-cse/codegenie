import { z } from "zod";

export type ExampleItem = {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
};

export const createExampleItemSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(100),
});

export type CreateExampleItemInput = z.infer<typeof createExampleItemSchema>;
