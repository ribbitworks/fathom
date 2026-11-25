// SPDX-License-Identifier: Apache-2.0

// UI tests of the option the keyboard is on in a drop-down list, which Enter would pick: it stands
// out from the list in light and dark mode alike.

import { expect, type Page, test } from "@playwright/test";
import { signedInAs } from "./test-accounts.ts";

test.use({ storageState: signedInAs("engineeringOperationsManager") });

// How far the option the keyboard is on stands out from the list behind it: the mean difference of
// their red, green and blue, from 0 to 255.
const standOutFromList = (page: Page) =>
  page.evaluate<number>(`(() => {
    const channels = (colour) => colour.match(/\\d+/g).slice(0, 3).map(Number);
    const option = document.querySelector("[data-combobox-selected]");
    let behind = option?.parentElement ?? null;
    while (behind !== null && getComputedStyle(behind).backgroundColor === "rgba(0, 0, 0, 0)")
      behind = behind.parentElement;
    if (option === null || behind === null) throw new Error("No option the keyboard is on, or no list behind it");
    const mine = channels(getComputedStyle(option).backgroundColor);
    const list = channels(getComputedStyle(behind).backgroundColor);
    return mine.reduce((sum, value, index) => sum + Math.abs(value - list[index]), 0) / 3;
  })()`);

// The least an option must stand out to read clearly: a little under light mode's, about 19.
const minimumStandOut = 15;

for (const colorScheme of ["light", "dark"] as const) {
  test(`marks the keyboard's option clearly apart from its list, in ${colorScheme} mode`, async ({
    page,
  }) => {
    // Given People in this mode, with a Manager cell's list open
    await page.emulateMedia({ colorScheme });
    await page.goto("/people");
    await page
      .getByRole("textbox", { name: "Search people" })
      .fill("Samuel Richter");
    const managerCell = page.locator('[id^="cell-"][id$="-managerId"]').first();
    await expect(managerCell).toContainText("Atmananda Ganaka");
    await managerCell.click();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("option").first()).toBeVisible();

    // When the keyboard moves onto an option
    await page.keyboard.press("ArrowDown");

    // Then that option stands out clearly from the list
    await expect(page.locator("[data-combobox-selected]")).toHaveCount(1);
    expect(await standOutFromList(page)).toBeGreaterThanOrEqual(
      minimumStandOut,
    );
  });
}
