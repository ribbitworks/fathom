// SPDX-License-Identifier: Apache-2.0

// Helpers for the Roles page's tests: fictional roles, the accounts holding them, and the sessions
// that edit or only see them, and ways to open a role's dialog, menu and details and read its
// permissions and summary.

import { type Account, type RoleSummary, startingRoles } from "@fathom/shared";
import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import { holdingRoles } from "./test-accounts-page.tsx";
import { findRowActions, fictionalUser } from "./test-support.tsx";

export function setUpEachTest() {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
}

export const roleEditor = () =>
  Response.json({
    ...fictionalUser,
    permissions: ["administration:view", "administration:edit", "plan:view"],
  });

export const roleViewer = () =>
  Response.json({ ...fictionalUser, permissions: ["administration:view"] });

export const teamMemberRole: RoleSummary = {
  id: "00000000-0000-4000-8000-000000000001",
  keyNumber: 1,
  key: "team-member",
  name: "Team Member",
  description: startingRoles["team-member"].description,
  permissions: [...startingRoles["team-member"].permissions],
  accounts: 3,
  updatedAt: "2026-11-01T12:00:00.000Z",
};

export const auditors: RoleSummary = {
  id: "00000000-0000-4000-8000-000000000002",
  keyNumber: 1,
  key: null,
  name: "Fictional Auditors",
  description: "Checks Personal and Confidential data for audits.",
  permissions: ["plan:view", "people:view", "personal:view"],
  accounts: 1,
  updatedAt: "2026-11-02T12:00:00.000Z",
};

export const roleList = () =>
  Response.json({ roles: [teamMemberRole, auditors] });

// A fictional account holding the roles given, the first its default.
export const fictionalAccount = (
  id: string,
  name: string,
  held: readonly [
    { id: string; name: string },
    ...{ id: string; name: string }[],
  ],
  active = true,
): Account => ({
  id,
  keyNumber: 1,
  name,
  email: `${name.toLowerCase().replace(" ", ".")}@example.test`,
  ...holdingRoles(...held),
  active,
  createdAt: "2026-10-12T09:00:00.000Z",
});

export const auditor = fictionalAccount(
  "10000000-0000-4000-8000-000000000101",
  "Fictional Auditor",
  [auditors],
);

export const accountList = () =>
  Response.json({
    accounts: [
      auditor,
      fictionalAccount(
        "10000000-0000-4000-8000-000000000102",
        "Fictional Former",
        [auditors],
        false,
      ),
      fictionalAccount(
        "10000000-0000-4000-8000-000000000103",
        "Fictional Member",
        [teamMemberRole],
      ),
    ],
  });

export async function openDialog(button: string, title: string) {
  await userEvent.click(await screen.findByRole("button", { name: button }));
  return screen.findByRole("dialog", { name: title });
}

// The ⋯ menu at the end of a role's row.
export async function roleMenu(role: string) {
  await userEvent.click(await findRowActions(role));
  return screen.findByRole("menu");
}

export const itemNames = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole("menuitem")
    .map(({ textContent }) => textContent);

// Opens a role's dialog from the item of its row's menu given, such as Edit….
export async function openFromMenu(role: string, item: string, title: string) {
  await userEvent.click(
    within(await roleMenu(role)).getByRole("menuitem", { name: item }),
  );
  return screen.findByRole("dialog", { name: title });
}

export async function openDetails(role: string) {
  await userEvent.click(
    await screen.findByRole("button", { name: `Show details of ${role}` }),
  );
  return screen.findByRole("region", { name: role });
}

export const box = (dialog: HTMLElement, name: string) =>
  within(dialog).getByRole<HTMLInputElement>("checkbox", { name });

// The lines under one of the summary's headings, as a screen reader reads them.
export function summaryLines(dialog: HTMLElement, title: string): string[] {
  const summary = within(dialog).getByLabelText("What the role allows");
  const heading = within(summary).getByRole("heading", { name: title });
  const list = heading.parentElement?.querySelector("ul");
  return [...(list?.querySelectorAll("li") ?? [])].map(
    (item) => item.textContent,
  );
}
