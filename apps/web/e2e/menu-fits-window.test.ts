// SPDX-License-Identifier: Apache-2.0

// UI tests of a menu taller than the window: it stays inside the window, scrolling in itself.

import { expect, test } from "./test-fixtures.ts";
import { signedInAs } from "./test-accounts.ts";

test.use({ storageState: signedInAs("engineeringOperationsManager") });

test("keeps a column's menu inside a short window, its last item reached by scrolling it", async ({
  page,
}) => {
  // Given People in a window too short for a column's whole menu
  const height = 480;
  await page.setViewportSize({ width: 1440, height });
  await page.goto("/people");
  await expect(page.getByRole("grid")).toBeVisible();

  // When the Site column's menu is opened
  await page.getByRole("button", { name: "Site column", exact: true }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();

  // Then it ends inside the window, and its last item is reached within it
  const box = await menu.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(height);
  const last = menu.getByRole("menuitem").last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  const lastBox = await last.boundingBox();
  expect(lastBox).not.toBeNull();
  expect((lastBox?.y ?? 0) + (lastBox?.height ?? 0)).toBeLessThanOrEqual(
    height,
  );
});
