// SPDX-License-Identifier: Apache-2.0

// Tests for the Roles page, with the server's responses simulated: who sees it, the list of roles,
// creating a role from nothing or as a copy, changing one with what the change does to accounts
// confirmed first, putting a starting role back as Fathom made it, the summary of what a role
// allows as it changes, and the server's refusals.

import { permissionDescriptions, startingRoles } from "@fathom/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { notAllowedMessage } from "./api.ts";
import {
  fictionalUser,
  greeting,
  renderApp,
  serverAnswers,
  signedIn,
} from "./test-support.tsx";

const roleEditor = () =>
  Response.json({
    ...fictionalUser,
    permissions: ["administration:view", "administration:edit", "plan:view"],
  });

const teamMemberRole = {
  id: "00000000-0000-4000-8000-000000000001",
  key: "team-member",
  name: "Team Member",
  description: startingRoles["team-member"].description,
  permissions: [...startingRoles["team-member"].permissions],
  accounts: 3,
  updatedAt: "2026-11-01T12:00:00.000Z",
};
const auditors = {
  id: "00000000-0000-4000-8000-000000000002",
  key: null,
  name: "Fictional Auditors",
  description: "Checks Personal and Confidential data for audits.",
  permissions: ["plan:view", "people:view", "personal:view"],
  accounts: 1,
  updatedAt: "2026-11-02T12:00:00.000Z",
};
const roleList = () => Response.json({ roles: [teamMemberRole, auditors] });

const planner = {
  id: "user-2",
  name: "Fictional Planner",
  email: "planner@example.test",
};
const self = {
  id: "user-1",
  name: "Fictional Person",
  email: "person@example.test",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openDialog(button: string, title: string) {
  await userEvent.click(await screen.findByRole("button", { name: button }));
  return screen.findByRole("dialog", { name: title });
}

const box = (dialog: HTMLElement, name: string) =>
  within(dialog).getByRole<HTMLInputElement>("checkbox", { name });

// The lines under one of the summary's headings, as a screen reader reads them.
function summaryLines(dialog: HTMLElement, title: string): string[] {
  const summary = within(dialog).getByLabelText("What the role allows");
  const heading = within(summary).getByRole("heading", { name: title });
  const list = heading.parentElement?.querySelector("ul");
  return [...(list?.querySelectorAll("li") ?? [])].map(
    (item) => item.textContent,
  );
}

// A line of the summary, under one heading if given.
function summaryLine(
  dialog: HTMLElement,
  text: string,
  title?: string,
): HTMLElement {
  const summary = within(dialog).getByLabelText("What the role allows");
  const section =
    title === undefined
      ? summary
      : (within(summary).getByRole("heading", { name: title })
          .parentElement as HTMLElement);
  return within(section).getByText(text);
}

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

  it("is not linked for anyone else, who see only Help's page about roles", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    await screen.findByText("Hello, Fathom");
    expect(
      screen
        .getAllByRole("link", { name: "Roles" })
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/help/roles"]);
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

  it("marks the sensitivity tiers a description names in their own colours", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    await screen.findByText("Fictional Auditors");
    expect(screen.getByText("Personal").className).toMatch(/personal/);
    expect(screen.getByText("Confidential").className).toMatch(/confidential/);
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

describe("the grid of permissions", () => {
  it("ticks, greys, and names a view that comes with editing the same area", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Auditors",
      "Edit Fictional Auditors",
    );
    expect(box(dialog, "View People").disabled).toBe(false);
    await userEvent.click(box(dialog, "Edit People"));
    const implied = box(dialog, "View People, which comes with Edit People");
    expect(implied.checked).toBe(true);
    expect(implied.disabled).toBe(true);
    await userEvent.click(box(dialog, "Edit People"));
    expect(box(dialog, "View People").checked).toBe(true);
    expect(box(dialog, "View People").disabled).toBe(false);
  });

  it("follows the areas with the data classes, General coming with each area", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog("New role", "New role");
    const rows = within(dialog)
      .getAllByRole("row")
      .map((row) => row.textContent);
    expect(rows.slice(0, 1)).toEqual(["AreaViewApproveEdit"]);
    expect(rows.slice(-4)).toEqual([
      "Data classification",
      "General",
      "Personal",
      "Confidential",
    ]);
    for (const name of [
      "View General, which comes with each area",
      "Edit General, which comes with each area",
    ]) {
      expect(box(dialog, name).checked).toBe(true);
      expect(box(dialog, name).disabled).toBe(true);
    }
    expect(
      box(
        dialog,
        "View Personal details, which needs View People or View Feature teams",
      ).checked,
    ).toBe(false);
  });

  it("turns off a box that does nothing without others, and takes it away with them", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Auditors",
      "Edit Fictional Auditors",
    );
    expect(box(dialog, "Approve People").disabled).toBe(false);
    expect(box(dialog, "View Hiring plan").disabled).toBe(false);
    await userEvent.click(box(dialog, "View People"));
    for (const name of [
      "Approve People, which needs View People",
      "View Hiring plan, which needs View People",
      "View Personal details, which needs View People or View Feature teams",
    ]) {
      expect(box(dialog, name).checked).toBe(false);
      expect(box(dialog, name).disabled).toBe(true);
    }
    expect(within(dialog).queryByText(/does nothing without/)).toBeNull();
  });

  it("keeps a box a role was saved with without its needs, until it is unticked", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": () =>
        Response.json({
          roles: [
            { ...auditors, permissions: ["plan:view", "hiring-plan:view"] },
          ],
        }),
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Auditors",
      "Edit Fictional Auditors",
    );
    const hiring = box(dialog, "View Hiring plan");
    expect([hiring.checked, hiring.disabled]).toEqual([true, false]);
    await userEvent.click(box(dialog, "View Configuration"));
    expect(box(dialog, "View Hiring plan").checked).toBe(true);
    await userEvent.click(box(dialog, "View Hiring plan"));
    const waiting = box(dialog, "View Hiring plan, which needs View People");
    expect([waiting.checked, waiting.disabled]).toEqual([false, true]);
  });

  it("gives Classify data and Approve own drafts a box of their own, saying what each allows", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog("New role", "New role");
    const classify = within(dialog).getByRole<HTMLInputElement>("checkbox", {
      name: "Classify data",
    });
    expect(classify.checked).toBe(false);
    expect(
      within(dialog).getByText(permissionDescriptions["data:classify"].allows),
    ).toBeDefined();
    await userEvent.click(box(dialog, "View Plan"));
    await userEvent.click(box(dialog, "Approve Plan"));
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Approve own drafts" }),
    );
    expect(
      within(dialog).getByRole<HTMLInputElement>("checkbox", {
        name: "Approve own drafts",
      }).checked,
    ).toBe(true);
  });
});

