// SPDX-License-Identifier: Apache-2.0

// Starts and stops Fathom's server: connects to the database as the application's role, and checks
// it can query it before listening over HTTPS, so wrong settings stop start-up. Closes cleanly,
// once, when asked to or when the process is told to end. The serve command reports start-up
// failures without internal details.

import { createDatabase, createPool, describeError } from "@fathom/db";
import { type App, buildApp } from "./app.ts";
import { loadServerConfig, type ServerConfig } from "./config.ts";
import { createDataAccess } from "./data/index.ts";
import type { LogStream } from "./logging.ts";

type Pool = ReturnType<typeof createPool>;

export interface RunningServer {
  url: string;
  close(): Promise<void>;
}

// Closes the application, so open requests finish, then the database connections, even if closing
// the application fails.
async function closeAll(app: App | undefined, pool: Pool): Promise<void> {
  try {
    await app?.close();
  } finally {
    await pool.end();
  }
}

export async function startServer(
  config: ServerConfig,
  logStream: LogStream,
): Promise<RunningServer> {
  const pool = createPool(config.database);
  let app: App | undefined;
  try {
    const data = createDataAccess(createDatabase(pool));
    await data.checkConnection();
    app = await buildApp({ data, tls: config.tls, logStream });
    const url = await app.listen({ host: config.host, port: config.port });
    const running = app;
    let closing: Promise<void> | undefined;
    return {
      url,
      close: () => (closing ??= closeAll(running, pool)),
    };
  } catch (error) {
    // The reason start-up failed matters more than any failure to clean up after it.
    await closeAll(app, pool).catch(() => undefined);
    throw error;
  }
}

// Starts the server with settings from the environment. Returns the running server, or undefined
// after reporting why it could not start.
export async function serveCommand(
  environment: NodeJS.ProcessEnv = process.env,
  logStream: LogStream = process.stdout,
): Promise<RunningServer | undefined> {
  try {
    return await startServer(loadServerConfig(environment), logStream);
  } catch (error) {
    console.error(`error: ${describeError(error)}`);
    return undefined;
  }
}

// Closes the server when the process is asked to end. A failure while closing is reported, and the
// process then ends with a failing exit code.
export function closeOnSignals(
  server: RunningServer,
  signals: readonly NodeJS.Signals[] = ["SIGINT", "SIGTERM"],
): void {
  for (const signal of signals) {
    process.once(signal, () => {
      server.close().catch((error: unknown) => {
        console.error(`error: ${describeError(error)}`);
        process.exitCode = 1;
      });
    });
  }
}
