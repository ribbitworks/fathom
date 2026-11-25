// SPDX-License-Identifier: Apache-2.0

// UI tests of the Manager picker on People: each manager offered is described under their name, so
// two with the same name are told apart.

import { expect, test } from "@playwright/test";
import { signedInAs } from "./test-accounts.ts";

test.use({ storageState: signedInAs("engineeringOperationsManager") });

test("describes each manager in a Manager cell's picker by position, then whom they report to or their team, under the name", async ({
  page,
}) => {
  // Given the Engineering Operations Manager on People, with one person found
  await page.goto("/people");
  const changes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("/api/"))
      changes.push(`${request.method()} ${request.url()}`);
  });
  await page
    .getByRole("textbox", { name: "Search people" })
    .fill("Samuel Richter");
  const managerCell = page.locator('[id^="cell-"][id$="-managerId"]').first();
  await expect(managerCell).toContainText("Atmananda Ganaka");

  // When the person's Manager cell is opened
  await managerCell.click();
  await page.keyboard.press("Enter");

  // Then every manager offered has a description under their name, such as Max Munk's position and
  // whom he reports to
  const options = page.getByRole("option");
  await expect(options.first()).toHaveText("No manager");
  const managers = options.filter({ hasNot: page.getByText("No manager") });
  expect(await managers.count()).toBeGreaterThan(1);
  for (const option of await managers.all()) {
    await expect(option.locator("p")).toHaveText(/\S/);
  }
  await page.keyboard.type("Max");
  await expect(page.getByRole("option", { name: /^Max Munk/ })).toHaveText(
    "Max MunkEngineering Manager, reports to Mateo Quintero Reynoso",
  );

  // And Esc leaves the manager as it was, with nothing sent to be saved
  await page.keyboard.press("Escape");
  await expect(managerCell).toContainText("Atmananda Ganaka");
  expect(changes).toEqual([]);
});
