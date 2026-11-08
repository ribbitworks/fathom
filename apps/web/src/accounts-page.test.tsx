// SPDX-License-Identifier: Apache-2.0

// Tests for the Accounts page and the Change name and Change password dialogs, with the server's
// responses simulated: who sees the Accounts page, the list of accounts, creating accounts, editing
// their names, email addresses, and their one role, chosen from every role, resetting passwords,
// with the password Fathom generates shown once, deactivating and reactivating, the server's
// refusals, changing one's own name and password, with the checklist of what a new password must
// meet, and changing a generated password before anything else.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fictionalUser,
  greeting,
  renderApp,
  serverAnswers,
  signedIn,
  signedOut,
} from "./test-support.tsx";

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
    key,
    name,
    description,
    permissions,
    accounts: 1,
    updatedAt: "2026-11-01T12:00:00.000Z",
  };
}
const administratorRole = role(
  1,
  "administrator",
  "Administrator",
  "Manages user accounts, roles, and system settings.",
  ["accounts:manage", "roles:edit", "settings:edit", "history:view"],
);
const auditorsRole = role(
  2,
  null,
  "Fictional Auditors",
  "Checks Restricted data for audits.",
  ["people:view", "restricted:view"],
);
const productManagerRole = role(
  3,
  "product-manager",
  "Product Manager",
  "Edits the plan.",
  ["plan:edit"],
);
const teamMemberRole = role(4, "team-member", "Team Member", "Sees the plan.", [
  "plan:view",
]);
// Manages accounts and edits roles, as Administrator does, though made later.
const keepersRole = role(
  5,
  null,
  "Fictional Keepers",
  "Keeps Fathom manageable.",
  ["accounts:manage", "roles:edit"],
);
const roles = [
  administratorRole,
  auditorsRole,
  keepersRole,
  productManagerRole,
  teamMemberRole,
];
const roleList = () => Response.json({ roles });
const holding = ({ id, name }: { id: string; name: string }) => ({ id, name });

const manager = () =>
  Response.json({
    ...fictionalUser,
    role: {
      ...holding(administratorRole),
      key: "administrator",
      description: "",
    },
    permissions: ["accounts:view", "accounts:manage", "plan:view"],
  });

const own = {
  id: "user-1",
  name: "Fictional Person",
  email: "person@example.test",
  role: holding(administratorRole),
  active: true,
  createdAt: "2026-10-12T09:00:00.000Z",
};
const planner = {
  id: "user-2",
  name: "Fictional Planner",
  email: "planner@example.test",
  role: holding(productManagerRole),
  active: true,
  createdAt: "2026-10-14T09:00:00.000Z",
};
const former = {
  id: "user-3",
  name: "Fictional Former",
  email: "former@example.test",
  role: holding(teamMemberRole),
  active: false,
  createdAt: "2026-10-16T09:00:00.000Z",
};
const accountList = () => Response.json({ accounts: [own, planner, former] });

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openEditFor(name: string): Promise<HTMLElement> {
  await userEvent.click(
    await screen.findByRole("button", { name: `Edit ${name}` }),
  );
  return screen.findByRole("dialog", { name: `Edit ${name}` });
}

// Opens one of the actions an account's Edit dialog offers besides saving.
async function openAction(name: string, action: string) {
  await userEvent.click(
    within(await openEditFor(name)).getByRole("button", { name: action }),
  );
}

// A password as Fathom generates one.
const generated = "Fict2ionalGenerated9";

