// SPDX-License-Identifier: Apache-2.0

// Starts and stops Fathom's server: connects to the database as the application's role, and checks
// it can query it before listening over HTTPS, directly or behind Fathom's proxy, so wrong settings
// stop start-up. Closes cleanly, once, when asked to or when the process is told to end. The serve
// command reports start-up failures without internal details.

import { createDatabase, createPool, describeError } from "@fathom/db";
import { type AddressInfo, isIPv6, type Server } from "node:net";
import { once } from "node:events";
import { type App, buildApp } from "./app.ts";
import { loadServerConfig, type ServerConfig } from "./config.ts";
import { createDataAccess } from "./data/index.ts";
import type { LogStream } from "./logging.ts";
import { acceptProxyProtocol } from "./proxy-protocol.ts";

type Pool = ReturnType<typeof createPool>;

export interface RunningServer {
  url: string;
  close(): Promise<void>;
}

// Closes the listener in front of the application, if there is one, so no new connections arrive,
// then the application, so open requests finish, then the database connections, even if closing
// the application fails.
async function closeAll(
  app: App | undefined,
  pool: Pool,
  front?: Server,
): Promise<void> {
  try {
    front?.close();
    await app?.close();
  } finally {
    await pool.end();
  }
}

// Behind the proxy, a separate listener accepts connections from the proxy only, reads each
// connection's header, and passes the connection on to the application's HTTPS server. That server
// listens too, only inside the container, so Node.js applies its request time limits and closes
// idle connections when the server stops.
async function listenBehindProxy(
  app: App,
  config: ServerConfig,
  proxyHost: string,
) {
  await app.listen({ host: "127.0.0.1", port: 0 });
  const front = acceptProxyProtocol(app.server, { proxyHost });
  front.listen(config.port, config.host);
  try {
    await once(front, "listening");
  } catch (error) {
    front.close();
    throw error;
  }
  const { address, port } = front.address() as AddressInfo;
  const host = isIPv6(address) ? `[${address}]` : address;
  return { front, url: `https://${host}:${String(port)}` };
}

export async function startServer(
  config: ServerConfig,
  logStream: LogStream,
): Promise<RunningServer> {
  const pool = createPool(config.database);
  let app: App | undefined;
  let front: Server | undefined;
  try {
    const database = createDatabase(pool);
    const data = createDataAccess(database);
    await data.checkConnection();
    app = await buildApp({
      data,
      database,
      auth: config.auth,
      tls: config.tls,
      webRoot: config.webRoot,
      logStream,
    });
    let url: string;
    if (config.proxyHost !== undefined) {
      ({ front, url } = await listenBehindProxy(app, config, config.proxyHost));
    } else {
      url = await app.listen({ host: config.host, port: config.port });
    }
    const running = app;
    const runningFront = front;
    let closing: Promise<void> | undefined;
    return {
      url,
      close: () => (closing ??= closeAll(running, pool, runningFront)),
    };
  } catch (error) {
    // The reason start-up failed matters more than any failure to clean up after it.
    await closeAll(app, pool, front).catch(() => undefined);
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
