// SPDX-License-Identifier: Apache-2.0

// UI tests of acting on a record's own draft from its row's menu and its details panel's menu, on
// People: publishing a change alone, then discarding it. Each run renames to a name of its own, since
// taking back a published draft waits, unpublished, until its maker publishes it.

import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./test-accounts.ts";

const person = "Max Munk";

function grid(page: Page) {
  return page.getByRole("grid", { name: "People" });
}

// A person's Name cell, which its row's controls name.
function nameCell(page: Page, name: string) {
  return grid(page)
    .getByRole("gridcell")
    .filter({
      has: page.getByRole("button", {
        name: `Show details of ${name}`,
        exact: true,
      }),
    });
}

async function openRowMenu(page: Page, name: string) {
  await nameCell(page, name).hover();
  await grid(page)
    .getByRole("button", { name: `Actions for ${name}`, exact: true })
    .first()
    .click();
  return page.getByRole("menu");
}

async function publishFromRow(page: Page, name: string) {
  const menu = await openRowMenu(page, name);
  await menu.getByRole("menuitem", { name: "Publish draft…" }).click();
  await expect(page.getByText("Published 1 change.").last()).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("publishes a change from its row, then discards it from its details, putting focus back each time", async ({
  page,
}) => {
  // Given the Workforce Administrator on People, with Max Munk renamed, not yet published
  const renamed = `${person} Fictional ${Date.now().toString(36)}`;
  await signIn(
    page,
    `/people?search=${encodeURIComponent(person)}`,
    "engineering.operations.manager@fathom.test",
  );
  await nameCell(page, person).dblclick();
  const input = grid(page).getByRole("textbox");
  await input.fill(renamed);
  await input.press("Enter");
  await expect(nameCell(page, renamed)).toBeVisible();

  // When Publish draft… is chosen in its row's menu
  await publishFromRow(page, renamed);

  // Then it is published alone, with no question, and focus is back in its row
  await expect(nameCell(page, renamed)).toBeFocused();

  // When its details are opened, and Discard draft is chosen in the details' menu
  await (
    await openRowMenu(page, renamed)
  )
    .getByRole("menuitem", { name: "Show details" })
    .click();
  const panel = page.getByRole("region", { name: /Max Munk/u });
  await panel
    .getByRole("button", { name: `Actions for ${renamed}`, exact: true })
    .click();
  const panelMenu = page.getByRole("menu");
  await expect(
    panelMenu.getByRole("menuitem", { name: "Show details" }),
  ).toHaveCount(0);
  const discarded = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      response.url().endsWith("/draft"),
  );
  await panelMenu.getByRole("menuitem", { name: "Discard draft" }).click();
  expect((await discarded).ok()).toBe(true);

  // Then the name is as it was, also once the page is loaded again
  await expect(nameCell(page, person)).toBeVisible();
  await page.reload();
  await expect(nameCell(page, person)).toBeVisible();
});
