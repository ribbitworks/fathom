// SPDX-License-Identifier: Apache-2.0

// UI tests of a dialog refusing Save: focus goes into the field the reason is under.

import { expect, test } from "@playwright/test";
import { signIn } from "./test-accounts.ts";

test("puts focus in Name when a new list is created without one, saving nothing", async ({
  page,
}) => {
  // Given the Engineering Director on Lists, with the New list dialog open
  await signIn(page, "/lists", "engineering.director@fathom.test");
  const changes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("/api/"))
      changes.push(`${request.method()} ${request.url()}`);
  });
  await page.getByRole("button", { name: "New list" }).click();
  const dialog = page.getByRole("dialog", { name: "New list" });
  const name = dialog.getByRole("textbox", { name: "Name" });

  // When the list is created with no name
  await dialog.getByRole("button", { name: "Create list" }).click();

  // Then the reason shows under Name, which has the focus
  await expect(dialog.getByText("Name needed")).toBeVisible();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toBeFocused();

  // And the dialog stays open, with nothing sent to be saved
  await expect(dialog).toBeVisible();
  expect(changes).toEqual([]);
});

test("puts focus in Schedule when a new release is made without one, saving nothing", async ({
  page,
}) => {
  // Given the Engineering Director on Releases, with the New release dialog open
  await signIn(page, "/releases", "engineering.director@fathom.test");
  await page.getByRole("tab", { name: "Releases" }).click();
  const changes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("/api/"))
      changes.push(`${request.method()} ${request.url()}`);
  });
  await page.getByRole("button", { name: "New release" }).click();
  const dialog = page.getByRole("dialog", { name: "New release" });
  const schedule = dialog.getByRole("combobox", { name: "Schedule" });

  // When it is made with a name but no schedule
  await dialog.getByRole("textbox", { name: "Name" }).fill("Fictional Two");
  await dialog.getByRole("button", { name: "Make release" }).click();

  // Then the reason shows under Schedule, which has the focus
  await expect(dialog.getByText("Choose a schedule")).toBeVisible();
  await expect(schedule).toHaveAttribute("aria-invalid", "true");
  await expect(schedule).toBeFocused();

  // And the dialog stays open, with nothing sent to be saved
  await expect(dialog).toBeVisible();
  expect(changes).toEqual([]);
});
