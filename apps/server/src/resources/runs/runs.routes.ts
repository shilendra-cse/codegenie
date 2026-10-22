import { db } from "@/db";
import { api } from "@/lib/ApiRouter";
import { createRunControllers } from "./runs.controller";

const runs = createRunControllers({ db });

api.get("/runs/:id").authSecure(runs.getRun);
api.get("/runs/:id/diff").authSecure(runs.getRunDiff);
