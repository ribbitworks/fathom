// SPDX-License-Identifier: Apache-2.0

// Tests for the Accounts page, with the server's responses simulated.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  accountList,
  administratorRole,
  auditorsRole,
  former,
  holdingRoles,
  keepersRole,
  manager,
  openAction,
  openEditFor,
  openPanelFor,
  own,
  planner,
  productManagerRole,
  roleList,
  roles,
  teamMemberRole,
} from "./test-accounts-page.tsx";
import {
  bodyOf,
  fictionalUser,
  greeting,
  recordCell,
  renderApp,
  savedFiles,
  serverAnswers,
  signedIn,
} from "./test-support.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

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
        Response.json({
          ...fictionalUser,
          permissions: ["administration:view"],
        }),
      "GET /api/accounts": accountList,
    });
    // When
    const history = renderApp("/");
    // Then
    expect(await screen.findByText("Fictional Planner")).toBeDefined();
    expect(history.location.pathname).toBe("/accounts");
    expect(screen.getByRole("link", { name: "Accounts" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "New account" })).toBeNull();
    const panel = await openPanelFor("Fictional Planner");
    expect(
      within(panel)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Close details", "#ACCOUNT-1, copy link or key"]);
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
    await screen.findByText("Fictional Planner");
    const text = (id: string, key: string) => recordCell(id, key)?.textContent;
    expect(
      ["name", "email", "roles", "status"].map((key) => text(planner.id, key)),
    ).toEqual([
      "Fictional Planner",
      "planner@example.test",
      "Product Manager",
      "Active",
    ]);
    expect(text(former.id, "status")).toBe("Deactivated");
    expect(text(own.id, "name")).toContain("This account");
  });

  it("opens an account's details at their own address, and closes them back to its row", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
    });
    const history = renderApp("/accounts");
    const panel = await openPanelFor("Fictional Planner");
    expect(history.location.search).toBe(`?open=${planner.id}`);
    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe("Fictional Planner");
    });

    await userEvent.click(
      within(panel).getByRole("button", { name: "Close details" }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: "Fictional Planner" }),
      ).toBeNull();
    });
    expect(history.location.search).toBe("");
    await waitFor(() => {
      expect(
        recordCell(planner.id, "name")?.contains(document.activeElement),
      ).toBe(true);
    });
  });

  it("shows every role an account holds, the default first and marked", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": () =>
        Response.json({
          accounts: [
            own,
            {
              ...planner,
              ...holdingRoles(productManagerRole, auditorsRole),
            },
          ],
        }),
    });
    renderApp("/accounts");
    await screen.findByText("Fictional Planner");
    expect(recordCell(planner.id, "roles")?.textContent).toBe(
      "Product Manager (default), Fictional Auditors",
    );
  });

  it("offers every change to one's own account but resetting its password, which needs the current one", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
    });
    renderApp("/accounts");
    const panel = await openPanelFor("Fictional Person");
    expect(
      within(panel)
        .getAllByRole("button")
        .map(({ textContent }) => textContent),
    ).toEqual(["", "#ACCOUNT-1", "Edit…", "Deactivate…"]);
  });

  it("shows an account left without a role as holding none, and asks for one before saving it", async () => {
    const fetch = serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": () =>
        Response.json({
          accounts: [own, { ...planner, role: null, roles: [] }],
        }),
    });
    renderApp("/accounts");
    await screen.findByText("Fictional Planner");
    expect(recordCell(planner.id, "roles")?.textContent).toBe("No role");
    const dialog = await openEditFor("Fictional Planner");
    expect(
      within(dialog)
        .getAllByRole<HTMLInputElement>("checkbox")
        .some(({ checked }) => checked),
    ).toBe(false);
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText("Choose a role.")).toBeDefined();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        within(dialog).getAllByRole("checkbox")[0],
      );
    });
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/accounts/10000000-0000-4000-8000-000000000002",
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
    expect(
      [own, planner, former].map(
        ({ id }) => recordCell(id, "created")?.textContent,
      ),
    ).toEqual(["Oct 12, 2026", "Oct 14, 2026", "Oct 16, 2026"]);
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
      "PATCH /api/accounts/10000000-0000-4000-8000-000000000001": () => {
        session = () =>
          Response.json({
            ...fictionalUser,
            user: { ...fictionalUser.user, name: "Fictional Self" },
            permissions: [
              "administration:view",
              "administration:edit",
              "plan:view",
              "features:view",
            ],
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
        name: "Account, Fictional Self",
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
          accounts: [own, { ...planner, ...holdingRoles(administratorRole) }],
        });
      },
      "PATCH /api/accounts/10000000-0000-4000-8000-000000000001": () => {
        session = signedIn;
        return Response.json({
          account: { ...own, ...holdingRoles(teamMemberRole) },
        });
      },
    });
    const history = renderApp("/accounts");
    const dialog = await openEditFor("Fictional Person");
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Team Member" }),
    );
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Administrator" }),
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
          accounts: [own, { ...planner, ...holdingRoles(administratorRole) }],
        }),
    });
    renderApp("/accounts");
    await openAction("Fictional Person", "Deactivate");
    const dialog = await screen.findByRole("dialog", {
      name: "Deactivate Fictional Person",
    });
    expect(
      within(dialog).getByText(
        "This account will be signed out everywhere, and won't be able to sign in until an Administrator reactivates it.",
      ),
    ).toBeDefined();
  });
});

