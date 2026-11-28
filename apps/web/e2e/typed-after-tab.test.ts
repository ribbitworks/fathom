// SPDX-License-Identifier: Apache-2.0

// UI test of a new row's next cell typed into at a person's pace straight after Tab: every key lands
// in its editor, in the order typed.

import { expect, test } from "./test-fixtures.ts";
import { signedInAs } from "./test-accounts.ts";
import { send } from "./test-requests.ts";

// With a trace, Playwright pauses between Tab and the first key, giving the editor time to take
// focus that a person typing doesn't, so the test would pass even if the first key went astray.
test.use({ storageState: signedInAs("featureLead"), trace: "off" });

const millisecondsBetweenKeys = 60;

const day = "2027-02-10";

// The columns a run drafted, discarded so no run leaves one behind.
const made: string[] = [];

test.afterEach(async ({ page }) => {
  for (const fieldId of made.splice(0)) {
    const path = `/api/features/columns/${fieldId}/draft`;
    const answer = await send(page, "DELETE", path);
    expect
      .soft(answer.ok, `${path}: ${JSON.stringify(answer.body)}`)
      .toBe(true);
  }
});

test("keeps a day's digits in order when typed at a person's pace straight after Tab", async ({
  page,
}) => {
  // Given the Feature Lead on Features, with a text column and then a date column
  await page.goto("/features");
  await expect(page.getByRole("grid")).toBeVisible();
  const stamp = String(Date.now());
  const due = `Fictional Due ${stamp}`;
  for (const [name, type] of [
    [`Fictional Reference ${stamp}`, "text"],
    [due, "date"],
  ]) {
    const added = await send(page, "POST", "/api/features/columns", {
      name,
      type,
      visibility: "general",
    });
    expect(added.ok, JSON.stringify(added.body)).toBe(true);
    made.push((added.body as { field: { id: string } }).field.id);
  }
  await page.reload();
  await page.locator(`#cell-new-0-${String(made[0])}`).click();

  // When text is typed in the new row's text cell, then Tab, then a day, each at a person's pace
  await page.keyboard.type("Fictional", { delay: millisecondsBetweenKeys });
  await page.keyboard.press("Tab");
  await page.keyboard.type(day, { delay: millisecondsBetweenKeys });

  // Then the date's editor holds the day as typed
  await expect(page.getByRole("textbox", { name: due })).toHaveValue(day);
});