// Checks the dialog that shows a generated password once: what it says, the password, and its Copy
// button, then closes it with Done.
async function showsGeneratedPassword(name: string) {
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

describe("who sees the Accounts page", () => {
  it("links to it for users who may manage accounts", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/greeting": greeting,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
    });
    renderApp("/");
    await userEvent.click(
      await screen.findByRole("link", { name: "Accounts" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Accounts" }),
    ).toBeDefined();
  });

  it("is not linked for anyone else", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    expect(await screen.findByText("Hello, Fathom")).toBeDefined();
    expect(screen.queryByRole("link", { name: "Accounts" })).toBeNull();
  });

  it("shows every account, without changing any, to users who may only see accounts", async () => {
    // Given
    const fetch = serverAnswers({
      "GET /api/session": () =>
        Response.json({ ...fictionalUser, permissions: ["accounts:view"] }),
      "GET /api/accounts": accountList,
    });
    // When
    const history = renderApp("/");
    // Then
    expect(await screen.findByText("Fictional Planner")).toBeDefined();
    expect(history.location.pathname).toBe("/accounts");
    expect(screen.getByRole("link", { name: "Accounts" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "New account" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Edit Fictional Planner" }),
    ).toBeNull();
    expect(screen.getAllByRole("columnheader")).toHaveLength(4);
    expect(fetch).not.toHaveBeenCalledWith("/api/roles", expect.anything());
  });

  it("is not shown to anyone else", async () => {
    serverAnswers({ "GET /api/session": signedIn });
    renderApp("/accounts");
    expect(
      await screen.findByText("There is no page at this address."),
    ).toBeDefined();
  });
});

describe("the list of accounts", () => {
  it("shows each account's role and status, and marks one's own", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
    });
    renderApp("/accounts");
    const row = (await screen.findByText("Fictional Planner")).closest("tr");
    expect(
      within(row as HTMLElement).getByText("Product Manager"),
    ).toBeDefined();
    expect(within(row as HTMLElement).getByText("Active")).toBeDefined();
    expect(screen.getByText("Deactivated")).toBeDefined();
    const ownRow = within(screen.getByRole("table"))
      .getByText("Fictional Person")
      .closest("tr");
    expect(within(ownRow as HTMLElement).getByText("You")).toBeDefined();
    expect(within(row as HTMLElement).queryByText("You")).toBeNull();
  });

  it("offers every change to one's own account but resetting its password, which needs the current one", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
    });
    renderApp("/accounts");
    const dialog = await openEditFor("Fictional Person");
    expect(
      within(dialog).getByRole("button", { name: "Deactivate" }),
    ).toBeDefined();
    expect(
      within(dialog).queryByRole("button", { name: "Reset password" }),
    ).toBeNull();
  });

  it("shows an account left without a role as holding none, and asks for one before saving it", async () => {
    const fetch = serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": () =>
        Response.json({ accounts: [own, { ...planner, role: null }] }),
    });
    renderApp("/accounts");
    const row = (await screen.findByText("Fictional Planner")).closest("tr");
    expect(within(row as HTMLElement).getByText("No role")).toBeDefined();
    const dialog = await openEditFor("Fictional Planner");
    expect(
      within(dialog)
        .getAllByRole<HTMLInputElement>("radio")
        .some(({ checked }) => checked),
    ).toBe(false);
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText("Choose a role.")).toBeDefined();
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/accounts/user-2",
      expect.anything(),
    );
  });

  it("shows the day each account was created", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
    });
    renderApp("/accounts");
    await screen.findByText("Fictional Planner");
    const created = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
    expect(
      screen.getAllByRole("row").flatMap((row) => {
        const time = row.querySelector("time");
        return time === null ? [] : [[time.dateTime, time.textContent]];
      }),
    ).toEqual(
      [own, planner, former].map(({ createdAt }) => [
        createdAt,
        created.format(new Date(createdAt)),
      ]),
    );
  });

  it("shows a loading indicator until the accounts arrive", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": () => new Promise<Response>(() => undefined),
    });
    renderApp("/accounts");
    expect(await screen.findByLabelText("Loading")).toBeDefined();
  });

  it("shows a message when the accounts cannot be loaded", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": () =>
        Response.json({ error: "Internal Server Error" }, { status: 500 }),
    });
    renderApp("/accounts");
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /could not load the accounts/,
    );
  });
});

describe("changing one's own account", () => {
  it("shows the new name in the top bar once saved", async () => {
    let session = manager;
    serverAnswers({
      "GET /api/session": () => session(),
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
      "PATCH /api/accounts/user-1": () => {
        session = () =>
          Response.json({
            ...fictionalUser,
            user: { ...fictionalUser.user, name: "Fictional Self" },
            permissions: ["accounts:view", "accounts:manage", "plan:view"],
          });
        return Response.json({ account: { ...own, name: "Fictional Self" } });
      },
    });
    renderApp("/accounts");
    const dialog = await openEditFor("Fictional Person");
    const name = within(dialog).getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Fictional Self");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(
      await screen.findByRole("button", {
        name: "Your account, Fictional Self",
      }),
    ).toBeDefined();
  });

  it("leaves Accounts for the first page the user may still open once their role no longer manages accounts", async () => {
    let session = manager;
    let refusedLists = 0;
    serverAnswers({
      "GET /api/session": () => session(),
      "GET /api/greeting": greeting,
      "GET /api/roles": roleList,
      "GET /api/accounts": () => {
        if (session === signedIn) {
          refusedLists += 1;
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }
        return Response.json({
          accounts: [own, { ...planner, role: holding(administratorRole) }],
        });
      },
      "PATCH /api/accounts/user-1": () => {
        session = signedIn;
        return Response.json({
          account: { ...own, role: holding(teamMemberRole) },
        });
      },
    });
    const history = renderApp("/accounts");
    const dialog = await openEditFor("Fictional Person");
    await userEvent.click(
      within(dialog).getByRole("radio", { name: "Team Member" }),
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(history.location.pathname).toBe("/");
    });
    expect(screen.queryByRole("link", { name: "Accounts" })).toBeNull();
    // The list is not asked for again, so the page never says it could not load it.
    expect(refusedLists).toBe(0);
  });

  it("says what deactivating their own account does to them", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": () =>
        Response.json({
          accounts: [own, { ...planner, role: holding(administratorRole) }],
        }),
    });
    renderApp("/accounts");
    await openAction("Fictional Person", "Deactivate");
    const dialog = await screen.findByRole("dialog", {
      name: "Deactivate Fictional Person",
    });
    expect(
      within(dialog).getByText(
        "You will be signed out everywhere, and will not be able to sign in until an Administrator reactivates your account.",
      ),
    ).toBeDefined();
  });
});

