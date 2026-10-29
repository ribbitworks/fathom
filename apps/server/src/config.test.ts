// SPDX-License-Identifier: Apache-2.0

// Tests for loading the server's settings: valid settings with the certificate, key, and database
// connection, and missing or invalid values, with errors that name settings without their values.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadServerConfig } from "./config.ts";

describe("server configuration", () => {
  let folder: string;

  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), "fathom-server-config-"));
    writeFileSync(join(folder, "cert.pem"), "fictional certificate");
    writeFileSync(join(folder, "key.pem"), "fictional key");
    writeFileSync(join(folder, "password"), "fictional-password\n");
  });

  afterEach(() => {
    rmSync(folder, { recursive: true, force: true });
  });

  function environment(
    overrides: Record<string, string | undefined> = {},
  ): NodeJS.ProcessEnv {
    return {
      FATHOM_HOST: "127.0.0.1",
      FATHOM_PORT: "8443",
      FATHOM_TLS_CERT_FILE: join(folder, "cert.pem"),
      FATHOM_TLS_KEY_FILE: join(folder, "key.pem"),
      FATHOM_DB_HOST: "localhost",
      FATHOM_DB_PORT: "5432",
      FATHOM_DB_NAME: "fathom",
      FATHOM_DB_USER: "fathom_app",
      FATHOM_DB_PASSWORD_FILE: join(folder, "password"),
      ...overrides,
    };
  }

  it("reads settings from the environment, and the certificate and key from their files", () => {
    expect(loadServerConfig(environment())).toEqual({
      host: "127.0.0.1",
      port: 8443,
      tls: { cert: "fictional certificate", key: "fictional key" },
      database: {
        host: "localhost",
        port: 5432,
        database: "fathom",
        user: "fathom_app",
        password: "fictional-password",
      },
    });
  });

  it("names every missing or invalid setting, without revealing values", () => {
    expect(() =>
      loadServerConfig(
        environment({ FATHOM_HOST: undefined, FATHOM_PORT: "70000" }),
      ),
    ).toThrow(/^Invalid server configuration: FATHOM_HOST, FATHOM_PORT$/);
  });

  it("checks the database settings too", () => {
    expect(() =>
      loadServerConfig(environment({ FATHOM_DB_HOST: undefined })),
    ).toThrow(/^Invalid database configuration: FATHOM_DB_HOST$/);
  });

  it("fails when the private key file does not exist", () => {
    expect(() =>
      loadServerConfig(
        environment({ FATHOM_TLS_KEY_FILE: join(folder, "missing.pem") }),
      ),
    ).toThrow(/ENOENT/);
  });

  it("matches the example configuration, which lists every setting and no others", () => {
    const read = (path: string) =>
      readFileSync(new URL(path, import.meta.url), "utf8");
    const names = (text: string, pattern: RegExp) =>
      new Set([...text.matchAll(pattern)].map((match) => match[1]));
    const readByCode = names(
      read("./config.ts") + read("../../../packages/db/src/config.ts"),
      /\b(FATHOM_[A-Z_]+): z\./g,
    );
    const listed = names(
      read("../../../deploy/fathom.env.example"),
      /^(FATHOM_[A-Z_]+)=/gm,
    );
    expect(readByCode.size).toBeGreaterThan(0);
    expect(listed).toEqual(readByCode);
  });
});
