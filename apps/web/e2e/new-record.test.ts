// SPDX-License-Identifier: Apache-2.0

// UI tests of adding a record from its New panel: a required value left empty is refused.

import { expect, test } from "@playwright/test";
import { signIn } from "./test-accounts.ts";

test("refuses a new project whose Name was emptied, naming why under it and saving nothing", async ({
  page,
}) => {
  // Given the Product Manager on Projects, with the New project panel open
  await signIn(page, "/projects", "product.manager@fathom.test");
  const count = page.getByRole("status").filter({ hasText: /projects?$/ });
  const before = await count.innerText();
  expect(before).toMatch(/^\d+ projects?$/);
  const changes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("/api/"))
      changes.push(`${request.method()} ${request.url()}`);
  });
  await page.getByRole("button", { name: "New project" }).click();
  const panel = page.getByRole("region", { name: "New project" });
  const name = panel.getByRole("textbox", { name: "Name" });

  // When a name is typed, then emptied, and the project added
  await name.fill("Fictional Lighthouse");
  await name.fill("");
  await panel.getByRole("button", { name: "Add", exact: true }).click();

  // Then the reason shows under Name, which has the focus
  await expect(name).toHaveAccessibleDescription(/Name needed/);
  await expect(panel.getByText("Name needed")).toBeVisible();
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(panel).toBeVisible();

  // And nothing was sent to be saved, and the projects are as they were once the page is loaded again
  expect(changes).toEqual([]);
  await page.reload();
  await expect(count).toHaveText(before);
});