describe("the last active account that manages accounts and edits roles", () => {
  // Roles made later that each grant only one of the permissions that keep Fathom manageable.
  const accountKeepersRole = role(
    6,
    null,
    "Fictional Account Keepers",
    "Manages accounts.",
    ["accounts:manage"],
  );
  const roleEditorsRole = role(
    7,
    null,
    "Fictional Role Editors",
    "Edits roles.",
    ["roles:edit"],
  );

  async function controlsFor(accounts: object[], name = "Fictional Person") {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": () =>
        Response.json({
          roles: [...roles, accountKeepersRole, roleEditorsRole],
        }),
      "GET /api/accounts": () => Response.json({ accounts }),
    });
    renderApp("/accounts");
    const dialog = await openEditFor(name);
    const deactivate = within(dialog).getByRole("button", {
      name: "Deactivate",
    });
    const choice = (name: string) =>
      within(dialog).getByRole<HTMLInputElement>("radio", { name });
    return { deactivate, choice };
  }

  it("can neither be given a role without both nor be deactivated", async () => {
    const { deactivate, choice } = await controlsFor([own, planner, former]);
    expect((deactivate as HTMLButtonElement).disabled).toBe(true);
    expect(choice("Administrator").checked).toBe(true);
    expect(choice("Team Member").disabled).toBe(true);
    expect(choice("Fictional Keepers").disabled).toBe(false);
  });

  it("can do both once another active account's role grants both, even a role made later", async () => {
    const { deactivate, choice } = await controlsFor([
      own,
      { ...planner, role: holding(keepersRole) },
    ]);
    expect((deactivate as HTMLButtonElement).disabled).toBe(false);
    expect(choice("Team Member").disabled).toBe(false);
  });

  it("can be given a role that keeps the one permission no other active account's role grants", async () => {
    const { deactivate, choice } = await controlsFor([
      own,
      { ...planner, role: holding(accountKeepersRole) },
    ]);
    expect(choice("Fictional Role Editors").disabled).toBe(false);
    expect(choice("Fictional Account Keepers").disabled).toBe(true);
    expect(choice("Team Member").disabled).toBe(true);
    expect((deactivate as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps each permission apart, when no account's role grants both", async () => {
    const { deactivate, choice } = await controlsFor(
      [
        { ...own, role: holding(roleEditorsRole) },
        { ...planner, role: holding(accountKeepersRole) },
      ],
      "Fictional Planner",
    );
    expect((deactivate as HTMLButtonElement).disabled).toBe(true);
    expect(choice("Fictional Account Keepers").checked).toBe(true);
    expect(choice("Fictional Account Keepers").disabled).toBe(false);
    expect(choice("Fictional Role Editors").disabled).toBe(true);
    expect(choice("Administrator").disabled).toBe(false);
  });

  it("counts a deactivated account as gone", async () => {
    const { choice } = await controlsFor([
      own,
      { ...former, role: holding(administratorRole) },
    ]);
    expect(choice("Team Member").disabled).toBe(true);
  });
});

describe("finding accounts", () => {
  it("narrows the list by name or email address as you type", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
    });
    renderApp("/accounts");
    const search = await screen.findByLabelText("Search by name or email");
    await userEvent.type(search, "PLANNER@");
    expect(screen.getByText("Fictional Planner")).toBeDefined();
    expect(screen.queryByText("Fictional Former")).toBeNull();
    await userEvent.clear(search);
    await userEvent.type(search, "former");
    expect(screen.getByText("Fictional Former")).toBeDefined();
    expect(screen.queryByText("Fictional Planner")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByText("Fictional Planner")).toBeDefined();
    expect(document.activeElement).toBe(search);
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).not.toBe(search);
  });

  it("shows only active or only deactivated accounts, with how many of each", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
    });
    renderApp("/accounts");
    await userEvent.click(await screen.findByText("Deactivated 1"));
    expect(screen.getByText("Fictional Former")).toBeDefined();
    expect(screen.queryByText("Fictional Planner")).toBeNull();
    await userEvent.click(screen.getByText("Active 2"));
    expect(screen.getByText("Fictional Planner")).toBeDefined();
    expect(screen.queryByText("Fictional Former")).toBeNull();
    await userEvent.click(screen.getByText("All 3"));
    expect(screen.getByText("Fictional Former")).toBeDefined();
  });

  it("says when no account matches", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
    });
    renderApp("/accounts");
    await userEvent.type(
      await screen.findByLabelText("Search by name or email"),
      "nobody",
    );
    expect(screen.getByText("No accounts match.")).toBeDefined();
  });
});

