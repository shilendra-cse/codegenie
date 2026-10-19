import {
  bigint,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const installationAccountTypeEnum = pgEnum("installation_account_type", [
  "user",
  "organization",
]);

export const githubInstallations = pgTable("github_installations", {
  id: uuid("id").primaryKey().defaultRandom(),
  installationId: bigint("installation_id", { mode: "number" })
    .notNull()
    .unique(),
  accountLogin: text("account_login").notNull(),
  accountType: installationAccountTypeEnum("account_type").notNull(),
  installedByUserId: text("installed_by_user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
