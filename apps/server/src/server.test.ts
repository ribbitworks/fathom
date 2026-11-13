// SPDX-License-Identifier: Apache-2.0

// Tests for starting and stopping the server against a migrated PostgreSQL server: it serves the API
// and the built front end over HTTPS only, directly or behind Fathom's proxy, cleans up when it
// cannot start, closes once, closes idle connections when it stops, closes when the process is told
// to end, and the serve command reads its settings from the environment and reports failures.

import { createPool } from "@fathom/db";
import {
  createTestCertificate,
  httpGet,
  httpsGet,
  httpsGetAfter,
  proxyProtocolHeader,
  startTestDatabase,
  type TestCertificate,
  type TestDatabase,
} from "@fathom/test-utils";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { connect, createServer } from "node:net";
import { once } from "node:events";
import { connect as tlsConnect } from "node:tls";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ServerConfig } from "./config.ts";
import {
  closeOnSignals,
  type RunningServer,
  serveCommand,
  startServer,
} from "./server.ts";

// How long a test waits for something to happen, so a busy computer does not fail it.
const waitLimit = { timeout: 10_000 };

let database: TestDatabase;
let certificate: TestCertificate;
const silent = { write: () => undefined };

function configFor(port = 0): ServerConfig {
  // Port 0 lets the system choose a free port.
  return {
    host: "127.0.0.1",
    port,
    auth: {
      publicUrl: "https://fathom.example.test",
      secret: "fictional-session-secret-for-tests-only-0123456789",
    },
    proxyHost: undefined,
    tls: certificate,
    webRoot: undefined,
    database: database.app,
  };
}

// The application role's open sessions in this file's database, which a server that failed to start
// must not leave behind.
async function applicationSessions(): Promise<number> {
  return Number(
    await database.superuserQuery(
      "SELECT count(*) FROM pg_stat_activity WHERE usename = 'fathom_app' AND datname = current_database()",
    ),
  );
}

async function expectApplicationSessions(count: number): Promise<void> {
  await vi.waitFor(async () => {
    expect(await applicationSessions()).toBe(count);
  }, waitLimit);
}

// Asks the system for a free port, for settings that must name one.
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => {
        resolve(typeof address === "object" && address ? address.port : 0);
      });
    });
  });
}

beforeAll(async () => {
  certificate = createTestCertificate();
  database = await startTestDatabase();
});

afterAll(async () => {
  await database.remove();
  certificate.remove();
});

