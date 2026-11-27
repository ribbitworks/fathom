// SPDX-License-Identifier: Apache-2.0

// UI tests of a checkbox column on People: added through New column, which asks nothing about being
// filled in, then a person's box ticked with a click and unticked with Space.

import { expect, test } from "./test-fixtures.ts";
import { signedInAs } from "./test-accounts.ts";
import { send } from "./test-requests.ts";

test.use({ storageState: signedInAs("engineeringOperationsManager") });

// What a run drafted, discarded so no run leaves a column behind: the person's draft first, since
// it depends on the column's. The person's box ends as it started, which may leave them no draft.
const made: { personId?: string; fieldId?: string } = {};

test.afterEach(async ({ page }) => {
  const { personId, fieldId } = made;
  delete made.personId;
  delete made.fieldId;
  if (personId !== undefined) {
    await send(page, "DELETE", `/api/people/${personId}/draft`);
  }
  if (fieldId !== undefined) {
    const path = `/api/people/columns/${fieldId}/draft`;
    const answer = await send(page, "DELETE", path);
    expect
      .soft(answer.ok, `${path}: ${JSON.stringify(answer.body)}`)
      .toBe(true);
  }
});

test("adds a checkbox column, then ticks and unticks a person's box", async ({
  page,
}) => {
  // Given the Engineering Operations Manager on People, with one person found
  await page.goto("/people");
  await expect(page.getByRole("grid", { name: "People" })).toBeVisible();
  const name = `Fictional First Aider ${String(Date.now())}`;

  // When a checkbox column is added through New column
  await page.getByRole("button", { name: "New column" }).click();
  const dialog = page.getByRole("dialog", { name: "New column" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Type").click();
  await page.getByRole("option", { name: "Checkbox" }).click();

  // Then the dialog asks nothing about the column being filled in
  await expect(dialog.getByLabel("Must be filled in")).toHaveCount(0);
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/people/columns"),
  );
  await dialog.getByRole("button", { name: "Add column" }).click();
  const { field } = (await (await saved).json()) as { field: { id: string } };
  made.fieldId = field.id;
  await expect(dialog).toHaveCount(0);

  // And a person's box in it is ticked with a click and unticked with Space
  await page
    .getByRole("textbox", { name: "Search people" })
    .fill("Samuel Richter");
  const cell = page.locator(`[id^="cell-"][id$="-${field.id}"]`).first();
  await expect(cell).toHaveText("No");
  const id = String(await cell.getAttribute("id"))
    .replace(/^cell-/u, "")
    .replace(`-${field.id}`, "");
  made.personId = id;
  await cell.click();
  await expect(cell).toContainText("Yes");
  await page.keyboard.press("Space");
  await expect(cell).toContainText("No");
});
