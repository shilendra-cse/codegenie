import { db } from "@/db";
import { api } from "@/lib/ApiRouter";
import { createUsageControllers } from "./usage.controller";

const usage = createUsageControllers({ db });

api.get("/me/usage").authSecure(usage.getMyUsage);