describe("creating an account", () => {
  it("sends the new account with the one role chosen, any role, then shows its password once, to copy", async () => {
    const fetch = serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
      "POST /api/accounts": () =>
        Response.json(
          {
            account: { ...planner, id: "user-4", name: "Fictional Newcomer" },
            password: generated,
          },
          { status: 201 },
        ),
    });
    renderApp("/accounts");
    await userEvent.click(
      await screen.findByRole("button", { name: "New account" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByLabelText("Name"),
      "Fictional Newcomer",
    );
    await userEvent.type(
      within(dialog).getByLabelText("Email address"),
      "newcomer@example.test",
    );
    expect(within(dialog).queryByLabelText(/password/iu)).toBeNull();
    await userEvent.click(
      within(dialog).getByRole("radio", { name: "Fictional Auditors" }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create account" }),
    );
    await showsGeneratedPassword("Fictional Newcomer");
    expect((await screen.findByRole("status")).textContent).toBe(
      "Created the account for Fictional Newcomer.",
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/accounts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Fictional Newcomer",
          email: "newcomer@example.test",
          roleId: auditorsRole.id,
        }),
      }),
    );
  });

  it("keeps the password shown when the page behind it is clicked, and forgets it once closed", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
      "POST /api/accounts/user-2/password": () =>
        Response.json({ password: generated }),
    });
    renderApp("/accounts");
    await openAction("Fictional Planner", "Reset password");
    const reset = await screen.findByRole("dialog");
    await userEvent.click(
      within(reset).getByRole("button", { name: "Reset password" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Password for Fictional Planner",
    });
    await userEvent.click(document.body);
    expect(screen.getByRole("dialog")).toBe(dialog);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(screen.queryByDisplayValue(generated)).toBeNull();
  });

  it("chooses Team Member until another role is chosen", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
    });
    renderApp("/accounts");
    await userEvent.click(
      await screen.findByRole("button", { name: "New account" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole<HTMLInputElement>("radio", {
        name: "Team Member",
      }).checked,
    ).toBe(true);
  });

  it("points those who may edit roles to the Roles page, in New account and Edit", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: [
            "accounts:view",
            "accounts:manage",
            "roles:view",
            "roles:edit",
          ],
        }),
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
    });
    const history = renderApp("/accounts");
    const edit = await openEditFor("Fictional Planner");
    expect(
      within(edit).getByText(/^Custom roles are created on the/u),
    ).toBeDefined();
    await userEvent.click(within(edit).getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await userEvent.click(screen.getByRole("button", { name: "New account" }));
    const dialog = await screen.findByRole("dialog", { name: "New account" });
    await userEvent.click(within(dialog).getByRole("link", { name: "Roles" }));
    await waitFor(() => {
      expect(history.location.pathname).toBe("/roles");
    });
  });

  it("does not point to the Roles page those who may not edit roles", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
    });
    renderApp("/accounts");
    const edit = await openEditFor("Fictional Planner");
    expect(
      within(edit).getByRole("radio", { name: "Product Manager" }),
    ).toBeDefined();
    expect(within(edit).queryByText(/Custom roles are created/u)).toBeNull();
    expect(within(edit).queryByRole("link", { name: "Roles" })).toBeNull();
  });

  it("asks for a role when there is none to start from", async () => {
    const fetch = serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": () =>
        Response.json({ roles: [administratorRole, auditorsRole] }),
      "GET /api/accounts": accountList,
    });
    renderApp("/accounts");
    await userEvent.click(
      await screen.findByRole("button", { name: "New account" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByLabelText("Name"),
      "Fictional Newcomer",
    );
    await userEvent.type(
      within(dialog).getByLabelText("Email address"),
      "newcomer@example.test",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create account" }),
    );
    expect(await within(dialog).findByText("Choose a role.")).toBeDefined();
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/accounts",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("waits for the roles", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": () => new Promise<Response>(() => undefined),
      "GET /api/accounts": accountList,
    });
    renderApp("/accounts");
    await userEvent.click(
      await screen.findByRole("button", { name: "New account" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Loading")).toBeDefined();
  });

  it("says when the roles cannot be loaded", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": () =>
        Response.json({ error: "Internal Server Error" }, { status: 500 }),
      "GET /api/accounts": accountList,
    });
    renderApp("/accounts");
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit Fictional Planner" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      "Fathom could not load the roles. Try again in a moment.",
    );
  });

  it("asks for a name and a valid email address", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
    });
    renderApp("/accounts");
    await userEvent.click(
      await screen.findByRole("button", { name: "New account" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByLabelText("Email address"),
      "nope",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create account" }),
    );
    expect(
      await within(dialog).findByText("Enter the person's name."),
    ).toBeDefined();
    expect(
      within(dialog).getByText("Enter a valid email address."),
    ).toBeDefined();
  });

  it("shows the server's message when it refuses, and stays open", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
      "POST /api/accounts": () =>
        Response.json(
          { error: "An account with this email address already exists" },
          { status: 409 },
        ),
    });
    renderApp("/accounts");
    await userEvent.click(
      await screen.findByRole("button", { name: "New account" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByLabelText("Name"),
      "Fictional Twin",
    );
    await userEvent.type(
      within(dialog).getByLabelText("Email address"),
      "planner@example.test",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create account" }),
    );
    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      "An account with this email address already exists",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});

describe("changing an account", () => {
  it("changes its name, email address, and role together", async () => {
    const fetch = serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
      "PATCH /api/accounts/user-2": () =>
        Response.json({
          account: {
            ...planner,
            name: "Fictional Planning",
            role: holding(teamMemberRole),
          },
        }),
    });
    renderApp("/accounts");
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit Fictional Planner" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Edit Fictional Planner",
    });
    const name = within(dialog).getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Fictional Planning");
    const email = within(dialog).getByLabelText("Email address");
    await userEvent.clear(email);
    await userEvent.type(email, "planning@example.test");
    await userEvent.click(
      within(dialog).getByRole("radio", { name: "Team Member" }),
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("status")).textContent).toBe(
      "Saved the account for Fictional Planning.",
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/accounts/user-2",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          name: "Fictional Planning",
          email: "planning@example.test",
          roleId: teamMemberRole.id,
        }),
      }),
    );
  });

  it("asks for a name and a valid email address when editing", async () => {
    const fetch = serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
    });
    renderApp("/accounts");
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit Fictional Planner" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.clear(within(dialog).getByLabelText("Name"));
    const email = within(dialog).getByLabelText("Email address");
    await userEvent.clear(email);
    await userEvent.type(email, "not an address");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(
      await within(dialog).findByText("Enter the person's name."),
    ).toBeDefined();
    expect(
      within(dialog).getByText("Enter a valid email address."),
    ).toBeDefined();
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/accounts/user-2",
      expect.anything(),
    );
  });

  it("resets its password, then shows the new one once, to copy", async () => {
    const fetch = serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
      "POST /api/accounts/user-2/password": () =>
        Response.json({ password: generated }),
    });
    renderApp("/accounts");
    await openAction("Fictional Planner", "Reset password");
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(
        "Fictional Planner will be signed out of every session. Fathom will generate a new password, which Fictional Planner must change at the next sign-in.",
      ),
    ).toBeDefined();
    expect(within(dialog).queryByLabelText(/password/iu)).toBeNull();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Reset password" }),
    );
    await showsGeneratedPassword("Fictional Planner");
    expect((await screen.findByRole("status")).textContent).toBe(
      "Reset the password for Fictional Planner.",
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/accounts/user-2/password",
      expect.objectContaining({ method: "POST", body: "{}" }),
    );
  });

  it("says why a reset was refused, and stays open", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
      "POST /api/accounts/user-2/password": () =>
        Response.json({ error: "There is no such account" }, { status: 404 }),
    });
    renderApp("/accounts");
    await openAction("Fictional Planner", "Reset password");
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Reset password" }),
    );
    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      "There is no such account",
    );
  });

  it.each([
    [
      "deactivates an active account",
      "Fictional Planner",
      "user-2",
      "Deactivate",
      false,
    ],
    [
      "reactivates a deactivated one",
      "Fictional Former",
      "user-3",
      "Reactivate",
      true,
    ],
  ] as const)("%s", async (_case, name, id, action, active) => {
    const fetch = serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
      [`PUT /api/accounts/${id}/active`]: () =>
        Response.json({ account: { ...planner, id, active } }),
    });
    renderApp("/accounts");
    await openAction(name, action);
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: action }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(fetch).toHaveBeenCalledWith(
      `/api/accounts/${id}/active`,
      expect.objectContaining({ body: JSON.stringify({ active }) }),
    );
  });
});

