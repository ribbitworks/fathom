// SPDX-License-Identifier: Apache-2.0

// Tests for creating and changing accounts on the Accounts page, with the server's responses
// simulated: names, email addresses and roles, passwords reset and shown once, deactivating and
// reactivating, the server's refusals, and what follows a change.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { notAllowedMessage } from "./api.ts";
import {
  accountList,
  administratorRole,
  auditorsRole,
  former,
  holdingRoles,
  generated,
  manager,
  openAction,
  openEditFor,
  own,
  planner,
  roleList,
  roles,
  showsGeneratedPassword,
  teamMemberRole,
} from "./test-accounts-page.tsx";
import {
  fictionalUser,
  recordCell,
  renderApp,
  requestsTo,
  serverAnswers,
} from "./test-support.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("creating an account", () => {
  it("sends the new account with the roles chosen, any role, and its default, then shows its password once, to copy", async () => {
    const fetch = serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
      "POST /api/accounts": () =>
        Response.json(
          {
            account: {
              ...planner,
              id: "10000000-0000-4000-8000-000000000004",
              name: "Fictional Newcomer",
            },
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
      within(dialog).getByRole("checkbox", { name: "Fictional Auditors" }),
    );
    await userEvent.click(
      within(
        within(dialog).getByRole("radiogroup", { name: "Default role" }),
      ).getByRole("radio", { name: "Fictional Auditors" }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create account" }),
    );
    await showsGeneratedPassword("Fictional Newcomer");
    expect(
      await screen.findByText("Created the account for Fictional Newcomer."),
    ).toBeDefined();
    expect(fetch).toHaveBeenCalledWith(
      "/api/accounts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Fictional Newcomer",
          email: "newcomer@example.test",
          roleId: auditorsRole.id,
          roleIds: [teamMemberRole.id, auditorsRole.id],
        }),
      }),
    );
  });

  it("keeps the password shown when the page behind it is clicked, and forgets it once closed", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
      "POST /api/accounts/10000000-0000-4000-8000-000000000002/password": () =>
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
      within(dialog).getByRole<HTMLInputElement>("checkbox", {
        name: "Team Member",
      }).checked,
    ).toBe(true);
    expect(within(dialog).queryByRole("radiogroup")).toBeNull();
  });

  it("asks for the default role only with several roles, keeping it while it is still held", async () => {
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
    const tick = (name: string) =>
      userEvent.click(within(dialog).getByRole("checkbox", { name }));
    const defaultRole = () =>
      within(dialog).queryByRole("radiogroup", { name: "Default role" });
    const choices = () =>
      within(defaultRole() as HTMLElement)
        .getAllByRole<HTMLInputElement>("radio")
        .map((choice) => [choice.labels?.[0]?.textContent, choice.checked]);
    await tick("Product Manager");
    expect(choices()).toEqual([
      ["Product Manager", false],
      ["Team Member", true],
    ]);
    await tick("Fictional Auditors");
    await userEvent.click(
      within(defaultRole() as HTMLElement).getByRole("radio", {
        name: "Product Manager",
      }),
    );
    await tick("Team Member");
    expect(choices()).toEqual([
      ["Fictional Auditors", false],
      ["Product Manager", true],
    ]);
    await tick("Product Manager");
    expect(defaultRole()).toBeNull();
    await tick("Team Member");
    expect(choices()).toEqual([
      ["Fictional Auditors", true],
      ["Team Member", false],
    ]);
  });

  it("points those who may edit roles to the Roles page, in New account and Edit", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["administration:view", "administration:edit"],
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
    const auditors = within(dialog).getByRole("checkbox", {
      name: "Fictional Auditors",
    });
    await userEvent.click(auditors);
    await userEvent.click(auditors);
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

  it("says when the roles cannot be loaded, and reads them again on Try again", async () => {
    // Given the roles failing to load, in an account's dialog
    let rolesFail = true;
    const fetch = serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": () =>
        rolesFail
          ? Response.json({ error: "Internal Server Error" }, { status: 500 })
          : roleList(),
      "GET /api/accounts": accountList,
    });
    renderApp("/accounts");
    const dialog = await openEditFor("Fictional Planner");
    const alert = await within(dialog).findByRole("alert");
    expect(alert.textContent).toContain("Fathom could not load the roles.");
    const reads = requestsTo(fetch, "/api/roles");

    // When the roles can be read again, and Try again is chosen
    rolesFail = false;
    await userEvent.click(
      within(alert).getByRole("button", { name: "Try again" }),
    );

    // Then the roles are read again, and the message goes
    await waitFor(() => {
      expect(requestsTo(fetch, "/api/roles")).toBeGreaterThan(reads);
    });
    await waitFor(() => {
      expect(within(dialog).queryByRole("alert")).toBeNull();
    });
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
    expect(await within(dialog).findByText("Name needed")).toBeDefined();
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
  it("changes its name, email address, and roles together", async () => {
    const fetch = serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
      "PATCH /api/accounts/10000000-0000-4000-8000-000000000002": () =>
        Response.json({
          account: {
            ...planner,
            name: "Fictional Planning",
            ...holdingRoles(teamMemberRole),
          },
        }),
    });
    renderApp("/accounts");
    const dialog = await openEditFor("Fictional Planner");
    const name = within(dialog).getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Fictional Planning");
    const email = within(dialog).getByLabelText("Email address");
    await userEvent.clear(email);
    await userEvent.type(email, "planning@example.test");
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Team Member" }),
    );
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Product Manager" }),
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Saved the account for Fictional Planning."),
    ).toBeDefined();
    expect(fetch).toHaveBeenCalledWith(
      "/api/accounts/10000000-0000-4000-8000-000000000002",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          name: "Fictional Planning",
          email: "planning@example.test",
          roleId: teamMemberRole.id,
          roleIds: [teamMemberRole.id],
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
    const dialog = await openEditFor("Fictional Planner");
    await userEvent.clear(within(dialog).getByLabelText("Name"));
    const email = within(dialog).getByLabelText("Email address");
    await userEvent.clear(email);
    await userEvent.type(email, "not an address");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText("Name needed")).toBeDefined();
    expect(
      within(dialog).getByText("Enter a valid email address."),
    ).toBeDefined();
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/accounts/10000000-0000-4000-8000-000000000002",
      expect.anything(),
    );
  });

  it("resets its password, then shows the new one once, to copy", async () => {
    const fetch = serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
      "POST /api/accounts/10000000-0000-4000-8000-000000000002/password": () =>
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
    expect(
      await screen.findByText("Reset the password for Fictional Planner."),
    ).toBeDefined();
    expect(fetch).toHaveBeenCalledWith(
      "/api/accounts/10000000-0000-4000-8000-000000000002/password",
      expect.objectContaining({ method: "POST", body: "{}" }),
    );
  });

  it("says why a reset was refused, and stays open", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
      "POST /api/accounts/10000000-0000-4000-8000-000000000002/password": () =>
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
      "10000000-0000-4000-8000-000000000002",
      "Deactivate",
      false,
    ],
    [
      "reactivates a deactivated one",
      "Fictional Former",
      "10000000-0000-4000-8000-000000000003",
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

describe("after a change", () => {
  it("refreshes the list, and says the change was made", async () => {
    let accounts = [own, planner, former];
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": () => Response.json({ accounts }),
      "PUT /api/accounts/10000000-0000-4000-8000-000000000002/active": () => {
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
    expect(
      await screen.findByText("Deactivated the account for Fictional Planner."),
    ).toBeDefined();
    await waitFor(() => {
      expect(recordCell(planner.id, "status")?.textContent).toBe("Deactivated");
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
        .getAllByRole("checkbox")
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
      "PATCH /api/accounts/10000000-0000-4000-8000-000000000002": () =>
        Response.json({ error: "Forbidden" }, { status: 403 }),
    });
    renderApp("/accounts");
    const dialog = await openEditFor("Fictional Planner");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      notAllowedMessage,
    );
  });

  it("sends the user to sign in when their session has ended mid-change", async () => {
    let session = manager;
    serverAnswers({
      "GET /api/session": () => session(),
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
      "POST /api/accounts/10000000-0000-4000-8000-000000000002/password":
        () => {
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
