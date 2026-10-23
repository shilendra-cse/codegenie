import { db } from "@/db";
import { api } from "@/lib/ApiRouter";
import { redis } from "@/lib/redis";
import { eventHub } from "@/lib/events";
import { stream } from "@/lib/sse";
import { createRunControllers } from "./runs.controller";

const runs = createRunControllers({
  db,
  publisher: redis,
  hub: eventHub,
  heartbeatMs: 15_000,
});

api.get("/runs/:id").authSecure(runs.getRun);
api.get("/runs/:id/diff").authSecure(runs.getRunDiff);
api.post("/runs/:id/cancel").authSecure(runs.cancel);
api.get("/runs/:id/events").authSecure(stream(runs.streamEvents));
