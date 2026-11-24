// SPDX-License-Identifier: Apache-2.0

// UI tests of a project's activities in its details on Projects: adding one, the form's refusals,
// and where focus goes as their panels close.

import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { signIn } from "./test-accounts.ts";

// Signed in once for the whole file, since signing in again for each test meets the limit on
// attempts.
let cookies: Awaited<ReturnType<BrowserContext["cookies"]>> = [];

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({
    baseURL: String(test.info().project.use.baseURL),
  });
  await signIn(page, "/projects", "product.manager@fathom.test");
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  cookies = await page.context().cookies();
  await page.close();
});

async function openCraneControl(page: Page) {
  await page.context().addCookies(cookies);
  await page.goto("/projects");
  await page
    .getByRole("button", { name: "Actions for Crane Control" })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Show details" }).click();
  return page.getByRole("region", { name: "Activities" });
}

// The requests that would change data, so a test can show nothing was sent.
function changesSent(page: Page): string[] {
  const changes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("/api/"))
      changes.push(`${request.method()} ${request.url()}`);
  });
  return changes;
}

test("adds an activity to a project, showing its details and listing it with its total effort", async ({
  page,
}) => {
  // Given Crane Control's details, with the New activity form open
  const activities = await openCraneControl(page);
  await activities.getByRole("button", { name: "Add activity" }).click();
  const form = page.getByRole("region", { name: "New activity" });
  await expect(form.getByText("P-2001 Crane Control")).toBeVisible();

  // When a name and a total effort are entered, and the activity added
  await form.getByRole("textbox", { name: "Name" }).fill("Go-live support");
  await form.getByRole("textbox", { name: "Total effort" }).fill("80");
  await form.getByRole("button", { name: "Add", exact: true }).click();

  // Then its details open, and the project's activities list it with its effort
  await expect(
    page.getByRole("region", { name: /^Go-live support/ }),
  ).toBeVisible();
  await expect(form).toBeHidden();
  await expect(
    activities.getByRole("button", { name: "Go-live support", exact: true }),
  ).toBeVisible();
  await expect(activities.getByText("Total effort: 80 hours")).toBeVisible();
});

test("refuses a new activity with no name, naming why under Name and saving nothing", async ({
  page,
}) => {
  // Given the New activity form open, with nothing entered
  const activities = await openCraneControl(page);
  await activities.getByRole("button", { name: "Add activity" }).click();
  const form = page.getByRole("region", { name: "New activity" });
  const name = form.getByRole("textbox", { name: "Name" });
  const changes = changesSent(page);

  // When the activity is added
  await form.getByRole("button", { name: "Add", exact: true }).click();

  // Then the reason shows under Name, which has the focus, and nothing was sent
  await expect(name).toHaveAccessibleDescription(/Name needed/);
  await expect(name).toBeFocused();
  await expect(form).toBeVisible();
  expect(changes).toEqual([]);
});

test("refuses a name another of the project's activities has, keeping what was entered", async ({
  page,
}) => {
  // Given the New activity form open
  const activities = await openCraneControl(page);
  const before = await activities.innerText();
  await activities.getByRole("button", { name: "Add activity" }).click();
  const form = page.getByRole("region", { name: "New activity" });
  const name = form.getByRole("textbox", { name: "Name" });

  // When the name of one of Crane Control's activities is entered, and the activity added
  await name.fill("General");
  await form.getByRole("button", { name: "Add", exact: true }).click();

  // Then the server's reason shows, the form keeps the name, and the activities are as they were
  await expect(
    page.getByText("This project already has an activity with that name"),
  ).toBeVisible();
  await expect(name).toHaveValue("General");
  expect(await activities.innerText()).toBe(before);
});

test("asks before discarding a new activity with something entered", async ({
  page,
}) => {
  // Given the New activity form with a name typed
  const activities = await openCraneControl(page);
  await activities.getByRole("button", { name: "Add activity" }).click();
  const form = page.getByRole("region", { name: "New activity" });
  const name = form.getByRole("textbox", { name: "Name" });
  await name.fill("Site survey");

  // When it is cancelled, and the question answered Keep adding
  await form.getByRole("button", { name: "Cancel" }).click();
  const question = page.getByRole("dialog", {
    name: "Discard the new activity?",
  });
  await question.getByRole("button", { name: "Keep adding" }).click();

  // Then the form stays, with the name typed
  await expect(question).toBeHidden();
  await expect(name).toHaveValue("Site survey");
});

test("closes an untouched New activity without asking, putting focus on Add activity", async ({
  page,
}) => {
  // Given the New activity form open, with nothing entered
  const activities = await openCraneControl(page);
  const add = activities.getByRole("button", { name: "Add activity" });
  await add.click();
  const form = page.getByRole("region", { name: "New activity" });

  // When it is cancelled
  await form.getByRole("button", { name: "Cancel" }).click();

  // Then it closes with no question, and Add activity has the focus
  await expect(form).toBeHidden();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(add).toBeFocused();
});

test("closes an activity's details, putting focus back on its link", async ({
  page,
}) => {
  // Given Data migration's details open from Crane Control's activities
  const activities = await openCraneControl(page);
  const link = activities.getByRole("button", {
    name: "Data migration",
    exact: true,
  });
  await link.click();
  const details = page.getByRole("region", { name: /^Data migration/ });
  await expect(details.getByText("#ACTIVITY-2")).toBeVisible();

  // When they are closed with their ×
  await details.getByRole("button", { name: /^Close/ }).click();

  // Then they close, the project's details stay, and the activity's link has the focus
  await expect(details).toBeHidden();
  await expect(activities).toBeVisible();
  await expect(link).toBeFocused();
});
