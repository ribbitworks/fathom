// SPDX-License-Identifier: Apache-2.0

// UI tests of the column dialog asking before it discards what was typed in it.

import { expect, test } from "./test-fixtures.ts";
import { signedInAs } from "./test-accounts.ts";

test.use({ storageState: signedInAs("productManager") });

test("asks before Esc discards a new column, keeps it on Keep adding, and discards it on Discard", async ({
  page,
}) => {
  // Given the Product Manager's New column dialog, with a name typed
  await page.goto("/features");
  await page.getByRole("button", { name: "New column" }).click();
  const dialog = page.getByRole("dialog", { name: "New column", exact: true });
  const name = dialog.getByRole("textbox", { name: "Name", exact: true });
  await name.fill("Fictional Tier");

  // When Esc is pressed, the question asks, and Keep adding keeps what was typed
  await page.keyboard.press("Escape");
  const question = page.getByRole("dialog", {
    name: "Discard the new column?",
  });
  await expect(question).toBeVisible();
  await question.getByRole("button", { name: "Keep adding" }).click();
  await expect(question).toBeHidden();
  await expect(name).toHaveValue("Fictional Tier");

  // Then Cancel asks again, and Discard closes the dialog
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await question.getByRole("button", { name: "Discard" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("columnheader", { name: /Fictional Tier/u }),
  ).toHaveCount(0);
});