describe("the last active account with Edit Administration", () => {
  async function controlsFor(accounts: object[], name = "Fictional Person") {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": () =>
        Response.json({
          roles,
        }),
      "GET /api/accounts": () => Response.json({ accounts }),
    });
    renderApp("/accounts");
    const panel = await openPanelFor(name);
    const deactivate = within(panel).getByRole("button", {
      name: "Deactivate…",
    });
    await userEvent.click(within(panel).getByRole("button", { name: "Edit…" }));
    const dialog = await screen.findByRole("dialog", { name: `Edit ${name}` });
    const choice = (name: string) =>
      within(dialog).getByRole<HTMLInputElement>("checkbox", { name });
    return { deactivate, choice };
  }

  const described = (control: HTMLElement) =>
    (control.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent)
      .join(" ");

  it("leaves deactivating to the server's check until the roles have loaded", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": () => new Promise<Response>(() => undefined),
      "GET /api/accounts": accountList,
    });
    renderApp("/accounts");
    const panel = await openPanelFor("Fictional Person");
    expect(
      within(panel).getByRole<HTMLButtonElement>("button", {
        name: "Deactivate…",
      }).disabled,
    ).toBe(false);
  });

  it("can neither give up the role that alone grants it nor be deactivated, though it can take on others", async () => {
    const { deactivate, choice } = await controlsFor([own, planner, former]);
    expect((deactivate as HTMLButtonElement).disabled).toBe(true);
    expect(choice("Administrator").checked).toBe(true);
    expect(choice("Administrator").disabled).toBe(true);
    expect(choice("Team Member").disabled).toBe(false);
  });

  it("says why in place of the role's description and under Deactivate…, each read with its control, and nowhere else", async () => {
    const { deactivate, choice } = await controlsFor([own, planner, former]);
    const why = "No other account can manage accounts.";
    expect(screen.getAllByText(why)).toHaveLength(2);
    expect(within(deactivate).queryByText(why)).toBeNull();
    expect(described(deactivate)).toBe(why);
    expect(described(choice("Administrator"))).toBe(why);
    expect(screen.queryByText(administratorRole.description)).toBeNull();
    expect(described(choice("Team Member"))).toBe(teamMemberRole.description);
  });

  it("can do both once another active account's role grants it, even a role made later", async () => {
    const { deactivate, choice } = await controlsFor([
      own,
      { ...planner, ...holdingRoles(keepersRole) },
    ]);
    expect((deactivate as HTMLButtonElement).disabled).toBe(false);
    expect(choice("Administrator").disabled).toBe(false);
  });

  it("can give up a role once another of its picked roles grants it", async () => {
    const { choice } = await controlsFor([own, planner]);
    await userEvent.click(choice("Fictional Keepers"));
    expect(choice("Administrator").disabled).toBe(false);
    expect(choice("Fictional Keepers").disabled).toBe(false);
    await userEvent.click(choice("Administrator"));
    expect(choice("Fictional Keepers").disabled).toBe(true);
  });

  it("counts a deactivated account as gone", async () => {
    const { choice } = await controlsFor([
      own,
      { ...former, ...holdingRoles(administratorRole) },
    ]);
    expect(choice("Administrator").disabled).toBe(true);
  });
});

