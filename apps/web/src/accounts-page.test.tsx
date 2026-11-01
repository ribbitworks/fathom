// SPDX-License-Identifier: Apache-2.0

// Tests for the Accounts page and the Change password page, with the server's responses simulated:
// who sees the Accounts page, the list of accounts, creating accounts, changing roles, resetting
// passwords, deactivating and reactivating, the server's refusals, and changing one's own password.

import { roleSchema } from "@fathom/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fictionalUser,
  greeting,
  renderApp,
  serverAnswers,
  signedIn,
} from "./test-support.tsx";
import { roleDescription, roleName } from "./accounts.ts";

const manager = () =>
  Response.json({
    ...fictionalUser,
    roles: ["viewer", "administrator"],
    permissions: ["accounts:manage", "plan:view"],
  });

const own = {
  id: "user-1",
  name: "Fictional Person",
  email: "person@example.test",
  roles: ["viewer", "administrator"],
  active: true,
  createdAt: "2026-10-12T09:00:00.000Z",
};
const planner = {
  id: "user-2",
  name: "Fictional Planner",
  email: "planner@example.test",
  roles: ["viewer", "project-planner"],
  active: true,
  createdAt: "2026-10-14T09:00:00.000Z",
};
const former = {
  id: "user-3",
  name: "Fictional Former",
  email: "former@example.test",
  roles: ["viewer"],
  active: false,
  createdAt: "2026-10-16T09:00:00.000Z",
};
const accountList = () => Response.json({ accounts: [own, planner, former] });

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openMenuFor(name: string) {
  await userEvent.click(
    await screen.findByRole("button", { name: `Actions for ${name}` }),
  );
}

describe("who sees the Accounts page", () => {
  it("links to it for users who may manage accounts", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/greeting": greeting,
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

  it("is not shown to anyone else", async () => {
    serverAnswers({ "GET /api/session": signedIn });
    renderApp("/accounts");
    expect(
      await screen.findByText("There is no page at this address."),
    ).toBeDefined();
  });
});

describe("the list of accounts", () => {
  it("shows each account's roles and status, and offers no changes to one's own", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/accounts": accountList,
    });
    renderApp("/accounts");
    const row = (await screen.findByText("Fictional Planner")).closest("tr");
    expect(
      within(row as HTMLElement).getByText("Project Planner"),
    ).toBeDefined();
    expect(within(row as HTMLElement).getByText("Active")).toBeDefined();
    expect(screen.getByText("Deactivated")).toBeDefined();
    expect(screen.getByText("Your account")).toBeDefined();
    expect(
      screen.queryByRole("button", { name: "Actions for Fictional Person" }),
    ).toBeNull();
  });

  it("shows the day each account was created", async () => {
    serverAnswers({
      "GET /api/session": manager,
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
      "GET /api/accounts": () => new Promise<Response>(() => undefined),
    });
    renderApp("/accounts");
    expect(await screen.findByLabelText("Loading")).toBeDefined();
  });

  it("shows a message when the accounts cannot be loaded", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/accounts": () =>
        Response.json({ error: "Internal Server Error" }, { status: 500 }),
    });
    renderApp("/accounts");
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /could not load the accounts/,
    );
  });
});

