import { type Db, restoreEnvironmentUnlessSettingUp } from "@codegenie/db";
import type { EnvironmentResponse } from "@codegenie/shared";
import { HttpError } from "@/lib/http-error";
import { toEnvironmentResponse } from "../projects.types";
import { getUserProject } from "./getUserProject.service";

export async function restoreEnvironment(
  db: Db,
  userId: string,
  projectId: string,
  version: number,
): Promise<EnvironmentResponse> {
  await getUserProject(db, userId, projectId);
  const outcome = await restoreEnvironmentUnlessSettingUp(
    db,
    projectId,
    version,
  );
  if (outcome.status === "not_found") {
    throw new HttpError(
      404,
      `Version ${version} not found.`,
      "ENVIRONMENT_NOT_FOUND",
    );
  }
  if (outcome.status === "setup_in_progress") {
    throw new HttpError(
      409,
      "Finish or stop the setup first.",
      "SETUP_IN_PROGRESS",
    );
  }
  return toEnvironmentResponse(outcome.environment);
}
