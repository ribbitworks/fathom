// SPDX-License-Identifier: Apache-2.0

// UI tests of renaming a list in its row on the Lists page: an empty name, a name another list has,
// and a name too long are each refused in the row, saving nothing.

import { expect, type Page, test } from "@playwright/test";
import { signedInAs } from "./test-accounts.ts";

test.use({ storageState: signedInAs("engineeringDirector") });

// The changes the page sends to be saved, from when it starts watching.
function changesSent(page: Page): string[] {
  const changes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("/api/"))
      changes.push(`${request.method()} ${request.url()}`);
  });
  return changes;
}

async function renameLevels(page: Page, name: string) {
  const grid = page.getByRole("grid", { name: "Lists" });
  await grid.getByRole("gridcell", { name: /^Levels/ }).dblclick();
  const input = grid.getByRole("textbox");
  await input.fill(name);
  await input.press("Enter");
  return input;
}

test.describe("renaming a list in its row", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/lists");
    await expect(page.getByRole("grid", { name: "Lists" })).toBeVisible();
  });

  for (const [why, name, reason] of [
    ["an empty name", "", "Name needed"],
    ["a name another list has", "sites", "Another list has that name"],
    ["a name too long", "x".repeat(41), "Name is too long"],
  ] as const) {
    test(`refuses ${why}, keeping the name open and saving nothing`, async ({
      page,
    }) => {
      // Given the Engineering Director on Lists, watching what is sent
      const changes = changesSent(page);

      // When Levels is renamed
      const input = await renameLevels(page, name);

      // Then the row says why, the name stays open with the focus, and nothing is sent
      await expect(page.getByText(reason)).toBeVisible();
      await expect(input).toBeFocused();
      expect(changes).toEqual([]);

      // And Levels is as it was once the name is left
      await input.press("Escape");
      await expect(
        page
          .getByRole("grid", { name: "Lists" })
          .getByRole("gridcell", { name: /^Levels/ }),
      ).toBeVisible();
    });
  }
});