// Each requirement in the checklist under New password, as a screen reader reads it, with its
// state: met, pending (not met, while typing), or unmet (not met, shown in red).
const checklist = (container: HTMLElement) =>
  within(container)
    .getAllByRole("listitem")
    .map((item) => [item.textContent, item.dataset.state]);

describe("changing one's own password", () => {
  async function openDialog(): Promise<HTMLElement> {
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Your account, Fictional Person",
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Change password" }),
    );
    return screen.findByRole("dialog", { name: "Change password" });
  }

  async function changePassword(
    dialog: HTMLElement,
    current: string,
    next: string,
    repeated = next,
  ) {
    await userEvent.type(
      within(dialog).getByLabelText("Current password"),
      current,
    );
    await userEvent.type(within(dialog).getByLabelText("New password"), next);
    await userEvent.type(
      within(dialog).getByLabelText("New password again"),
      repeated,
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Change password" }),
    );
  }

  it("is offered to every user, and confirms the change like other changes", async () => {
    const fetch = serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
      "POST /api/auth/change-password": () => Response.json({}),
    });
    renderApp("/");
    await changePassword(
      await openDialog(),
      "fictional password 1",
      "fictional password 2",
    );
    expect(
      await screen.findByText(
        "Your password has been changed, and you have been signed out everywhere else.",
      ),
    ).toBeDefined();
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Change password" }),
      ).toBeNull();
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/change-password",
      expect.objectContaining({
        body: JSON.stringify({
          currentPassword: "fictional password 1",
          newPassword: "fictional password 2",
        }),
      }),
    );
  });

  it("asks for the new password twice, the same each time", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    const dialog = await openDialog();
    await changePassword(
      dialog,
      "fictional password 1",
      "fictional password 2",
      "different",
    );
    expect(
      await within(dialog).findByText("The new passwords do not match."),
    ).toBeDefined();
  });

  it("shows the rules from the start, and asks for the current password and a long enough new one", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    const dialog = await openDialog();
    expect(checklist(dialog)).toEqual([
      ["12 to 128 characters (not met)", "pending"],
      ["Not a common or easily guessed password (not met)", "pending"],
    ]);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Change password" }),
    );
    expect(
      await within(dialog).findByText("Enter your current password."),
    ).toBeDefined();
    expect(
      within(dialog).getByText(
        "The password must have at least 12 characters.",
      ),
    ).toBeDefined();
  });

  it("follows the rules in the password settings, saying what a new password lacks", async () => {
    const fetch = serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          settings: {
            ...fictionalUser.settings,
            passwords: {
              ...fictionalUser.settings.passwords,
              rules: {
                minimumLength: 14,
                uppercase: true,
                lowercase: false,
                digits: false,
                symbols: true,
              },
            },
          },
        }),
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    const dialog = await openDialog();
    expect(checklist(dialog).map(([text]) => text)).toEqual([
      "14 to 128 characters (not met)",
      "An uppercase letter (not met)",
      "A symbol (not met)",
      "Not a common or easily guessed password (not met)",
    ]);
    await changePassword(
      dialog,
      "fictional password 1",
      "fictional password 2",
    );
    expect(
      await within(dialog).findByText(
        "The password must include an uppercase letter and a symbol.",
      ),
    ).toBeDefined();
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/auth/change-password",
      expect.anything(),
    );
  });

  it("puts the server's refusal of a new password plainly", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
      "POST /api/auth/change-password": () =>
        Response.json(
          { error: "The password must include a symbol." },
          { status: 400 },
        ),
    });
    renderApp("/");
    const dialog = await openDialog();
    await changePassword(
      dialog,
      "fictional password 1",
      "fictional password 2",
    );
    expect(
      await within(dialog).findByText("The password must include a symbol."),
    ).toBeDefined();
  });

  it("asks for a new password that differs from the current one", async () => {
    const fetch = serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    const dialog = await openDialog();
    await changePassword(
      dialog,
      "fictional password 1",
      "fictional password 1",
    );
    expect(
      await within(dialog).findByText(
        "The new password must differ from the current password.",
      ),
    ).toBeDefined();
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/auth/change-password",
      expect.anything(),
    );
  });

  it("names a wrong current password beside it, keeping the dialog open", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
      "POST /api/auth/change-password": () =>
        Response.json({ code: "INVALID_PASSWORD" }, { status: 400 }),
    });
    renderApp("/");
    const dialog = await openDialog();
    await changePassword(dialog, "not the password", "fictional password 2");
    expect(
      await within(dialog).findByText("Your current password is not right."),
    ).toBeDefined();
    expect(within(dialog).queryByRole("alert")).toBeNull();
    expect(document.activeElement).toBe(
      within(dialog).getByLabelText("Current password"),
    );
  });

  it("starts afresh when opened again", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
      "POST /api/auth/change-password": () =>
        Response.json({ code: "INVALID_PASSWORD" }, { status: 400 }),
    });
    renderApp("/");
    const first = await openDialog();
    await changePassword(first, "not the password", "fictional password 2");
    await within(first).findByText("Your current password is not right.");
    await userEvent.click(
      within(first).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Change password" }),
      ).toBeNull();
    });
    const dialog = await openDialog();
    for (const label of [
      "Current password",
      "New password",
      "New password again",
    ]) {
      expect(within(dialog).getByLabelText<HTMLInputElement>(label).value).toBe(
        "",
      );
    }
    expect(
      within(dialog).queryByText("Your current password is not right."),
    ).toBeNull();
  });

  it("stays open while the change is being saved", async () => {
    let answer: (response: Response) => void = () => undefined;
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
      "POST /api/auth/change-password": () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    });
    renderApp("/");
    const dialog = await openDialog();
    await changePassword(
      dialog,
      "fictional password 1",
      "fictional password 2",
    );
    await userEvent.keyboard("{Escape}");
    expect(
      screen.getByRole("dialog", { name: "Change password" }),
    ).toBeDefined();
    expect(within(dialog).queryByRole("button", { name: "Close" })).toBeNull();
    answer(Response.json({}));
    expect(
      await screen.findByText(
        "Your password has been changed, and you have been signed out everywhere else.",
      ),
    ).toBeDefined();
  });

  it("explains another refusal plainly", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
      "POST /api/auth/change-password": () =>
        Response.json({ error: "Fictional" }, { status: 500 }),
    });
    renderApp("/");
    const dialog = await openDialog();
    await changePassword(
      dialog,
      "fictional password 1",
      "fictional password 2",
    );
    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      "Fathom could not make this change. Try again in a moment.",
    );
  });
});

