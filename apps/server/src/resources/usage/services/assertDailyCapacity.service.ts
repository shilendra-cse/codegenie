import { type Db, spendToday } from "@hobai/db";
import { PRODUCT_NAME } from "@hobai/shared/brand";
import { HttpError } from "@/lib/http-error";

/** Refuses new work once today's model spend, across every user, has reached the cap. */
export async function assertDailyCapacity(db: Db, capUsd: number) {
  if ((await spendToday(db)) >= capUsd) {
    throw new HttpError(
      503,
      `${PRODUCT_NAME} has reached today's capacity. Try again tomorrow.`,
      "DAILY_CAPACITY_REACHED",
    );
  }
}
