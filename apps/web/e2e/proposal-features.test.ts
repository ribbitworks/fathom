// SPDX-License-Identifier: Apache-2.0

// UI tests of a proposal's Features in its details: a new feature added from New feature, linked
// to the proposal, with focus back on the button.

import { expect, type Page, test } from "@playwright/test";
import { signedInAs } from "./test-accounts.ts";

test.use({ storageState: signedInAs("productManager") });

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
