// SPDX-License-Identifier: Apache-2.0

// UI tests of the strip above a timeline in a narrow window: a rail whose periods each show their
// whole name, scrolling sideways to keep the periods in view tinted, by Today, the arrows and the
// keys.

import { expect, type Page, test } from "@playwright/test";
import { signedInAs } from "./test-accounts.ts";

test.use({
  storageState: signedInAs("engineeringDirector"),
  viewport: { width: 760, height: 800 },
});

// Where a rail's periods are, by the browser's own layout, read as numbers: the UI tests compile
// without the browser's types.
interface Layout {
  scrolls: boolean;
  nameCut: boolean;
  tinted: number;
  tintedShown: boolean;
  firstTintedAtStart: boolean;
  focused: number;
  last: number;
  focusedShown: boolean;
}

const layout = (page: Page) =>
  page.evaluate<Layout>(`(() => {
    const strip = document.querySelector('[role="toolbar"][aria-label="Quarters"]');
    const box = strip.getBoundingClientRect();
    const periods = [...strip.querySelectorAll("button")];
    const shown = (period) => {
      const at = period.getBoundingClientRect();
      return at.left >= box.left - 1 && at.right <= box.right + 1;
    };
    return {
      scrolls: strip.scrollWidth > strip.clientWidth,
      nameCut: periods.some((period) => period.scrollWidth > period.clientWidth),
      tinted: periods.filter((period) => period.dataset.inView).length,
      tintedShown: periods.filter((period) => period.dataset.inView).every(shown),
      firstTintedAtStart: Math.abs(
        periods.find((period) => period.dataset.inView).getBoundingClientRect().left - box.left,
      ) <= 2,
      focused: periods.indexOf(document.activeElement),
      last: periods.length - 1,
      focusedShown: periods.filter((period) => period === document.activeElement).every(shown),
    };
  })()`);

// Releases' Schedules tab afresh, at its first zoom, its strip of quarters. Opened by its address
// and found in its own panel, since Releases reopens on the tab last shown, whose strip of quarters
// would otherwise be found, then replaced, as Schedules opened.
async function narrowSchedules(page: Page) {
  await page.goto("/releases?tab=schedules");
  const strip = page
    .getByRole("tabpanel", { name: "Schedules" })
    .getByRole("toolbar", { name: "Quarters" });
  await expect(strip).toBeVisible();
  return strip;
}

test("a narrow strip is a rail showing every name whole, starting from the first quarter in view", async ({
  page,
}) => {
  // Given Releases' Schedules tab in a window too narrow for every quarter's name, at Year, its
  // quarters in view too many to fit
  await narrowSchedules(page);

  // Then the strip scrolls sideways, no name is cut, and it starts from the first quarter in view
  const opened = await layout(page);
  expect(opened.scrolls).toBe(true);
  expect(opened.nameCut).toBe(false);
  expect(opened.firstTintedAtStart).toBe(true);
});

test("a narrow strip keeps the quarters in view shown as the view moves", async ({
  page,
}) => {
  // Given the narrow strip zoomed in, its quarters in view few enough to fit
  await narrowSchedules(page);
  for (let step = 0; step < 4; step += 1) {
    await page.getByRole("button", { name: "Zoom in" }).click();
  }
  const zoomed = await layout(page);
  expect(zoomed.tinted).toBeGreaterThan(0);
  expect(zoomed.tintedShown).toBe(true);

  // When the reader goes back a quarter at a time
  for (let step = 0; step < 6; step += 1) {
    await page.getByRole("button", { name: "Previous quarter" }).click();
  }

  // Then the quarters in view still show, and again after Today
  const back = await layout(page);
  expect([back.tinted > 0, back.tintedShown]).toEqual([true, true]);
  await page.getByRole("button", { name: "Today" }).click();
  const today = await layout(page);
  expect([today.tinted > 0, today.tintedShown]).toEqual([true, true]);
});

test("the keys move along a narrow strip, keeping the quarter focused in view", async ({
  page,
}) => {
  // Given the narrow strip, its first quarter in view focused
  const strip = await narrowSchedules(page);
  await strip.locator("button[tabindex='0']").focus();

  // When End, then Home, are pressed
  await page.keyboard.press("End");
  const atEnd = await layout(page);
  await page.keyboard.press("Home");

  // Then the last quarter, then the first, is focused and shows
  const atHome = await layout(page);
  expect([atEnd.focused, atEnd.focusedShown]).toEqual([atEnd.last, true]);
  expect([atHome.focused, atHome.focusedShown]).toEqual([0, true]);
});
