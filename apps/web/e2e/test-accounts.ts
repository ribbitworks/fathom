// SPDX-License-Identifier: Apache-2.0

// Signing in to the development server as one of the development accounts, which share the password
// in the file 'pnpm test:ui' names.

import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

function developmentPassword(): string {
  const file = process.env.FATHOM_UI_PASSWORD_FILE;
  if (file === undefined || file === "")
    throw new Error("Run the UI tests with 'pnpm test:ui'");
  // The path comes from 'pnpm test:ui', not from users of the application.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return readFileSync(file, "utf8").trim();
}

export async function signIn(page: Page, path: string, email: string) {
  await page.goto(path);
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(developmentPassword());
  await page.getByRole("button", { name: "Sign in" }).click();
}
