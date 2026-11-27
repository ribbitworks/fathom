// SPDX-License-Identifier: Apache-2.0

// UI tests of a text column on People: added through New column, then a person's long text typed
// in its cell, shown cut short on one line there and whole in their details.

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

// Long enough to be cut short in its cell, and within a text column's 200 characters.
const directions =
  "Take the east stairs to the second floor, then follow the corridor past the kitchen to the last door on the left, beside the window.";

test("adds a text column, then shows a person's long text cut short in its cell and whole in their details", async ({
  page,
}) => {
  // Given the Engineering Operations Manager on People
  await page.goto("/people");
  await expect(page.getByRole("grid", { name: "People" })).toBeVisible();
  const name = `Fictional Directions ${String(Date.now())}`;

  // When a text column is added through New column
  await page.getByRole("button", { name: "New column" }).click();
  const dialog = page.getByRole("dialog", { name: "New column" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Type").click();
  await page.getByRole("option", { name: "Text", exact: true }).click();
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/people/columns"),
  );
  await dialog.getByRole("button", { name: "Add column" }).click();
  const { field } = (await (await saved).json()) as {
    field: { id: string };
  };
  made.fieldId = field.id;
  await expect(dialog).toHaveCount(0);

  // And a person's long text is typed in its cell
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
  await page.keyboard.type(directions);
  await page.keyboard.press("Enter");

  // Then the cell shows it on one line, its row as tall as the Live row under it, and the person's
  // details show it whole
  await expect(cell).toContainText(directions);
  const row = await cell.locator("xpath=ancestor::tr").boundingBox();
  const live = await cell
    .locator("xpath=ancestor::tr/following-sibling::tr[1]")
    .boundingBox();
  expect(row).not.toBeNull();
  expect(live).not.toBeNull();
  expect(row?.height).toBe(live?.height);
  // Its draft's words for screen readers sit within the cell, not elsewhere in the table: none lies
  // more than a pixel, Mantine's margin of -1px, outside the cell's box.
  const cellId = String(await cell.getAttribute("id"));
  await expect(cell).toContainText("Draft");
  expect(
    await page.evaluate(`(() => {
      const box = document.getElementById(${JSON.stringify(cellId)});
      const outer = box.getBoundingClientRect();
      return [...box.querySelectorAll(".mantine-VisuallyHidden-root")]
        .map((each) => each.getBoundingClientRect())
        .filter((inner) =>
          inner.left < outer.left - 1 || inner.right > outer.right + 1 ||
          inner.top < outer.top - 1 || inner.bottom > outer.bottom + 1)
        .map((inner) => [inner.left, inner.top, outer.left, outer.top].map(Math.round));
    })()`),
  ).toEqual([]);
  // Cut short, its text sets no width: the table scrolls no further than its columns reach.
  expect(
    await page.evaluate(`(() => {
      const grid = document.querySelector('[role=grid]');
      let frame = grid.parentElement;
      while (getComputedStyle(frame).overflowX === 'visible') frame = frame.parentElement;
      return frame.scrollWidth - Math.ceil(grid.getBoundingClientRect().width);
    })()`),
  ).toBeLessThanOrEqual(0);
  await cell.hover();
  await page
    .getByRole("button", { name: "Show details of Samuel Richter" })
    .click();
  const details = page.getByRole("region", { name: "Samuel Richter" });
  await expect(details.getByText(directions, { exact: true })).toBeVisible();
  // And the page itself never scrolls, however long the details
  expect(
    await page.evaluate(
      "document.scrollingElement.scrollHeight - window.innerHeight",
    ),
  ).toBeLessThanOrEqual(0);
});
