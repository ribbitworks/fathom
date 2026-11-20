// SPDX-License-Identifier: Apache-2.0

// Creates the PostgreSQL connection pool and the Drizzle client that queries through it.

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { DatabaseConfig } from "./config.ts";
import { describeError } from "./errors.ts";
import * as schema from "./schema.ts";

function logIdleConnectionError(error: Error): void {
  console.error(
    `error: an idle database connection failed: ${describeError(error)}`,
  );
}

// An idle connection can fail, for example when the database restarts. Without a handler for that,
// the error would end the process.
export function createPool(
  config: DatabaseConfig,
  onIdleConnectionError: (error: Error) => void = logIdleConnectionError,
): Pool {
  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
  });
  pool.on("error", onIdleConnectionError);
  return pool;
}

export function createDatabase(pool: Pool) {
  return drizzle(pool, { schema });
}

export type Database = ReturnType<typeof createDatabase>;

// A database or transaction, where only reading is needed.
export type Reader = Pick<Database, "select">;
