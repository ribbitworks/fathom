// SPDX-License-Identifier: Apache-2.0

// UI tests of a feature given a value in a Features column only drafted to be added.

import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./test-accounts.ts";

// A request sent from the page, signed in as it is, answering its status and body.
const send = (page: Page, method: string, path: string, body?: object) =>
  page.evaluate(
    async ({ method, path, body }) => {
      const response = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { ok: response.ok, body: await response.json() };
    },
    { method, path, body },
  );

test("fills a column drafted to be added, and leaves approving it to a role that approves both", async ({
  page,
  browser,
}) => {
  // Given the Feature Lead on Features, with a number column drafted and published
  await signIn(page, "/features", "feature.lead@fathom.test");
  await expect(page.getByRole("grid")).toBeVisible();
  const name = `Fictional Score ${String(Date.now())}`;
  const added = await send(page, "POST", "/api/features/columns", {
    name,
    type: "number",
    visibility: "general",
  });
  expect(added.ok).toBe(true);
  const { field } = added.body as { field: { id: string } };
  await send(page, "POST", "/api/unpublished/publish", {});
  const plan = (await send(page, "GET", "/api/projects")).body as {
    features: { id: string; name: string; draft?: unknown }[];
  };
  const feature = plan.features.find(({ draft }) => draft === undefined);
  expect(feature).toBeDefined();
  const { id, name: featureName } = feature as { id: string; name: string };
  await page.reload();

  // When a value is typed in the feature's cell of the new column, and published
  const cell = page.locator(`[data-record-cell="${id} ${field.id}"]`).first();
  await cell.dblclick();
  await page.keyboard.type("7");
  await page.keyboard.press("Enter");
  await expect(cell).toContainText("7");
  await send(page, "POST", "/api/unpublished/publish", {});
  await page.reload();
  await expect(cell).toContainText("7");

  // Then the Product Manager, who approves features but not configuration, is told another approver
  // must approve the new column with the feature, and approves nothing
  const approverContext = await browser.newContext();
  const approver = await approverContext.newPage();
  await signIn(approver, "/features", "product.manager@fathom.test");
  // The row's own ⋯, at its end, is always shown.
  await approver
    .getByRole("button", { name: `Actions for ${featureName}` })
    .last()
    .click();
  await approver.getByRole("menuitem", { name: /^Approve/u }).click();
  const dialog = approver.getByRole("dialog", {
    name: "Another approver needed",
  });
  await expect(dialog).toContainText(name);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  const after = (await send(approver, "GET", "/api/projects")).body as {
    features: { id: string; draft?: unknown }[];
  };
  expect(after.features.find((one) => one.id === id)?.draft).toBeDefined();
  await approverContext.close();
});
