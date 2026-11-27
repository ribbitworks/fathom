// SPDX-License-Identifier: Apache-2.0

// UI tests of typing a day: a digit corrected in the middle leaves the others, and the cursor, in
// place, in a table's cell and in a form's box, a digit more than a day holds is ignored, and a day
// typed faster than the cell's editor takes focus is still checked on Enter.

import { expect, type Locator, type Page, test } from "@playwright/test";
import { signedInAs } from "./test-accounts.ts";

// The page's own key event, which the UI tests' types, made for Node, don't name.
declare const KeyboardEvent: new (
  type: string,
  init: { key: string; bubbles: boolean; cancelable: boolean },
) => unknown;

test.use({ storageState: signedInAs("engineeringOperationsManager") });

const deleteTheYearsLastDigitThenType7 = async (page: Page, box: Locator) => {
  await page.keyboard.type("20261108");
  await expect(box).toHaveValue("2026-11-08");
  await page.keyboard.press("Home");
  for (let digit = 0; digit < "2026".length; digit += 1)
    await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Backspace");
  await expect(box).toHaveValue("202-11-08");
  await expect(box).toHaveJSProperty("selectionStart", "202".length);
  await page.keyboard.type("7");
  await expect(box).toHaveValue("2027-11-08");
  await expect(box).toHaveJSProperty("selectionStart", "2027".length);
};

test("corrects a digit in the middle of a person's Start, leaving the others in place", async ({
  page,
}) => {
  // Given the Engineering Operations Manager on People, editing a person's Start
  await page.goto("/people");
  const cell = page.locator("[role=gridcell][id$='-startDate']").first();
  await cell.click();
  const before = await cell.innerText();
  const changes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("/api/"))
      changes.push(`${request.method()} ${request.url()}`);
  });
  await page.keyboard.press("Enter");
  const editor = page.getByRole("textbox", { name: "Start" });
  await expect(editor).toBeFocused();
  await page.keyboard.press("ControlOrMeta+a");

  // When a date is typed, its year's last digit deleted and another typed in its place
  // Then the other digits, and the cursor, stay where they were
  await deleteTheYearsLastDigitThenType7(page, editor);

  // And Esc leaves the person's Start as it was, saving nothing
  await page.keyboard.press("Escape");
  await expect(editor).toBeHidden();
  await expect(cell).toHaveText(before);
  expect(changes).toEqual([]);
});

test("ignores a digit typed in the middle of a person's whole Start", async ({
  page,
}) => {
  // Given the Engineering Operations Manager on People, editing a person's Start
  await page.goto("/people");
  const cell = page.locator("[role=gridcell][id$='-startDate']").first();
  await cell.click();
  await page.keyboard.press("Enter");
  const editor = page.getByRole("textbox", { name: "Start" });
  await expect(editor).toBeFocused();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("20261108");

  // When a 0 is typed after 2026-1
  await page.keyboard.press("Home");
  for (let digit = 0; digit < "2026-1".length; digit += 1)
    await page.keyboard.press("ArrowRight");
  await page.keyboard.type("0");

  // Then the date and the cursor stay as they were
  await expect(editor).toHaveValue("2026-11-08");
  await expect(editor).toHaveJSProperty("selectionStart", "2026-1".length);
  await page.keyboard.press("Escape");
});

test("corrects a digit in the middle of a filter's From, leaving the others in place", async ({
  page,
}) => {
  // Given the Engineering Operations Manager on People, filtering Start
  await page.goto("/people");
  await page
    .getByRole("button", { name: /^Start column/ })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Filter…" }).click();
  const from = page.getByRole("textbox", { name: "From" });
  await expect(from).toBeFocused();

  // When a date is typed, its year's last digit deleted and another typed in its place
  // Then the other digits, and the cursor, stay where they were
  await deleteTheYearsLastDigitThenType7(page, from);
});

test("refuses an impossible day typed with Enter before the cell's editor has focus", async ({
  page,
}) => {
  // Given the Engineering Operations Manager on People, on a person's Start
  await page.goto("/people");
  const cell = page.locator("[role=gridcell][id$='-startDate']").first();
  await cell.click();
  const changes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("/api/"))
      changes.push(`${request.method()} ${request.url()}`);
  });

  // When a day that doesn't exist and Enter reach the cell at once, as when typed fast
  // React draws each key's change in a microtask, while the editor takes focus only after a timer.
  await cell.evaluate(
    async (
      target: { dispatchEvent: (event: unknown) => boolean },
      keys: string[],
    ) => {
      for (const key of keys) {
        target.dispatchEvent(
          new KeyboardEvent("keydown", {
            key,
            bubbles: true,
            cancelable: true,
          }),
        );
        await new Promise<void>((drawn) => {
          queueMicrotask(drawn);
        });
      }
    },
    ["2", "0", "2", "6", "0", "2", "3", "0", "Enter"],
  );

  // Then the day is refused, and nothing is saved
  await expect(page.getByRole("alert")).toContainText("Start");
  expect(changes).toEqual([]);
  await page.keyboard.press("Escape");
});
