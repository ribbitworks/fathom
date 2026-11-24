// SPDX-License-Identifier: Apache-2.0

// Helpers for the Roles page's tests: fictional roles and the session that edits them, and ways to
// open a role's dialog and read its permissions and summary.

import { startingRoles } from "@fathom/shared";
import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import { fictionalUser } from "./test-support.tsx";

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

export const teamMemberRole = {
  id: "00000000-0000-4000-8000-000000000001",
  keyNumber: 1,
  key: "team-member",
  name: "Team Member",
  description: startingRoles["team-member"].description,
  permissions: [...startingRoles["team-member"].permissions],
  accounts: 3,
  updatedAt: "2026-11-01T12:00:00.000Z",
};

export const auditors = {
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

export async function openDialog(button: string, title: string) {
  await userEvent.click(await screen.findByRole("button", { name: button }));
  return screen.findByRole("dialog", { name: title });
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
