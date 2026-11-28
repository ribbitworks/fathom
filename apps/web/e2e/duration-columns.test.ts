// SPDX-License-Identifier: Apache-2.0

// UI tests of a Duration column on People: added through New column with the unit a bare number
// takes; then part of a unit refused under the row with the editor kept open, a bare number saved in
// the column's unit, and every length shown in weeks once Show in chooses them.

import { expect, test } from "./test-fixtures.ts";
import { signedInAs } from "./test-accounts.ts";
import { send } from "./test-requests.ts";

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

test("adds a Duration column in working days, refuses part of a unit, keeps a bare number, then shows weeks", async ({
  page,
}) => {
  // Given the Engineering Operations Manager on People
  await page.goto("/people");
  await expect(page.getByRole("grid", { name: "People" })).toBeVisible();
  const name = `Fictional Notice ${String(Date.now())}`;

  // When a Duration column in working days is added through New column
  await page.getByRole("button", { name: "New column" }).click();
  const dialog = page.getByRole("dialog", { name: "New column" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Type").click();
  await page.getByRole("option", { name: "Duration", exact: true }).click();
  await dialog.getByLabel("Unit").click();
  await page.getByRole("option", { name: "Working days", exact: true }).click();
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/people/columns"),
  );
  await dialog.getByRole("button", { name: "Add column" }).click();
  const { field } = (await (await saved).json()) as {
    field: { id: string; type: string; unit: string };
  };
  made.fieldId = field.id;
  expect([field.type, field.unit]).toEqual(["duration", "wd"]);
  await expect(dialog).toHaveCount(0);

  // And part of a unit is typed in a person's cell
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
  await page.keyboard.type("1.5 mo");
  await page.keyboard.press("Enter");

  // Then it is refused under the row, its editor kept open with what was typed
  await expect(
    page.getByText(`Type a whole number for ${name}, such as 2 wk`),
  ).toBeVisible();
  const editor = page.getByRole("textbox", { name });
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue("1.5 mo");

  // And a bare number, typed in its place, is kept in working days
  await editor.fill("10");
  await page.keyboard.press("Enter");
  await expect(cell).toHaveText("10 wd");

  // And once Show in chooses weeks, the length shows in weeks
  await page.getByRole("button", { name: `${name} column` }).click();
  await page.getByRole("menuitem", { name: "Weeks" }).click();
  await expect(cell).toHaveText("2 wk");
});

test("refuses a Duration column with no unit, sending nothing it can't keep", async ({
  page,
}) => {
  await page.goto("/people");
  const refused = await send(page, "POST", "/api/people/columns", {
    name: `Fictional Notice ${String(Date.now())}`,
    type: "duration",
    visibility: "general",
  });
  expect(refused.ok).toBe(false);
});
