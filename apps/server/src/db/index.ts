import { createDb, type Db } from "@codegenie/db";
import type { Pool } from "pg";
import { config } from "@/config/index.js";

const connection = createDb(config.database.url);

export const db: Db = connection.db;
export const pool: Pool = connection.pool;
