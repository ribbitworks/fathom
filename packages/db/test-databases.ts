// SPDX-License-Identifier: Apache-2.0

// The Vitest global setup of every package whose tests use a database: one PostgreSQL server for the
// package's test run, whose template every test file copies, migrated once here. Kept outside src so
// the application image never holds it.

import { serveTestDatabases } from "@fathom/test-utils";
import { runMigrations } from "./src/migrate.ts";

export default serveTestDatabases(runMigrations);
