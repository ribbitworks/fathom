// SPDX-License-Identifier: Apache-2.0

// Tests for creating, changing and restoring roles, with what a change does to accounts confirmed
// first, the permissions that keep access managed, and the server's refusals.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { notAllowedMessage } from "./api.ts";
import { renderApp, serverAnswers } from "./test-support.tsx";
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

const planner = {
  id: "10000000-0000-4000-8000-000000000002",
  keyNumber: 1,
  name: "Fictional Planner",
  email: "planner@example.test",
};

const self = {
  id: "10000000-0000-4000-8000-000000000001",
  keyNumber: 1,
  name: "Fictional Person",
  email: "person@example.test",
};

describe("creating a role", () => {
  it("starts empty, granting nothing, and creates the role with what was set", async () => {
    // Given
    const fetch = serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
      "POST /api/roles": () =>
        Response.json({
          role: {
            ...auditors,
            id: "00000000-0000-4000-8000-000000000003",
            name: "Fictional Readers",
          },
        }),
    });
    renderApp("/roles");
    const dialog = await openDialog("New role", "New role");
    expect(within(dialog).getByLabelText<HTMLInputElement>("Name").value).toBe(
      "",
    );
    expect(summaryLines(dialog, "Sees")).toEqual(["Nothing."]);
    expect(within(dialog).queryByRole("heading", { name: "Can" })).toBeNull();
    expect(
      within(dialog).queryByRole("button", { name: "Restore template" }),
    ).toBeNull();
    // When
    await userEvent.type(
      within(dialog).getByLabelText("Name"),
      "Fictional Readers",
    );
    await userEvent.type(
      within(dialog).getByLabelText("Description"),
      "Reads the plan.",
    );
    await userEvent.click(box(dialog, "View Plan"));
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create role" }),
    );
    // Then
    expect(await screen.findByText("The role has been created.")).toBeDefined();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/roles",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Fictional Readers",
          description: "Reads the plan.",
          permissions: ["plan:view"],
        }),
      }),
    );
  });

  it("asks for a name and a short enough description", async () => {
    const fetch = serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog("New role", "New role");
    await userEvent.click(within(dialog).getByLabelText("Description"));
    await userEvent.paste("x".repeat(501));
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create role" }),
    );
    expect(
      await within(dialog).findByText("Enter a name for the role."),
    ).toBeDefined();
    expect(
      within(dialog).getByText("Use at most 500 characters."),
    ).toBeDefined();
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/roles",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("copies another role's description and permissions under a new name", async () => {
    const fetch = serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
      "POST /api/roles": () =>
        Response.json({
          role: {
            ...auditors,
            id: "00000000-0000-4000-8000-000000000004",
            name: "Copy of Fictional Auditors",
          },
        }),
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Copy Fictional Auditors",
      "Copy Fictional Auditors",
    );
    expect(within(dialog).getByLabelText<HTMLInputElement>("Name").value).toBe(
      "Copy of Fictional Auditors",
    );
    expect(
      within(dialog).getByLabelText<HTMLTextAreaElement>("Description").value,
    ).toBe(auditors.description);
    expect(box(dialog, "View People").checked).toBe(true);
    expect(box(dialog, "Edit People").checked).toBe(false);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create role" }),
    );
    expect(await screen.findByText("The role has been created.")).toBeDefined();
    expect(fetch).toHaveBeenCalledWith(
      "/api/roles",
      expect.objectContaining({
        body: JSON.stringify({
          name: "Copy of Fictional Auditors",
          description: auditors.description,
          permissions: auditors.permissions,
        }),
      }),
    );
  });

  it("shows the server's message when it refuses, and stays open", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
      "POST /api/roles": () =>
        Response.json(
          { error: "A role with this name already exists" },
          { status: 409 },
        ),
    });
    renderApp("/roles");
    const dialog = await openDialog("New role", "New role");
    await userEvent.type(within(dialog).getByLabelText("Name"), "Team Member");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create role" }),
    );
    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      "A role with this name already exists",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});

