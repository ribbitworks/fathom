// SPDX-License-Identifier: Apache-2.0

// The development accounts the UI tests use, each signed in once a run by accounts.setup.ts, and
// where each one's session is kept for the tests to start from.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export const accounts = [
  { name: "productManager", email: "product.manager@fathom.test" },
  { name: "engineeringDirector", email: "engineering.director@fathom.test" },
] as const;

export type AccountName = (typeof accounts)[number]["name"];

// Kept beside the tests' output, which the repository ignores, rather than in it, since Playwright
// empties its output folder as each run starts.
export const signedInAs = (name: AccountName): string =>
  join(import.meta.dirname, "../../../.tmp/ui-accounts", `${name}.json`);

export function developmentPassword(): string {
  const file = process.env.FATHOM_UI_PASSWORD_FILE;
  if (file === undefined || file === "")
    throw new Error("Run the UI tests with 'pnpm test:ui'");
  // The path comes from 'pnpm test:ui', not from users of the application.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return readFileSync(file, "utf8").trim();
}
