// SPDX-License-Identifier: Apache-2.0

// Tests for the Roles page, with the server's responses simulated: who sees it, the list of roles,
// creating a role from nothing or as a copy, changing one with what the change does to accounts
// confirmed first, putting a starting role back as Fathom made it, the summary of what a role
// allows as it changes, and the server's refusals.

import { permissionDescriptions } from "@fathom/shared";
import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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
    permissions: ["roles:view", "roles:edit", "plan:view"],
  });

const teamMemberRole = {
  id: "00000000-0000-4000-8000-000000000001",
  key: "team-member",
  name: "Team Member",
  description:
    "Sees the plan, including everyone's work assignments, and the org chart.",
  permissions: ["plan:view", "allocations:view", "org-chart:view"],
  accounts: 3,
  updatedAt: "2026-11-01T12:00:00.000Z",
};
const auditors = {
  id: "00000000-0000-4000-8000-000000000002",
  key: null,
  name: "Fictional Auditors",
  description: "Checks Restricted and Confidential data for audits.",
  permissions: ["plan:view", "people:view", "restricted:view"],
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
  vi.useRealTimers();
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

function summaryLine(dialog: HTMLElement, text: string): HTMLElement {
  const summary = within(dialog).getByLabelText("What the role allows");
  return within(summary).getByText(text);
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
      "Checks Restricted and Confidential data for audits.",
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
    expect(screen.getByText("Restricted").className).toMatch(/restricted/);
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
    expect(summaryLines(dialog, "Pages its holders see")).toEqual([
      "None, apart from Help.",
    ]);
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
      within(dialog).getByLabelText("What it is for"),
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
    await userEvent.click(within(dialog).getByLabelText("What it is for"));
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
      within(dialog).getByLabelText<HTMLTextAreaElement>("What it is for")
        .value,
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

  it("names the sensitivity tiers among the areas in their own colours", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog("New role", "New role");
    const grid = within(dialog).getByRole("table", {
      name: "What the role grants",
    });
    expect(within(grid).getByText("Restricted").className).toMatch(
      /restricted/,
    );
    expect(within(grid).getByText("Confidential").className).toMatch(
      /confidential/,
    );
  });

  it("marks what Fathom does not have yet, area by area or action by action", async () => {
    // Given
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    // When
    const dialog = await openDialog("New role", "New role");
    // Then
    const grid = within(dialog).getByRole("table", {
      name: "What the role grants",
    });
    const area = (name: string) =>
      within(grid).getByText(name).closest("td")?.textContent;
    expect(area("Allocations")).toBe("Allocations, Not built yet");
    expect(area("Feature teams")).toBe("Feature teams");
    expect(area("Drafts")).toBe("Drafts, Not built yet");
    expect(area("Plan")).toBe("Plan");
    expect(area("Releases")).toBe("Releases");
    expect(box(dialog, "Edit Allocations, not built yet")).toBeDefined();
    expect(box(dialog, "Approve Plan")).toBeDefined();
    expect(box(dialog, "Approve Releases")).toBeDefined();
    expect(
      within(dialog).getByText(/marked Not built yet/).textContent,
    ).toContain("A role can grant it now, and it works once it is built.");
  });
});

