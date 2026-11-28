// SPDX-License-Identifier: Apache-2.0

// UI tests of New page under Mine: its refusals, with focus where they are, and a page made and
// typed in, its rows saved at once. Also removing a page's column and the page itself: each asks
// first, from the keyboard, with focus where it should be, then offers Undo.

import type { Locator, Page } from "@playwright/test";
import { signedInAs } from "./test-accounts.ts";
import { expect, test } from "./test-fixtures.ts";
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
  await expect(
    grid.getByRole("row", { name: "New row" }).locator("td").first(),
  ).toBeFocused();
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

test("cuts a long page name short in the top bar before the account's, keeping its menu in reach", async ({
  page,
}) => {
  // Given a page with a long name, at 680 pixels, where the name doesn't fit
  await page.setViewportSize({ width: 680, height: 800 });
  await page.goto("/help");
  const name = `Fictional follow-ups for the spring round ${Date.now().toString(36)}`;
  const answer = await send(page, "POST", "/api/private-pages", {
    name,
    columns: [{ name: "Name", type: "text", visibility: "general" }],
  });
  made.pageId = (answer.body as { page: { id: string } }).page.id;
  await page.goto(`/mine/${made.pageId}`);
  await expect(page.getByRole("grid", { name })).toBeVisible();
  await page.evaluate("document.fonts.ready");
  const bar = page.getByRole("banner");
  const shown = bar.getByText(name);
  // Whether a part's words are wider than its box, so cut short, or fit inside it.
  const overflows = (element: { scrollWidth: number; clientWidth: number }) =>
    element.scrollWidth > element.clientWidth;
  const cut = (text: Locator) => text.evaluate(overflows);

  // Then the bar is one line, and the page's name is cut short, not the account's
  await expect.poll(() => cut(shown)).toBe(true);
  expect(await cut(bar.getByText("Feature Lead", { exact: true }))).toBe(false);
  const fits = async () => !(await bar.evaluate(overflows));
  expect(await fits()).toBe(true);

  // And pointing at it shows its whole name in a tip
  await shown.hover();
  await expect(
    page.getByRole("tooltip").filter({ hasText: name }),
  ).toBeVisible();

  // And at 390 pixels the bar still fits, and the account's menu opens
  await page.setViewportSize({ width: 390, height: 800 });
  await expect.poll(fits).toBe(true);
  await bar.getByRole("button", { name: /^Account, / }).click();
  await expect(page.getByRole("menu")).toBeVisible();
});

// A page of the Feature Lead's own with a second column, opened, made through the API.
async function openTwoColumnPage(page: Page) {
  await page.goto("/help");
  const name = `Fictional follow-ups ${Date.now().toString(36)}`;
  const answer = await send(page, "POST", "/api/private-pages", {
    name,
    columns: [
      { name: "Name", type: "text", visibility: "general" },
      { name: "Notes", type: "text", visibility: "general" },
    ],
  });
  const { id } = (answer.body as { page: { id: string } }).page;
  made.pageId = id;
  await page.goto(`/mine/${id}`);
  await expect(page.getByRole("grid", { name })).toBeVisible();
  return name;
}

test("asks before removing a column, Esc keeping it, then Remove and Cmd+Z", async ({
  page,
}) => {
  // Given the Notes column's Remove column…
  await openTwoColumnPage(page);
  const heading = page.getByRole("button", { name: /^Notes column/u });
  const ask = async () => {
    await heading.click();
    await page.getByRole("menuitem", { name: "Remove column…" }).click();
    return page.getByRole("dialog", { name: "Remove the Notes column?" });
  };

  // When it asks, Cancel has focus, and Esc keeps the column, focus back on its heading
  const question = await ask();
  await expect(question.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(question).toBeHidden();
  await expect(heading).toBeFocused();

  // Then Tab then Enter takes Remove, and the column goes, a notification saying so
  await ask();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(heading).toBeHidden();
  await expect(page.getByText("Removed the Notes column.")).toBeVisible();

  // And Cmd+Z or Ctrl+Z brings it back
  await page.keyboard.press("ControlOrMeta+z");
  await expect(heading).toBeVisible();
});

test("asks before removing the page from its ⋯, landing elsewhere, then Undo opens it again", async ({
  page,
}) => {
  // Given the page's ⋯, then Remove page…
  const name = await openTwoColumnPage(page);
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Remove page…" }).click();
  const question = page.getByRole("dialog", {
    name: `Remove the ${name} page?`,
  });
  await expect(question.getByRole("button", { name: "Cancel" })).toBeFocused();

  // When Remove is taken, the page is gone, and a notification offers Undo
  await question.getByRole("button", { name: "Remove" }).click();
  await expect(page).not.toHaveURL(new RegExp(made.pageId ?? "", "u"));
  const notice = page.getByRole("status").filter({
    hasText: `Removed the ${name} page.`,
  });

  // Then Undo opens it again
  await notice.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("grid", { name })).toBeVisible();
});
