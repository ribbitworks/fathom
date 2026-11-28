// SPDX-License-Identifier: Apache-2.0

// Tests for the Roles page, with the server's responses simulated: who sees it, the table of roles,
// each role's menu for those who edit roles and those who only see them, a role's details, a role's
// description, and a link to a role.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  detailValue,
  overviewGreeting,
  recordCell,
  renderApp,
  serverAnswers,
  signedIn,
} from "./test-support.tsx";
import {
  accountList,
  auditor,
  auditors,
  box,
  itemNames,
  openDetails,
  openFromMenu,
  roleEditor,
  roleList,
  roleMenu,
  roleViewer,
  setUpEachTest,
  summaryLines,
  teamMemberRole,
} from "./test-roles-page.tsx";

setUpEachTest();

describe("who sees the Roles page", () => {
  it("links to it under Administration for users who may edit roles", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    const history = renderApp("/");
    await screen.findByText(overviewGreeting);
    const link = screen
      .getAllByRole("link", { name: "Roles" })
      .find((found) => found.getAttribute("href") === "/roles");
    await userEvent.click(link as HTMLElement);
    expect(await screen.findByRole("heading", { name: "Roles" })).toBeDefined();
    expect(history.location.pathname).toBe("/roles");
  });

  it("is not linked for anyone else", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
    });
    renderApp("/");
    await screen.findByText(overviewGreeting);
    expect(screen.queryAllByRole("link", { name: "Roles" })).toEqual([]);
  });

  it("is not shown to anyone else", async () => {
    serverAnswers({ "GET /api/session": signedIn });
    renderApp("/roles");
    expect(
      await screen.findByText("There is no page at this address."),
    ).toBeDefined();
  });
});

describe("the table of roles", () => {
  it("shows each role's name, what it is for, and how many accounts hold it, with its key hidden at first", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    expect(await screen.findByRole("grid", { name: "Roles" })).toBeDefined();
    const text = (key: string) => recordCell(auditors.id, key)?.textContent;
    expect(["name", "description", "accounts"].map(text)).toEqual([
      "Fictional Auditors",
      "Checks Personal and Confidential data for audits.",
      "1",
    ]);
    expect(text("key")).toBeUndefined();
    expect(recordCell(teamMemberRole.id, "accounts")?.textContent).toBe("3");
    expect(screen.queryByRole("button", { name: /^Group by/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Edit / })).toBeNull();
  });

  it("shows a description as typed, with no class marked in its words", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const description = await screen.findByText(
      "Checks Personal and Confidential data for audits.",
    );
    expect(description.querySelector("svg")).toBeNull();
  });

  it("shows a loading indicator until the roles arrive", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": () => new Promise<Response>(() => undefined),
    });
    renderApp("/roles");
    expect(await screen.findByLabelText("Loading")).toBeDefined();
  });

  it("shows a message when the roles cannot be loaded", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": () =>
        Response.json({ error: "Internal Server Error" }, { status: 500 }),
    });
    renderApp("/roles");
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Fathom could not load the roles. Try again in a moment.",
    );
  });
});

describe("a role's menu, for those who may edit roles", () => {
  it("offers Edit… and Copy… after the role's details and link", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    expect(itemNames(await roleMenu("Fictional Auditors"))).toEqual([
      "Show details",
      "Copy link",
      "Edit…",
      "Copy…",
    ]);
  });

  it("opens the role's dialog to edit it, or to copy it", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const editing = await openFromMenu(
      "Fictional Auditors",
      "Edit…",
      "Edit Fictional Auditors",
    );
    expect(within(editing).getByLabelText<HTMLInputElement>("Name").value).toBe(
      "Fictional Auditors",
    );
    await userEvent.click(
      within(editing).getByRole("button", { name: "Cancel" }),
    );
    const copying = await openFromMenu(
      "Fictional Auditors",
      "Copy…",
      "Copy Fictional Auditors",
    );
    expect(within(copying).getByLabelText<HTMLInputElement>("Name").value).toBe(
      "Copy of Fictional Auditors",
    );
  });
});

