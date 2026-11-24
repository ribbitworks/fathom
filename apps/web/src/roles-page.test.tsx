// SPDX-License-Identifier: Apache-2.0

// Tests for the Roles page, with the server's responses simulated: who sees it, the list of roles,
// seeing roles without editing them, a role's description, and a link to a role.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  fictionalUser,
  greeting,
  renderApp,
  serverAnswers,
  signedIn,
} from "./test-support.tsx";
import {
  setUpEachTest,
  roleEditor,
  teamMemberRole,
  auditors,
  roleList,
  openDialog,
  box,
  summaryLines,
} from "./test-roles-page.tsx";

setUpEachTest();

describe("who sees the Roles page", () => {
  it("links to it under Administration for users who may edit roles", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/greeting": greeting,
      "GET /api/roles": roleList,
    });
    const history = renderApp("/");
    await screen.findByText("Hello, Fathom");
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
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    await screen.findByText("Hello, Fathom");
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

describe("the list of roles", () => {
  it("shows each role's name, what it is for, and how many accounts hold it", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const row = (await screen.findByText("Fictional Auditors")).closest(
      "tr",
    ) as HTMLElement;
    expect(
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual([
      "Fictional Auditors",
      "Checks Personal and Confidential data for audits.",
      "1",
      "EditCopy",
    ]);
    expect(
      within(
        screen.getByText("Team Member").closest("tr") as HTMLElement,
      ).getByText("3"),
    ).toBeDefined();
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

describe("seeing roles without editing them", () => {
  const roleViewer = () =>
    Response.json({ ...fictionalUser, permissions: ["administration:view"] });

  it("offers each role only to view", async () => {
    // Given
    serverAnswers({
      "GET /api/session": roleViewer,
      "GET /api/roles": roleList,
    });
    // When
    const history = renderApp("/roles");
    // Then
    await screen.findByText("Fictional Auditors");
    expect(history.location.pathname).toBe("/roles");
    expect(
      screen
        .getAllByRole("link", { name: "Roles" })
        .map((link) => link.getAttribute("href")),
    ).toContain("/roles");
    expect(screen.queryByRole("button", { name: "New role" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Edit Fictional Auditors" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Copy Fictional Auditors" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "View Team Member" }),
    ).toBeDefined();
  });

  it("shows what a role grants read only, and closes", async () => {
    // Given
    const fetch = serverAnswers({
      "GET /api/session": roleViewer,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    // When
    const dialog = await openDialog(
      "View Fictional Auditors",
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
      fetch.mock.calls.filter(([, init]) => init?.method !== undefined),
    ).toEqual([]);
  });
});

describe("a role's description", () => {
  it("stays as it is when what the role grants changes", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog("Edit Team Member", "Edit Team Member");
    await userEvent.click(box(dialog, "View Configuration"));
    expect(
      within(dialog).getByLabelText<HTMLTextAreaElement>("Description").value,
    ).toBe(teamMemberRole.description);
  });
});

describe("a link to a role", () => {
  it.each([
    ["an editor", roleEditor, "Edit Fictional Auditors"],
    [
      "a viewer",
      () =>
        Response.json({
          ...fictionalUser,
          permissions: ["administration:view"],
        }),
      "Fictional Auditors",
    ],
  ])(
    "opens the role's dialog for %s, then takes the role out of the address",
    async (_reader, session, title) => {
      serverAnswers({
        "GET /api/session": session,
        "GET /api/roles": roleList,
      });
      const history = renderApp(`/roles?open=${auditors.id}`);
      expect(await screen.findByRole("dialog", { name: title })).toBeDefined();
      await waitFor(() => {
        expect(history.location.search).toBe("");
      });
      expect(history.location.pathname).toBe("/roles");
    },
  );
});