describe("finding accounts", () => {
  it("finds an account by its email address, as by any of its columns", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
    });
    renderApp("/accounts");
    await userEvent.type(
      await screen.findByRole("textbox", { name: "Search accounts" }),
      "former@",
    );
    expect(screen.getByText("Fictional Former")).toBeDefined();
    expect(screen.queryByText("Fictional Planner")).toBeNull();
  });

  it("shows only deactivated accounts when Status is filtered to them", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
    });
    renderApp('/accounts?filters={"status":{"any":["deactivated"]}}');
    expect(await screen.findByText("Fictional Former")).toBeDefined();
    expect(screen.queryByText("Fictional Planner")).toBeNull();
  });

  it("breaks accounts down by their roles and status alone", async () => {
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
    });
    renderApp("/accounts");
    await userEvent.click(
      await screen.findByRole("button", { name: "Metrics" }),
    );
    await userEvent.click(
      await screen.findByRole("combobox", { name: "Break down by" }),
    );
    expect(
      (await screen.findAllByRole("option")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["Choose a column", "Roles", "Status"]);
  });

  it("counts accounts by status with no draft's dot, as accounts have no drafts", async () => {
    // Given the accounts broken down by status
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
    });
    renderApp(`/accounts?breakdown=${encodeURIComponent('["status"]')}`);

    // Then each status has its figures, with no dot before any
    const metrics = await screen.findByRole("region", { name: "Metrics" });
    expect(
      (await within(metrics).findAllByRole("rowheader")).length,
    ).toBeGreaterThan(1);
    expect(metrics.querySelector('td [class*="Mark"]')).toBeNull();
  });
});

describe("the Accounts page's saved views", () => {
  it("applies a shared view, keeping the account open", async () => {
    const view = {
      id: "00000000-0000-4000-8000-0000000000d1",
      name: "Gone",
      scope: "shared",
      definition: { filters: { status: { any: ["deactivated"] } } },
      canChange: true,
      canShare: true,
    };
    serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
      "GET /api/views/accounts": () => Response.json([view]),
    });
    const history = renderApp(`/accounts?open=${former.id}`);
    await screen.findByRole("region", { name: "Fictional Former" });

    await userEvent.click(screen.getByRole("button", { name: "Views" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /^Gone/u }),
    );

    await waitFor(() => {
      expect(screen.queryByText("Fictional Planner")).toBeNull();
    });
    expect(history.location.search).toContain(`view=${view.id}`);
    expect(history.location.search).toContain(`open=${former.id}`);
  });
});

describe("exporting the Accounts page", () => {
  it("asks before exporting accounts' names and email addresses as Personal data, then records the export", async () => {
    // Given the Accounts page, read by an Administrator, who sees no one's Personal details on People
    const files = savedFiles();
    const fetch = serverAnswers({
      "GET /api/session": manager,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
      "POST /api/exports": () => Response.json({ recorded: true }),
    });
    renderApp("/accounts");
    await screen.findByRole("grid", { name: "Accounts" });

    // When it is exported as a CSV file
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "CSV file" }),
    );

    // Then the question names the Personal columns
    const dialog = await screen.findByRole("dialog", {
      name: "Export Personal data?",
    });
    expect(dialog.textContent).toContain(
      "This file holds Personal data (Name, Email address)",
    );
    expect(files).toHaveLength(0);

    // When Export is chosen, the export is recorded as of Accounts, then the file saved
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Export" }),
    );
    await waitFor(() => {
      expect(files).toHaveLength(1);
    });
    expect(bodyOf(fetch, "POST", "/api/exports")).toEqual([
      {
        table: "accounts",
        columns: ["name", "email", "roles", "status", "created"],
        details: [],
      },
    ]);
    const text = (await files[0]?.text()) ?? "";
    expect(text).toContain("planner@example.test");
  });
});
