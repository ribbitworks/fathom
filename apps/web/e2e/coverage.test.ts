// SPDX-License-Identifier: Apache-2.0

// UI tests of Capacity's Coverage tab: each work with its effort, hours allocated and what is left,
// and each month's hours allocated of those needed.

import { expect, test } from "@playwright/test";
import { signIn } from "./test-accounts.ts";

test("shows each work's effort, allocated hours and months as allocated of needed", async ({
  page,
}) => {
  // Given the Engineering Manager on Capacity
  await signIn(page, "/capacity", "engineering.manager@fathom.test");

  // When Coverage is opened
  await page.getByRole("tab", { name: "Coverage" }).click();

  // Then the table names the work, its effort, allocated and remaining hours, and a month reads
  // allocated of needed
  const table = page.getByRole("tabpanel", { name: "Coverage" });
  for (const heading of ["Work", "Effort", "Allocated", "Remaining"]) {
    await expect(
      table.getByRole("columnheader", { name: `${heading} column` }),
    ).toBeVisible();
  }
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
