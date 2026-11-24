// SPDX-License-Identifier: Apache-2.0

// UI tests of the strip above a timeline in a narrow window: a rail whose periods each show their
// whole name, scrolling sideways to keep the periods in view tinted, by Today, the arrows and the
// keys.

import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./test-accounts.ts";

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

const layout = () =>
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

// One page in a narrow window, signed in once for the file, since signing in again for each test
// meets the limit on sign-in attempts.
test.describe.configure({ mode: "serial" });
let page: Page;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 760, height: 800 } });
  await signIn(page, "/releases", "engineering.director@fathom.test");
  await page.getByRole("tab", { name: "Schedules" }).waitFor();
});
test.afterAll(async () => {
  await page.close();
});

// Releases' Schedules tab afresh, at its first zoom, its strip of quarters.
async function narrowSchedules() {
  await page.goto("/releases");
  await page.getByRole("tab", { name: "Schedules" }).click();
  const strip = page.getByRole("toolbar", { name: "Quarters" });
  await expect(strip).toBeVisible();
  return strip;
}

test("a narrow strip is a rail showing every name whole, starting from the first quarter in view", async () => {
  // Given Releases' Schedules tab in a window too narrow for every quarter's name, at Year, its
  // quarters in view too many to fit
  await narrowSchedules();

  // Then the strip scrolls sideways, no name is cut, and it starts from the first quarter in view
  const opened = await layout();
  expect(opened.scrolls).toBe(true);
  expect(opened.nameCut).toBe(false);
  expect(opened.firstTintedAtStart).toBe(true);
});

test("a narrow strip keeps the quarters in view shown as the view moves", async () => {
  // Given the narrow strip zoomed in, its quarters in view few enough to fit
  await narrowSchedules();
  for (let step = 0; step < 4; step += 1) {
    await page.getByRole("button", { name: "Zoom in" }).click();
  }
  const zoomed = await layout();
  expect(zoomed.tinted).toBeGreaterThan(0);
  expect(zoomed.tintedShown).toBe(true);

  // When the reader goes back a quarter at a time
  for (let step = 0; step < 6; step += 1) {
    await page.getByRole("button", { name: "Previous quarter" }).click();
  }

  // Then the quarters in view still show, and again after Today
  const back = await layout();
  expect([back.tinted > 0, back.tintedShown]).toEqual([true, true]);
  await page.getByRole("button", { name: "Today" }).click();
  const today = await layout();
  expect([today.tinted > 0, today.tintedShown]).toEqual([true, true]);
});

test("the keys move along a narrow strip, keeping the quarter focused in view", async () => {
  // Given the narrow strip, its first quarter in view focused
  const strip = await narrowSchedules();
  await strip.locator("button[tabindex='0']").focus();

  // When End, then Home, are pressed
  await page.keyboard.press("End");
  const atEnd = await layout();
  await page.keyboard.press("Home");

  // Then the last quarter, then the first, is focused and shows
  const atHome = await layout();
  expect([atEnd.focused, atEnd.focusedShown]).toEqual([atEnd.last, true]);
  expect([atHome.focused, atHome.focusedShown]).toEqual([0, true]);
});
