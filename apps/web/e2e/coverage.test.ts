// SPDX-License-Identifier: Apache-2.0

// UI tests of Capacity's Coverage tab: each work with its effort, hours allocated and what is left,
// and each month's hours allocated of those needed.

import { expect, test } from "@playwright/test";
import { signedInAs } from "./test-accounts.ts";

test.use({ storageState: signedInAs("engineeringDirector") });

test("shows each work's effort, what is left, allocated hours and months as allocated of needed", async ({
  page,
}) => {
  // Given the Engineering Director on Capacity
  await page.goto("/capacity");

  // When Coverage is opened
  await page.getByRole("tab", { name: "Coverage" }).click();

  // Then the table names the work, its effort and remaining hours, frozen at the left, then its
  // allocated hours, and a month reads allocated of needed
  const table = page.getByRole("tabpanel", { name: "Coverage" });
  for (const heading of ["Work", "Effort", "Remaining"]) {
    await expect(
      table.getByRole("columnheader", { name: `${heading} column` }),
    ).toBeVisible();
  }
  await expect(
    table.getByRole("columnheader", { name: "Allocated column" }),
  ).toBeAttached();
  await expect(
    table.getByText(/^\d[\d,]* of \d[\d,]* h$/u).first(),
  ).toBeVisible();

  // And a feature's details button opens it on Features
  const feature = "Mobile Approvals";
  await table.getByRole("row", { name: new RegExp(feature, "u") }).hover();
  await page
    .getByRole("button", { name: `Show details of ${feature}` })
    .click();
  await expect(page).toHaveURL(/\/features\?open=/u);
  await expect(page.getByRole("heading", { name: feature })).toBeVisible();
});