describe("finding accounts", () => {
  it("narrows the list by name or email address as you type", async () => {
    serverAnswers({
      "GET /api/session": manager,
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
  });

  it("shows only active or only deactivated accounts, with how many of each", async () => {
    serverAnswers({
      "GET /api/session": manager,
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
  it("sends the new account, with Viewer chosen unless taken off, and closes the dialog", async () => {
    const fetch = serverAnswers({
      "GET /api/session": manager,
      "GET /api/accounts": accountList,
      "POST /api/accounts": () =>
        Response.json(
          { account: { ...planner, id: "user-4" } },
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
    await userEvent.type(
      within(dialog).getByLabelText(/Temporary password/),
      "fictional password 1",
    );
    await userEvent.click(within(dialog).getByLabelText("Resource Planner"));
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create account" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/accounts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Fictional Newcomer",
          email: "newcomer@example.test",
          password: "fictional password 1",
          roles: ["viewer", "resource-planner"],
        }),
      }),
    );
  });

  it("asks for a name, a valid email address, and a long enough password", async () => {
    serverAnswers({
      "GET /api/session": manager,
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
    await userEvent.type(
      within(dialog).getByLabelText(/Temporary password/),
      "short",
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
    expect(within(dialog).getByText("Use 12 to 128 characters.")).toBeDefined();
  });

  it("shows the server's message when it refuses, and stays open", async () => {
    serverAnswers({
      "GET /api/session": manager,
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
    await userEvent.type(
      within(dialog).getByLabelText(/Temporary password/),
      "fictional password 1",
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
  it("changes its roles", async () => {
    const fetch = serverAnswers({
      "GET /api/session": manager,
      "GET /api/accounts": accountList,
      "PUT /api/accounts/user-2/roles": () =>
        Response.json({ account: { ...planner, roles: ["viewer"] } }),
    });
    renderApp("/accounts");
    await openMenuFor("Fictional Planner");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Change roles" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByLabelText("Project Planner"));
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Save roles" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/accounts/user-2/roles",
      expect.objectContaining({ body: JSON.stringify({ roles: ["viewer"] }) }),
    );
  });

  it("resets its password, asking for one long enough", async () => {
    const fetch = serverAnswers({
      "GET /api/session": manager,
      "GET /api/accounts": accountList,
      "PUT /api/accounts/user-2/password": () =>
        new Response(null, { status: 204 }),
    });
    renderApp("/accounts");
    await openMenuFor("Fictional Planner");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Reset password" }),
    );
    const dialog = await screen.findByRole("dialog");
    const button = within(dialog).getByRole("button", {
      name: "Reset password",
    });
    await userEvent.click(button);
    expect(
      await within(dialog).findByText("Use 12 to 128 characters."),
    ).toBeDefined();
    await userEvent.type(
      within(dialog).getByLabelText("New temporary password"),
      "fictional password 2",
    );
    await userEvent.click(button);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/accounts/user-2/password",
      expect.objectContaining({
        body: JSON.stringify({ password: "fictional password 2" }),
      }),
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
      "GET /api/accounts": accountList,
      [`PUT /api/accounts/${id}/active`]: () =>
        Response.json({ account: { ...planner, id, active } }),
    });
    renderApp("/accounts");
    await openMenuFor(name);
    await userEvent.click(
      await screen.findByRole("menuitem", { name: action }),
    );
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

describe("changing one's own password", () => {
  async function changePassword(
    current: string,
    next: string,
    repeated = next,
  ) {
    await userEvent.type(
      await screen.findByLabelText("Current password"),
      current,
    );
    await userEvent.type(screen.getByLabelText("New password"), next);
    await userEvent.type(screen.getByLabelText("New password again"), repeated);
    await userEvent.click(
      screen.getByRole("button", { name: "Change password" }),
    );
  }

  it("is linked for every user, and says when the password has changed", async () => {
    const fetch = serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
      "POST /api/auth/change-password": () => Response.json({}),
    });
    renderApp("/");
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Your account, Fictional Person",
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Change password" }),
    );
    await changePassword("fictional password 1", "fictional password 2");
    expect((await screen.findByRole("status")).textContent).toMatch(
      /has been changed/,
    );
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
    serverAnswers({ "GET /api/session": signedIn });
    renderApp("/password");
    await changePassword(
      "fictional password 1",
      "fictional password 2",
      "different",
    );
    expect(
      await screen.findByText("The new passwords do not match."),
    ).toBeDefined();
  });

  it("asks for the current password and a long enough new one", async () => {
    serverAnswers({ "GET /api/session": signedIn });
    renderApp("/password");
    await userEvent.click(
      await screen.findByRole("button", { name: "Change password" }),
    );
    expect(
      await screen.findByText("Enter your current password."),
    ).toBeDefined();
    expect(screen.getByText("Use 12 to 128 characters.")).toBeDefined();
  });

  it.each([
    [{ code: "INVALID_PASSWORD" }, 400, "Your current password is not right."],
    [
      { error: "Fictional" },
      500,
      "Fathom could not change your password. Try again in a moment.",
    ],
  ])("explains a refusal plainly", async (body, status, message) => {
    serverAnswers({
      "GET /api/session": signedIn,
      "POST /api/auth/change-password": () => Response.json(body, { status }),
    });
    renderApp("/password");
    await changePassword("not the password", "fictional password 2");
    expect((await screen.findByRole("alert")).textContent).toBe(message);
  });
});

describe("after a change", () => {
  it("refreshes the list, and says the change was made", async () => {
    let accounts = [own, planner, former];
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/accounts": () => Response.json({ accounts }),
      "PUT /api/accounts/user-2/active": () => {
        accounts = [own, { ...planner, active: false }, former];
        return Response.json({ account: accounts[1] });
      },
    });
    renderApp("/accounts");
    await openMenuFor("Fictional Planner");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Deactivate" }),
    );
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

  it("says under each role what it allows", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/accounts": accountList,
    });
    renderApp("/accounts");
    await userEvent.click(
      await screen.findByRole("button", { name: "New account" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "New account" });
    for (const role of roleSchema.options) {
      const box = within(dialog).getByRole("checkbox", {
        name: roleName(role),
      });
      expect(box.getAttribute("aria-describedby")).toBeTruthy();
      expect(
        document.getElementById(String(box.getAttribute("aria-describedby")))
          ?.textContent,
      ).toBe(roleDescription(role));
    }
  });

  it("closes a dialog with Escape when nothing is being saved", async () => {
    serverAnswers({
      "GET /api/session": manager,
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

  it("puts a refusal plainly, such as when the user's own roles have changed", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/accounts": accountList,
      "PUT /api/accounts/user-2/roles": () =>
        Response.json({ error: "Forbidden" }, { status: 403 }),
    });
    renderApp("/accounts");
    await openMenuFor("Fictional Planner");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Change roles" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Roles for Fictional Planner",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Save roles" }),
    );
    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      "You do not have permission to do this. Your roles may have changed.",
    );
  });

  it("sends the user to sign in when their session has ended mid-change", async () => {
    let session = manager;
    serverAnswers({
      "GET /api/session": () => session(),
      "GET /api/accounts": accountList,
      "PUT /api/accounts/user-2/password": () => {
        session = () =>
          Response.json({ error: "Unauthorized" }, { status: 401 });
        return session();
      },
    });
    renderApp("/accounts");
    await openMenuFor("Fictional Planner");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Reset password" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByLabelText("New temporary password"),
      "fictional password 2",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Reset password" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeDefined();
  });
});
