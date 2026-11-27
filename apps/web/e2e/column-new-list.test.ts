// SPDX-License-Identifier: Apache-2.0

// UI tests of a new list made with a column on Features or Activities: its name and choices are
// needed, and the column is drafted drawing on it.

import type { Page } from "@playwright/test";
import { expect, test } from "./test-fixtures.ts";
import { signedInAs } from "./test-accounts.ts";
import { changesSent } from "./test-requests.ts";

test.use({ storageState: signedInAs("productManager") });

async function openNewColumn(page: Page, path = "/features") {
  await page.goto(path);
  await page.getByRole("button", { name: "New column" }).click();
  const dialog = page.getByRole("dialog", { name: "New column" });
  await dialog
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Fictional Tier");
  await dialog.getByLabel("Type").click();
  await page.getByRole("option", { name: "Choice from a list" }).click();
  await dialog.getByRole("combobox", { name: "List", exact: true }).click();
  await page.getByRole("option", { name: "New list" }).click();
  return dialog;
}

test("refuses a new list with no name or choices, naming why under each, and saving nothing", async ({
  page,
}) => {
  // Given the Product Manager's New column dialog, with New list chosen and nothing else filled in
  const dialog = await openNewColumn(page);
  const changes = changesSent(page);

  // When the column is added
  await dialog.getByRole("button", { name: "Add column" }).click();

  // Then the list's name and its choices are each asked for, focus is on the name, and nothing sent
  const listName = dialog.getByRole("textbox", { name: "List name" });
  await expect(listName).toHaveAccessibleDescription(/Name needed/u);
  await expect(dialog.getByText("Choices needed")).toBeVisible();
  await expect(listName).toBeFocused();
  expect(changes).toEqual([]);
});

test("adds a choice column drawing on a new list, made with it", async ({
  page,
}) => {
  // Given the Product Manager's New column dialog, with New list chosen
  const dialog = await openNewColumn(page);

  // When the list is named, given two choices, and the column added
  await dialog
    .getByRole("textbox", { name: "List name" })
    .fill("Fictional Tiers");
  const choice = dialog.getByRole("textbox", { name: "New choice name" });
  await choice.fill("Fictional Gold");
  await choice.press("Enter");
  await choice.fill("Fictional Silver");
  await choice.press("Enter");
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/features/columns"),
  );
  // The page shows the column at once, then reads the lists offered again.
  const reread = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url().endsWith("/api/lists"),
  );
  await dialog.getByRole("button", { name: "Add column" }).click();
  await reread;
  const sent = (await saved).request().postDataJSON() as { newList: unknown };
  expect(sent.newList).toEqual({
    name: "Fictional Tiers",
    choices: [
      { label: "Fictional Gold", description: "" },
      { label: "Fictional Silver", description: "" },
    ],
  });

  // Then the column shows, drawing on the new list, which its dialog names as new
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: /^Fictional Tier column/u }).click();
  await page.getByRole("menuitem", { name: "Edit column…" }).click();
  const editing = page.getByRole("dialog", { name: "Edit column" });
  await expect(
    editing.getByRole("combobox", { name: "List", exact: true }),
  ).toHaveValue("Fictional Tiers (new)");
});

test("adds a choice column on Activities drawing on a new list, as on Features", async ({
  page,
}) => {
  // Given the Product Manager's New column dialog on Activities, with New list chosen
  const dialog = await openNewColumn(page, "/activities");

  // When the list is named, given a choice, and the column added
  await dialog
    .getByRole("textbox", { name: "List name" })
    .fill("Fictional Grades");
  const choice = dialog.getByRole("textbox", { name: "New choice name" });
  await choice.fill("Fictional Bronze");
  await choice.press("Enter");
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/activities/columns"),
  );
  await dialog.getByRole("button", { name: "Add column" }).click();

  // Then the column is drafted on Activities, drawing on the new list
  expect((await saved).status()).toBe(201);
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: /^Fictional Tier column/u }).click();
  await page.getByRole("menuitem", { name: "Edit column…" }).click();
  const editing = page.getByRole("dialog", { name: "Edit column" });
  await expect(
    editing.getByRole("combobox", { name: "List", exact: true }),
  ).toHaveValue("Fictional Grades (new)");
});
