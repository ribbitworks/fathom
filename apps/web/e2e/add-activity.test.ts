// SPDX-License-Identifier: Apache-2.0

// UI tests of Add activity in a project's details: New activity opens stacked under them on the same
// page, with the project set and the cursor in Name, and closing it puts focus back on Add activity.

import { expect, test } from "./test-fixtures.ts";
import { signedInAs } from "./test-accounts.ts";

test.use({ storageState: signedInAs("productManager") });

test("opens New activity under a project's details, with the project set, then puts focus back on Add activity", async ({
  page,
}) => {
  // Given Crane Control's details on Projects
  await page.goto("/projects");
  const craneId = await page.evaluate(async () => {
    const plan = (await (await fetch("/api/projects")).json()) as {
      projects: { id: string; name: string }[];
    };
    return plan.projects.find(({ name }) => name === "Crane Control")?.id;
  });
  await page.goto(`/projects?open=${String(craneId)}`);
  const details = page.getByRole("region", { name: /Crane Control/ });
  const add = details.getByRole("button", { name: "Add activity" });

  // When Add activity is selected
  await add.click();

  // Then New activity opens under the details, on Projects, with the project set and the cursor in
  // Name
  const form = page.getByRole("region", { name: "New activity" });
  await expect(form).toBeVisible();
  await expect(details).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/projects");
  await expect(form).toContainText("P-2001 Crane Control");
  await expect(form.getByRole("textbox", { name: "Name" })).toBeFocused();

  // And Cancel, with nothing typed, closes it without asking, focus back on Add activity
  await form.getByRole("button", { name: "Cancel" }).click();
  await expect(form).toBeHidden();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(add).toBeFocused();
});
