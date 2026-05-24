import { drizzle } from "drizzle-orm/node-postgres";
import { pool } from "./pool.js";
import * as schema from "./schema.js";

export { pool } from "./pool.js";

export const db = drizzle({ client: pool, schema: schema });
