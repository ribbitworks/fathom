// SPDX-License-Identifier: Apache-2.0

// UI tests of a proposal's Features in its details: a new feature added from New feature, linked
// to the proposal, with focus back on the button, and one Undo taking back both.

import { expect, type Locator, type Page, test } from "@playwright/test";
import { signedInAs } from "./test-accounts.ts";

test.use({ storageState: signedInAs("productManager") });

// The names of the plan's features, as the server holds them.
async function featureNames(page: Page) {
  return page.evaluate(async () => {
    const plan = (await (await fetch("/api/projects")).json()) as {
      features: { name: string }[];
    };
    return plan.features.map(({ name }) => name);
  });
}

// Adds a feature by name from the details' New feature, and waits for its form to close.
async function addFeature(page: Page, details: Locator, name: string) {
  await details.getByRole("button", { name: "New feature" }).click();
  const form = page.getByRole("region", { name: "New feature" });
  await form.getByRole("textbox", { name: "Name" }).fill(name);
  await form.getByRole("button", { name: "Add" }).click();
  await expect(form).toHaveCount(0);
}

// Opens Harbour Cranes Upgrade's details on Projects' Proposals.
async function harbourCranes(page: Page) {
  await page.goto("/projects?tab=proposals");
  const id = await page.evaluate(async () => {
    const plan = (await (await fetch("/api/projects")).json()) as {
      proposals: { id: string; name: string }[];
    };
    return plan.proposals.find(({ name }) => name === "Harbour Cranes Upgrade")
      ?.id;
  });
  await page.goto(`/projects?tab=proposals&open=${String(id)}`);
  return page.getByRole("region", { name: /Harbour Cranes Upgrade/ });
}

test("adds a new feature from a proposal's Features, linked to it, with focus back on New feature", async ({
  page,
}) => {
  // Given Harbour Cranes Upgrade's details
  const details = await harbourCranes(page);
  const add = details.getByRole("button", { name: "New feature" });

  // When New feature is chosen, a name typed, and Add chosen
  await add.click();
  const form = page.getByRole("region", { name: "New feature" });
  await expect(form.getByRole("textbox", { name: "Name" })).toBeFocused();
  await form
    .getByRole("textbox", { name: "Name" })
    .fill("Fictional Quay Lights");
  await form.getByRole("button", { name: "Add" }).click();

  // Then the form closes, the proposal's Features names the feature, and focus is back on the button
  await expect(form).toHaveCount(0);
  // It is named in Features, then in the scope history under it.
  await expect(
    details.getByRole("button", { name: "Fictional Quay Lights" }).first(),
  ).toBeVisible();
  await expect(add).toBeFocused();
});

test("takes back a feature added from a proposal, and its link, with one Undo", async ({
  page,
}) => {
  // Given a feature added from Harbour Cranes Upgrade's New feature
  const details = await harbourCranes(page);
  await addFeature(page, details, "Fictional Pier Lamps");
  // Undo is offered once the add and its link have saved and the plan has reloaded.
  await page.waitForLoadState("networkidle");
  const named = details.getByRole("button", { name: "Fictional Pier Lamps" });
  await expect(named.first()).toBeVisible();

  // When Undo is pressed once
  await page.keyboard.press("ControlOrMeta+z");

  // Then the proposal no longer names it, and the server holds no such feature
  await expect(named).toHaveCount(0);
  await expect
    .poll(() => featureNames(page))
    .not.toContain("Fictional Pier Lamps");
});
