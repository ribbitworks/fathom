// SPDX-License-Identifier: Apache-2.0

// UI tests of the shared timeline: its row labels drawn at the size of the table's text.

import { expect, test } from "@playwright/test";
import { signIn } from "./test-accounts.ts";

test("draws a timeline's row names at the table's text size", async ({
  page,
}) => {
  // Given the Engineering Director on Releases' Schedules tab, its timeline above the table
  await signIn(page, "/releases", "engineering.director@fathom.test");
  await page.getByRole("tab", { name: "Schedules" }).click();
  const name = page
    .getByRole("listitem")
    .getByRole("button", { name: "Platform", exact: true });
  await expect(name).toBeVisible();
  await expect(
    page
      .getByRole("grid", { name: "Schedules" })
      .getByRole("gridcell")
      .filter({ hasText: /^Field Apps$/ }),
  ).toBeVisible();

  // Then a row's name, which opens its schedule, is the size of the table's text
  // The UI tests compile without the browser's types, so the cell's size is read by an expression.
  const tableSize = String(
    await page.evaluate(
      `getComputedStyle([...document.querySelectorAll('[role=grid][aria-label=Schedules] [role=gridcell]')].find((cell) => cell.textContent.trim() === "Field Apps")).fontSize`,
    ),
  );
  await expect(name).toHaveCSS("font-size", tableSize);
});
