// SPDX-License-Identifier: Apache-2.0

// UI tests of New page under Mine: its refusals, with focus where they are, and a page made and
// typed in, its rows saved at once.

import { expect, test } from "@playwright/test";
import { signedInAs } from "./test-accounts.ts";
import { send } from "./test-requests.ts";

test.use({ storageState: signedInAs("featureLead") });

// The page a run made, removed so no run leaves one behind.
const made: { pageId?: string } = {};

test.afterEach(async ({ page }) => {
  const { pageId } = made;
  delete made.pageId;
  if (pageId === undefined) return;
  const path = `/api/private-pages/${pageId}`;
  const answer = await send(page, "DELETE", path);
  expect.soft(answer.ok, `${path}: ${JSON.stringify(answer.body)}`).toBe(true);
});

test("refuses a missing name and a column named twice, then makes the page and saves its rows at once", async ({
  page,
}) => {
  // Given the Feature Lead's New page
  await page.goto("/help");
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("button", { name: "New page" })
    .click();
  const dialog = page.getByRole("dialog", { name: "New page" });
  const name = dialog.getByRole("textbox", { name: "Name", exact: true });

  // When Next is chosen with no name, it's refused under Name, with focus there
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByText("Name needed")).toBeVisible();
  await expect(name).toBeFocused();

  // And a second column named as the first is refused under it, with focus there
  const pageName = `Fictional reading list ${Date.now().toString(36)}`;
  await name.fill(pageName);
  await page.keyboard.press("Enter");
  const added = dialog.getByRole("textbox", { name: "New column name" });
  await expect(added).toBeFocused();
  await page.keyboard.type("name");
  await dialog.getByRole("button", { name: "Add page" }).click();
  await expect(dialog.getByText("Another column has that name")).toBeVisible();
  const second = dialog.getByRole("textbox", { name: "Column name" }).nth(1);
  await expect(second).toBeFocused();

  // Then a page with a name of its own is made and opened
  await second.fill("Author");
  await dialog.getByRole("button", { name: "Add page" }).click();
  const grid = page.getByRole("grid", { name: pageName });
  await expect(grid).toBeVisible();
  made.pageId = new URL(page.url()).pathname.split("/").slice(-1).join("");

  // And a row typed at once, in its empty row, which has focus, is saved at once, still there once
  // the page is read again
  await expect(grid.locator("tbody td").first()).toBeFocused();
  await page.keyboard.type("Fictional title");
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/rows"),
  );
  await page.keyboard.press("Enter");
  expect((await saved).ok()).toBe(true);
  await page.reload();
  await expect(grid.getByText("Fictional title")).toBeVisible();
});
