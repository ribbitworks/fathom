// SPDX-License-Identifier: Apache-2.0

// Test databases from Fathom's own PostgreSQL image: one server for each package's run, and a copy
// of a migrated template for each test file.

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { execFile, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inject } from "vitest";
import type { TestProject } from "vitest/node";
import { cloneName } from "./clone.ts";
import { inSlot, machineSlots } from "./slots.ts";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
// Each copy of the repository builds its own image, so copies changing it at once never test each
// other's build.
const imageTag = cloneName("dev", repositoryRoot);
const imageName = `fathom-postgres:${imageTag}`;

// The database the image creates and grants Fathom's roles access to, migrated once and then only
// copied, since PostgreSQL copies a database only while nobody is connected to it.
const templateDatabase = "fathom";
const superuser = "postgres";

// The database the superuser connects to for creating and dropping the others.
const maintenanceDatabase = "postgres";

// Each test file running at once may hold a few pools of connections, and run commands that connect
// too.
const connectionsPerTestFile = 50;

// Starting every test database server at once, across copies of the repository, can make
// Testcontainers time out waiting for a container's ports.
const databaseStarts = machineSlots("test-database-starts", {
  atOnce: 8,
  retryMilliseconds: 250,
  reportAfterMilliseconds: 30_000,
  waitingTo: "start a test database",
});

// Reads a setting from the development database's Compose file, so tests use the same server
// settings as development, with one place to change them.
function composeSetting(pattern: RegExp, description: string): string {
  const compose = readFileSync(
    `${repositoryRoot}deploy/compose.dev.yaml`,
    "utf8",
  );
  const value = pattern.exec(compose)?.[1];
  if (!value)
    throw new Error(
      `Could not find the ${description} in deploy/compose.dev.yaml`,
    );
  return value;
}