describe("the summary of what a role allows", () => {
  it("lists the pages its holders do not see, and what they cannot do", async () => {
    // Given
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog("New role", "New role");
    // Then
    expect(summaryLines(dialog, "Doesn't see")).toEqual(
      expect.arrayContaining(["Capacity", "People"]),
    );
    // When
    await userEvent.click(box(dialog, "Edit Allocations"));
    // Then
    expect(summaryLines(dialog, "Can")).toEqual(
      expect.arrayContaining([
        `New: ${permissionDescriptions["allocations:edit"].allows}`,
      ]),
    );
    expect(summaryLines(dialog, "Cannot")).toContain(
      permissionDescriptions["people:view"].without,
    );
    expect(summaryLines(dialog, "Doesn't see")).toContain("People");
  });

  it("says which pages its holders see and what they can and cannot do", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Auditors",
      "Edit Fictional Auditors",
    );
    expect(summaryLines(dialog, "Sees")).toEqual([
      "Overview",
      "Projects",
      "People",
      "Org chart",
      "Org chart on other dates",
      "Drafts",
      "Change history",
    ]);
    expect(summaryLines(dialog, "Doesn't see")).toEqual(
      expect.arrayContaining([
        "Org chart on future dates: needs Confidential (Future reorganizations)",
        "Accounts",
      ]),
    );
    expect(summaryLines(dialog, "Can")).toEqual([
      permissionDescriptions["plan:view"].allows,
      permissionDescriptions["people:view"].allows,
      permissionDescriptions["personal:view"].allows,
    ]);
  });

  it("marks lines added since the dialog opened, and keeps those taken away, struck through", async () => {
    // Given
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Auditors",
      "Edit Fictional Auditors",
    );
    // When
    await userEvent.click(box(dialog, "View People"));
    // Then
    expect(summaryLines(dialog, "Sees")).toEqual([
      "Overview",
      "Projects",
      "No longer: People",
      "No longer: Org chart",
      "No longer: Org chart on other dates",
      // Drafts and the change history stay, since viewing the plan opens them too.
      "Drafts",
      "Change history",
    ]);
    expect(summaryLines(dialog, "Can")).toEqual([
      permissionDescriptions["plan:view"].allows,
      `No longer: ${permissionDescriptions["people:view"].allows}`,
      `No longer: ${permissionDescriptions["personal:view"].allows}`,
    ]);
    expect(summaryLine(dialog, "People", "Sees").className).toMatch(/removed/);
    const cannot = permissionDescriptions["people:view"].without;
    expect(summaryLine(dialog, cannot).className).toMatch(/added/);
    // When the first line is taken away too, and others added
    await userEvent.click(box(dialog, "View Plan"));
    await userEvent.click(box(dialog, "View Configuration"));
    // Then
    expect(summaryLines(dialog, "Sees")).toEqual([
      "No longer: Overview",
      "No longer: Projects",
      "No longer: People",
      "No longer: Org chart",
      "No longer: Org chart on other dates",
      // Releases, Drafts and the change history stay, since configuration opens them too, and
      // Capacity and Lists open with it.
      "New: Releases",
      "Drafts",
      "New: Capacity",
      "New: Lists",
      "Change history",
    ]);
    expect(summaryLine(dialog, "Releases", "Sees").className).toMatch(/added/);
    expect(summaryLine(dialog, "Drafts", "Sees").className).not.toMatch(
      /added/,
    );
    // When the role grants again what it did when the dialog opened
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Reset" }),
    );
    // Then
    expect(within(dialog).queryByText("No longer:")).toBeNull();
    expect(summaryLine(dialog, "People", "Sees").className).not.toMatch(
      /removed/,
    );
    expect(
      within(dialog).getByRole("button", { name: "Reset" }),
    ).toHaveProperty("disabled", true);
  });

  it("reads Nothing once the role sees no page, marked as added", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Auditors",
      "Edit Fictional Auditors",
    );
    await userEvent.click(box(dialog, "View Plan"));
    await userEvent.click(box(dialog, "View People"));
    expect(summaryLines(dialog, "Sees").at(-1)).toBe("New: Nothing.");
    expect(summaryLine(dialog, "Nothing.").className).toMatch(/added/);
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

describe("the permissions that keep access managed", () => {
  const administrators = {
    ...auditors,
    id: "00000000-0000-4000-8000-000000000005",
    name: "Fictional Administrators",
    permissions: ["administration:edit"],
  };
  const lastAdministrator = {
    id: "user-5",
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
