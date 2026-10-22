import { db } from "@/db";
import { api } from "@/lib/ApiRouter";
import { redis } from "@/lib/redis";
import { createRunControllers } from "./runs.controller";

const runs = createRunControllers({ db, publisher: redis });

api.get("/runs/:id").authSecure(runs.getRun);
api.get("/runs/:id/diff").authSecure(runs.getRunDiff);
api.post("/runs/:id/cancel").authSecure(runs.cancel);
