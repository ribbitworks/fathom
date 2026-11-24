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
