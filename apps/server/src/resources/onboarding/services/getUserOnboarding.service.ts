import {
  type Db,
  findUserOnboarding,
  type UserOnboarding,
} from "@codegenie/db";
import { HttpError } from "@/lib/http-error";
import { getUserProject } from "../../projects/services/getUserProject.service";

/** The latest setup of one of the user's projects; 404 when there's none. */
export async function getUserOnboarding(
  db: Db,
  userId: string,
  projectId: string,
): Promise<UserOnboarding> {
  await getUserProject(db, userId, projectId);
  const onboarding = await findUserOnboarding(db, userId, projectId);
  if (!onboarding) {
    throw new HttpError(
      404,
      "This project hasn't been set up yet.",
      "ONBOARDING_NOT_FOUND",
    );
  }
  return onboarding;
}
