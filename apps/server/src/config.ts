// SPDX-License-Identifier: Apache-2.0

// Loads and validates the server's settings from environment variables: the address it listens on,
// its HTTPS certificate and private key, the built front end it serves, and the database connection.

import { type DatabaseConfig, loadDatabaseConfig } from "@fathom/db";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { z } from "zod";

const environmentSchema = z.object({
  FATHOM_HOST: z.string().min(1),
  FATHOM_PORT: z.coerce.number().int().min(1).max(65535),
  FATHOM_TLS_CERT_FILE: z.string().min(1),
  FATHOM_TLS_KEY_FILE: z.string().min(1),
  // An absolute path, unset in development mode, where Vite's development server serves the front end.
  FATHOM_WEB_ROOT: z.string().refine(isAbsolute).optional(),
});

export interface TlsConfig {
  cert: string;
  key: string;
}

export interface ServerConfig {
  host: string;
  port: number;
  tls: TlsConfig;
  // Unset in development mode.
  webRoot: string | undefined;
  database: DatabaseConfig;
}

// The certificate and private key come from files, such as container secrets, so the key never
// appears in the environment or in process listings. Invalid settings are named without their values.
export function loadServerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    const fields = result.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(`Invalid server configuration: ${fields}`);
  }
  const settings = result.data;
  const webRoot = settings.FATHOM_WEB_ROOT;
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (webRoot !== undefined && !existsSync(join(webRoot, "index.html"))) {
    throw new Error(
      "The front end is missing; FATHOM_WEB_ROOT must be the folder holding the built front end",
    );
  }
  return {
    host: settings.FATHOM_HOST,
    port: settings.FATHOM_PORT,
    tls: {
      // The paths come from the operator's configuration, not from users of the application.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      cert: readFileSync(settings.FATHOM_TLS_CERT_FILE, "utf8"),
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      key: readFileSync(settings.FATHOM_TLS_KEY_FILE, "utf8"),
    },
    webRoot,
    database: loadDatabaseConfig(environment),
  };
}
