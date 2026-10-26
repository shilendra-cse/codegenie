// pnpm admin:set-plan <email> <plan>: moves a user to another plan (e.g. `unlimited`), keeping their cycle.
import { findUserIdByEmail, setUserPlan } from "@hobai/db";
import { db, pool } from "@/db";

const [email, planSlug] = process.argv.slice(2);
if (!email || !planSlug) {
  console.error("Usage: pnpm admin:set-plan <email> <plan>");
  process.exit(1);
}

try {
  const userId = await findUserIdByEmail(db, email);
  if (!userId) throw new Error(`No user with the email ${email}.`);
  const subscription = await setUserPlan(db, userId, planSlug);
  if (!subscription) throw new Error(`No plan called ${planSlug}.`);
  process.stdout.write(
    `${email} is now on ${subscription.plan.name}; the cycle resets on ${subscription.periodEnd.toISOString()}.\n`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
