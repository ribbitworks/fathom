// SPDX-License-Identifier: Apache-2.0

// The seed command's settings for tests against a test database, with a fictional session secret and
// account password in a folder of its own, and a clean start without the seed data, whatever the
// test before left. Used only by tests.

import type { TestDatabase } from "@fathom/test-utils";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, vi } from "vitest";
import { seedCommand } from "./seed.ts";

// A session secret and an account password used only by tests.
const sessionSecret = "fictional-session-secret-for-tests-only-0123456789";
const accountPassword = "fictional-seed-password";

export interface TestSeedCommand {
  // A folder of the tests' own, for files a test adds.
  folder: string;
  environment(): Record<string, string>;
  // Removes the seed data, saying nothing; the personas' accounts are added first, since removing
  // the data needs them, and are left deactivated.
  startClean(): Promise<void>;
  remove(): void;
}

export function testSeedCommand(database: TestDatabase): TestSeedCommand {
  const folder = mkdtempSync(join(tmpdir(), "fathom-seed-"));
  writeFileSync(join(folder, "password"), database.app.password);
  writeFileSync(join(folder, "secret"), sessionSecret);
  writeFileSync(join(folder, "accounts"), `${accountPassword}\n`);
  const environment = () => ({
    FATHOM_PUBLIC_URL: "https://fathom.example.test",
    FATHOM_AUTH_SECRET_FILE: join(folder, "secret"),
    FATHOM_SEED_PASSWORD_FILE: join(folder, "accounts"),
    FATHOM_DB_HOST: database.app.host,
    FATHOM_DB_PORT: String(database.app.port),
    FATHOM_DB_NAME: database.app.database,
    FATHOM_DB_USER: database.app.user,
    FATHOM_DB_PASSWORD_FILE: join(folder, "password"),
  });
  return {
    folder,
    environment,
    async startClean() {
      const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
      try {
        expect(await seedCommand(["accounts"], environment())).toBe(0);
        expect(await seedCommand(["unseed"], environment())).toBe(0);
      } finally {
        log.mockRestore();
      }
    },
    remove() {
      rmSync(folder, { recursive: true, force: true });
    },
  };
}
