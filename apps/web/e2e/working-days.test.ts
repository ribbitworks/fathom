// SPDX-License-Identifier: Apache-2.0

// UI tests of the working days on Planning settings: no day ticked is refused under the days, with
// focus kept on them and nothing saved, Esc puts them back, and the days stay on one line.

import { expect, type Page, test } from "@playwright/test";
import { signedInAs } from "./test-accounts.ts";

test.use({ storageState: signedInAs("engineeringOperationsManager") });

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

async function openDays(page: Page) {
  await page.goto("/planning-settings");
  await page
    .getByRole("button", { name: "Change Working days", exact: true })
    .click();
  const days = page.getByRole("toolbar", { name: "Working days" });
  await expect(days.getByRole("button", { name: "Monday" })).toBeFocused();
  return days;
}

test("refuses no working day under the days, keeping focus and saving nothing, and puts them back with Esc", async ({
  page,
}) => {
  // Given the Workforce Administrator with the working days open
  const days = await openDays(page);
  const changes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("/api/"))
      changes.push(`${request.method()} ${request.url()}`);
  });

  // When every working day is unticked and Enter pressed
  for (const day of weekdays) {
    await days.getByRole("button", { name: day }).click();
  }
  await page.keyboard.press("Enter");

  // Then the reason shows under the days, which stay open with the focus
  await expect(page.getByText("Working day needed")).toBeVisible();
  const friday = days.getByRole("button", { name: "Friday" });
  await expect(friday).toBeFocused();
  await expect(friday).toHaveAccessibleDescription("Working day needed");
  expect(changes).toEqual([]);

  // And Esc puts the days back, with focus on the pencil
  await page.keyboard.press("Escape");
  await expect(page.getByText("Working day needed")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Change Working days", exact: true }),
  ).toBeFocused();
  expect(changes).toEqual([]);
});

test("keeps the days on one line in a narrow window", async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 900 });
  const days = await openDays(page);

  const boxes = await days.getByRole("button").all();
  const tops = await Promise.all(
    boxes.map(async (box) => (await box.boundingBox())?.y),
  );

  expect(tops).toHaveLength(7);
  expect(new Set(tops).size).toBe(1);
});
