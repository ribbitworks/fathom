// SPDX-License-Identifier: Apache-2.0

// UI tests of a date column on People: added through New column, whose Type list shows every type
// whole, or is held to a short window and scrolls inside it; then a person's day typed in its cell
// as digits, a day that doesn't exist refused under the row with the editor kept open, and a day
// that does saved and shown as the app's other days are.

import { expect, test } from "./test-fixtures.ts";
import { signedInAs } from "./test-accounts.ts";
import { changesSent, send } from "./test-requests.ts";

// The page's own key event, which the UI tests' types, made for Node, don't name.
declare const KeyboardEvent: new (
  type: string,
  init: { key: string; bubbles: boolean; cancelable: boolean },
) => unknown;

test.use({ storageState: signedInAs("engineeringOperationsManager") });

// What a run drafted, discarded so no run leaves a column behind: the person's draft first, since
// it depends on the column's.
const made: { personId?: string; fieldId?: string } = {};

test.afterEach(async ({ page }) => {
  const { personId, fieldId } = made;
  delete made.personId;
  delete made.fieldId;
  for (const path of [
    ...(personId === undefined ? [] : [`/api/people/${personId}/draft`]),
    ...(fieldId === undefined ? [] : [`/api/people/columns/${fieldId}/draft`]),
  ]) {
    const answer = await send(page, "DELETE", path);
    expect
      .soft(answer.ok, `${path}: ${JSON.stringify(answer.body)}`)
      .toBe(true);
  }
});

test("adds a date column, refuses a day that doesn't exist, then keeps a person's day", async ({
  page,
}) => {
  // Given the Engineering Operations Manager on People
  await page.goto("/people");
  await expect(page.getByRole("grid", { name: "People" })).toBeVisible();
  const name = `Fictional Last Review ${String(Date.now())}`;

  // When a date column is added through New column
  await page.getByRole("button", { name: "New column" }).click();
  const dialog = page.getByRole("dialog", { name: "New column" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Type").click();

  // Then the Type list shows every type whole, Note as fully as Text
  const note = page.getByRole("option", { name: "Note", exact: true });
  await expect(note).toBeVisible();
  expect(
    await page.evaluate(`(() => {
      const option = [...document.querySelectorAll("[role=option]")].find((each) => each.textContent.trim() === "Note");
      const frame = option?.closest(".mantine-ScrollArea-viewport")?.getBoundingClientRect();
      return frame !== undefined && option.getBoundingClientRect().bottom <= frame.bottom + 1;
    })()`),
  ).toBe(true);
  await page.getByRole("option", { name: "Date", exact: true }).click();
  await expect(dialog.getByLabel("Required", { exact: true })).toBeVisible();
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/people/columns"),
  );
  await dialog.getByRole("button", { name: "Add column" }).click();
  const { field } = (await (await saved).json()) as {
    field: { id: string; type: string };
  };
  made.fieldId = field.id;
  expect(field.type).toBe("date");
  await expect(dialog).toHaveCount(0);

  // And a day that doesn't exist is typed in a person's cell
  await page
    .getByRole("textbox", { name: "Search people" })
    .fill("Samuel Richter");
  const cell = page
    .getByRole("row", { name: /^Samuel Richter / })
    .locator(`[id^="cell-"][id$="-${field.id}"]`);
  made.personId = String(await cell.getAttribute("id"))
    .replace(/^cell-/u, "")
    .replace(`-${field.id}`, "");
  await cell.focus();
  await page.keyboard.type("20260230");
  await page.keyboard.press("Enter");

  // Then it is refused under the row, its editor kept open with what was typed
  await expect(
    page.getByText(`Type a date for ${name}, such as 2026-10-31`),
  ).toBeVisible();
  const editor = page.getByRole("textbox", { name });
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue("2026-02-30");

  // And a day that exists, typed in its place, is saved and shown as a day
  await editor.fill("2026-03-14");
  await page.keyboard.press("Enter");
  const shown = await page.evaluate(() =>
    new Date(2026, 2, 14).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
  );
  await expect(cell).toContainText(shown);
});

test("refuses a day that doesn't exist typed fast with Enter in a date column's cell", async ({
  page,
}) => {
  // Given a date column on People, and a person's cell in it
  await page.goto("/people");
  await expect(page.getByRole("grid", { name: "People" })).toBeVisible();
  const name = `Fictional Next Review ${String(Date.now())}`;
  const added = await send(page, "POST", "/api/people/columns", {
    name,
    type: "date",
    visibility: "general",
  });
  expect(added.ok, JSON.stringify(added.body)).toBe(true);
  const { field } = added.body as { field: { id: string } };
  made.fieldId = field.id;
  await page.reload();
  await page
    .getByRole("textbox", { name: "Search people" })
    .fill("Samuel Richter");
  const cell = page
    .getByRole("row", { name: /^Samuel Richter / })
    .locator(`[id^="cell-"][id$="-${field.id}"]`);
  await cell.click();
  const changes = changesSent(page);

  // When a day that doesn't exist and Enter reach the cell as fast as the keyboard sends them
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
    ["2", "0", "2", "6", "-", "0", "2", "-", "3", "0", "Enter"],
  );

  // Then the day is refused under the row, its editor kept open with what was typed
  await expect(
    page.getByText(`Type a date for ${name}, such as 2026-10-31`),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name })).toHaveValue("2026-02-30");
  expect(changes).toEqual([]);
  await page.keyboard.press("Escape");
});

test("holds the Type list to a short window, scrolling inside it", async ({
  page,
}) => {
  // Given People in a window too short for the whole Type list
  await page.setViewportSize({ width: 1440, height: 420 });
  await page.goto("/people");
  await expect(page.getByRole("grid", { name: "People" })).toBeVisible();

  // When the New column dialog's Type list is opened
  await page.getByRole("button", { name: "New column" }).click();
  const dialog = page.getByRole("dialog", { name: "New column" });
  await dialog.getByLabel("Type").click();
  await expect(page.getByRole("option", { name: "Text" })).toBeVisible();

  // Then the list keeps its 8 pixels from the window's edges, and scrolls inside itself
  const gap = 8;
  const list = await page.evaluate<{
    top: number;
    bottom: number;
    window: number;
    scrolls: boolean;
  }>(`(() => {
    const option = [...document.querySelectorAll("[role=option]")].find((each) => each.textContent.trim() === "Text");
    const box = option.closest(".mantine-Select-dropdown").getBoundingClientRect();
    const frame = option.closest(".mantine-ScrollArea-viewport");
    return {
      top: box.top,
      bottom: box.bottom,
      window: window.innerHeight,
      scrolls: frame.scrollHeight > frame.clientHeight,
    };
  })()`);
  expect(list.top).toBeGreaterThanOrEqual(gap - 1);
  expect(list.bottom).toBeLessThanOrEqual(list.window - gap + 1);
  expect(list.scrolls).toBe(true);
});
