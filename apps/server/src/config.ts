// SPDX-License-Identifier: Apache-2.0

// Loads and validates the server's settings from environment variables: the address it listens on,
// the address users reach Fathom at, whether connections come through Fathom's proxy, its HTTPS
// certificate and private key, the secret that signs sessions, the built front end it serves, the
// limits on each client's requests and sign-ins, and the database connection.

import { type DatabaseConfig, loadDatabaseConfig } from "@fathom/db";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { z } from "zod";

const authEnvironmentSchema = z.object({
  // The address users reach Fathom at, such as https://fathom.example.internal. Sign-in accepts
  // requests only from pages at this address.
  FATHOM_PUBLIC_URL: z.url({ protocol: /^https$/ }),
  FATHOM_AUTH_SECRET_FILE: z.string().min(1),
});

const environmentSchema = z.object({
  FATHOM_HOST: z.string().min(1),
  FATHOM_PORT: z.coerce.number().int().min(1).max(65535),
  // Set when every connection comes through Fathom's proxy, which names each client; connections
  // from anywhere else are then refused.
  FATHOM_PROXY_HOST: z.string().min(1).optional(),
  FATHOM_TLS_CERT_FILE: z.string().min(1),
  FATHOM_TLS_KEY_FILE: z.string().min(1),
  // An absolute path, unset in development mode, where Vite's development server serves the front end.
  FATHOM_WEB_ROOT: z.string().refine(isAbsolute).optional(),
});

// Every browser tab and UI test reaches the development server from one address, through Vite, so
// development mode may raise the limits. Production must never pick them up, so a server that serves
// the built front end, sits behind the proxy, or runs with NODE_ENV=production, as the application
// image sets it, refuses to start with them.
const developmentLimitsSchema = z.object({
  FATHOM_DEV_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().optional(),
  FATHOM_DEV_SIGN_INS_PER_MINUTE: z.coerce.number().int().positive().optional(),
});

const modeSchema = z.object({ NODE_ENV: z.string().optional() });

// How many requests, and how many sign-in attempts, each client address may make a minute.
export interface RequestLimits {
  requestsPerMinute: number;
  signInsPerMinute: number;
}

export const productionLimits: RequestLimits = {
  requestsPerMinute: 300,
  signInsPerMinute: 5,
};

export interface TlsConfig {
  cert: string;
  key: string;
}

export interface AuthConfig {
  // The origin of the address users reach Fathom at, such as https://fathom.example.internal.
  publicUrl: string;
  secret: string;
}

// Long enough to resist guessing, as Better Auth recommends.
const minimumSecretLength = 32;

export interface ServerConfig {
  host: string;
  port: number;
  auth: AuthConfig;
  // The proxy's host name, unset when clients connect directly, as in development mode.
  proxyHost: string | undefined;
  tls: TlsConfig;
  // Unset in development mode.
  webRoot: string | undefined;
  limits: RequestLimits;
  database: DatabaseConfig;
}

// Validates settings with the given schema, naming every invalid setting without its value.
function parseSettings<Schema extends z.ZodType>(
  schema: Schema,
  environment: NodeJS.ProcessEnv,
): z.infer<Schema> {
  const result = schema.safeParse(environment);
  if (!result.success) {
    const fields = result.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(`Invalid server configuration: ${fields}`);
  }
  return result.data;
}

function loadLimits(
  environment: NodeJS.ProcessEnv,
  settings: z.infer<typeof environmentSchema>,
): RequestLimits {
  const raised = parseSettings(developmentLimitsSchema, environment);
  const { NODE_ENV: mode } = parseSettings(modeSchema, environment);
  const named = Object.entries(raised)
    .filter(([, limit]) => limit !== undefined)
    .map(([name]) => name);
  const developmentMode =
    settings.FATHOM_WEB_ROOT === undefined &&
    settings.FATHOM_PROXY_HOST === undefined &&
    mode !== "production";
  if (named.length > 0 && !developmentMode) {
    throw new Error(
      `Invalid server configuration: only development mode may set ${named.join(", ")}`,
    );
  }
  return {
    requestsPerMinute:
      raised.FATHOM_DEV_REQUESTS_PER_MINUTE ??
      productionLimits.requestsPerMinute,
    signInsPerMinute:
      raised.FATHOM_DEV_SIGN_INS_PER_MINUTE ??
      productionLimits.signInsPerMinute,
  };
}

// The settings sign-in needs, which the account commands read too.
export function loadAuthConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AuthConfig {
  const settings = parseSettings(authEnvironmentSchema, environment);
  // The path comes from the operator's configuration, not from users of the application.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const secret = readFileSync(settings.FATHOM_AUTH_SECRET_FILE, "utf8").trim();
  if (secret.length < minimumSecretLength) {
    throw new Error(
      `Invalid server configuration: the file FATHOM_AUTH_SECRET_FILE names must hold at least ${String(minimumSecretLength)} characters`,
    );
  }
  return { publicUrl: new URL(settings.FATHOM_PUBLIC_URL).origin, secret };
}

// The certificate, private key, and session secret come from files, such as container secrets, so
// they never appear in the environment or in process listings. Invalid settings are named without
// their values.
export function loadServerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  const settings = parseSettings(environmentSchema, environment);
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
    auth: loadAuthConfig(environment),
    proxyHost: settings.FATHOM_PROXY_HOST,
    tls: {
      // The paths come from the operator's configuration, not from users of the application.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      cert: readFileSync(settings.FATHOM_TLS_CERT_FILE, "utf8"),
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      key: readFileSync(settings.FATHOM_TLS_KEY_FILE, "utf8"),
    },
    webRoot,
    limits: loadLimits(environment, settings),
    database: loadDatabaseConfig(environment),
  };
}
