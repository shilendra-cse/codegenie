import { db } from "@/db";
import { api } from "@/lib/ApiRouter";
import { redis } from "@/lib/redis";
import { workQueue } from "@/lib/work-queue";
import { createOnboardingControllers } from "./onboarding.controller";

const onboarding = createOnboardingControllers({
  db,
  queue: workQueue,
  publisher: redis,
});

api.post("/projects/:id/onboarding").authSecure(onboarding.start);
api.get("/projects/:id/onboarding").authSecure(onboarding.getLatest);
api.post("/projects/:id/onboarding/answer").authSecure(onboarding.answer);
api.post("/projects/:id/onboarding/cancel").authSecure(onboarding.cancel);
