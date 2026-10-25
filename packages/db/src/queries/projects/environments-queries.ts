import type {
  EnvironmentConfig,
  EnvironmentHealth,
  EnvironmentSource,
  EnvironmentStore,
  StoredEnvironment,
} from "@hobai/shared";
import { and, desc, eq, inArray, max } from "drizzle-orm";
import type { Db } from "../../client.js";
import { onboardings } from "../../schema/projects/onboardings-schema.js";
import { ACTIVE_ONBOARDING } from "./onboardings-queries.js";
import { projectEnvironments } from "../../schema/projects/project-environments-schema.js";
import { projects } from "../../schema/projects/projects-schema.js";

type Row = typeof projectEnvironments.$inferSelect;

export type DbStoredEnvironment = StoredEnvironment & {
  id: string;
  active: boolean;
};

function toStored(row: Row): DbStoredEnvironment {
  return {
    id: row.id,
    active: row.status === "active",
    repoKey: row.projectId,
    version: row.version,
    source: row.source,
    savedAt: row.createdAt.toISOString(),
    config: row.config,
    health: {
      status: row.health,
      reasons: row.healthReasons,
      ...(row.healthUpdatedAt ? { at: row.healthUpdatedAt.toISOString() } : {}),
    },
  };
}

/**
 * Environments in Postgres, keyed by project id: every version is kept, the
 * latest saved one is active and runs replay it.
 */
export class DbEnvironmentStore implements EnvironmentStore {
  constructor(private readonly db: Db) {}

  async load(projectId: string) {
    const [row] = await this.db
      .select()
      .from(projectEnvironments)
      .where(
        and(
          eq(projectEnvironments.projectId, projectId),
          eq(projectEnvironments.status, "active"),
        ),
      );
    return row ? toStored(row) : null;
  }

  async list(projectId: string) {
    const rows = await this.db
      .select()
      .from(projectEnvironments)
      .where(eq(projectEnvironments.projectId, projectId))
      .orderBy(desc(projectEnvironments.version));
    return rows.map(toStored);
  }

  async save(
    projectId: string,
    config: EnvironmentConfig,
    source: EnvironmentSource,
  ) {
    return this.db.transaction(async (tx) => {
      // Locking the project makes concurrent saves for it take turns, so versions stay 1, 2, 3…
      const [project] = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId))
        .for("update");
      if (!project) throw new Error(`Project ${projectId} doesn't exist.`);

      const [latest] = await tx
        .select({ version: max(projectEnvironments.version) })
        .from(projectEnvironments)
        .where(eq(projectEnvironments.projectId, projectId));
      await tx
        .update(projectEnvironments)
        .set({ status: "superseded" })
        .where(
          and(
            eq(projectEnvironments.projectId, projectId),
            eq(projectEnvironments.status, "active"),
          ),
        );
      const [row] = await tx
        .insert(projectEnvironments)
        .values({
          projectId,
          version: (latest?.version ?? 0) + 1,
          config,
          source,
          verifiedCommit: config.meta.commit ?? null,
        })
        .returning();
      return toStored(row!);
    });
  }

  async markHealth(
    projectId: string,
    status: EnvironmentHealth,
    reasons: string[] = [],
  ) {
    await this.db
      .update(projectEnvironments)
      .set({
        health: status,
        healthReasons: reasons,
        healthUpdatedAt: new Date(),
      })
      .where(
        and(
          eq(projectEnvironments.projectId, projectId),
          eq(projectEnvironments.status, "active"),
        ),
      );
  }
}

export type RestoreOutcome =
  | { status: "restored"; environment: DbStoredEnvironment }
  | { status: "not_found" }
  | { status: "setup_in_progress" };

export async function restoreEnvironmentUnlessSettingUp(
  db: Db,
  projectId: string,
  version: number,
): Promise<RestoreOutcome> {
  return db.transaction(async (tx) => {
    // The same lock as saving, so a restore and a setup's save take turns.
    await tx
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .for("update");

    const [settingUp] = await tx
      .select({ id: onboardings.id })
      .from(onboardings)
      .where(
        and(
          eq(onboardings.projectId, projectId),
          inArray(onboardings.status, ACTIVE_ONBOARDING),
        ),
      )
      .limit(1);
    if (settingUp) return { status: "setup_in_progress" };

    const [target] = await tx
      .select()
      .from(projectEnvironments)
      .where(
        and(
          eq(projectEnvironments.projectId, projectId),
          eq(projectEnvironments.version, version),
        ),
      );
    if (!target) return { status: "not_found" };
    if (target.status === "active") {
      return { status: "restored", environment: toStored(target) };
    }

    await tx
      .update(projectEnvironments)
      .set({ status: "superseded" })
      .where(
        and(
          eq(projectEnvironments.projectId, projectId),
          eq(projectEnvironments.status, "active"),
        ),
      );
    const [restored] = await tx
      .update(projectEnvironments)
      .set({ status: "active" })
      .where(eq(projectEnvironments.id, target.id))
      .returning();
    return { status: "restored", environment: toStored(restored!) };
  });
}
