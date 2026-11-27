// SPDX-License-Identifier: Apache-2.0

// UI tests of the Features Board's Columns menu: months of one schedule, whose features alone show,
// kept in a saved view.

import { expect, test } from "./test-fixtures.ts";
import { signedInAs } from "./test-accounts.ts";
import { send } from "./test-requests.ts";

test.use({ storageState: signedInAs("productManager") });

test("shows one schedule's features by months, and a saved view keeps the choice", async ({
  page,
}) => {
  // Given the Product Manager on the Features Board by months of all schedules
  await page.goto("/features");
  await page
    .locator("label")
    .filter({ hasText: /^Board$/ })
    .click();
  const columns = page.getByRole("button", { name: /^Columns: / });
  await expect(columns).toHaveText("Columns: Months");
  await expect(page.getByText("Offline Sync", { exact: true })).toBeVisible();

  // When Field Apps is chosen under Months
  await columns.click();
  await page
    .getByRole("group", { name: "Months" })
    .getByRole("menuitem", { name: "Field Apps" })
    .click();

  // Then only Field Apps' features show, by months still
  await expect(columns).toHaveText("Columns: Months, Field Apps");
  await expect(
    page.getByText("Work Order Sync", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Offline Sync", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("toolbar", { name: "Quarters" })).toBeVisible();

  // When the view is saved, then cleared, then chosen again
  await page.getByRole("button", { name: /^Views/ }).click();
  await page.getByRole("menuitem", { name: "Save view…" }).click();
  const dialog = page.getByRole("dialog", { name: "Save view" });
  await expect(dialog.getByText("Months, Field Apps")).toBeVisible();
  // Saved views outlast the seed data, so each run names its own, in case one is left behind.
  const named = `Fictional Field Apps ${Date.now().toString(36)}`;
  await dialog.getByRole("textbox", { name: "Name" }).fill(named);
  await dialog.getByRole("button", { name: "Save view" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: /^Views/ }).click();
  await page.getByRole("menuitem", { name: "Clear view" }).click();
  await expect(columns).toHaveText("Columns: Months");
  await page.getByRole("button", { name: /^Views/ }).click();
  await page.getByRole("menuitem", { name: named }).click();

  // Then the board shows Field Apps' features by months again
  await expect(columns).toHaveText("Columns: Months, Field Apps");
  await expect(page.getByText("Offline Sync", { exact: true })).toHaveCount(0);

  // The view is taken away again, so runs leave none behind.
  const views = (await send(page, "GET", "/api/views/features")).body as {
    id: string;
    name: string;
  }[];
  const saved = views.find((view) => view.name === named);
  expect(saved).toBeDefined();
  const removed = await send(
    page,
    "DELETE",
    `/api/views/features/${String(saved?.id)}`,
  );
  expect(removed.ok).toBe(true);
});