describe("the checklist for a new password", () => {
  async function openDialog(): Promise<HTMLElement> {
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Your account, Fictional Person",
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Change password" }),
    );
    return screen.findByRole("dialog", { name: "Change password" });
  }

  const withAllRules = () =>
    Response.json({
      ...fictionalUser,
      settings: {
        ...fictionalUser.settings,
        passwords: {
          ...fictionalUser.settings.passwords,
          rules: {
            minimumLength: 14,
            uppercase: true,
            lowercase: true,
            digits: true,
            symbols: true,
          },
        },
      },
    });

  it("marks each requirement met as it is typed, and leaves the others neutral", async () => {
    serverAnswers({ "GET /api/session": withAllRules });
    renderApp("/");
    const dialog = await openDialog();
    const field = within(dialog).getByLabelText("New password");
    await userEvent.type(field, "a1");
    expect(checklist(dialog)).toEqual([
      ["14 to 128 characters (not met)", "pending"],
      ["An uppercase letter (not met)", "pending"],
      ["A lowercase letter (met)", "met"],
      ["A digit (met)", "met"],
      ["A symbol (not met)", "pending"],
      ["Not a common or easily guessed password (not met)", "pending"],
    ]);
    await userEvent.clear(field);
    await userEvent.type(field, "Correct-horse-91");
    await waitFor(() => {
      expect(checklist(dialog).every(([, state]) => state === "met")).toBe(
        true,
      );
    });
    expect(checklist(dialog).map(([text]) => text)).toEqual([
      "14 to 128 characters (met)",
      "An uppercase letter (met)",
      "A lowercase letter (met)",
      "A digit (met)",
      "A symbol (met)",
      "Not a common or easily guessed password (met)",
    ]);
  });

  it("is read with the field, and turns what is not met red only once the field is left", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    const dialog = await openDialog();
    const field = within(dialog).getByLabelText("New password");
    const list = within(dialog).getByRole("list");
    expect(field.getAttribute("aria-describedby")).toContain(
      list.parentElement?.id,
    );
    await userEvent.type(field, "test1234");
    expect(checklist(dialog)).toEqual([
      ["12 to 128 characters (not met)", "pending"],
      ["Not a common or easily guessed password (not met)", "pending"],
    ]);
    await userEvent.tab();
    expect(checklist(dialog)).toEqual([
      ["12 to 128 characters (not met)", "unmet"],
      ["Not a common or easily guessed password (not met)", "unmet"],
    ]);
  });

  it("turns what is not met red once the form is sent, though the field is not left", async () => {
    const fetch = serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    const dialog = await openDialog();
    await userEvent.type(
      within(dialog).getByLabelText("New password"),
      "short{Enter}",
    );
    await waitFor(() => {
      expect(checklist(dialog)).toEqual([
        ["12 to 128 characters (not met)", "unmet"],
        ["Not a common or easily guessed password (not met)", "unmet"],
      ]);
    });
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/auth/change-password",
      expect.anything(),
    );
  });

  it.each([
    ["a common password", "test12345678"],
    ["a password built from the person's own name", "Fictional2026!"],
  ])("refuses %s before sending it", async (_, password) => {
    const fetch = serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    const dialog = await openDialog();
    await userEvent.type(
      within(dialog).getByLabelText("Current password"),
      "fictional password 1",
    );
    const field = within(dialog).getByLabelText("New password");
    // A strong password first, so the check has loaded before the one tried is sent.
    await userEvent.type(field, "Correct-horse-91");
    await waitFor(() => {
      expect(checklist(dialog).at(-1)?.[1]).toBe("met");
    });
    await userEvent.clear(field);
    await userEvent.type(field, password);
    expect(checklist(dialog).at(-1)).toEqual([
      "Not a common or easily guessed password (not met)",
      "pending",
    ]);
    await userEvent.type(
      within(dialog).getByLabelText("New password again"),
      password,
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Change password" }),
    );
    expect(
      await within(dialog).findByText(
        "This password is too common or easy to guess.",
      ),
    ).toBeDefined();
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/auth/change-password",
      expect.anything(),
    );
  });
});

