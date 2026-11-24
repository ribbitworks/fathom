// SPDX-License-Identifier: Apache-2.0

// UI tests of a new list made with a column on Features: its name and choices are needed, and the
// column is drafted drawing on it.

import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./test-accounts.ts";

async function openNewColumn(page: Page) {
  await signIn(page, "/features", "product.manager@fathom.test");
  await page.getByRole("button", { name: "New column" }).click();
  const dialog = page.getByRole("dialog", { name: "New column" });
  await dialog
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Fictional Tier");
  await dialog.getByRole("combobox", { name: "List", exact: true }).click();
  await page.getByRole("option", { name: "New list" }).click();
  return dialog;
}

test("refuses a new list with no name or choices, naming why under each, and saving nothing", async ({
  page,
}) => {
  // Given the Product Manager's New column dialog, with New list chosen and nothing else filled in
  const dialog = await openNewColumn(page);
  const changes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("/api/"))
      changes.push(`${request.method()} ${request.url()}`);
  });

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
  const choices = dialog.getByLabel("Choices", { exact: true });
  await choices.fill("Fictional Gold");
  await choices.press("Enter");
  await choices.fill("Fictional Silver");
  await choices.press("Enter");
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
    choices: ["Fictional Gold", "Fictional Silver"],
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
