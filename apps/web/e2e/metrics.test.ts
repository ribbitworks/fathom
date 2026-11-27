// SPDX-License-Identifier: Apache-2.0

// UI tests of the Metrics panel on Features: choosing to add nothing up is a change to the view, the
// Save view dialog names it, and the panel's table scrolls within it rather than the page.

import type { Page } from "@playwright/test";
import { expect, test } from "./test-fixtures.ts";
import { signedInAs } from "./test-accounts.ts";

test.use({ storageState: signedInAs("productManager") });

const narrowWidth = 820;
const screenHeight = 900;

async function openMetrics(page: Page) {
  await page.goto("/features");
  await page.getByRole("button", { name: "Metrics", exact: true }).click();
}

// Measure shows only once Break down by has a column.
async function breakDownByStatus(page: Page) {
  await pick(page, "Break down by", "Status");
}

async function pick(page: Page, label: string, option: string | RegExp) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option }).first().click();
}

test("counts Measure set to Nothing as a change, which Clear view takes back to Effort", async ({
  page,
}) => {
  // Given the Product Manager on Features, with the Metrics panel broken down by Status
  await openMetrics(page);
  await breakDownByStatus(page);
  const measure = page.getByRole("combobox", { name: "Measure", exact: true });
  await expect(measure).toHaveValue("Effort (h)");

  // When Measure is set to Nothing
  await pick(page, "Measure", "Nothing");

  // Then Views shows a change, and Clear view brings Effort back
  const views = page.getByRole("button", { name: /^Views.*, changed$/u });
  await expect(views).toBeVisible();
  await views.click();
  await page.getByRole("menuitem", { name: "Clear view" }).click();
  await expect(
    page.getByRole("button", { name: "Views", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Metrics" })).toBeHidden();
  await page.getByRole("button", { name: "Metrics", exact: true }).click();
  await breakDownByStatus(page);
  await expect(measure).toHaveValue("Effort (h)");
});

test("names Measure set to Nothing among what Save view includes", async ({
  page,
}) => {
  // Given the Product Manager on Features, broken down by Status, with Measure set to Nothing
  await openMetrics(page);
  await breakDownByStatus(page);
  await pick(page, "Measure", "Nothing");

  // When Save view is opened
  await page.getByRole("button", { name: /^Views.*, changed$/u }).click();
  await page.getByRole("menuitem", { name: "Save view…" }).click();

  // Then its Includes names Measure Nothing
  const dialog = page.getByRole("dialog", { name: "Save view" });
  await expect(
    dialog.getByRole("term").filter({ hasText: "Measure" }),
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
  await breakDownByStatus(page);
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