describe("changing a role", () => {
  it("saves at once a change that changes no account", async () => {
    const fetch = serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
      "POST /api/roles/00000000-0000-4000-8000-000000000002/effects": () =>
        Response.json({ effects: [] }),
      "PUT /api/roles/00000000-0000-4000-8000-000000000002": () =>
        Response.json({ role: { ...auditors, name: "Fictional Checkers" } }),
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Auditors",
      "Edit Fictional Auditors",
    );
    const name = within(dialog).getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Fictional Checkers");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("The role has been changed.")).toBeDefined();
    expect(fetch).toHaveBeenCalledWith(
      "/api/roles/00000000-0000-4000-8000-000000000002/effects",
      expect.objectContaining({
        body: JSON.stringify({ permissions: auditors.permissions }),
      }),
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/roles/00000000-0000-4000-8000-000000000002",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          name: "Fictional Checkers",
          description: auditors.description,
          permissions: auditors.permissions,
          updatedAt: auditors.updatedAt,
        }),
      }),
    );
  });

  it("lists what each account would gain and lose, marking one's own, before saving", async () => {
    // Given
    const fetch = serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
      "POST /api/roles/00000000-0000-4000-8000-000000000002/effects": () =>
        Response.json({
          effects: [
            {
              account: self,
              before: ["plan:view", "people:view", "personal:view"],
              after: ["plan:view", "personal:view", "configuration:view"],
            },
            {
              account: planner,
              before: ["plan:view"],
              after: ["plan:view", "configuration:view"],
            },
          ],
        }),
      "PUT /api/roles/00000000-0000-4000-8000-000000000002": () =>
        Response.json({ role: auditors }),
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Auditors",
      "Edit Fictional Auditors",
    );
    await userEvent.click(box(dialog, "View People"));
    await userEvent.click(box(dialog, "View Configuration"));
    // When
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    // Then
    expect(
      await within(dialog).findByText("This change affects 2 accounts."),
    ).toBeDefined();
    const own = within(dialog)
      .getByText("Fictional Person (person@example.test) (this account)")
      .closest(".mantine-Paper-root") as HTMLElement;
    expect(within(own).getByText("Sees the Lists page.")).toBeDefined();
    expect(
      within(own).getByText("The People page no longer appears."),
    ).toBeDefined();
    const other = within(dialog)
      .getByText("Fictional Planner (planner@example.test)")
      .closest(".mantine-Paper-root") as HTMLElement;
    expect(within(other).getByRole("heading", { name: "Gains" })).toBeDefined();
    expect(within(other).queryByRole("heading", { name: "Loses" })).toBeNull();
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/roles/00000000-0000-4000-8000-000000000002",
      expect.anything(),
    );
    // When
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    // Then
    expect(await screen.findByText("The role has been changed.")).toBeDefined();
    expect(fetch).toHaveBeenCalledWith(
      "/api/roles/00000000-0000-4000-8000-000000000002",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          name: auditors.name,
          description: auditors.description,
          permissions: ["plan:view", "configuration:view"],
          updatedAt: auditors.updatedAt,
        }),
      }),
    );
  });

  it("goes back from the accounts it affects to the change with Cancel, keeping it, and asks again", async () => {
    let previews = 0;
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
      "POST /api/roles/00000000-0000-4000-8000-000000000002/effects": () => {
        previews += 1;
        return Response.json({
          effects: [
            {
              account: planner,
              before: ["plan:view", "people:view"],
              after: ["plan:view"],
            },
          ],
        });
      },
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Auditors",
      "Edit Fictional Auditors",
    );
    await userEvent.click(box(dialog, "View People"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(
      await within(dialog).findByText("This change affects 1 account."),
    ).toBeDefined();
    expect(within(dialog).queryByText(/\(this account\)/)).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Back" })).toBeNull();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    expect(box(dialog, "View People").checked).toBe(false);
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(
      await within(dialog).findByText("This change affects 1 account."),
    ).toBeDefined();
    expect(previews).toBe(2);
  });

  it("shows the server's message when it refuses the change after it was confirmed", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
      "POST /api/roles/00000000-0000-4000-8000-000000000002/effects": () =>
        Response.json({
          effects: [{ account: planner, before: ["plan:view"], after: [] }],
        }),
      "PUT /api/roles/00000000-0000-4000-8000-000000000002": () =>
        Response.json(
          { error: "A role with this name already exists" },
          { status: 409 },
        ),
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Auditors",
      "Edit Fictional Auditors",
    );
    await userEvent.click(box(dialog, "View Plan"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await userEvent.click(
      await within(dialog).findByRole("button", { name: "Save changes" }),
    );
    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      "A role with this name already exists",
    );
    expect(
      within(dialog).getByText("This change affects 1 account."),
    ).toBeDefined();
  });

  it("says why when the accounts it affects cannot be worked out", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
      "POST /api/roles/00000000-0000-4000-8000-000000000002/effects": () =>
        Response.json({ error: "Forbidden" }, { status: 403 }),
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Auditors",
      "Edit Fictional Auditors",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      notAllowedMessage,
    );
    expect(within(dialog).getByLabelText("Name")).toBeDefined();
  });

  it("stays open while the change is being saved", async () => {
    let answer: (response: Response) => void = () => undefined;
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
      "POST /api/roles/00000000-0000-4000-8000-000000000002/effects": () =>
        Response.json({ effects: [] }),
      "PUT /api/roles/00000000-0000-4000-8000-000000000002": () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Auditors",
      "Edit Fictional Auditors",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(
        within(dialog).getByLabelText<HTMLInputElement>("Name").disabled,
      ).toBe(true);
    });
    expect(box(dialog, "View Plan").disabled).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(
      screen.getByRole("dialog", { name: "Edit Fictional Auditors" }),
    ).toBeDefined();
    expect(within(dialog).queryByRole("button", { name: "Close" })).toBeNull();
    answer(Response.json({ role: auditors }));
    expect(await screen.findByText("The role has been changed.")).toBeDefined();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("closes with Escape when nothing is being saved", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    await openDialog("Edit Team Member", "Edit Team Member");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});

