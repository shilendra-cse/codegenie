import { createDb } from "@codegenie/db";
import { config } from "@/config/index.js";

export const { db, pool } = createDb(config.database.url);
