// SPDX-License-Identifier: Apache-2.0

// UI tests of adding planned hires to a feature team in its details on the Org chart, as a member
// and as its lead, and of the server's refusal of a change, named in the row's picker opened again,
// with nothing saved. Each test leaves no change behind.

import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./test-fixtures.ts";
import { signedInAs } from "./test-accounts.ts";
import { send } from "./test-requests.ts";

test.use({ storageState: signedInAs("featureLead") });

// Whatever a test drafted is discarded, however it ended.
test.afterEach(async ({ page }) => {
  await send(page, "POST", "/api/unpublished/discard", {});
});

const openTeam = async (page: Page, name: string) => {
  await page.goto("/org-chart?teams=feature");
  await page
    .getByRole("button", { name: "Feature teams", exact: true })
    .click();
  await page.getByRole("menuitem", { name }).click();
  return page.getByRole("region", { name });
};

// A row of the team's details, by its label.
const row = (
  panel: Locator,
  label: "Feature lead" | "Members" | "Planned hires",
) =>
  panel
    .getByRole("term")
    .getByText(label, { exact: true })
    .locator("xpath=ancestor::*[dt][1]");

const choose = async (page: Page, label: string, option: RegExp) => {
  await page.getByRole("button", { name: `Change ${label}` }).click();
  await page.getByRole("option", { name: option }).click();
};

const publish = (page: Page) =>
  page.getByRole("button", { name: /^Publish \d+ changes?$/u });

test("adds a planned hire to a team as a member, then makes it the lead, as one draft", async ({
  page,
}) => {
  // Given the Feature Lead in Identity's details
  const panel = await openTeam(page, "Identity");

  // When an unnamed planned hire is added as a member
  await choose(page, "Members", /^SDET, TBD-/u);
  await page.keyboard.press("Enter");

  // Then Planned hires lists it, with its draft's dot, and Members doesn't
  await expect(row(panel, "Planned hires")).toContainText(
    /SDET, TBD-\d+ #HIRE-\d+, added/u,
  );
  await expect(row(panel, "Members")).not.toContainText(/SDET/u);

  // When it is made the team's lead
  await choose(page, "Feature lead", /^SDET, TBD-/u);

  // Then Feature lead names it, and the change waits to be published
  await expect(row(panel, "Feature lead")).toContainText(/SDET, TBD-\d+/u);
  await expect(publish(page)).toHaveText("Publish 1 change");
});

test("makes a planned hire not on a team its lead straight away", async ({
  page,
}) => {
  // Given the Feature Lead in Data pipeline's details
  const panel = await openTeam(page, "Data pipeline");

  // When an unnamed planned hire is chosen as its lead
  await choose(page, "Feature lead", /^Engineering Manager, TBD-/u);

  // Then it leads the team and is one of its planned hires, in one draft
  await expect(row(panel, "Feature lead")).toContainText(
    /Engineering Manager, TBD-\d+/u,
  );
  await expect(row(panel, "Planned hires")).toContainText(
    /Engineering Manager, TBD-\d+/u,
  );
  await expect(publish(page)).toHaveText("Publish 1 change");
});

test("opens Feature lead again on a refused change, with the reason under it, saving nothing", async ({
  page,
}) => {
  // Given the Feature Lead's own draft adding an unnamed planned hire to Identity from a later day
  await page.goto("/org-chart?teams=feature");
  const teams = (await send(page, "GET", "/api/feature-teams")).body as {
    teams: { id: string; name: string }[];
  };
  const chart = (await send(page, "GET", "/api/org-chart")).body as {
    people: { id: string; preferredName: string }[];
  };
  const identity = teams.teams.find(({ name }) => name === "Identity");
  const hire = chart.people.find(({ preferredName }) =>
    preferredName.startsWith("SDET, TBD-"),
  );
  expect(
    (
      await send(page, "PATCH", `/api/feature-teams/${String(identity?.id)}`, {
        add: [hire?.id],
        from: "2099-01-01",
      })
    ).ok,
  ).toBe(true);

  // When the hire is made its lead from today, in Identity's details
  const panel = await openTeam(page, "Identity");
  await choose(page, "Feature lead", /^SDET, TBD-/u);

  // Then Feature lead's picker is open again, refused, with the cursor in it, the hire still
  // chosen and the reason under the row, and only the earlier draft waits to be published
  const lead = row(panel, "Feature lead");
  const picker = lead.getByRole("textbox", { name: "Feature lead" });
  await expect(picker).toBeFocused();
  await expect(picker).toHaveAttribute("aria-invalid", "true");
  await expect(lead.locator("[id$='-problem']")).not.toBeEmpty();
  await expect(
    page.getByRole("option", { name: /^SDET, TBD-/u }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(publish(page)).toHaveText("Publish 1 change");

  // And Esc puts the row back
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await expect(lead).not.toContainText("SDET, TBD-");
});
