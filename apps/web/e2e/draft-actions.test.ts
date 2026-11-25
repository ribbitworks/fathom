// SPDX-License-Identifier: Apache-2.0

// UI tests of acting on a record's own draft from its row's menu and its details panel's menu, on
// People: publishing a change alone, then discarding it, and cancelling the question for one that
// goes with another. Each run renames to a name of its own, since taking back a published draft
// waits, unpublished, until its maker publishes it.

import { expect, type Page, test } from "@playwright/test";
import { signedInAs } from "./test-accounts.ts";

test.use({ storageState: signedInAs("engineeringOperationsManager") });

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

async function renamed(page: Page): Promise<string> {
  const name = `${person} Fictional ${Date.now().toString(36)}`;
  await page.goto(`/people?search=${encodeURIComponent(person)}`);
  await nameCell(page, person).dblclick();
  const input = grid(page).getByRole("textbox");
  await input.fill(name);
  await input.press("Enter");
  await expect(nameCell(page, name)).toBeVisible();
  return name;
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
  const renamedTo = await renamed(page);

  // When Publish draft… is chosen in its row's menu
  await publishFromRow(page, renamedTo);

  // Then it is published alone, with no question, and focus is back in its row
  await expect(nameCell(page, renamedTo)).toBeFocused();

  // When its details are opened, and Discard draft is chosen in the details' menu
  await (
    await openRowMenu(page, renamedTo)
  )
    .getByRole("menuitem", { name: "Show details" })
    .click();
  const panel = page.getByRole("region", { name: /Max Munk/u });
  await panel
    .getByRole("button", { name: `Actions for ${renamedTo}`, exact: true })
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

test("puts focus back on the row's cell once the question is cancelled, however slowly the changes load", async ({
  page,
}) => {
  // Given Max Munk renamed, not yet published, and the user's changes listing that rename as going
  // with one more change, held until the row's ⋯ has focus, as on a slow connection
  const renamedTo = await renamed(page);
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/unpublished", async (route) => {
    const response = await route.fetch();
    const { changes } = (await response.json()) as {
      changes: { subject: string; key: string; linked: string[] }[];
    };
    const other = "person fictional-other";
    await held;
    await route.fulfill({
      response,
      json: {
        changes: [
          ...changes.map((change) =>
            change.subject.includes(renamedTo)
              ? { ...change, linked: [...change.linked, other] }
              : change,
          ),
          {
            subject: "the person Fictional Other",
            action: "changed",
            key: other,
            linked: [],
          },
        ],
      },
    });
  });
  const menu = await openRowMenu(page, renamedTo);
  await menu.getByRole("menuitem", { name: "Publish draft…" }).click();
  const rowActions = grid(page)
    .getByRole("button", { name: `Actions for ${renamedTo}`, exact: true })
    .first();
  await rowActions.focus();
  release();
  const dialog = page.getByRole("dialog", { name: "Publish 2 changes?" });

  // When the question is cancelled
  await dialog.getByRole("button", { name: "Cancel" }).click();

  // Then focus is back on the row's cell
  await expect(dialog).toHaveCount(0);
  await expect(nameCell(page, renamedTo)).toBeFocused();

  // Afterwards, the rename is discarded, so Max Munk is as he was
  await page.unroute("**/api/unpublished");
  const discarded = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      response.url().endsWith("/draft"),
  );
  await (
    await openRowMenu(page, renamedTo)
  )
    .getByRole("menuitem", { name: "Discard draft" })
    .click();
  expect((await discarded).ok()).toBe(true);
  await expect(nameCell(page, person)).toBeVisible();
});