describe("a role's menu, for those who may only see roles", () => {
  it("offers only View…, and no New role", async () => {
    serverAnswers({
      "GET /api/session": roleViewer,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    expect(itemNames(await roleMenu("Team Member"))).toEqual([
      "Show details",
      "Copy link",
      "View…",
    ]);
    expect(screen.queryByRole("button", { name: "New role" })).toBeNull();
  });

  it("shows what a role grants read only, and closes", async () => {
    // Given
    const fetch = serverAnswers({
      "GET /api/session": roleViewer,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    // When
    const dialog = await openFromMenu(
      "Fictional Auditors",
      "View…",
      "Fictional Auditors",
    );
    // Then
    const name = within(dialog).getByLabelText<HTMLInputElement>("Name");
    expect([name.value, name.readOnly]).toEqual(["Fictional Auditors", true]);
    const purpose =
      within(dialog).getByLabelText<HTMLTextAreaElement>("Description");
    expect([purpose.value, purpose.readOnly]).toEqual([
      auditors.description,
      true,
    ]);
    await userEvent.click(box(dialog, "View People"));
    await userEvent.click(box(dialog, "View Configuration"));
    expect(box(dialog, "View People").checked).toBe(true);
    expect(box(dialog, "View Configuration").checked).toBe(false);
    expect(summaryLines(dialog, "Sees")).toContain("People");
    expect(within(dialog).queryByRole("button", { name: "Save" })).toBeNull();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Close" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(
      fetch.mock.calls.filter(
        ([url, init]) =>
          init?.method !== undefined && !url.startsWith("/api/last-views"),
      ),
    ).toEqual([]);
  });
});

describe("a role's details", () => {
  it("show its description, the active accounts holding it, and what it grants, read only", async () => {
    serverAnswers({
      "GET /api/session": roleViewer,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
    });
    renderApp("/roles");
    const panel = await openDetails("Fictional Auditors");
    expect(detailValue("Description", panel)).toBe(auditors.description);
    const heldBy = within(panel).getByRole("region", { name: "Held by" });
    expect(await within(heldBy).findAllByRole("button")).toHaveLength(1);
    expect(within(heldBy).getByRole("button").textContent).toBe(
      "Fictional Auditor",
    );
    const grants = within(panel).getByRole("group", {
      name: "What the role grants",
    });
    await userEvent.click(box(grants, "View Configuration"));
    expect(box(grants, "View People").checked).toBe(true);
    expect(box(grants, "View Configuration").checked).toBe(false);
  });

  it("open an account holding the role on Accounts, with its details", async () => {
    serverAnswers({
      "GET /api/session": roleViewer,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
    });
    const history = renderApp("/roles");
    const panel = await openDetails("Fictional Auditors");
    await userEvent.click(
      await within(panel).findByRole("button", { name: "Fictional Auditor" }),
    );
    await waitFor(() => {
      expect(history.location.pathname).toBe("/accounts");
    });
    expect(history.location.search).toContain(`open=${auditor.id}`);
    expect(
      await screen.findByRole("region", { name: "Fictional Auditor" }),
    ).toBeDefined();
  });

  it("close back to the role's row, keeping the view, and stay open while the view changes", async () => {
    serverAnswers({
      "GET /api/session": roleViewer,
      "GET /api/roles": roleList,
      "GET /api/accounts": accountList,
    });
    const history = renderApp("/roles");
    await openDetails("Fictional Auditors");
    // When the search changes with the details open
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search roles" }),
      "Audit",
    );
    // Then the details stay open
    await waitFor(() => {
      expect(history.location.search).toContain("search=Audit");
    });
    expect(history.location.search).toContain(`open=${auditors.id}`);
    // When they close, focus is back on the role's name
    await userEvent.click(
      screen.getByRole("button", { name: "Close details" }),
    );
    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe("Fictional Auditors");
    });
    expect(history.location.search).not.toContain("open=");
  });

  it("say so when the accounts holding the role cannot be read", async () => {
    serverAnswers({
      "GET /api/session": roleViewer,
      "GET /api/roles": roleList,
      "GET /api/accounts": () =>
        Response.json({ error: "Internal Server Error" }, { status: 500 }),
    });
    renderApp("/roles");
    const panel = await openDetails("Fictional Auditors");
    expect(
      await within(panel).findByText("Fathom could not load the accounts."),
    ).toBeDefined();
  });

  it.each([
    ["an editor", roleEditor, ["Copy link", "Edit…", "Copy…"]],
    ["a viewer", roleViewer, ["Copy link", "View…"]],
  ])(
    "offer %s the row's menu, less Show details, from their ⋯",
    async (_reader, session, items) => {
      serverAnswers({
        "GET /api/session": session,
        "GET /api/roles": roleList,
        "GET /api/accounts": accountList,
      });
      renderApp("/roles");
      const panel = await openDetails("Team Member");
      await userEvent.click(
        within(panel).getByRole("button", { name: "Actions for Team Member" }),
      );
      expect(itemNames(await screen.findByRole("menu"))).toEqual(items);
    },
  );
});

describe("a role's description", () => {
  it("stays as it is when what the role grants changes", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openFromMenu(
      "Team Member",
      "Edit…",
      "Edit Team Member",
    );
    await userEvent.click(box(dialog, "View Configuration"));
    expect(
      within(dialog).getByLabelText<HTMLTextAreaElement>("Description").value,
    ).toBe(teamMemberRole.description);
  });
});

describe("a link to a role", () => {
  it.each([
    ["an editor", roleEditor],
    ["a viewer", roleViewer],
  ])(
    "opens the role's details for %s, kept in the address",
    async (_reader, session) => {
      serverAnswers({
        "GET /api/session": session,
        "GET /api/roles": roleList,
        "GET /api/accounts": accountList,
      });
      const history = renderApp(`/roles?open=${auditors.id}`);
      expect(
        await screen.findByRole("region", { name: "Fictional Auditors" }),
      ).toBeDefined();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(history.location.search).toBe(`?open=${auditors.id}`);
    },
  );
});