describe("changing one's own name", () => {
  async function openDialog(): Promise<HTMLElement> {
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Your account, Fictional Person",
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Change name" }),
    );
    return screen.findByRole("dialog", { name: "Change name" });
  }

  it("is offered to every user, starts from their name, and confirms the change like other changes", async () => {
    let session = signedIn;
    const fetch = serverAnswers({
      "GET /api/session": () => session(),
      "GET /api/greeting": greeting,
      "PUT /api/account/name": () => {
        session = () =>
          Response.json({
            ...fictionalUser,
            user: { ...fictionalUser.user, name: "Fictional Renamed" },
          });
        return new Response(null, { status: 204 });
      },
    });
    renderApp("/");
    const dialog = await openDialog();
    const name = within(dialog).getByLabelText("Name");
    expect((name as HTMLInputElement).value).toBe("Fictional Person");
    await userEvent.clear(name);
    await userEvent.type(name, "Fictional Renamed");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Your name has been changed."),
    ).toBeDefined();
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Change name" })).toBeNull();
    });
    expect(
      await screen.findByRole("button", {
        name: "Your account, Fictional Renamed",
      }),
    ).toBeDefined();
    expect(fetch).toHaveBeenCalledWith(
      "/api/account/name",
      expect.objectContaining({
        body: JSON.stringify({ name: "Fictional Renamed" }),
      }),
    );
  });

  it("asks for a name", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    const dialog = await openDialog();
    await userEvent.clear(within(dialog).getByLabelText("Name"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText("Enter your name.")).toBeDefined();
  });

  it("names the rule a name breaks", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    const dialog = await openDialog();
    const name = within(dialog).getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "n".repeat(101));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(
      await within(dialog).findByText("Use at most 100 characters."),
    ).toBeDefined();
  });

  it("explains a refusal plainly, keeping the dialog open", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
      "PUT /api/account/name": () =>
        Response.json(
          { error: "Another account already has that name; choose another" },
          { status: 409 },
        ),
    });
    renderApp("/");
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      "Another account already has that name; choose another",
    );
  });

  it("stays open while the change is being saved", async () => {
    let answer: (response: Response) => void = () => undefined;
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
      "PUT /api/account/name": () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    });
    renderApp("/");
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "Change name" })).toBeDefined();
    expect(within(dialog).queryByRole("button", { name: "Close" })).toBeNull();
    answer(new Response(null, { status: 204 }));
    expect(
      await screen.findByText("Your name has been changed."),
    ).toBeDefined();
  });

  it("closes without saving on Cancel", async () => {
    const fetch = serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    const dialog = await openDialog();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Change name" })).toBeNull();
    });
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/account/name",
      expect.anything(),
    );
  });
});

describe("after a change", () => {
  it("refreshes the list, and says the change was made", async () => {
    let accounts = [own, planner, former];
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": () => Response.json({ accounts }),
      "PUT /api/accounts/user-2/active": () => {
        accounts = [own, { ...planner, active: false }, former];
        return Response.json({ account: accounts[1] });
      },
    });
    renderApp("/accounts");
    await openAction("Fictional Planner", "Deactivate");
    const dialog = await screen.findByRole("dialog", {
      name: "Deactivate Fictional Planner",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Deactivate" }),
    );
    expect((await screen.findByRole("status")).textContent).toBe(
      "Deactivated the account for Fictional Planner.",
    );
    await waitFor(() => {
      expect(screen.getAllByText("Deactivated")).toHaveLength(2);
    });
  });

  it("lists every role, each with its description under its name", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
    });
    renderApp("/accounts");
    await userEvent.click(
      await screen.findByRole("button", { name: "New account" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "New account" });
    expect(
      within(dialog)
        .getAllByRole("radio")
        .map((choice) => [
          (choice as HTMLInputElement).labels?.[0]?.textContent,
          document.getElementById(
            String(choice.getAttribute("aria-describedby")),
          )?.textContent,
        ]),
    ).toEqual(roles.map(({ name, description }) => [name, description]));
  });

  it("closes a dialog with Escape when nothing is being saved", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
    });
    renderApp("/accounts");
    await userEvent.click(
      await screen.findByRole("button", { name: "New account" }),
    );
    await screen.findByRole("dialog", { name: "New account" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("puts a refusal plainly, such as when the user's own role has changed", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
      "PATCH /api/accounts/user-2": () =>
        Response.json({ error: "Forbidden" }, { status: 403 }),
    });
    renderApp("/accounts");
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit Fictional Planner" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Edit Fictional Planner",
    });
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      "You do not have permission to do this. Your role may have changed.",
    );
  });

  it("sends the user to sign in when their session has ended mid-change", async () => {
    let session = manager;
    serverAnswers({
      "GET /api/session": () => session(),
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
      "POST /api/accounts/user-2/password": () => {
        session = () =>
          Response.json({ error: "Unauthorized" }, { status: 401 });
        return session();
      },
    });
    renderApp("/accounts");
    await openAction("Fictional Planner", "Reset password");
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Reset password" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeDefined();
  });
});

