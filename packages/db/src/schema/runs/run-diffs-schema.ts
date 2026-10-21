import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { runs } from "./runs-schema";

export type RunDiffFile = {
  path: string;
  added: number | null;
  removed: number | null;
};

export const runDiffs = pgTable("run_diffs", {
  runId: uuid("run_id")
    .primaryKey()
    .references(() => runs.id, { onDelete: "cascade" }),
  patch: text("patch").notNull(),
  files: jsonb("files").$type<RunDiffFile[]>().notNull(),
  truncated: boolean("truncated").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
