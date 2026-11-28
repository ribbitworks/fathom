// SPDX-License-Identifier: Apache-2.0

// Tests for loading the server's settings: valid settings with the certificate, key, built front
// end, and database connection, and missing or invalid values, with errors that name settings
// without their values.

import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadServerConfig, productionLimits } from "./config.ts";

describe("server configuration", () => {
  let folder: string;

  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), "fathom-server-config-"));
    writeFileSync(join(folder, "cert.pem"), "fictional certificate");
    writeFileSync(join(folder, "key.pem"), "fictional key");
    writeFileSync(join(folder, "password"), "fictional-password\n");
    writeFileSync(
      join(folder, "secret"),
      "fictional-session-secret-for-tests-only-0123456789\n",
    );
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
      FATHOM_PUBLIC_URL: "https://fathom.example.test/",
      FATHOM_AUTH_SECRET_FILE: join(folder, "secret"),
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
      auth: {
        publicUrl: "https://fathom.example.test",
        secret: "fictional-session-secret-for-tests-only-0123456789",
      },
      proxyHost: undefined,
      tls: { cert: "fictional certificate", key: "fictional key" },
      webRoot: undefined,
      limits: { requestsPerMinute: 300, signInsPerMinute: 5 },
      database: {
        host: "localhost",
        port: 5432,
        database: "fathom",
        user: "fathom_app",
        password: "fictional-password",
      },
    });
  });

  it("requires Fathom's address to use HTTPS", () => {
    for (const address of ["http://fathom.example.test", "not an address"]) {
      expect(() =>
        loadServerConfig(environment({ FATHOM_PUBLIC_URL: address })),
      ).toThrow(/^Invalid server configuration: FATHOM_PUBLIC_URL$/);
    }
  });

  it("requires a session secret long enough to resist guessing, without revealing it", () => {
    writeFileSync(join(folder, "secret"), "too-short\n");
    expect(() => loadServerConfig(environment())).toThrow(
      /^Invalid server configuration: the file FATHOM_AUTH_SECRET_FILE names must hold at least 32 characters$/,
    );
  });

  it("reads the host name of Fathom's proxy, when connections come through it", () => {
    expect(
      loadServerConfig(environment({ FATHOM_PROXY_HOST: "proxy" })).proxyHost,
    ).toBe("proxy");
    expect(() =>
      loadServerConfig(environment({ FATHOM_PROXY_HOST: "" })),
    ).toThrow(/^Invalid server configuration: FATHOM_PROXY_HOST$/);
  });

  it("reads the folder holding the built front end", () => {
    const webRoot = join(folder, "web");
    mkdirSync(webRoot);
    writeFileSync(join(webRoot, "index.html"), "<!doctype html>");
    expect(
      loadServerConfig(environment({ FATHOM_WEB_ROOT: webRoot })).webRoot,
    ).toBe(webRoot);
  });

  it("fails when the built front end is missing from its folder", () => {
    expect(() =>
      loadServerConfig(environment({ FATHOM_WEB_ROOT: folder })),
    ).toThrow(
      /^The front end is missing; FATHOM_WEB_ROOT must be the folder holding the built front end$/,
    );
  });

  it("rejects a relative or empty folder for the built front end", () => {
    for (const webRoot of ["apps/web/dist", ""]) {
      expect(() =>
        loadServerConfig(environment({ FATHOM_WEB_ROOT: webRoot })),
      ).toThrow(/^Invalid server configuration: FATHOM_WEB_ROOT$/);
    }
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

  it("keeps production's limits of 300 requests and 5 sign-ins a minute", () => {
    expect(productionLimits).toEqual({
      requestsPerMinute: 300,
      signInsPerMinute: 5,
    });
  });

  it("raises the limits in development mode when asked to", () => {
    expect(
      loadServerConfig(
        environment({
          FATHOM_DEV_REQUESTS_PER_MINUTE: "3000",
          FATHOM_DEV_SIGN_INS_PER_MINUTE: "100",
        }),
      ).limits,
    ).toEqual({ requestsPerMinute: 3000, signInsPerMinute: 100 });
    expect(
      loadServerConfig(environment({ FATHOM_DEV_SIGN_INS_PER_MINUTE: "100" }))
        .limits,
    ).toEqual({ requestsPerMinute: 300, signInsPerMinute: 100 });
  });

  it("refuses to start with raised limits anywhere but development mode", () => {
    const webRoot = join(folder, "web");
    mkdirSync(webRoot);
    writeFileSync(join(webRoot, "index.html"), "<!doctype html>");
    for (const production of [
      { FATHOM_WEB_ROOT: webRoot },
      { FATHOM_PROXY_HOST: "proxy" },
      { NODE_ENV: "production" },
    ]) {
      expect(() =>
        loadServerConfig(
          environment({
            ...production,
            FATHOM_DEV_REQUESTS_PER_MINUTE: "3000",
          }),
        ),
      ).toThrow(
        /^Invalid server configuration: only development mode may set FATHOM_DEV_REQUESTS_PER_MINUTE$/,
      );
      expect(() =>
        loadServerConfig(
          environment({
            ...production,
            FATHOM_DEV_REQUESTS_PER_MINUTE: "3000",
            FATHOM_DEV_SIGN_INS_PER_MINUTE: "100",
          }),
        ),
      ).toThrow(
        /^Invalid server configuration: only development mode may set FATHOM_DEV_REQUESTS_PER_MINUTE, FATHOM_DEV_SIGN_INS_PER_MINUTE$/,
      );
    }
  });

  it("rejects limits that aren't a whole number above zero", () => {
    for (const limit of ["0", "-5", "2.5", "lots", ""]) {
      expect(() =>
        loadServerConfig(
          environment({ FATHOM_DEV_SIGN_INS_PER_MINUTE: limit }),
        ),
      ).toThrow(
        /^Invalid server configuration: FATHOM_DEV_SIGN_INS_PER_MINUTE$/,
      );
    }
  });

  it("matches the example configuration, which lists every setting outside development mode and no others", () => {
    const read = (path: string) =>
      readFileSync(new URL(path, import.meta.url), "utf8");
    const names = (text: string, pattern: RegExp) =>
      new Set([...text.matchAll(pattern)].map((match) => match[1]));
    const readByCode = names(
      read("./config.ts") + read("../../../packages/db/src/config.ts"),
      /\b(FATHOM_(?!DEV_)[A-Z_]+): z\./g,
    );
    const listed = names(
      read("../../../deploy/fathom.env.example"),
      /^(FATHOM_[A-Z_]+)=/gm,
    );
    expect(readByCode.size).toBeGreaterThan(0);
    expect(listed).toEqual(readByCode);
  });
});