describe("the summary of what a role allows", () => {
  it("marks what it grants, and what its holders cannot do, that Fathom does not have yet", async () => {
    // Given
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog("New role", "New role");
    // Then
    expect(summaryLines(dialog, "Cannot")).toEqual(
      expect.arrayContaining([
        "The Capacity page does not appear., Not built yet",
        `${permissionDescriptions["allocations:view"].without}, Not built yet`,
        "The People page does not appear.",
      ]),
    );
    // When
    await userEvent.click(box(dialog, "Edit Allocations, not built yet"));
    // Then
    expect(summaryLines(dialog, "Pages its holders see")).toContain(
      "Capacity, Not built yet",
    );
    expect(summaryLines(dialog, "Can")).toContain(
      `${permissionDescriptions["allocations:edit"].allows}, Not built yet`,
    );
    expect(summaryLines(dialog, "Cannot")).toContain(
      "The People page does not appear.",
    );
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
    expect(summaryLines(dialog, "Pages its holders see")).toEqual([
      "Overview",
      "Projects, Not built yet",
      "Releases",
      "People",
      "Drafts",
    ]);
    expect(summaryLines(dialog, "Can")).toEqual([
      permissionDescriptions["plan:view"].allows,
      permissionDescriptions["people:view"].allows,
      permissionDescriptions["restricted:view"].allows,
    ]);
    expect(summaryLines(dialog, "Cannot")).toContain(
      "The Accounts page does not appear.",
    );
  });

  it("warns of a permission that does nothing without another", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Auditors",
      "Edit Fictional Auditors",
    );
    expect(within(dialog).queryByText(/does nothing without/)).toBeNull();
    await userEvent.click(box(dialog, "View People"));
    expect(
      within(dialog).getByText(
        "View Restricted details does nothing without View People.",
      ),
    ).toBeDefined();
  });

  it("marks lines just added, and keeps lines just taken away, struck through, until they go", async () => {
    // Given
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({
      advanceTimers: (delay) => vi.advanceTimersByTime(delay),
    });
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    await user.click(
      await screen.findByRole("button", { name: "Edit Fictional Auditors" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Edit Fictional Auditors",
    });
    // When
    await user.click(box(dialog, "View People"));
    // Then
    expect(summaryLines(dialog, "Pages its holders see")).toEqual([
      "Overview",
      "Projects, Not built yet",
      "Releases",
      "No longer: People",
      // Drafts stays, since viewing the plan opens it too.
      "Drafts",
    ]);
    expect(summaryLines(dialog, "Can")).toEqual([
      permissionDescriptions["plan:view"].allows,
      `No longer: ${permissionDescriptions["people:view"].allows}`,
      permissionDescriptions["restricted:view"].allows,
    ]);
    expect(summaryLine(dialog, "People").className).toMatch(/removed/);
    const cannot = permissionDescriptions["people:view"].without;
    expect(summaryLine(dialog, cannot).className).toMatch(/added/);
    // When the first line is taken away too, and another added, before the first change ends
    await user.click(box(dialog, "View Plan"));
    await user.click(box(dialog, "View Configuration"));
    // Then
    expect(summaryLines(dialog, "Pages its holders see")).toEqual([
      "No longer: Overview",
      "No longer: Projects, Not built yet",
      // Releases and Drafts come back, since configuration opens them too.
      "Releases",
      "No longer: People",
      "Drafts",
      "No longer: None, apart from Help.",
      "Lists",
    ]);
    expect(summaryLine(dialog, cannot).className).toMatch(/added/);
    expect(summaryLine(dialog, "Drafts").className).toMatch(/added/);
    // When each change has ended
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    // Then
    expect(summaryLines(dialog, "Pages its holders see")).toEqual([
      "Releases",
      "Drafts",
      "Lists",
    ]);
    expect(summaryLine(dialog, cannot).className).not.toMatch(/added/);
    expect(summaryLine(dialog, "Lists").className).not.toMatch(/added/);
    expect(within(dialog).queryByText("No longer:")).toBeNull();
    // The dialog closes with no change left to end.
    await user.click(box(dialog, "View Plan"));
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
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
              before: ["plan:view", "people:view", "restricted:view"],
              after: ["plan:view", "restricted:view", "changes:view"],
            },
            {
              account: planner,
              before: ["plan:view"],
              after: ["plan:view", "changes:view"],
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
    await userEvent.click(box(dialog, "View Change history"));
    // When
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    // Then
    expect(
      await within(dialog).findByText("This change affects 2 accounts."),
    ).toBeDefined();
    const own = within(dialog)
      .getByText("Fictional Person (person@example.test) (you)")
      .closest(".mantine-Paper-root") as HTMLElement;
    expect(
      within(own).getByText("Sees the Change history page."),
    ).toBeDefined();
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
          permissions: ["plan:view", "restricted:view", "changes:view"],
          updatedAt: auditors.updatedAt,
        }),
      }),
    );
  });

  it("goes back to the change from the accounts it affects, keeping it, and asks again", async () => {
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
    expect(within(dialog).queryByText(/\(you\)/)).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Back" }));
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
      "You do not have permission to do this. Your role may have changed.",
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

describe("confirming a change to what is not built yet", () => {
  it("marks each account's gains and losses that Fathom does not have yet", async () => {
    // Given
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
      "POST /api/roles/00000000-0000-4000-8000-000000000002/effects": () =>
        Response.json({
          effects: [
            {
              account: planner,
              before: ["plan:view", "allocations:view", "drafts:submit"],
              after: ["plan:view", "allocations:view", "allocations:edit"],
            },
          ],
        }),
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Auditors",
      "Edit Fictional Auditors",
    );
    await userEvent.click(box(dialog, "Edit Allocations, not built yet"));
    // When
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    // Then
    expect(
      await within(dialog).findByText("This change affects 1 account."),
    ).toBeDefined();
    const lines = (title: string) =>
      [
        ...(within(dialog)
          .getByRole("heading", { name: title })
          .parentElement?.querySelectorAll("li") ?? []),
      ].map((item) => item.textContent);
    expect(lines("Gains")).toEqual([
      `${permissionDescriptions["allocations:edit"].allows}, Not built yet`,
    ]);
    expect(lines("Loses")).toEqual([
      `${permissionDescriptions["drafts:submit"].without}, Not built yet`,
    ]);
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
      ["What it is for", " Fictionally."],
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
      within(dialog).getByLabelText<HTMLTextAreaElement>("What it is for")
        .value,
    ).toBe(teamMemberRole.description);
    expect(box(dialog, "View Plan").checked).toBe(true);
    expect(box(dialog, "View Allocations, not built yet").checked).toBe(true);
    expect(box(dialog, "View Org chart").checked).toBe(true);
    expect(box(dialog, "View Change history").checked).toBe(false);
    expect(box(dialog, "View People").checked).toBe(false);
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
    Response.json({ ...fictionalUser, permissions: ["roles:view"] });

  it("starts on the page, which offers each role only to view", async () => {
    // Given
    serverAnswers({
      "GET /api/session": roleViewer,
      "GET /api/roles": roleList,
    });
    // When
    const history = renderApp("/");
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
      within(dialog).getByLabelText<HTMLTextAreaElement>("What it is for");
    expect([purpose.value, purpose.readOnly]).toEqual([
      auditors.description,
      true,
    ]);
    await userEvent.click(box(dialog, "View People"));
    await userEvent.click(box(dialog, "View Change history"));
    expect(box(dialog, "View People").checked).toBe(true);
    expect(box(dialog, "View Change history").checked).toBe(false);
    expect(summaryLines(dialog, "Pages its holders see")).toContain("People");
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

describe("a starting role's summary", () => {
  const purpose = (dialog: HTMLElement) =>
    within(dialog).getByLabelText<HTMLTextAreaElement>("What it is for");
  const gone = "What the role grants changed, so its old summary is gone.";

  it("is emptied once what the role grants changes, and saved empty", async () => {
    // Given
    const fetch = serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
      "POST /api/roles/00000000-0000-4000-8000-000000000001/effects": () =>
        Response.json({ effects: [] }),
      "PUT /api/roles/00000000-0000-4000-8000-000000000001": () =>
        Response.json({ role: teamMemberRole }),
    });
    renderApp("/roles");
    const dialog = await openDialog("Edit Team Member", "Edit Team Member");
    // When
    await userEvent.click(box(dialog, "View People"));
    await userEvent.click(box(dialog, "View Change history"));
    // Then
    expect(purpose(dialog).value).toBe("");
    expect(within(dialog).getByText(gone)).toBeDefined();
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("The role has been changed.")).toBeDefined();
    expect(fetch).toHaveBeenCalledWith(
      "/api/roles/00000000-0000-4000-8000-000000000001",
      expect.objectContaining({
        body: JSON.stringify({
          name: "Team Member",
          description: "",
          permissions: [
            ...teamMemberRole.permissions,
            "people:view",
            "changes:view",
          ],
          updatedAt: teamMemberRole.updatedAt,
        }),
      }),
    );
  });

  it("takes a new summary, which a further change keeps", async () => {
    // Given
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog("Edit Team Member", "Edit Team Member");
    await userEvent.click(box(dialog, "View People"));
    // When
    await userEvent.type(purpose(dialog), "Sees people.");
    await userEvent.click(box(dialog, "View People"));
    // Then
    expect(purpose(dialog).value).toBe("Sees people.");
    expect(within(dialog).queryByText(gone)).toBeNull();
  });

  it("comes back once what the role grants is put back as saved", async () => {
    // Given a starting role changed since Fathom made it
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": () =>
        Response.json({
          roles: [
            {
              ...teamMemberRole,
              description: "Watches.",
              permissions: ["people:view"],
            },
          ],
        }),
    });
    renderApp("/roles");
    const dialog = await openDialog("Edit Team Member", "Edit Team Member");
    // When
    await userEvent.click(box(dialog, "View People"));
    expect(purpose(dialog).value).toBe("");
    await userEvent.click(box(dialog, "View People"));
    // Then
    expect(purpose(dialog).value).toBe("Watches.");
    expect(within(dialog).queryByText(gone)).toBeNull();
  });

  it("comes back with the rest of Fathom's version", async () => {
    // Given
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog("Edit Team Member", "Edit Team Member");
    await userEvent.click(box(dialog, "View People"));
    // When
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Restore template" }),
    );
    // Then
    expect(purpose(dialog).value).toBe(teamMemberRole.description);
    expect(within(dialog).queryByText(gone)).toBeNull();
  });

  it("is not emptied for a role made later", async () => {
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
    await userEvent.click(box(dialog, "View Change history"));
    // Then
    expect(purpose(dialog).value).toBe(auditors.description);
  });
});
