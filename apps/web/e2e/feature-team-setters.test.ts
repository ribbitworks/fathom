// SPDX-License-Identifier: Apache-2.0

// UI tests of who sets a feature's Feature team: those who edit feature teams, such as the Feature
// Lead, and not those who edit features alone, such as the Product Manager.

import { expect, type Page, test } from "@playwright/test";
import { signedInAs } from "./test-accounts.ts";

const firstTeamCell = (page: Page) =>
  page.locator('[role=grid] tbody td[id$="-featureTeamId"]').first();

const newFeature = async (page: Page) => {
  await page.getByRole("button", { name: "New feature" }).click();
  return page.getByRole("region", { name: "New feature" });
};

test.describe("as the Product Manager", () => {
  test.use({ storageState: signedInAs("productManager") });

  test("shows a feature's Feature team read only, and leaves it out of New feature", async ({
    page,
  }) => {
    // Given the Product Manager on Features
    await page.goto("/features");

    // Then each feature's Feature team is read only
    await expect(firstTeamCell(page)).toHaveAttribute("aria-readonly", "true");

    // And New feature doesn't offer it
    const panel = await newFeature(page);
    await expect(panel.getByRole("textbox", { name: "Name" })).toBeVisible();
    await expect(panel.getByText("Feature team", { exact: true })).toHaveCount(
      0,
    );
  });
});

test.describe("as the Feature Lead", () => {
  test.use({ storageState: signedInAs("featureLead") });

  test("lets a feature's Feature team be changed, and offers it in New feature", async ({
    page,
  }) => {
    // Given the Feature Lead on Features
    await page.goto("/features");

    // Then each feature's Feature team can be changed
    await expect(firstTeamCell(page)).not.toHaveAttribute("aria-readonly");

    // And New feature offers it
    const panel = await newFeature(page);
    await expect(
      panel.getByText("Feature team", { exact: true }),
    ).toBeVisible();
  });
});
