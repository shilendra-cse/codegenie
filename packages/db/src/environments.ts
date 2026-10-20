import type {
  EnvironmentConfig,
  EnvironmentHealth,
  EnvironmentSource,
  EnvironmentStore,
  StoredEnvironment,
} from "@codegenie/shared";
import { and, desc, eq, max } from "drizzle-orm";
import type { Db } from "./client.js";
import { projectEnvironments } from "./schema/project-environments-schema.js";
import { projects } from "./schema/projects-schema.js";

type Row = typeof projectEnvironments.$inferSelect;

export type DbStoredEnvironment = StoredEnvironment & { id: string };

function toStored(row: Row): DbStoredEnvironment {
  return {
    id: row.id,
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
 * latest saved one is active and jobs replay it.
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
