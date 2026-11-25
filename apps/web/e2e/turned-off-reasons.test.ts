// SPDX-License-Identifier: Apache-2.0

// UI tests of a control turned off with a line saying why, which a screen reader hears with the
// control.

import { expect, type Page, test } from "@playwright/test";
import { signedInAs } from "./test-accounts.ts";

test.use({ storageState: signedInAs("fathomAdministrator") });

const why = "No other account can manage accounts.";

// One's own account is headed with This account after the name.
async function openAccount(page: Page, name: string, heading = name) {
  await page
    .getByRole("button", { name: `Show details of ${name}`, exact: true })
    .click();
  return page.getByRole("region", { name: heading, exact: true });
}

async function changeActive(page: Page, name: string, action: string) {
  const panel = await openAccount(page, name);
  await panel.getByRole("button", { name: `${action}…` }).click();
  const dialog = page.getByRole("dialog", { name: `${action} ${name}` });
  await dialog.getByRole("button", { name: action, exact: true }).click();
  await expect(dialog).toBeHidden();
}

test("says why the last account that manages accounts can't give up its role or be deactivated, sending nothing", async ({
  page,
}) => {
  // Given the Fathom Administrator on Accounts, with Superuser, the other account that manages
  // accounts, deactivated
  await page.goto("/accounts");
  await changeActive(page, "Superuser", "Deactivate");
  try {
    const changes: string[] = [];
    page.on("request", (request) => {
      if (request.method() !== "GET" && request.url().includes("/api/"))
        changes.push(`${request.method()} ${request.url()}`);
    });

    // When they open their own account
    const panel = await openAccount(
      page,
      "Fathom Administrator",
      "Fathom Administrator This account",
    );

    // Then Deactivate… is turned off, with the reason under it, read with it
    const deactivate = panel.getByRole("button", { name: "Deactivate…" });
    await expect(deactivate).toBeDisabled();
    await expect(deactivate).toHaveAccessibleDescription(why);
    await expect(panel.getByText(why)).toBeVisible();

    // And in Edit, the Administrator role is ticked and turned off, with the reason in place of its
    // description
    await panel.getByRole("button", { name: "Edit…" }).click();
    const dialog = page.getByRole("dialog", {
      name: "Edit Fathom Administrator",
    });
    const administrator = dialog.getByRole("checkbox", {
      name: "Administrator",
      exact: true,
    });
    await expect(administrator).toBeChecked();
    await expect(administrator).toBeDisabled();
    await expect(administrator).toHaveAccessibleDescription(why);
    await expect(dialog.getByText(why)).toBeVisible();

    // And nothing was sent to be saved
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    expect(changes).toEqual([]);
  } finally {
    // Superuser is reactivated even after a failure, with any dialog left open closed first.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await changeActive(page, "Superuser", "Reactivate");
  }
});