describe("server", () => {
  it("serves the API over HTTPS with its certificate", async () => {
    const server = await startServer(configFor(), silent);
    try {
      // Answered by the server itself: no one is signed in.
      const response = await httpsGet(
        `${server.url}/api/session`,
        certificate.cert,
      );
      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toEqual({ error: "Unauthorized" });
    } finally {
      await server.close();
    }
  });

  it("serves the built front end from its folder", async () => {
    const folder = mkdtempSync(join(tmpdir(), "fathom-server-web-"));
    try {
      mkdirSync(join(folder, "web"));
      writeFileSync(
        join(folder, "web", "index.html"),
        "<!doctype html><title>Fathom</title>",
      );
      const server = await startServer(
        { ...configFor(), webRoot: join(folder, "web") },
        silent,
      );
      try {
        const response = await httpsGet(`${server.url}/`, certificate.cert);
        expect(response.statusCode).toBe(200);
        expect(response.body).toContain("<title>Fathom</title>");
      } finally {
        await server.close();
      }
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it("behind the proxy, reads each client's address from the proxy's header", async () => {
    const logLines: string[] = [];
    const server = await startServer(
      { ...configFor(), proxyHost: "localhost" },
      { write: (line) => logLines.push(line) },
    );
    try {
      const response = await httpsGetAfter(
        `${server.url}/api/session`,
        certificate.cert,
        proxyProtocolHeader("192.0.2.88"),
      );
      expect(response.statusCode).toBe(401);
      expect(logLines.join("")).toContain('"clientAddress":"192.0.2.88"');
      await expect(
        httpsGet(`${server.url}/api/greeting`, certificate.cert),
      ).rejects.toThrow();
    } finally {
      await server.close();
    }
  });

  it("behind the proxy, gives its address in URL form for an IPv6 address", async () => {
    const server = await startServer(
      { ...configFor(), host: "::1", proxyHost: "localhost" },
      silent,
    );
    try {
      expect(server.url).toMatch(/^https:\/\/\[::1\]:\d+$/);
    } finally {
      await server.close();
    }
  });

  it("behind the proxy, closes idle connections when it stops", async () => {
    const server = await startServer(
      { ...configFor(), proxyHost: "localhost" },
      silent,
    );
    const connection = connect(Number(new URL(server.url).port), "127.0.0.1");
    connection.write(proxyProtocolHeader("192.0.2.89"));
    const tlsConnection = tlsConnect({
      socket: connection,
      servername: "localhost",
      ca: certificate.cert,
    });
    await once(tlsConnection, "secureConnect");
    // A browser keeps its connection open for further requests after the first.
    tlsConnection.write(
      "GET /api/greeting HTTP/1.1\r\nHost: localhost\r\n\r\n",
    );
    await once(tlsConnection, "data");
    const closed = once(tlsConnection, "close");
    await server.close();
    await closed;
  }, 10_000);

  it("behind the proxy, does not start when its port is taken, and closes what it opened", async () => {
    const first = await startServer(configFor(), silent);
    try {
      const port = Number(new URL(first.url).port);
      await expect(
        startServer({ ...configFor(port), proxyHost: "localhost" }, silent),
      ).rejects.toMatchObject({ code: "EADDRINUSE" });
      await expectApplicationSessions(1);
    } finally {
      await first.close();
    }
  });

  it("refuses plain HTTP by closing the connection", async () => {
    const server = await startServer(configFor(), silent);
    try {
      await expect(
        httpGet(`${server.url.replace("https:", "http:")}/api/greeting`),
      ).rejects.toMatchObject({ code: "ECONNRESET" });
    } finally {
      await server.close();
    }
  });

  it("closes only once, however many times it is asked", async () => {
    const server = await startServer(configFor(), silent);
    await expect(
      Promise.all([server.close(), server.close()]),
    ).resolves.toBeDefined();
  });

  it("does not start with an invalid private key, names the settings to check, and closes its database connections", async () => {
    await expect(
      startServer(
        { ...configFor(), tls: { cert: certificate.cert, key: "not a key" } },
        silent,
      ),
    ).rejects.toThrow(/FATHOM_TLS_CERT_FILE and FATHOM_TLS_KEY_FILE/);
    await expectApplicationSessions(0);
  });

  it("reports why it could not start, even if cleaning up also fails", async () => {
    const poolPrototype = Object.getPrototypeOf(createPool(database.app)) as {
      end: (this: unknown) => Promise<void>;
    };
    const end = poolPrototype.end;
    const failingEnd = vi
      .spyOn(poolPrototype, "end")
      .mockImplementationOnce(async function (this: unknown) {
        await end.call(this);
        throw new Error("A fictional clean-up failure");
      });
    try {
      await expect(
        startServer(
          { ...configFor(), tls: { cert: certificate.cert, key: "not a key" } },
          silent,
        ),
      ).rejects.toThrow(/FATHOM_TLS_CERT_FILE and FATHOM_TLS_KEY_FILE/);
      expect(failingEnd).toHaveBeenCalledOnce();
    } finally {
      failingEnd.mockRestore();
    }
  });

  it("does not start when the database cannot be queried, and names the settings to check", async () => {
    await expect(
      startServer(
        {
          ...configFor(),
          database: { ...database.app, password: "wrong-password" },
        },
        silent,
      ),
    ).rejects.toThrow(/FATHOM_DB_\* settings/);
  });

  it("does not start when its port is taken, and closes what it opened", async () => {
    const first = await startServer(configFor(), silent);
    try {
      const port = Number(new URL(first.url).port);
      await expect(startServer(configFor(port), silent)).rejects.toMatchObject({
        code: "EADDRINUSE",
      });
      // Only the running server's own connection remains.
      await expectApplicationSessions(1);
    } finally {
      await first.close();
    }
    await expectApplicationSessions(0);
  });
});

describe("closing on signals", () => {
  function fakeServer(close: () => Promise<void>): RunningServer {
    return { url: "https://127.0.0.1", close };
  }

  it("closes the server when the process is told to end", () => {
    const close = vi.fn(() => Promise.resolve());
    closeOnSignals(fakeServer(close), ["SIGUSR2"]);
    process.emit("SIGUSR2");
    expect(close).toHaveBeenCalledOnce();
  });

  it("reports a failure while closing and sets a failing exit code", async () => {
    const errors = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      closeOnSignals(
        fakeServer(() => Promise.reject(new Error("A fictional failure"))),
        ["SIGUSR2"],
      );
      process.emit("SIGUSR2");
      await vi.waitFor(() => {
        expect(errors).toHaveBeenCalledWith("error: A fictional failure");
      }, waitLimit);
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = undefined;
      errors.mockRestore();
    }
  });
});

describe("serve command", () => {
  let folder: string;

  beforeAll(() => {
    folder = mkdtempSync(join(tmpdir(), "fathom-serve-"));
    writeFileSync(join(folder, "password"), database.app.password);
    writeFileSync(
      join(folder, "secret"),
      "fictional-session-secret-for-tests-only-0123456789",
    );
  });

  afterAll(() => {
    rmSync(folder, { recursive: true, force: true });
  });

  it("starts the server with settings from the environment", async () => {
    const server = await serveCommand(
      {
        FATHOM_HOST: "127.0.0.1",
        FATHOM_PORT: String(await freePort()),
        FATHOM_PUBLIC_URL: "https://fathom.example.test",
        FATHOM_AUTH_SECRET_FILE: join(folder, "secret"),
        FATHOM_TLS_CERT_FILE: certificate.certFile,
        FATHOM_TLS_KEY_FILE: certificate.keyFile,
        FATHOM_DB_HOST: database.app.host,
        FATHOM_DB_PORT: String(database.app.port),
        FATHOM_DB_NAME: database.app.database,
        FATHOM_DB_USER: database.app.user,
        FATHOM_DB_PASSWORD_FILE: join(folder, "password"),
      },
      silent,
    );
    expect(server).toBeDefined();
    await server?.close();
  });

  it("reports invalid settings and does not start", async () => {
    const errors = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      expect(await serveCommand({}, silent)).toBeUndefined();
      expect(errors).toHaveBeenCalledWith(
        expect.stringMatching(/^error: Invalid server configuration: /),
      );
    } finally {
      errors.mockRestore();
    }
  });
});
