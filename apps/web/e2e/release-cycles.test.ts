// SPDX-License-Identifier: Apache-2.0

// UI tests of New release's cycles: a release of one cycle, its first cycle chosen again as its last.

import { expect, test } from "@playwright/test";
import { signedInAs } from "./test-accounts.ts";

test.use({ storageState: signedInAs("productManager") });

test("takes a release's first cycle again as its last, for a release of one cycle", async ({
  page,
}) => {
  // Given New release on Field Apps, a free cycle chosen as its First cycle
  await page.goto("/releases");
  await page.getByRole("button", { name: "New release" }).click();
  const dialog = page.getByRole("dialog", { name: "New release" });
  await dialog.getByRole("combobox", { name: "Schedule" }).click();
  await page.getByRole("option", { name: "Field Apps" }).click();
  await dialog.getByRole("combobox", { name: "First cycle" }).click();
  const firstCycles = page.getByRole("listbox", { name: "First cycle" });
  await expect(firstCycles).toBeVisible();
  const cycle = firstCycles.getByRole("option").first();
  const named = await cycle.textContent();
  const cycleName = named?.split(" ")[0];
  if (named === null || cycleName === undefined) {
    throw new Error("First cycle offers no cycle");
  }
  await cycle.click();

  // When the same cycle is chosen as its Last cycle
  const last = dialog.getByRole("combobox", { name: "Last cycle" });
  await last.click();
  await page.getByRole("option", { name: named, exact: true }).click();

  // Then Last cycle keeps it, and Ships on offers that cycle's last day
  await expect(last).toHaveValue(named);
  const shipsOn = dialog.getByRole("textbox", { name: "Ships on" });
  await expect
    .poll(() => shipsOn.getAttribute("placeholder"))
    .toContain(`(end of ${cycleName})`);
  await dialog.getByRole("button", { name: "Cancel" }).click();
});
