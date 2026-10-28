import { readFileSync } from "node:fs";
import { z } from "zod";

const environmentSchema = z.object({
  FATHOM_DB_HOST: z.string().min(1),
  FATHOM_DB_PORT: z.coerce.number().int().min(1).max(65535),
  FATHOM_DB_NAME: z.string().min(1),
  FATHOM_DB_USER: z.string().min(1),
  FATHOM_DB_PASSWORD_FILE: z.string().min(1),
});

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

// Reads connection settings from the environment. The password comes from a file, such as a
// container secret, so it never appears in the environment or in process listings.
export function loadDatabaseConfig(
  environment: NodeJS.ProcessEnv = process.env,
): DatabaseConfig {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    const fields = result.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(`Invalid database configuration: ${fields}`);
  }
  const settings = result.data;
  // The path comes from the operator's configuration, not from users of the application.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const password = readFileSync(
    settings.FATHOM_DB_PASSWORD_FILE,
    "utf8",
  ).trim();
  if (!password)
    throw new Error(
      "Invalid database configuration: the password file is empty",
    );
  return {
    host: settings.FATHOM_DB_HOST,
    port: settings.FATHOM_DB_PORT,
    database: settings.FATHOM_DB_NAME,
    user: settings.FATHOM_DB_USER,
    password,
  };
}