describe("restoring a starting role", () => {
  it("is offered only for Fathom's starting roles", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Auditors",
      "Edit Fictional Auditors",
    );
    expect(
      within(dialog).queryByRole("button", { name: "Restore template" }),
    ).toBeNull();
  });

  it("is not offered for a role whose key Fathom no longer knows", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": () =>
        Response.json({ roles: [{ ...auditors, key: "retired-role" }] }),
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Auditors",
      "Edit Fictional Auditors",
    );
    expect(
      within(dialog).queryByRole("button", { name: "Restore template" }),
    ).toBeNull();
  });

  it("cannot be used while the role is as Fathom started it", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog("Edit Team Member", "Edit Team Member");
    const restore = within(dialog).getByRole<HTMLButtonElement>("button", {
      name: "Restore template",
    });
    expect(restore.disabled).toBe(true);
    for (const [label, change] of [
      ["Name", "s"],
      ["Description", " Fictionally."],
    ] as const) {
      const field = within(dialog).getByLabelText(label);
      await userEvent.type(field, change);
      expect(restore.disabled).toBe(false);
      await userEvent.type(field, "{Backspace}".repeat(change.length));
      expect(restore.disabled).toBe(true);
    }
    await userEvent.click(box(dialog, "View People"));
    expect(restore.disabled).toBe(false);
    await userEvent.click(box(dialog, "View Plan"));
    expect(restore.disabled).toBe(false);
  });

  it("puts back the starting role's name, description, and permissions without saving", async () => {
    // Given a starting role changed since Fathom made it
    const fetch = serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": () =>
        Response.json({
          roles: [
            {
              ...teamMemberRole,
              name: "Fictional Watchers",
              description: "Watches.",
              permissions: ["people:view"],
            },
          ],
        }),
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Watchers",
      "Edit Fictional Watchers",
    );
    // When
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Restore template" }),
    );
    // Then
    expect(within(dialog).getByLabelText<HTMLInputElement>("Name").value).toBe(
      teamMemberRole.name,
    );
    expect(
      within(dialog).getByLabelText<HTMLTextAreaElement>("Description").value,
    ).toBe(teamMemberRole.description);
    expect(box(dialog, "View Plan").checked).toBe(true);
    expect(box(dialog, "View Allocations").checked).toBe(true);
    expect(box(dialog, "View People").checked).toBe(true);
    expect(box(dialog, "View Feature teams").checked).toBe(true);
    expect(box(dialog, "View Configuration").checked).toBe(false);
    expect(
      within(dialog).getByRole<HTMLButtonElement>("button", {
        name: "Restore template",
      }).disabled,
    ).toBe(true);
    expect(
      fetch.mock.calls.filter(([, init]) => init?.method !== undefined),
    ).toEqual([]);
  });
});

