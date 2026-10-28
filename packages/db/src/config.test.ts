import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadDatabaseConfig } from "./config.ts";

describe("database configuration", () => {
  let folder: string;
  let passwordFile: string;

  function environment(
    overrides: Record<string, string | undefined> = {},
  ): NodeJS.ProcessEnv {
    return {
      FATHOM_DB_HOST: "db.example.test",
      FATHOM_DB_PORT: "5432",
      FATHOM_DB_NAME: "fathom",
      FATHOM_DB_USER: "fathom_app",
      FATHOM_DB_PASSWORD_FILE: passwordFile,
      ...overrides,
    };
  }

  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), "fathom-config-"));
    passwordFile = join(folder, "password");
    writeFileSync(passwordFile, "fictional-password\n");
  });

  afterEach(() => {
    rmSync(folder, { recursive: true, force: true });
  });

  it("reads settings from the environment and the password from its file", () => {
    expect(loadDatabaseConfig(environment())).toEqual({
      host: "db.example.test",
      port: 5432,
      database: "fathom",
      user: "fathom_app",
      password: "fictional-password",
    });
  });

  it("names every missing or invalid setting, without revealing values", () => {
    expect(() =>
      loadDatabaseConfig(
        environment({ FATHOM_DB_HOST: undefined, FATHOM_DB_PORT: "70000" }),
      ),
    ).toThrow("Invalid database configuration: FATHOM_DB_HOST, FATHOM_DB_PORT");
  });

  it("rejects a port that is not a number", () => {
    expect(() =>
      loadDatabaseConfig(environment({ FATHOM_DB_PORT: "abc" })),
    ).toThrow("FATHOM_DB_PORT");
  });

  it("rejects an empty password file", () => {
    writeFileSync(passwordFile, "  \n");
    expect(() => loadDatabaseConfig(environment())).toThrow(
      "the password file is empty",
    );
  });

  it("fails when the password file does not exist", () => {
    expect(() =>
      loadDatabaseConfig(
        environment({ FATHOM_DB_PASSWORD_FILE: join(folder, "missing") }),
      ),
    ).toThrow(/ENOENT/);
  });
});
