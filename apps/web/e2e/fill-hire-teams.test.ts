// SPDX-License-Identifier: Apache-2.0

// UI tests of filling a planned hire on a feature team from its details on People: the form names
// the team its person joins, from the start date entered, and saves the fill, and a team's draft
// refuses it, keeping what was entered. Each test leaves no change behind.

import type { Page } from "@playwright/test";
import { expect, test } from "./test-fixtures.ts";
import { signedInAs } from "./test-accounts.ts";
import { send } from "./test-requests.ts";

test.use({ storageState: signedInAs("engineeringOperationsManager") });

// Whatever a test drafted is discarded, however it ended.
test.afterEach(async ({ page }) => {
  await send(page, "POST", "/api/unpublished/discard", {});
});

// The seeded hire on Field tools from the month it was expected.
const hireName = "Data engineer";

const openFill = async (page: Page) => {
  await page.goto("/people");
  await page.getByRole("textbox", { name: "Search people" }).fill("REQ-2053");
  await page.getByRole("button", { name: `Fill ${hireName}` }).click();
  return page.getByRole("region", { name: "Fill this planned hire" });
};

// A row of the form, by its label.
const row = (form: ReturnType<Page["getByRole"]>, label: string) =>
  form
    .getByRole("term")
    .getByText(label, { exact: true })
    .locator("xpath=ancestor::*[dt][1]");

const nextYear = new Date().getFullYear() + 1;

test("names the team the hire's person joins, from the start entered, and saves the fill", async ({
  page,
}) => {
  // Given the fill form of a planned hire on Field tools
  const form = await openFill(page);
  // Then the team is listed with no day, since its person would join it today
  await expect(row(form, "Feature teams").getByRole("definition")).toHaveText(
    "Field tools",
  );

  // When a later start is entered
  const start = form.getByRole("textbox", { name: "Start" });
  await start.fill(`${String(nextYear)}-02-01`);
  await start.press("Tab");

  // Then the person joins it from that day, leading nothing
  await expect(row(form, "Feature teams")).toContainText(
    `Field tools from Feb 1, ${String(nextYear)}`,
  );
  await expect(row(form, "Leads")).toHaveCount(0);

  // When the fill is saved
  await form.getByRole("textbox", { name: "Name" }).fill("Fictional Joiner");
  await form.getByRole("textbox", { name: "ID" }).fill("EMP-9301");
  await form.getByRole("button", { name: "Fill", exact: true }).click();

  // Then the form closes on the person, drafted
  await expect(form).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Publish \d+ changes?$/u }),
  ).toBeVisible();
});

test("refuses the fill while a draft changes the hire's team, keeping what was entered", async ({
  page,
}) => {
  // Given a draft renaming Field tools
  await page.goto("/people");
  const teams = (await send(page, "GET", "/api/feature-teams")).body as {
    teams: { id: string; name: string }[];
  };
  const team = teams.teams.find(({ name }) => name === "Field tools");
  expect(
    (
      await send(page, "PATCH", `/api/feature-teams/${String(team?.id)}`, {
        name: "Fictional field tools",
      })
    ).ok,
  ).toBe(true);

  // When the hire on it is filled
  const form = await openFill(page);
  await form.getByRole("textbox", { name: "Name" }).fill("Fictional Joiner");
  await form.getByRole("textbox", { name: "ID" }).fill("EMP-9302");
  await form.getByRole("button", { name: "Fill", exact: true }).click();

  // Then a notification gives the reason, and the form keeps what was entered
  await expect(
    page.getByText(
      "A draft of one of this planned hire's feature teams, or one naming it, is waiting. Approve or discard it before filling the hire.",
    ),
  ).toBeVisible();
  await expect(form.getByRole("textbox", { name: "Name" })).toHaveValue(
    "Fictional Joiner",
  );
});
