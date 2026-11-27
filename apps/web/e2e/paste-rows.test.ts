// SPDX-License-Identifier: Apache-2.0

// UI tests of pasting rows into a plan table: they are saved together, so one the server refuses
// keeps every other row of the paste from being saved.

import { expect, test } from "./test-fixtures.ts";
import { signedInAs } from "./test-accounts.ts";

test.use({ storageState: signedInAs("productManager") });

// The page's own classes a paste is made of, which the UI tests' types, made for Node, don't name.
declare const DataTransfer: new () => {
  setData: (format: string, data: string) => void;
};
declare const ClipboardEvent: new (
  type: string,
  init: { clipboardData: unknown; bubbles: boolean },
) => unknown;

test("saves none of the pasted customers when the server refuses one of them", async ({
  page,
}) => {
  // Given Customers on Projects, and a customer added elsewhere since the page was shown
  await page.goto("/projects?tab=customers");
  const count = page.getByRole("status").filter({ hasText: /customers?$/ });
  const counted = await count.innerText();
  expect(counted).toMatch(/^\d+ customers?$/);
  const stamp = String(Date.now());
  const named = (name: string) => `Fictional ${name} ${stamp}`;
  const [first, taken, last] = [named("Alder"), named("Birch"), named("Cedar")];
  const elsewhere = await page.context().newPage();
  await elsewhere.goto("/projects?tab=customers");
  await elsewhere.getByRole("button", { name: "New customer" }).click();
  const panel = elsewhere.getByRole("region", { name: "New customer" });
  await panel.getByRole("textbox", { name: "Name" }).fill(taken);
  await elsewhere.keyboard.press("Enter");
  await expect(elsewhere.getByRole("grid").getByText(taken)).toBeVisible();
  await elsewhere.close();

  // When three rows, the middle one named as that customer, are pasted into the empty row
  const cell = page.locator("#cell-new-0-name");
  await cell.focus();
  await cell.evaluate(
    (target: { dispatchEvent: (event: unknown) => boolean }, text) => {
      const data = new DataTransfer();
      data.setData("text/plain", text);
      target.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: data, bubbles: true }),
      );
    },
    [first, taken, last].join("\n"),
  );

  // Then the server's refusal is shown, and once the page is loaded again only the customer added
  // elsewhere is saved
  await expect(page.getByText("Another customer has that name")).toBeVisible();
  await page.reload();
  await expect(count).toHaveText(
    `${String(Number.parseInt(counted, 10) + 1)} customers`,
  );
  const grid = page.getByRole("grid");
  await expect(grid.getByText(taken)).toBeVisible();
  await expect(grid.getByText(first)).toHaveCount(0);
  await expect(grid.getByText(last)).toHaveCount(0);
});
