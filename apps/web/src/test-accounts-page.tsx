// SPDX-License-Identifier: Apache-2.0

// Helpers for the Accounts page's tests: fictional roles and accounts, the server's answers, and
// ways to open an account's details and actions and check a generated password shown once.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect } from "vitest";
import { fictionalUser } from "./test-support.tsx";

// Every role, as the server lists them by name: starting roles and one made later.
function role(
  id: number,
  key: string | null,
  name: string,
  description: string,
  permissions: string[],
) {
  return {
    id: `00000000-0000-4000-8000-00000000000${String(id)}`,
    keyNumber: 1,
    key,
    name,
    description,
    permissions,
    accounts: 1,
    updatedAt: "2026-11-01T12:00:00.000Z",
  };
}
export const administratorRole = role(
  1,
  "administrator",
  "Administrator",
  "Manages user accounts, roles, and system settings.",
  ["administration:edit", "administration:view"],
);
export const auditorsRole = role(
  2,
  null,
  "Fictional Auditors",
  "Checks Personal data for audits.",
  ["people:view", "personal:view"],
);
export const productManagerRole = role(
  3,
  "product-manager",
  "Product Manager",
  "Edits the plan.",
  ["plan:edit"],
);
export const teamMemberRole = role(
  4,
  "team-member",
  "Team Member",
  "Sees the plan.",
  ["plan:view", "features:view"],
);
// Manages accounts and edits roles, as Administrator does, though made later.
export const keepersRole = role(
  5,
  null,
  "Fictional Keepers",
  "Keeps Fathom manageable.",
  ["administration:edit"],
);
export const roles = [
  administratorRole,
  auditorsRole,
  keepersRole,
  productManagerRole,
  teamMemberRole,
];
export const roleList = () => Response.json({ roles });
const holding = ({ id, name }: { id: string; name: string }) => ({ id, name });
// An account's default role and every role it holds: the default, then any others.
export const holdingRoles = (
  defaultRole: { id: string; name: string },
  ...others: { id: string; name: string }[]
) => ({
  role: holding(defaultRole),
  roles: [defaultRole, ...others].map(holding),
});

export const manager = () =>
  Response.json({
    ...fictionalUser,
    role: {
      ...holding(administratorRole),
      key: "administrator",
      description: "",
    },
    permissions: [
      "administration:view",
      "administration:edit",
      "plan:view",
      "features:view",
    ],
  });

export const own = {
  id: "10000000-0000-4000-8000-000000000001",
  keyNumber: 1,
  name: "Fictional Person",
  email: "person@example.test",
  ...holdingRoles(administratorRole),
  active: true,
  createdAt: "2026-10-12T09:00:00.000Z",
};
export const planner = {
  id: "10000000-0000-4000-8000-000000000002",
  keyNumber: 1,
  name: "Fictional Planner",
  email: "planner@example.test",
  ...holdingRoles(productManagerRole),
  active: true,
  createdAt: "2026-10-14T09:00:00.000Z",
};
export const former = {
  id: "10000000-0000-4000-8000-000000000003",
  keyNumber: 1,
  name: "Fictional Former",
  email: "former@example.test",
  ...holdingRoles(teamMemberRole),
  active: false,
  createdAt: "2026-10-16T09:00:00.000Z",
};
export const accountList = () =>
  Response.json({ accounts: [own, planner, former] });

// Opens an account's details beside the table, from its details button.
export async function openPanelFor(name: string): Promise<HTMLElement> {
  await userEvent.click(
    await screen.findByRole("button", { name: `Show details of ${name}` }),
  );
  // One's own account is headed with This account after the name.
  return screen.findByRole("region", {
    name: (heading) => heading === name || heading === `${name} This account`,
  });
}

export async function openEditFor(name: string): Promise<HTMLElement> {
  await userEvent.click(
    within(await openPanelFor(name)).getByRole("button", { name: "Edit…" }),
  );
  return screen.findByRole("dialog", { name: `Edit ${name}` });
}

// Opens one of the actions an account's details offer besides editing it, such as Deactivate….
export async function openAction(name: string, action: string) {
  await userEvent.click(
    within(await openPanelFor(name)).getByRole("button", {
      name: `${action}…`,
    }),
  );
}

// A password as Fathom generates one.
export const generated = "Fict2ionalGenerated9";

// Checks the dialog that shows a generated password once: what it says, the password, and its Copy
// button, then closes it with Done.
export async function showsGeneratedPassword(name: string) {
  const dialog = await screen.findByRole("dialog", {
    name: `Password for ${name}`,
  });
  expect(
    within(dialog).getByText(
      `This password is shown only once. ${name} must change it at the next sign-in.`,
    ),
  ).toBeDefined();
  const field = within(dialog).getByLabelText<HTMLInputElement>("Password");
  // Hidden until asked for, and read-only.
  expect([field.value, field.type, field.readOnly]).toEqual([
    generated,
    "password",
    true,
  ]);
  // Set up for this test, so the simulated browser has a clipboard to copy to. Copied while
  // hidden, it is still the password itself.
  const user = userEvent.setup();
  await user.click(within(dialog).getByRole("button", { name: "Copy" }));
  expect(await navigator.clipboard.readText()).toBe(generated);
  expect(within(dialog).getByRole("button", { name: "Copied" })).toBeDefined();
  const show = within(dialog).getByRole("button", { name: "Show password" });
  await user.click(show);
  expect([field.type, show.getAttribute("aria-pressed")]).toEqual([
    "text",
    "true",
  ]);
  // Selected whole on reaching it, ready to copy by hand.
  act(() => {
    field.focus();
  });
  expect([field.selectionStart, field.selectionEnd]).toEqual([
    0,
    generated.length,
  ]);
  await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).toBeNull();
  });
}