describe("the permissions that keep access managed", () => {
  const administrators = {
    ...auditors,
    id: "00000000-0000-4000-8000-000000000005",
    name: "Fictional Administrators",
    permissions: ["administration:edit"],
  };
  const lastAdministrator = {
    id: "10000000-0000-4000-8000-000000000005",
    keyNumber: 1,
    name: "Fictional Administrator",
    email: "administrator@example.test",
    role: { id: administrators.id, name: administrators.name },
    roles: [{ id: administrators.id, name: administrators.name }],
    active: true,
    createdAt: "2026-10-12T09:00:00.000Z",
  };

  it("cannot be taken away from the last role giving them to an active account", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": () =>
        Response.json({ roles: [administrators, auditors] }),
      "GET /api/accounts": () =>
        Response.json({ accounts: [lastAdministrator] }),
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Administrators",
      "Edit Fictional Administrators",
    );
    const kept = box(
      dialog,
      "Edit Administration, which some active account must keep",
    );
    expect([kept.checked, kept.disabled]).toEqual([true, true]);
  });

  it("can be taken away once the accounts show another role keeps them", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": () =>
        Response.json({
          roles: [
            administrators,
            { ...auditors, permissions: ["administration:edit"] },
          ],
        }),
      "GET /api/accounts": () =>
        Response.json({
          accounts: [
            {
              ...lastAdministrator,
              roles: [
                { id: administrators.id, name: administrators.name },
                { id: auditors.id, name: auditors.name },
              ],
            },
          ],
        }),
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Administrators",
      "Edit Fictional Administrators",
    );
    // Locked while the accounts load, then freed.
    expect(
      (
        await within(dialog).findByRole<HTMLInputElement>("checkbox", {
          name: "Edit Administration",
        })
      ).disabled,
    ).toBe(false);
  });

  it("can be taken away when the accounts cannot be read, leaving the server to refuse", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": () =>
        Response.json({ roles: [administrators, auditors] }),
      "GET /api/accounts": () =>
        Response.json({ error: "Internal Server Error" }, { status: 500 }),
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Administrators",
      "Edit Fictional Administrators",
    );
    expect(
      (
        await within(dialog).findByRole<HTMLInputElement>("checkbox", {
          name: "Edit Administration",
        })
      ).disabled,
    ).toBe(false);
  });

  it("is kept when a starting role's template is restored", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": () =>
        Response.json({
          roles: [
            {
              ...teamMemberRole,
              permissions: ["administration:edit"],
            },
          ],
        }),
      "GET /api/accounts": () =>
        Response.json({
          accounts: [
            {
              ...lastAdministrator,
              role: { id: teamMemberRole.id, name: teamMemberRole.name },
              roles: [{ id: teamMemberRole.id, name: teamMemberRole.name }],
            },
          ],
        }),
    });
    renderApp("/roles");
    const dialog = await openDialog("Edit Team Member", "Edit Team Member");
    await within(dialog).findByRole("checkbox", {
      name: "Edit Administration, which some active account must keep",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Restore template" }),
    );
    expect(
      box(dialog, "Edit Administration, which some active account must keep")
        .checked,
    ).toBe(true);
    expect(box(dialog, "View Plan").checked).toBe(true);
  });
});
