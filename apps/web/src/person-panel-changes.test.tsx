// SPDX-License-Identifier: Apache-2.0

// Tests for changing a person's details and added columns from their side panel, as drafts.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  background,
  bodyOf,
  positions,
  renderApp,
  serverAnswers,
} from "./test-support.tsx";
import {
  setUpEachTest,
  session,
  profile,
  robin,
  sasha,
  uma,
  peopleAnswer,
  answers,
  panel,
  row,
  editAnswers,
  typeInto,
  settled,
  undone,
  renaming,
  change,
} from "./test-person-panel.tsx";

setUpEachTest();

describe("changing a person's details", () => {
  const drafting = (action: string) => ({
    action,
    changed: [],
    live: { values: {}, links: {} },
    state: "waiting",
    madeBy: null,
    madeAt: null,
  });

  it("offers no changes to those who only see people", async () => {
    answers();
    renderApp("/people?open=E1");
    await panel("Robin Fictional");
    expect(screen.queryByRole("button", { name: "Change Name" })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /Manager\?/ })).toBeNull();
  });

  it("offers no changes beside the live values alone", async () => {
    editAnswers();
    renderApp("/people?open=E1&show=live");
    await panel("Robin Fictional");
    expect(screen.queryByRole("button", { name: "Change Name" })).toBeNull();
  });

  it.each([
    ["drafted to be removed", { draft: drafting("deleted") }],
    ["held by another's changes", { heldBy: "Another Fictional" }],
  ])("offers no changes to someone %s", async (_, details) => {
    editAnswers({
      "GET /api/people": peopleAnswer([
        { ...(robin as Record<string, unknown>), ...details },
        sasha,
        uma,
      ]),
    });
    renderApp("/people?open=E1");
    await screen.findByRole("region", { name: /^Robin Fictional/ });
    expect(screen.queryByRole("button", { name: "Change Name" })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /Manager\?/ })).toBeNull();
  });

  it("offers no change to the team, which follows the manager", async () => {
    editAnswers();
    renderApp("/people?open=E2");
    await panel("Sasha Fictional");
    expect(change("Manager")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Change Team" })).toBeNull();
  });

  it("saves text with Enter as a draft, putting focus back on its button", async () => {
    // Given Robin's details, beside People
    const fetch = editAnswers();
    renderApp("/people?open=E1");
    await panel("Robin Fictional");
    // When their team's name is typed and Enter pressed
    await typeInto("Reporting team name", "Harbour team{Enter}");
    // Then the change is saved, and focus is back on its button
    expect(bodyOf(fetch, "PATCH", "/api/people/1")).toEqual([
      { teamName: "Harbour team" },
    ]);
    await waitFor(() => {
      expect(document.activeElement).toBe(change("Reporting team name"));
    });
  });

  it("undoes the latest change with Cmd+Z, as People does", async () => {
    // Given a change saved from Robin's details
    const fetch = editAnswers();
    renderApp("/people?open=E1");
    await panel("Robin Fictional");
    await typeInto("Reporting team name", "Harbour team{Enter}");
    await settled(fetch);
    // When Cmd+Z is pressed
    await userEvent.keyboard("{Meta>}z{/Meta}");
    // Then the change is undone
    await waitFor(() => {
      expect(undone(fetch)).toBe(1);
    });
  });

  it("opens a value's editor when the value is clicked, and leaves it as it was with Esc", async () => {
    // Given Robin's details
    const fetch = editAnswers();
    renderApp("/people?open=E1");
    await panel("Robin Fictional");
    // When their ID is clicked, typed in, and Esc pressed
    await userEvent.click(within(row("ID")).getByText("E1"));
    const field = await screen.findByRole("textbox", { name: "ID" });
    await userEvent.type(field, "0{Escape}");
    // Then the field closes, nothing is saved, the panel stays, and focus is on the ID's button
    expect(screen.queryByRole("textbox", { name: "ID" })).toBeNull();
    expect(
      screen.getByRole("region", { name: "Robin Fictional" }),
    ).toBeDefined();
    expect(bodyOf(fetch, "PATCH", "/api/people/1")).toEqual([]);
    await waitFor(() => {
      expect(document.activeElement).toBe(change("ID"));
    });
  });

  it("reaches a web link in a value with Tab", async () => {
    answers();
    renderApp("/people?open=E2");
    await panel("Sasha Fictional");
    const link = within(row("Profile")).getByRole("link", {
      name: /Profile page/,
    });
    expect(link.getAttribute("tabindex")).toBeNull();
  });

  it("follows a link in a value rather than opening its editor", async () => {
    editAnswers();
    renderApp("/people?open=E2");
    await panel("Sasha Fictional");
    await userEvent.click(within(row("Manager")).getByText("Robin Fictional"));
    expect(await panel("Robin Fictional")).toBeDefined();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("refuses what People's cells refuse, naming why, until the value will do", async () => {
    // Given Robin's details
    const fetch = editAnswers();
    renderApp("/people?open=E1");
    await panel("Robin Fictional");
    // When Sasha's ID is given to Robin
    const field = await typeInto("ID", "e2{Enter}");
    // Then the field stays open, naming why, and nothing is saved
    const problem = screen.getByText("Someone already has that ID");
    expect(field.getAttribute("aria-describedby")).toContain(problem.id);
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(bodyOf(fetch, "PATCH", "/api/people/1")).toEqual([]);
    // When an ID nobody has is given instead
    await userEvent.clear(field);
    await userEvent.type(field, "E7{Enter}");
    // Then it is saved, and the problem has gone
    expect(bodyOf(fetch, "PATCH", "/api/people/1")).toEqual([
      { employeeId: "E7" },
    ]);
    expect(screen.queryByText("Someone already has that ID")).toBeNull();
  });

  it("puts a refused value back when its field is left", async () => {
    // Given an end date before the start date, refused
    const fetch = editAnswers();
    renderApp("/people?open=E1");
    await panel("Robin Fictional");
    await typeInto("End", "2019-01-01{Enter}");
    expect(
      screen.getByText("The end date cannot be before the start date"),
    ).toBeDefined();
    // When the field is left
    await userEvent.click(screen.getByRole("heading", { name: "Details" }));
    // Then it closes, its problem goes, and nothing is saved
    expect(screen.queryByRole("textbox", { name: "End" })).toBeNull();
    expect(
      screen.queryByText("The end date cannot be before the start date"),
    ).toBeNull();
    expect(bodyOf(fetch, "PATCH", "/api/people/1")).toEqual([]);
  });

  describe("when a person's ID changes", () => {
    it("keeps showing them, under the new ID in the address, with focus kept on the ID", async () => {
      // Given Robin's details
      renaming();
      const history = renderApp("/people?open=E1");
      await panel("Robin Fictional");
      const before = history.length;
      // When their ID is changed
      await typeInto("ID", "E7{Enter}");
      // Then the address names the new ID, in place of the old, and the panel stays on Robin
      await waitFor(() => {
        expect(history.location.search).toContain("open=E7");
      });
      expect(history.length).toBe(before);
      expect(
        screen.getByRole("region", { name: "Robin Fictional" }),
      ).toBeDefined();
      await waitFor(() => {
        expect(document.activeElement).toBe(change("ID"));
      });
    });

    it("shows nobody once the address moves to an ID nobody has", async () => {
      // Given Robin's ID changed
      renaming();
      const history = renderApp("/people?open=E1");
      await panel("Robin Fictional");
      await typeInto("ID", "E7{Enter}");
      await waitFor(() => {
        expect(history.location.search).toContain("open=E7");
      });
      // When the address names an ID nobody has
      act(() => {
        history.push("/people?open=E9");
      });
      // Then the panel says so, rather than showing Robin
      expect(
        await screen.findByText("Nobody in People has the ID E9."),
      ).toBeDefined();
    });

    it("keeps showing them once the change is undone", async () => {
      // Given Robin's ID changed
      const fetch = renaming();
      const history = renderApp("/people?open=E1");
      await panel("Robin Fictional");
      await typeInto("ID", "E7{Enter}");
      await waitFor(() => {
        expect(history.location.search).toContain("open=E7");
      });
      await settled(fetch);
      // When the change is undone
      await userEvent.keyboard("{Meta>}z{/Meta}");
      // Then the address names the old ID again, and the panel still shows Robin
      await waitFor(() => {
        expect(history.location.search).toContain("open=E1");
      });
      expect(
        screen.getByRole("region", { name: "Robin Fictional" }),
      ).toBeDefined();
    });
  });

  it("picks a choice from the list People's cell offers", async () => {
    const fetch = editAnswers();
    renderApp("/people?open=E1");
    await panel("Robin Fictional");
    await userEvent.click(change("Position"));
    await userEvent.click(
      await screen.findByRole("option", { name: "Fictional Architect" }),
    );
    expect(bodyOf(fetch, "PATCH", "/api/people/1")).toEqual([
      { positionId: "position-2" },
    ]);
  });

  it("changes a checkbox, named by its label and the word beside it, in one step", async () => {
    const fetch = editAnswers();
    renderApp("/people?open=E1");
    await panel("Robin Fictional");
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Manager? Yes" }),
    );
    expect(bodyOf(fetch, "PATCH", "/api/people/1")).toEqual([
      { isManager: false },
    ]);
  });

  it("marks a drafted checkbox, with the live value under it", async () => {
    editAnswers({
      "GET /api/people": peopleAnswer([
        {
          ...(robin as Record<string, unknown>),
          isManager: false,
          draft: {
            ...drafting("changed"),
            changed: ["isManager"],
            live: { isManager: true, values: {}, links: {} },
          },
        },
        sasha,
        uma,
      ]),
    });
    renderApp("/people?open=E1");
    await panel("Robin Fictional");
    const manager = row("Manager?");
    expect(
      within(manager).getByRole<HTMLInputElement>("checkbox").checked,
    ).toBe(false);
    expect(
      within(manager).getByText(", Draft: changed from “Yes”"),
    ).toBeDefined();
    expect(within(manager).getByText(", live")).toBeDefined();
  });

  it("names the problem under a value whose editor does not name it", async () => {
    // Given a required Skills column holding one skill
    const skills = {
      ...background,
      id: "f3",
      keyNumber: 1,
      name: "Skills",
      type: "choice",
      listId: "skills",
      multiple: true,
      required: true,
    };
    const fetch = editAnswers({
      "GET /api/people": () =>
        Response.json({
          people: [
            { ...(robin as Record<string, unknown>), values: { f3: ["rust"] } },
          ],
          fields: [skills],
          order: [],
        }),
      "GET /api/lists": () =>
        Response.json({
          lists: [
            positions,
            {
              ...positions,
              id: "skills",
              keyNumber: 1,
              name: "Skills",
              builtIn: null,
              choices: [
                { id: "rust", label: "Rust", description: "", retired: false },
              ],
            },
          ],
        }),
    });
    renderApp("/people?open=E1");
    await panel("Robin Fictional");
    // When the skill is taken off
    await userEvent.click(change("Skills"));
    await userEvent.click(await screen.findByRole("option", { name: "Rust" }));
    await userEvent.keyboard("{Tab}");
    // Then the problem shows under the value, and nothing is saved
    expect(within(row("Skills")).getByText("Skills needed")).toBeDefined();
    expect(bodyOf(fetch, "PATCH", "/api/people/1")).toEqual([]);
  });

  it("neither shows nor changes a column drafted away, with the drafts applied", async () => {
    editAnswers({
      "GET /api/people": () =>
        Response.json({
          people: [robin, sasha, uma],
          fields: [background, { ...profile, draft: drafting("deleted") }],
          order: [],
        }),
    });
    renderApp("/people?open=E2&show=drafts");
    await panel("Sasha Fictional");
    expect(screen.queryByText("Profile", { selector: "dt" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Change Profile" })).toBeNull();
  });

  it("closes an editor left open while only the live values were shown", async () => {
    // Given Robin's team name being changed
    const errors = vi.spyOn(console, "error");
    editAnswers();
    const history = renderApp("/people?open=E1");
    await panel("Robin Fictional");
    await userEvent.click(change("Reporting team name"));
    await screen.findByRole("textbox", { name: "Reporting team name" });
    // When only the live values are shown, then the drafts again
    act(() => {
      history.push("/people?open=E1&show=live");
    });
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Change Name" })).toBeNull();
    });
    act(() => {
      history.push("/people?open=E1");
    });
    // Then the editor is closed, with nothing reported wrong in drawing the page
    expect(
      await screen.findByRole("button", { name: "Change Name" }),
    ).toBeDefined();
    expect(
      screen.queryByRole("textbox", { name: "Reporting team name" }),
    ).toBeNull();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("starts afresh on showing someone else", async () => {
    editAnswers();
    renderApp("/people?open=E2");
    await panel("Sasha Fictional");
    await userEvent.click(change("Reporting team name"));
    await screen.findByRole("textbox", { name: "Reporting team name" });
    await userEvent.click(within(row("Manager")).getByText("Robin Fictional"));
    await panel("Robin Fictional");
    expect(
      screen.queryByRole("textbox", { name: "Reporting team name" }),
    ).toBeNull();
  });

  describe("beside the org chart", () => {
    const charts = (fetch: ReturnType<typeof serverAnswers>) =>
      fetch.mock.calls.filter(([url]) => url === "/api/org-chart").length;

    it("saves a change, and draws the chart again", async () => {
      // Given Robin's details beside the chart
      const fetch = editAnswers();
      renderApp("/org-chart?open=E1");
      await panel("Robin Fictional");
      const before = charts(fetch);
      // When their team's name is changed
      await typeInto("Reporting team name", "Harbour team{Enter}");
      // Then it is saved, and the chart drawn again
      expect(bodyOf(fetch, "PATCH", "/api/people/1")).toEqual([
        { teamName: "Harbour team" },
      ]);
      await waitFor(() => {
        expect(charts(fetch)).toBeGreaterThan(before);
      });
    });

    it("undoes the change with Cmd+Z, and draws the chart again", async () => {
      // Given a change saved beside the chart
      const fetch = editAnswers();
      renderApp("/org-chart?open=E1");
      await panel("Robin Fictional");
      await typeInto("Reporting team name", "Harbour team{Enter}");
      await settled(fetch);
      const before = charts(fetch);
      // When Cmd+Z is pressed
      await userEvent.keyboard("{Meta>}z{/Meta}");
      // Then the change is undone, and the chart drawn again
      await waitFor(() => {
        expect(undone(fetch)).toBe(1);
      });
      await waitFor(() => {
        expect(charts(fetch)).toBeGreaterThan(before);
      });
    });

    it("keeps showing someone whose ID changes, under the new ID in the address", async () => {
      renaming();
      const history = renderApp("/org-chart?open=E1");
      await panel("Robin Fictional");
      const before = history.length;
      await typeInto("ID", "E7{Enter}");
      await waitFor(() => {
        expect(history.location.search).toContain("open=E7");
      });
      expect(history.length).toBe(before);
      expect(
        screen.getByRole("region", { name: "Robin Fictional" }),
      ).toBeDefined();
    });

    it("undoes nothing once a later change has been made on the page", async () => {
      // Given a change saved beside the chart, then a team's colour chosen
      const fetch = editAnswers({
        "GET /api/session": session([
          "people:view",
          "people:edit",
          "feature-teams:view",
          "plan:view",
          "features:view",
        ]),
        "PUT /api/org-chart/teams/1/colour": () =>
          new Response(null, { status: 204 }),
      });
      renderApp("/org-chart?open=E1");
      await panel("Robin Fictional");
      await typeInto("Reporting team name", "Harbour team{Enter}");
      await settled(fetch);
      await userEvent.click(
        screen.getByRole("button", { name: /^Colour of Fictional team:/ }),
      );
      await userEvent.click(
        await screen.findByRole("menuitem", { name: "Grape" }),
      );
      await waitFor(() => {
        expect(
          fetch.mock.calls.some(
            ([url]) => url === "/api/org-chart/teams/1/colour",
          ),
        ).toBe(true);
      });
      // When Cmd+Z is pressed
      await userEvent.keyboard("{Meta>}z{/Meta}");
      // Then the panel's change is not undone
      expect(undone(fetch)).toBe(0);
    });
  });
});

describe("a person's choice a draft renames, in their details", () => {
  // Positions, whose Fictional Engineer a waiting draft renames Fictional Developer.
  const renamedPositions = () =>
    Response.json({
      lists: [
        {
          ...positions,
          choices: [
            {
              ...positions.choices[0],
              label: "Fictional Developer",
              draft: {
                action: "changed",
                changed: ["label"],
                live: { label: "Fictional Engineer" },
                state: "waiting",
                madeBy: null,
                madeAt: null,
              },
            },
          ],
        },
      ],
    });

  it.each([
    ["beside People", "/people?open=E1"],
    ["beside the Org chart", "/org-chart?open=E1"],
  ])("has the rename's dot, naming its live name, %s", async (_, address) => {
    answers(undefined, renamedPositions);
    renderApp(address);
    await panel("Robin Fictional");
    expect(row("Position").textContent).toContain(
      "Fictional Developer, Draft: changed from “Fictional Engineer”",
    );
  });
});
