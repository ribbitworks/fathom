// SPDX-License-Identifier: Apache-2.0

// UI tests of adding a record from its New panel: the cursor starts in its first field typed into,
// Enter adds the record or fills a planned hire, Esc reaches the panel, and a required value left
// empty, or an activity of no owner, is refused.

import { expect, test } from "@playwright/test";
import { signedInAs } from "./test-accounts.ts";

test.use({ storageState: signedInAs("productManager") });

test("refuses a new project whose Name was emptied, naming why under it and saving nothing", async ({
  page,
}) => {
  // Given the Product Manager on Projects, with the New project panel open
  await page.goto("/projects");
  await page.getByRole("tab", { name: "Projects" }).click();
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
  await page.getByRole("tab", { name: "Projects" }).click();
  await expect(count).toHaveText(before);
});

test("adds a new customer with Enter in its Name", async ({ page }) => {
  // Given the New customer panel open on Projects' Customers
  await page.goto("/projects?tab=customers");
  const count = page.getByRole("status").filter({ hasText: /customers?$/ });
  const counted = await count.innerText();
  expect(counted).toMatch(/^\d+ customers?$/);
  const before = Number.parseInt(counted, 10);
  await page.getByRole("button", { name: "New customer" }).click();
  const panel = page.getByRole("region", { name: "New customer" });

  // When a name is typed and Enter pressed
  await panel.getByRole("textbox", { name: "Name" }).fill("Fictional Wharf");
  await panel.getByRole("textbox", { name: "Name" }).press("Enter");

  // Then the panel closes and the table counts one customer more
  await expect(panel).toHaveCount(0);
  await expect(count).toHaveText(`${String(before + 1)} customers`);
});

test("opens the New project panel with the cursor in Name, ready to type into", async ({
  page,
}) => {
  await page.goto("/projects");
  await page.getByRole("tab", { name: "Projects" }).click();
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

  test("fills a planned hire with Enter in the Fill form's ID", async ({
    page,
  }) => {
    // Given the Fill form of 'Backend engineer 2', a name typed
    await page.goto("/people");
    await page.getByPlaceholder("Search").fill("Backend engineer 2");
    await page
      .getByRole("button", { name: /^Fill Backend engineer 2/ })
      .click();
    await page.getByRole("textbox", { name: "Name" }).fill("Fictional Starter");

    // When an ID is typed and Enter pressed
    const id = page.getByRole("textbox", { name: "ID" });
    await id.fill("EMP-9001");
    await id.press("Enter");

    // Then the hire is filled: the details are headed with the new person's name
    await expect(
      page.getByRole("heading", { name: /Fictional Starter/ }),
    ).toBeVisible();
  });
});

test("refuses a new activity of neither a release nor a project, naming why under Release and saving nothing", async ({
  page,
}) => {
  // Given the Product Manager on Activities, with the New activity panel open
  await page.goto("/activities");
  const count = page.getByRole("status").filter({ hasText: /activit(y|ies)$/ });
  const before = await count.innerText();
  expect(before).toMatch(/^\d+ activit(y|ies)$/);
  const changes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("/api/"))
      changes.push(`${request.method()} ${request.url()}`);
  });
  await page.getByRole("button", { name: "New activity" }).click();
  const panel = page.getByRole("region", { name: "New activity" });

  // When it is named, with no release or project, and added
  await panel
    .getByRole("textbox", { name: "Name" })
    .fill("Fictional Rehearsal");
  await panel.getByRole("button", { name: "Add", exact: true }).click();

  // Then the reason shows under Release, which has the focus
  const release = panel.getByRole("button", { name: "Change Release" });
  await expect(panel.getByText("Choose a release or a project")).toBeVisible();
  await expect(release).toBeFocused();
  await expect(panel).toBeVisible();

  // And nothing was sent to be saved, and the activities are as they were once the page is loaded
  // again
  expect(changes).toEqual([]);
  await page.reload();
  await expect(count).toHaveText(before);
});
