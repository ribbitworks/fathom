// SPDX-License-Identifier: Apache-2.0

// UI tests of adding a record from its New panel: the cursor starts in its first field typed into,
// Esc reaches the panel, and a required value left empty is refused.

import { expect, test } from "@playwright/test";
import { signedInAs } from "./test-accounts.ts";

test.use({ storageState: signedInAs("productManager") });

test("refuses a new project whose Name was emptied, naming why under it and saving nothing", async ({
  page,
}) => {
  // Given the Product Manager on Projects, with the New project panel open
  await page.goto("/projects");
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

test("opens the New project panel with the cursor in Name, ready to type into", async ({
  page,
}) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: "New project" }).click();
  const panel = page.getByRole("region", { name: "New project" });
  const name = panel.getByRole("textbox", { name: "Name" });
  await expect(name).toBeFocused();
  await page.keyboard.type("Fictional Beacon");
  await expect(name).toHaveValue("Fictional Beacon");

  // And Esc first keeps what was typed, then closes the panel, asking before discarding it
  await page.keyboard.press("Escape");
  await expect(name).toHaveValue("Fictional Beacon");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Discard the new project?" }),
  ).toBeVisible();
});

test.describe("as the Engineering Director", () => {
  test.use({ storageState: signedInAs("engineeringDirector") });

  test("opens New feature team, from the Org chart's Feature teams menu, with the cursor in Name", async ({
    page,
  }) => {
    await page.goto("/org-chart?teams=feature");
    await page.getByRole("button", { name: "Feature teams" }).click();
    await page.getByRole("menuitem", { name: "New feature team" }).click();
    const panel = page.getByRole("region", { name: "New feature team" });
    await expect(panel.getByRole("textbox", { name: "Name" })).toBeFocused();

    // And Esc, with nothing entered, closes it at once
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
  });
});
