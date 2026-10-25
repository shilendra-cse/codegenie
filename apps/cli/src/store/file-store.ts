import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { parseEnvironmentConfig } from "@hobai/runner";
import type {
  EnvironmentConfig,
  EnvironmentHealth,
  EnvironmentSource,
  EnvironmentStore,
  StoredEnvironment,
} from "@hobai/shared";
import { SHORT_NAME } from "@hobai/shared/brand";

export const MAX_VERSIONS = 5;

type StoreFile = {
  repoKey: string;
  /** Newest first; the first one is active. */
  versions: Omit<StoredEnvironment, "repoKey">[];
};

export const HOME_ENV = `${SHORT_NAME.toUpperCase()}_HOME`;

/** ~/.hobai/environments, or $HOBAI_HOME/environments. */
export function defaultStoreDir() {
  return path.join(
    process.env[HOME_ENV] ?? path.join(homedir(), `.${SHORT_NAME}`),
    "environments",
  );
}

export class EnvironmentFileError extends Error {}

/** One JSON file per repository, keeping its last few versions. */
export class FileEnvironmentStore implements EnvironmentStore {
  constructor(readonly dir = defaultStoreDir()) {}

  fileFor(repoKey: string) {
    return path.join(
      this.dir,
      `${repoKey.replace(/[^a-z0-9._-]+/gi, "__")}.json`,
    );
  }

  async load(repoKey: string) {
    return (await this.list(repoKey))[0] ?? null;
  }

  async list(repoKey: string): Promise<StoredEnvironment[]> {
    const data = await this.read(repoKey);
    return (data?.versions ?? []).map((version) => ({ repoKey, ...version }));
  }

  async save(
    repoKey: string,
    config: EnvironmentConfig,
    source: EnvironmentSource,
  ): Promise<StoredEnvironment> {
    const versions = (await this.read(repoKey))?.versions ?? [];
    const saved = {
      version: (versions[0]?.version ?? 0) + 1,
      source,
      savedAt: new Date().toISOString(),
      config,
      health: { status: "ok" as const, reasons: [] },
    };
    await this.write({
      repoKey,
      versions: [saved, ...versions].slice(0, MAX_VERSIONS),
    });
    return { repoKey, ...saved };
  }

  async markHealth(
    repoKey: string,
    status: EnvironmentHealth,
    reasons: string[] = [],
  ) {
    const data = await this.read(repoKey);
    const active = data?.versions[0];
    if (!data || !active) return;
    active.health = { status, reasons, at: new Date().toISOString() };
    await this.write(data);
  }

  private async read(repoKey: string): Promise<StoreFile | null> {
    const file = this.fileFor(repoKey);
    let text: string;
    try {
      text = await readFile(file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
    try {
      const data = JSON.parse(text) as StoreFile;
      if (!Array.isArray(data.versions)) throw new Error("no versions list");
      for (const version of data.versions) {
        version.config = parseEnvironmentConfig(version.config);
      }
      return data;
    } catch (error) {
      throw new EnvironmentFileError(
        `Can't read the saved environment ${file}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }

  /** Written to a temporary file first, so a crash never leaves a half-written one. */
  private async write(data: StoreFile) {
    const file = this.fileFor(data.repoKey);
    await mkdir(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`);
    await rename(temp, file);
  }
}