describe("changing a generated password first", () => {
  const mustChange = () =>
    Response.json({ ...fictionalUser, mustChangePassword: true });

  async function change(current: string, next: string) {
    await userEvent.type(
      await screen.findByLabelText("Current password"),
      current,
    );
    await userEvent.type(screen.getByLabelText("New password"), next);
    await userEvent.type(screen.getByLabelText("New password again"), next);
    await userEvent.click(
      screen.getByRole("button", { name: "Change password" }),
    );
  }

  it("shows only the page that changes it, at the start page's address, whatever page was asked for", async () => {
    serverAnswers({ "GET /api/session": mustChange });
    const history = renderApp("/people");
    expect(
      await screen.findByRole("heading", { name: "Change password" }),
    ).toBeDefined();
    expect(
      screen.getByText(
        "Fathom generated this password. A new password is required to continue.",
      ),
    ).toBeDefined();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Your account, Fictional Person" }),
    ).toBeNull();
    expect(history.location.pathname).toBe("/");
  });

  it("shows the rules in the password settings from the start", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          mustChangePassword: true,
          settings: {
            ...fictionalUser.settings,
            passwords: {
              ...fictionalUser.settings.passwords,
              rules: {
                minimumLength: 16,
                uppercase: false,
                lowercase: false,
                digits: true,
                symbols: false,
              },
            },
          },
        }),
    });
    renderApp("/");
    await screen.findByLabelText("New password");
    expect(checklist(document.body).map(([text]) => text)).toEqual([
      "16 to 128 characters (not met)",
      "A digit (not met)",
      "Not a common or easily guessed password (not met)",
    ]);
    await change(generated, "fictional 2");
    expect(
      await screen.findByText("The password must have at least 16 characters."),
    ).toBeDefined();
  });

  it("opens Fathom once the password is changed", async () => {
    let session = mustChange;
    const fetch = serverAnswers({
      "GET /api/session": () => session(),
      "GET /api/greeting": greeting,
      "POST /api/auth/change-password": () => {
        session = signedIn;
        return Response.json({});
      },
    });
    renderApp("/");
    await change(generated, "fictional password 2");
    expect(
      await screen.findByRole("button", {
        name: "Your account, Fictional Person",
      }),
    ).toBeDefined();
    expect(
      screen.getByText(
        "Your password has been changed, and you have been signed out everywhere else.",
      ),
    ).toBeDefined();
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/change-password",
      expect.objectContaining({
        body: JSON.stringify({
          currentPassword: generated,
          newPassword: "fictional password 2",
        }),
      }),
    );
  });

  it("refuses the same password again, and names a wrong current one", async () => {
    serverAnswers({
      "GET /api/session": mustChange,
      "POST /api/auth/change-password": () =>
        Response.json({ code: "INVALID_PASSWORD" }, { status: 400 }),
    });
    renderApp("/");
    await change(generated, generated);
    expect(
      await screen.findByText(
        "The new password must differ from the current password.",
      ),
    ).toBeDefined();
    await userEvent.clear(screen.getByLabelText("Current password"));
    await userEvent.type(
      screen.getByLabelText("Current password"),
      "not the password",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Change password" }),
    );
    expect(
      await screen.findByText("Your current password is not right."),
    ).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says when the change fails", async () => {
    serverAnswers({
      "GET /api/session": mustChange,
      "POST /api/auth/change-password": () =>
        Response.json({ error: "Internal Server Error" }, { status: 500 }),
    });
    renderApp("/");
    await change(generated, "fictional password 2");
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Fathom could not change the password. Try again in a moment.",
    );
  });

  it("signs out", async () => {
    let session = mustChange;
    serverAnswers({
      "GET /api/session": () => session(),
      "POST /api/auth/sign-out": () => {
        session = signedOut;
        return Response.json({ success: true });
      },
    });
    const history = renderApp("/");
    await userEvent.click(
      await screen.findByRole("button", { name: "Sign out" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeDefined();
    expect(history.location.pathname).toBe("/sign-in");
  });

  it("says when signing out fails", async () => {
    serverAnswers({
      "GET /api/session": mustChange,
      "POST /api/auth/sign-out": () =>
        Response.json({ error: "Internal Server Error" }, { status: 500 }),
    });
    renderApp("/");
    await userEvent.click(
      await screen.findByRole("button", { name: "Sign out" }),
    );
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Fathom could not sign out. Try again in a moment.",
    );
  });
});
