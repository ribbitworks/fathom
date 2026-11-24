// SPDX-License-Identifier: Apache-2.0

// UI tests of the Metrics panel on Features: choosing to add nothing up is a change to the view, the
// Save view dialog names it, and the panel's table scrolls within it rather than the page.

import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./test-accounts.ts";

const narrowWidth = 820;
const screenHeight = 900;

async function openMetrics(page: Page) {
  await signIn(page, "/features", "product.manager@fathom.test");
  await page.getByRole("button", { name: "Metrics", exact: true }).click();
}

async function pick(page: Page, label: string, option: string | RegExp) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option }).first().click();
}

test("counts Sum of Nothing as a change, which Clear view takes back to Effort", async ({
  page,
}) => {
  // Given the Product Manager on Features, with the Metrics panel open and nothing broken down
  await openMetrics(page);
  const sumOf = page.getByRole("combobox", { name: "Sum of", exact: true });
  await expect(sumOf).toHaveValue("Effort");

  // When Sum of is set to Nothing
  await pick(page, "Sum of", "Nothing");

  // Then Views shows a change, and Clear view brings Effort back
  const views = page.getByRole("button", { name: /^Views.*, changed$/u });
  await expect(views).toBeVisible();
  await views.click();
  await page.getByRole("menuitem", { name: "Clear view" }).click();
  await expect(page.getByRole("button", { name: "Views" })).toBeVisible();
  await page.getByRole("button", { name: "Metrics", exact: true }).click();
  await expect(sumOf).toHaveValue("Effort");
});

test("names Sum of Nothing among what Save view includes", async ({ page }) => {
  // Given the Product Manager on Features, with Sum of set to Nothing
  await openMetrics(page);
  await pick(page, "Sum of", "Nothing");

  // When Save view is opened
  await page.getByRole("button", { name: /^Views.*, changed$/u }).click();
  await page.getByRole("menuitem", { name: "Save view…" }).click();

  // Then its Includes names Sum of Nothing
  const dialog = page.getByRole("dialog", { name: "Save view" });
  await expect(
    dialog.getByRole("term").filter({ hasText: "Sum of" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("definition").filter({ hasText: "Nothing" }),
  ).toBeVisible();
});

test("keeps the page from scrolling sideways when the panel's table is wider than the panel", async ({
  page,
}) => {
  // Given a narrow window, with the Metrics panel open on Features
  await page.setViewportSize({ width: narrowWidth, height: screenHeight });
  await openMetrics(page);

  // When the metrics break down by Status, giving a table wider than the panel
  await pick(page, "Break down by", "Status");
  const panel = page.getByRole("region", { name: "Metrics" });
  const figures = panel.getByRole("table");
  await expect(figures).toBeVisible();
  const tableWidth = (await figures.boundingBox())?.width ?? 0;
  const panelWidth = (await panel.boundingBox())?.width ?? 0;
  expect(tableWidth).toBeGreaterThan(panelWidth);

  // Then the page itself is no wider than the window
  const overflow = await page.evaluate(
    "document.documentElement.scrollWidth - document.documentElement.clientWidth",
  );
  expect(overflow).toBe(0);
});