// The settings for one connection, in the shape the database package's configuration uses.
export interface ConnectionSettings {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface TestDatabase {
  migrator: ConnectionSettings;
  app: ConnectionSettings;
  configFor(
    user: string,
    password: string,
    database?: string,
  ): ConnectionSettings;
  // Runs SQL in this database as the superuser over the container's local socket, the only way the
  // superuser may log in.
  superuserQuery(sql: string): Promise<string>;
  // Runs a command inside the container with the superuser's password available to PostgreSQL tools.
  superuserCommand(command: string[]): Promise<CommandResult>;
  // Runs a command inside the container with no password available.
  command(command: string[]): Promise<CommandResult>;
  // Drops this database, ending any connections still open to it.
  remove(): Promise<void>;
}

export interface CommandResult {
  exitCode: number;
  output: string;
}

interface Passwords {
  superuser: string;
  migrator: string;
  app: string;
}

// Where the package's one server is, for each test file to make its copy there.
interface TestDatabaseServer {
  containerId: string;
  host: string;
  port: number;
  passwords: Passwords;
}

declare module "vitest" {
  export interface ProvidedContext {
    testDatabaseServer: TestDatabaseServer;
  }
}

// The server is thrown away, so it keeps its data in memory and does not wait for writes to reach
// the disk, which protects data only after a crash and slows every change the tests make. Every test
// file running at once shares it, with connections enough for each of them.
function startContainer(
  passwords: Passwords,
  testFilesAtOnce: number,
): Promise<StartedPostgreSqlContainer> {
  return new PostgreSqlContainer(imageName)
    .withDatabase(templateDatabase)
    .withUsername(superuser)
    .withPassword(passwords.superuser)
    .withEnvironment({
      POSTGRES_INITDB_ARGS: composeSetting(
        /^\s+POSTGRES_INITDB_ARGS:\s+(.+)$/m,
        "server settings",
      ),
    })
    .withCommand([
      "postgres",
      "-c",
      "fsync=off",
      "-c",
      "synchronous_commit=off",
      "-c",
      "full_page_writes=off",
      "-c",
      `max_connections=${String(Math.max(100, testFilesAtOnce * connectionsPerTestFile))}`,
    ])
    .withTmpFs({ "/var/lib/postgresql": "rw" })
    .withCopyContentToContainer([
      {
        content: passwords.migrator,
        target: "/run/secrets/fathom_migrator_password",
        mode: 0o644,
      },
      {
        content: passwords.app,
        target: "/run/secrets/fathom_app_password",
        mode: 0o644,
      },
    ])
    .start();
}

// Builds the image the same way development does, so tests run exactly that image.
function buildImage(): void {
  execFileSync(
    "bash",
    ["-c", "source scripts/lib.sh && build_dev_database_image"],
    { cwd: repositoryRoot, stdio: "inherit" },
  );
}

function connectionSettings(
  server: Pick<TestDatabaseServer, "host" | "port">,
  database: string,
  user: string,
  password: string,
): ConnectionSettings {
  return { host: server.host, port: server.port, database, user, password };
}

// Runs a command inside the container through Docker, which test files can reach without the
// container's handle. The password goes through the environment, never on a command line.
function runInContainer(
  containerId: string,
  command: string[],
  password?: string,
): Promise<CommandResult> {
  const passwordArgs = password === undefined ? [] : ["--env", "PGPASSWORD"];
  return new Promise((resolve) => {
    execFile(
      "docker",
      ["exec", ...passwordArgs, containerId, ...command],
      { env: { ...process.env, PGPASSWORD: password } },
      (error, stdout, stderr) => {
        const exitCode =
          error === null ? 0 : typeof error.code === "number" ? error.code : 1;
        const problem =
          error !== null && typeof error.code !== "number" ? error.message : "";
        resolve({ exitCode, output: `${stdout}${stderr}${problem}` });
      },
    );
  });
}

// Each statement runs on its own, since PostgreSQL creates and drops databases only outside a
// transaction.
async function superuserStatements(
  server: TestDatabaseServer,
  database: string,
  statements: string[],
): Promise<string> {
  const result = await runInContainer(
    server.containerId,
    [
      "psql",
      "--username",
      superuser,
      "--dbname",
      database,
      "--tuples-only",
      "--no-align",
      "--set",
      "ON_ERROR_STOP=1",
      ...statements.flatMap((statement) => ["--command", statement]),
    ],
    server.passwords.superuser,
  );
  if (result.exitCode !== 0)
    throw new Error(`Superuser query failed: ${result.output}`);
  return result.output.trim();
}

// A copy of the template's data does not carry who may connect to it, so the copy is given the
// template's access to the database itself, as the image set it up, and nobody else's.
function copyStatements(database: string): string[] {
  return [
    `CREATE DATABASE "${database}" TEMPLATE "${templateDatabase}"`,
    `REVOKE ALL ON DATABASE "${database}" FROM PUBLIC`,
    `DO $$
      DECLARE granted record;
      BEGIN
        FOR granted IN
          SELECT access.grantee::regrole::text AS grantee, access.privilege_type
          FROM pg_database, aclexplode(datacl) AS access
          WHERE datname = '${templateDatabase}' AND access.grantee NOT IN (0, datdba)
        LOOP
          EXECUTE format('GRANT %s ON DATABASE "${database}" TO %s', granted.privilege_type, granted.grantee);
        END LOOP;
      END
    $$`,
  ];
}

// The Vitest global setup of a package whose tests use test databases: starts the package's one
// server and prepares its template, such as by migrating it, then stops the server when the run
// ends.
export function serveTestDatabases(
  prepare: (migrator: ConnectionSettings) => Promise<void>,
): (project: TestProject) => Promise<() => Promise<void>> {
  return async (project) => {
    const passwords: Passwords = {
      superuser: randomBytes(32).toString("hex"),
      migrator: randomBytes(32).toString("hex"),
      app: randomBytes(32).toString("hex"),
    };
    buildImage();
    // The build waits for no slot: on the first run of a day it fetches security fixes, which would
    // hold up every other start.
    const container = await inSlot(
      () => startContainer(passwords, project.config.maxWorkers),
      databaseStarts,
    );
    const server: TestDatabaseServer = {
      containerId: container.getId(),
      host: container.getHost(),
      port: container.getPort(),
      passwords,
    };
    try {
      await prepare(
        connectionSettings(
          server,
          templateDatabase,
          "fathom_migrator",
          passwords.migrator,
        ),
      );
    } catch (error) {
      // Stopping is only tidying up, so a failure to stop never hides why preparing failed.
      await container.stop().catch(() => undefined);
      throw error;
    }
    project.provide("testDatabaseServer", server);
    return async () => {
      await container.stop();
    };
  };
}

// Makes this test file a database of its own, a copy of the package's prepared template, with the
// same roles and access as development.
export async function startTestDatabase(): Promise<TestDatabase> {
  const server = inject("testDatabaseServer") as TestDatabaseServer | undefined;
  if (server === undefined)
    throw new Error(
      "No test database server is running; add the package's test database setup to globalSetup in its Vitest settings",
    );
  const database = `test_${randomBytes(8).toString("hex")}`;
  try {
    await superuserStatements(
      server,
      maintenanceDatabase,
      copyStatements(database),
    );
  } catch (error) {
    // A copy made before its access failed to be given is dropped, never left half set up.
    await superuserStatements(server, maintenanceDatabase, [
      `DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`,
    ]).catch(() => undefined);
    throw error;
  }

  const configFor = (
    user: string,
    password: string,
    name = database,
  ): ConnectionSettings => connectionSettings(server, name, user, password);

  return {
    migrator: configFor("fathom_migrator", server.passwords.migrator),
    app: configFor("fathom_app", server.passwords.app),
    configFor,
    superuserQuery: (sql) => superuserStatements(server, database, [sql]),
    superuserCommand: (command) =>
      runInContainer(server.containerId, command, server.passwords.superuser),
    command: (command) => runInContainer(server.containerId, command),
    async remove() {
      await superuserStatements(server, maintenanceDatabase, [
        `DROP DATABASE "${database}" WITH (FORCE)`,
      ]);
    },
  };
}
