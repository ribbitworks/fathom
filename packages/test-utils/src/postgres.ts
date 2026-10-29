// SPDX-License-Identifier: Apache-2.0

// Starts a throwaway PostgreSQL server from Fathom's own image for tests, with the same roles and
// settings as development and random passwords for each run.

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const imageName = "fathom-postgres:dev";

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

function developmentBuildEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    FATHOM_IMAGE_TAG: "dev",
  };
  delete environment.DOCKER_DEFAULT_PLATFORM;
  return environment;
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
  container: StartedPostgreSqlContainer;
  migrator: ConnectionSettings;
  app: ConnectionSettings;
  configFor(
    user: string,
    password: string,
    database?: string,
  ): ConnectionSettings;
  // Runs SQL as the superuser over the container's local socket, the only way the superuser may log in.
  superuserQuery(sql: string): Promise<string>;
  // Runs a command inside the container with the superuser's password available to PostgreSQL tools.
  superuserCommand(
    command: string[],
  ): Promise<{ exitCode: number; output: string }>;
}

// Starts a fresh PostgreSQL from Fathom's own image, built and named exactly as for development.
// Passwords are random for each run.
export async function startTestDatabase(): Promise<TestDatabase> {
  // Builds the image the same way development does, so tests run exactly that image.
  execFileSync(
    "bash",
    [
      "-c",
      "source scripts/lib.sh && docker compose --file deploy/compose.dev.yaml build --quiet",
    ],
    {
      cwd: repositoryRoot,
      // Builds the development image for this machine, whatever the shell has set for scans.
      env: developmentBuildEnvironment(),
      stdio: "inherit",
    },
  );

  const passwords = {
    superuser: randomBytes(32).toString("hex"),
    migrator: randomBytes(32).toString("hex"),
    app: randomBytes(32).toString("hex"),
  };
  const container = await new PostgreSqlContainer(imageName)
    .withDatabase("fathom")
    .withUsername("postgres")
    .withPassword(passwords.superuser)
    .withEnvironment({
      POSTGRES_INITDB_ARGS: composeSetting(
        /^\s+POSTGRES_INITDB_ARGS:\s+(.+)$/m,
        "server settings",
      ),
    })
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

  const configFor = (
    user: string,
    password: string,
    database = "fathom",
  ): ConnectionSettings => ({
    host: container.getHost(),
    port: container.getPort(),
    database,
    user,
    password,
  });

  return {
    container,
    migrator: configFor("fathom_migrator", passwords.migrator),
    app: configFor("fathom_app", passwords.app),
    configFor,
    async superuserCommand(command: string[]) {
      const result = await container.exec(command, {
        env: { PGPASSWORD: passwords.superuser },
      });
      return { exitCode: result.exitCode, output: result.output };
    },
    async superuserQuery(sql: string): Promise<string> {
      const result = await container.exec(
        [
          "psql",
          "--username",
          "postgres",
          "--dbname",
          "fathom",
          "--tuples-only",
          "--no-align",
          "--command",
          sql,
        ],
        { env: { PGPASSWORD: passwords.superuser } },
      );
      if (result.exitCode !== 0)
        throw new Error(`Superuser query failed: ${result.output}`);
      return result.output.trim();
    },
  };
}
