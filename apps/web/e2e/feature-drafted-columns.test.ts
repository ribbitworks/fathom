// SPDX-License-Identifier: Apache-2.0

// UI tests of a feature given a value in a Features column only drafted to be added.

import { expect, test } from "@playwright/test";
import { signedInAs } from "./test-accounts.ts";
import { send } from "./test-requests.ts";

test.use({ storageState: signedInAs("featureLead") });

// What a run drafted, discarded so no run leaves a column behind: the feature's value first, since
// its draft depends on the column's. A published draft taken back waits until its maker publishes
// again, so each discard is published before the next.
const made: { featureId?: string; fieldId?: string } = {};

test.afterEach(async ({ page }) => {
  const { featureId, fieldId } = made;
  delete made.featureId;
  delete made.fieldId;
  if (fieldId === undefined) return;
  const steps: { method: string; path: string }[] = [];
  if (featureId !== undefined) {
    steps.push({
      method: "DELETE",
      path: `/api/records/feature/${featureId}/draft`,
    });
  }
  steps.push(
    { method: "POST", path: "/api/unpublished/publish" },
    { method: "DELETE", path: `/api/features/columns/${fieldId}/draft` },
    { method: "POST", path: "/api/unpublished/publish" },
  );
  // Each step runs even when one before it is refused, such as a feature with no draft yet.
  for (const { method, path } of steps) {
    const answer = await send(
      page,
      method,
      path,
      method === "POST" ? {} : undefined,
    );
    expect
      .soft(answer.ok, `${method} ${path}: ${JSON.stringify(answer.body)}`)
      .toBe(true);
  }
});

test("fills a column drafted to be added, whose approval goes with the feature's", async ({
  page,
  browser,
}) => {
  // Given the Feature Lead on Features, with a number column drafted and published
  await page.goto("/features");
  await expect(page.getByRole("grid")).toBeVisible();
  const name = `Fictional Score ${String(Date.now())}`;
  const added = await send(page, "POST", "/api/features/columns", {
    name,
    type: "number",
    visibility: "general",
  });
  expect(added.ok).toBe(true);
  const { field } = added.body as { field: { id: string } };
  made.fieldId = field.id;
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
  made.featureId = id;
  await expect(cell).toContainText("7");
  await send(page, "POST", "/api/unpublished/publish", {});
  await page.reload();
  await expect(cell).toContainText("7");

  // Then the Product Manager, who approves features and their columns, is asked to approve the new
  // column with the feature, and approves nothing once that is cancelled
  const approverContext = await browser.newContext({
    storageState: signedInAs("productManager"),
  });
  const approver = await approverContext.newPage();
  await approver.goto("/features");
  // The row's own ⋯, at its end, is always shown.
  await approver
    .getByRole("button", { name: `Actions for ${featureName}` })
    .last()
    .click();
  await approver.getByRole("menuitem", { name: /^Approve/u }).click();
  const dialog = approver.getByRole("dialog", { name: "Approve 2 drafts?" });
  await expect(dialog).toContainText(`the feature ${featureName}`);
  await expect(dialog).toContainText(`the column ${name}`);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toBeHidden();
  const after = (await send(approver, "GET", "/api/projects")).body as {
    features: { id: string; draft?: unknown }[];
  };
  expect(after.features.find((one) => one.id === id)?.draft).toBeDefined();
  await approverContext.close();
});
