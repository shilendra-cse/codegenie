import { db } from "@/db";
import { api } from "@/lib/ApiRouter";
import { eventHub } from "@/lib/events";
import { redis } from "@/lib/redis";
import { stream } from "@/lib/sse";
import { workQueue } from "@/lib/work-queue";
import { createOnboardingControllers } from "./onboarding.controller";

const onboarding = createOnboardingControllers({
  db,
  queue: workQueue,
  publisher: redis,
  hub: eventHub,
  heartbeatMs: 15_000,
});

api.post("/projects/:id/onboarding").authSecure(onboarding.start);
api.get("/projects/:id/onboarding").authSecure(onboarding.getLatest);
api.post("/projects/:id/onboarding/answer").authSecure(onboarding.answer);
api.post("/projects/:id/onboarding/cancel").authSecure(onboarding.cancel);
api
  .get("/projects/:id/onboarding/events")
  .authSecure(stream(onboarding.streamEvents));
