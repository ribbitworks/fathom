// SPDX-License-Identifier: Apache-2.0

// UI tests of Esc in a dropdown inside a side panel: it closes the dropdown alone, as in a dialog,
// and only a later Esc closes the panel.

import { expect, type Locator, type Page, test } from "@playwright/test";
import { signedInAs } from "./test-accounts.ts";

// With less motion a closing panel goes at once, rather than sliding away.
test.use({ storageState: signedInAs("featureLead"), reducedMotion: "reduce" });

// The first feature's details, opened beside Features.
async function firstFeatureDetails(page: Page): Promise<Locator> {
  await page.goto("/features");
  const firstRow = page.locator("[role=grid] tbody tr").first();
  await firstRow.hover();
  await firstRow.getByRole("button", { name: /^Show details of / }).click();
  const panel = page.getByRole("region", { name: /./ }).filter({
    has: page.getByRole("button", { name: "Close details" }),
  });
  await expect(panel).toBeVisible();
  return panel;
}

test("closes a picker in a feature's details with Esc, leaving the details open", async ({
  page,
}) => {
  // Given a feature's details, with its Feature team's choices open
  const panel = await firstFeatureDetails(page);
  const change = panel.getByRole("button", { name: "Change Feature team" });
  await change.click();
  await expect(page.getByRole("listbox")).toBeVisible();

  // When Esc is pressed
  await page.keyboard.press("Escape");

  // Then the choices close, and the details stay, so the choices open from them again
  await expect(page.getByRole("listbox")).toBeHidden();
  await change.click();
  await expect(page.getByRole("listbox")).toBeVisible();
});

test("closes the ⋯ menu in a feature's details with Esc, leaving the details open", async ({
  page,
}) => {
  // Given a feature's details, with its ⋯ menu open
  const panel = await firstFeatureDetails(page);
  const actions = panel.getByRole("button", { name: /^Actions for / });
  await actions.click();
  await expect(page.getByRole("menu")).toBeVisible();

  // When Esc is pressed
  await page.keyboard.press("Escape");

  // Then the menu closes, and the details stay, so the menu opens from them again
  await expect(page.getByRole("menu")).toBeHidden();
  await actions.click();
  await expect(page.getByRole("menu")).toBeVisible();
});

test("closes a select's choices in Metrics with Esc, leaving Metrics open until the next Esc", async ({
  page,
}) => {
  // Given Metrics beside Features, with Break down by's choices open
  await page.goto("/features");
  await page.getByRole("button", { name: "Metrics" }).click();
  const panel = page.getByRole("region", { name: "Metrics" });
  const breakDown = panel.getByRole("combobox", { name: "Break down by" });
  await breakDown.click();
  await expect(page.getByRole("listbox")).toBeVisible();

  // When Esc is pressed
  await page.keyboard.press("Escape");

  // Then the choices close, and Metrics stays, so the choices open from it again
  await expect(page.getByRole("listbox")).toBeHidden();
  await breakDown.click();
  await expect(page.getByRole("listbox")).toBeVisible();

  // And with the choices closed again, the next Esc closes Metrics
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});
