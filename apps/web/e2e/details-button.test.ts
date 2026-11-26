// SPDX-License-Identifier: Apache-2.0

// UI tests of a row's details button: it opens the row's details beside the table, and closes them
// again while they are open.

import { expect, test } from "@playwright/test";
import { signedInAs } from "./test-accounts.ts";

// With less motion a closing panel goes at once, rather than sliding away.
test.use({ storageState: signedInAs("featureLead"), reducedMotion: "reduce" });

test("closes a row's open details with its details button", async ({
  page,
}) => {
  // Given a feature's details, opened from its row's details button
  await page.goto("/features");
  const firstRow = page.locator("[role=grid] tbody tr").first();
  await firstRow.hover();
  const details = firstRow.getByRole("button", { name: /^Show details of / });
  await details.click();
  const panel = page.getByRole("region", { name: /./ }).filter({
    has: page.getByRole("button", { name: "Close details" }),
  });
  await expect(panel).toBeVisible();
  await expect(details).toHaveAttribute("aria-expanded", "true");

  // When the same button is selected again
  await firstRow.hover();
  await details.click();

  // Then the details close
  await expect(panel).toHaveCount(0);
  await expect(details).toHaveAttribute("aria-expanded", "false");
});
