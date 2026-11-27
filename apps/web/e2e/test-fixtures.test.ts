// SPDX-License-Identifier: Apache-2.0

// UI tests of the test every UI test runs in: a view a page saves never reaches the server, so no
// test opens a page on a view an earlier one left.

import { expect, test } from "./test-fixtures.ts";
import { signedInAs } from "./test-accounts.ts";
import { lastViewPaths, send } from "./test-requests.ts";

test.use({ storageState: signedInAs("engineeringOperationsManager") });

test("keeps a changed view from the account's last views on the server", async ({
  page,
}) => {
  // Given People, searched
  await page.goto("/people");
  const saved = page.waitForRequest(
    (request) =>
      request.method() === "PUT" &&
      new URL(request.url()).pathname === `${lastViewPaths}people`,
  );
  await page.getByRole("textbox", { name: "Search people" }).fill("Richter");

  // When the page saves the view
  await saved;

  // Then the server keeps no view of People for the account
  const kept = await send(page, "GET", "/api/last-views");
  expect(kept.ok).toBe(true);
  expect(kept.body).not.toHaveProperty("people");
});
