// SPDX-License-Identifier: Apache-2.0

// Tests for a person's details in a side panel, with the server's responses simulated: what it
// shows of them, their manager, reports and feature teams, drafted values beside live ones, opening
// it, moving to another person, closing it, and someone it cannot find.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp, serverAnswers } from "./test-support.tsx";
import {
  setUpEachTest,
  viewer,
  person,
  robin,
  sasha,
  uma,
  peopleAnswer,
  positions,
  chart,
  answers,
  panel,
  row,
} from "./test-person-panel.tsx";

setUpEachTest();

const squaresIn = (element: HTMLElement) =>
  [...element.querySelectorAll<HTMLElement>("[data-colour]")].map(
    (square) => square.dataset.colour,
  );

describe("a person's details", () => {
  it("shows the person, their manager, reports, details and columns beside People", async () => {
    answers();
    const history = renderApp("/people?open=E2");
    expect(await panel("Sasha Fictional")).toBeDefined();
    expect(screen.getByRole("grid", { name: "People" })).toBeDefined();
    expect(within(row("Manager")).getByText("Robin Fictional")).toBeDefined();
    expect(within(row("ID")).getByText("E2")).toBeDefined();
    expect(within(row("Background")).getByText("Joined")).toBeDefined();
    expect(
      within(row("Profile")).getByRole("link", { name: /Profile page/ }),
    ).toBeDefined();
    expect(
      screen
        .getByRole("link", { name: "Show on org chart" })
        .getAttribute("href"),
    ).toBe("/org-chart?person=E2");
    await userEvent.click(
      screen.getByRole("button", { name: "Close details" }),
    );
    expect(history.location.search).not.toContain("open=");
    expect(
      screen.queryByRole("region", { name: "Sasha Fictional" }),
    ).toBeNull();
  });

  it("lists today's reports and those starting later, but not those who have left", async () => {
    const reportOfSasha = {
      manager: { id: "2", preferredName: "Sasha Fictional" },
      team: "Fictional crew",
    };
    answers([
      robin,
      sasha,
      uma,
      person("4", "Vic Fictional", {
        ...reportOfSasha,
        startDate: "2099-01-04",
      }),
      person("5", "Wren Fictional", {
        ...reportOfSasha,
        endDate: "2021-01-01",
      }),
    ]);
    renderApp("/people?open=E2");
    await panel("Sasha Fictional");
    const reports = row("Direct reports");
    expect(
      within(reports)
        .getAllByRole("button")
        .map(({ textContent }) => textContent),
    ).toEqual(["Uma Fictional", "Vic Fictional"]);
    expect(within(reports).getByText(/^Starts .*2099/)).toBeDefined();
  });

  it("shows a direct report when their name is chosen", async () => {
    answers();
    const history = renderApp("/people?open=E1");
    await panel("Robin Fictional");
    await userEvent.click(
      within(row("Direct reports")).getByRole("button", {
        name: "Sasha Fictional",
      }),
    );
    expect(await panel("Sasha Fictional")).toBeDefined();
    expect(history.location.search).toContain("open=E2");
  });

  it("shows someone else when their name is chosen", async () => {
    answers();
    const history = renderApp("/people?open=E2");
    await panel("Sasha Fictional");
    await userEvent.click(
      within(row("Manager")).getByRole("button", { name: "Robin Fictional" }),
    );
    expect(await panel("Robin Fictional")).toBeDefined();
    expect(history.location.search).toContain("open=E1");
    history.back();
    expect(await panel("Sasha Fictional")).toBeDefined();
  });

  it("stays open beside Metrics, and while People's view changes", async () => {
    answers();
    const history = renderApp("/people?open=E2");
    await panel("Sasha Fictional");
    await userEvent.click(screen.getByRole("button", { name: "Metrics" }));
    expect(
      await screen.findByRole("region", { name: "Metrics" }),
    ).toBeDefined();
    expect(
      screen.getByRole("region", { name: "Sasha Fictional" }),
    ).toBeDefined();
    expect(history.location.search).toContain("open=E2");
  });

  it("marks a drafted value, with the live one under it, beside live", async () => {
    answers();
    renderApp("/people?open=E2");
    await panel("Sasha Fictional");
    const team = row("Reporting team name");
    expect(within(team).getByText("Fictional crew")).toBeDefined();
    expect(
      within(team).getByText(", Draft: changed from no reporting team name"),
    ).toBeDefined();
    expect(within(team).getByText(", live")).toBeDefined();
  });

  it.each([
    [
      "note",
      "Background",
      "f1",
      { notes: { f1: "Moved from the data team" } },
      "Moved from the data team",
    ],
    [
      "link",
      "Profile",
      "f2",
      {
        links: {
          f2: { address: "https://example.com/old", text: "Old profile" },
        },
      },
      "Old profile",
    ],
  ])(
    "marks a drafted %s without its live words in the dot's words, showing them under it beside live",
    async (_, label, key, live, liveWords) => {
      answers([
        robin,
        {
          ...(sasha as Record<string, unknown>),
          draft: {
            action: "changed",
            changed: [key],
            live: { values: {}, links: {}, ...live },
            state: "waiting",
            madeBy: null,
            madeAt: null,
          },
        },
        uma,
      ]);
      renderApp("/people?open=E2");
      await panel("Sasha Fictional");
      const drafted = row(label);
      expect(within(drafted).getByText(", Draft")).toBeDefined();
      expect(within(drafted).getByText(liveWords)).toBeDefined();
      expect(within(drafted).getByText(", live")).toBeDefined();
    },
  );

  it("follows the Draft menu of the page beside it", async () => {
    answers();
    renderApp("/people?open=E2&show=live");
    await panel("Sasha Fictional");
    expect(
      within(row("Reporting team name")).queryByText("Fictional crew"),
    ).toBeNull();
    expect(within(row("Reporting team name")).queryByText("Live")).toBeNull();
  });

  it("finds the person whatever the letter case of the ID", async () => {
    answers();
    renderApp("/people?open=e2");
    expect(await panel("Sasha Fictional")).toBeDefined();
  });

  it("says when nobody has the ID", async () => {
    answers();
    renderApp("/people?open=E9");
    expect(
      await screen.findByText("Nobody in People has the ID E9."),
    ).toBeDefined();
  });

  it("opens from the button in a person's Name cell on People", async () => {
    answers();
    const history = renderApp("/people");
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Show details of Sasha Fictional",
      }),
    );
    expect(history.location.pathname).toBe("/people");
    expect(history.location.search).toContain("open=E2");
    expect(await panel("Sasha Fictional")).toBeDefined();
  });

  it("opens from People's row menu", async () => {
    answers();
    const history = renderApp("/people");
    await screen.findByRole("grid", { name: "People" });
    act(() => {
      (document.getElementById("cell-2-preferredName") as HTMLElement).focus();
    });
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Show details" }),
    );
    expect(history.location.search).toContain("open=E2");
  });

  it("opens beside the org chart from a card", async () => {
    answers();
    const history = renderApp("/org-chart");
    await userEvent.click(
      await screen.findByRole("link", { name: "Sasha Fictional" }),
    );
    expect(history.location.pathname).toBe("/org-chart");
    expect(history.location.search).toContain("open=E2");
    expect(await panel("Sasha Fictional")).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Show in People" }).getAttribute("href"),
    ).toBe("/people?search=E2");
  });

  describe("with drafts of whole people", () => {
    const draft = (action: string, state = "waiting") => ({
      action,
      changed: [],
      live: { values: {}, links: {} },
      state,
      madeBy: null,
      madeAt: null,
    });
    const leaving = person("7", "Wendy Fictional", { draft: draft("deleted") });
    const joining = person("8", "Xan Fictional", { draft: draft("created") });
    const refused = person("6", "Rex Fictional", {
      manager: { id: "2", preferredName: "Sasha Fictional" },
      draft: draft("created", "rejected"),
    });
    const taken = person("3", "Uma Fictional", {
      manager: { id: "2", preferredName: "Sasha Fictional" },
      team: "Fictional crew",
      teamName: "Uma's crew",
      draft: {
        ...draft("changed", "rejected"),
        changed: ["teamName"],
        live: { teamName: null, values: {}, links: {} },
      },
    });
    const everyone = [robin, sasha, taken, leaving, joining, refused];

    it("marks someone drafted to be added beside live", async () => {
      answers(everyone);
      renderApp("/people?open=E8");
      // The panel is named for the person alone, with the draft's mark beside its heading.
      const shown = await panel("Xan Fictional");
      expect(within(shown).getByText(/Draft: added/)).toBeDefined();
    });

    it("says who is not live yet with Live only", async () => {
      answers(everyone);
      renderApp("/people?open=E8&show=live");
      expect(
        await screen.findByText(
          "Xan Fictional is only drafted to be added, so is not live yet.",
        ),
      ).toBeDefined();
    });

    it("says who is drafted to be removed with Drafts applied", async () => {
      answers(everyone);
      renderApp("/people?open=E7&show=drafts");
      expect(
        await screen.findByText("Wendy Fictional is drafted to be removed."),
      ).toBeDefined();
    });

    it("takes rejected drafts back with Drafts applied", async () => {
      answers(everyone);
      renderApp("/people?open=E3&show=drafts");
      await panel("Uma Fictional");
      expect(
        within(row("Reporting team name")).queryByText("Uma's crew"),
      ).toBeNull();
    });

    it("leaves out reports whose addition was rejected with Drafts applied", async () => {
      answers(everyone);
      renderApp("/people?open=E2&show=drafts");
      await panel("Sasha Fictional");
      expect(
        within(row("Direct reports")).queryByText("Rex Fictional"),
      ).toBeNull();
      expect(
        within(row("Direct reports")).getByText("Uma Fictional"),
      ).toBeDefined();
    });

    it("says when adding someone was rejected, with Drafts applied", async () => {
      answers(everyone);
      renderApp("/people?open=E6&show=drafts");
      expect(
        await screen.findByText("Adding Rex Fictional was rejected."),
      ).toBeDefined();
    });
  });

  it("marks someone who has left", async () => {
    answers([
      robin,
      person("2", "Sasha Fictional", { endDate: "2020-12-31" }),
      uma,
    ]);
    renderApp("/people?open=E2");
    await panel("Sasha Fictional");
    expect(screen.getByText("Left")).toBeDefined();
  });

  it("shows no position to those who cannot see the Positions list", async () => {
    answers(undefined, undefined, true);
    renderApp("/people?open=E1");
    const shown = await panel("Robin Fictional");
    expect(within(shown).queryByText("Fictional Engineer")).toBeNull();
  });

  it("draws a team's colour only beside its name", async () => {
    answers();
    renderApp("/people?open=E1");
    await panel("Robin Fictional");
    expect(
      within(row("Reporting team name")).getByText("Fictional team"),
    ).toBeDefined();
  });

  it("draws no colour for a team without a name", async () => {
    answers();
    renderApp("/people?open=E3");
    await panel("Uma Fictional");
    expect(within(row("Reporting team name")).getByText("None")).toBeDefined();
    expect(
      row("Reporting team name").querySelector(".mantine-ColorSwatch-root"),
    ).toBeNull();
  });

  it("says so when it cannot load, and tries again", async () => {
    let fail = true;
    answers(undefined, () =>
      fail
        ? Response.json({ error: "Down" }, { status: 500 })
        : Response.json({ lists: [positions] }),
    );
    renderApp("/org-chart?open=E2");
    expect(
      await screen.findByText("Fathom could not load this person."),
    ).toBeDefined();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await panel("Sasha Fictional")).toBeDefined();
  });

  it("says so when People cannot load beside the org chart", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/people": () =>
        Response.json({ error: "Down" }, { status: 500 }),
      "GET /api/lists": () => Response.json({ lists: [positions] }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": () =>
        Response.json({ people: chart, drafted: chart }),
    });
    renderApp("/org-chart?open=E2");
    expect(
      await screen.findByText("Fathom could not load this person."),
    ).toBeDefined();
  });

  it("closes beside People when nobody has the ID", async () => {
    answers();
    const history = renderApp("/people?open=E9");
    await screen.findByText("Nobody in People has the ID E9.");
    await userEvent.click(
      screen.getByRole("button", { name: "Close details" }),
    );
    expect(history.location.search).not.toContain("open=");
  });

  it("shows someone else, and closes, beside the org chart", async () => {
    answers();
    const history = renderApp("/org-chart?open=E2");
    await panel("Sasha Fictional");
    await userEvent.click(
      within(row("Manager")).getByRole("button", { name: "Robin Fictional" }),
    );
    expect(await panel("Robin Fictional")).toBeDefined();
    expect(history.location.search).toContain("open=E1");
    await userEvent.click(
      screen.getByRole("button", { name: "Close details" }),
    );
    expect(history.location.search).not.toContain("open=");
  });

  it("marks reports drafted in and away beside live, as added and removed", async () => {
    const moving = (
      id: string,
      name: string,
      managerId: string,
      liveManagerId: string,
    ) =>
      person(id, name, {
        manager: {
          id: managerId,
          keyNumber: 1,
          preferredName:
            managerId === "1" ? "Robin Fictional" : "Sasha Fictional",
        },
        draft: {
          action: "changed",
          changed: ["managerId"],
          live: { managerId: liveManagerId, values: {}, links: {} },
          state: "waiting",
          madeBy: null,
          madeAt: null,
        },
      });
    answers([
      robin,
      sasha,
      moving("3", "Uma Fictional", "1", "2"),
      moving("9", "Yan Fictional", "2", "1"),
    ]);
    renderApp("/people?open=E2");
    await panel("Sasha Fictional");
    const reports = row("Direct reports");
    const item = (name: string) =>
      within(reports).getByText(name).closest("li") as HTMLElement;
    expect(within(item("Yan Fictional")).getByText(", added")).toBeDefined();
    expect(within(item("Uma Fictional")).getByText(", removed")).toBeDefined();
  });

  it("marks a manager who has left", async () => {
    answers([
      robin,
      person("2", "Sasha Fictional", {
        manager: { id: "1", preferredName: "Robin Fictional" },
        managerLeft: true,
      }),
      uma,
    ]);
    renderApp("/people?open=E2");
    await panel("Sasha Fictional");
    expect(within(row("Manager")).getByText("Left")).toBeDefined();
  });

  it("marks a live manager who has left on the live line under a drafted move", async () => {
    answers([
      robin,
      person("4", "Tatum Fictional", {
        isManager: true,
        endDate: "2020-06-30",
        manager: { id: "1", preferredName: "Robin Fictional" },
      }),
      person("2", "Sasha Fictional", {
        manager: { id: "1", preferredName: "Robin Fictional" },
        draft: {
          action: "changed",
          changed: ["managerId"],
          live: { managerId: "4", values: {}, links: {} },
          state: "waiting",
          madeBy: null,
          madeAt: null,
        },
      }),
    ]);
    renderApp("/people?open=E2");
    await panel("Sasha Fictional");
    const manager = row("Manager");
    expect(within(manager).getByText("Robin Fictional")).toBeDefined();
    const liveLine = within(manager).getByText("Tatum Fictional")
      .parentElement as HTMLElement;
    expect(within(liveLine).getByText(", live")).toBeDefined();
    expect(within(liveLine).getByText("Left")).toBeDefined();
    expect(within(manager).getAllByText("Left")).toHaveLength(1);
  });

  it("draws the Reporting team in its manager's team's colour", async () => {
    answers();
    renderApp("/people?open=E2");
    await panel("Sasha Fictional");
    await waitFor(() => {
      expect(squaresIn(row("Reporting team"))).toEqual(["teal"]);
    });
  });

  it("draws the live Reporting team's colour on its Live line under a drafted move", async () => {
    // Given Uma, drafted to move from Robin, whose team is teal, to Sasha, whose team has no colour
    answers([
      robin,
      sasha,
      person("3", "Uma Fictional", {
        manager: { id: "2", preferredName: "Sasha Fictional" },
        team: "Fictional crew",
        draft: {
          action: "changed",
          changed: ["managerId"],
          live: { managerId: "1", values: {}, links: {} },
          state: "waiting",
          madeBy: null,
          madeAt: null,
        },
      }),
    ]);

    // When her details open
    renderApp("/people?open=E3");
    await panel("Uma Fictional");

    // Then only the Live line has a square, Robin's team's
    await waitFor(() => {
      expect(squaresIn(row("Reporting team"))).toEqual(["teal"]);
    });
  });

  it("draws the team's colour before its name", async () => {
    answers();
    renderApp("/people?open=E1");
    await panel("Robin Fictional");
    expect(
      row("Reporting team name").querySelector(".mantine-ColorSwatch-root"),
    ).not.toBeNull();
  });

  it("puts focus on the person's name when it opens, and back on their Name cell when it closes on People", async () => {
    answers();
    renderApp("/people?open=e2");
    await panel("Sasha Fictional");
    await waitFor(() => {
      expect(document.activeElement?.id).toBe("person-panel-title");
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Close details" }),
    );
    await waitFor(() => {
      expect(document.activeElement?.id).toBe("cell-2-preferredName");
    });
  });

  it("puts focus back on the person's card when it closes beside the org chart", async () => {
    answers();
    renderApp("/org-chart?open=E2");
    await panel("Sasha Fictional");
    await userEvent.click(
      screen.getByRole("button", { name: "Close details" }),
    );
    await waitFor(() => {
      expect(document.activeElement?.id).toBe("card-2");
    });
  });

  it("shows a planned hire's details too", async () => {
    answers([
      robin,
      sasha,
      uma,
      { ...person("h1", "Fictional Hire"), kind: "planned-hire" },
    ]);
    renderApp("/people");
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Show details of Fictional Hire",
      }),
    );
    expect(await panel("Fictional Hire")).toBeDefined();
  });

  it("does not tell those who only view People who holds a record", async () => {
    answers([robin, { ...sasha, heldBy: "Fictional Editor" }, uma]);
    renderApp("/people");
    await screen.findByRole("grid", { name: "People" });
    act(() => {
      (document.getElementById("cell-2-preferredName") as HTMLElement).focus();
    });
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    expect(
      await screen.findByRole("menuitem", { name: "Show details" }),
    ).toBeDefined();
    expect(screen.queryByText(/Being changed by/)).toBeNull();
  });

  it("closes beside the org chart onto finding someone, when nobody has the ID", async () => {
    answers();
    const history = renderApp("/org-chart?open=E9");
    await screen.findByText("Nobody in People has the ID E9.");
    await userEvent.click(
      screen.getByRole("button", { name: "Close details" }),
    );
    expect(history.location.search).not.toContain("open=");
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("combobox", { name: "Find a person or team" }),
      );
    });
  });

  it("closes beside the org chart onto the person's card, whatever the ID's case", async () => {
    answers();
    renderApp("/org-chart?open=e2");
    await panel("Sasha Fictional");
    await userEvent.click(
      screen.getByRole("button", { name: "Close details" }),
    );
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("link", { name: "Sasha Fictional" }),
      );
    });
  });
});

describe("a person's feature teams", () => {
  const team = (id: string, name: string, leadId: string | null) => ({
    id,
    keyNumber: 1,
    name,
    leadId,
    colour: null,
    members: ["2"],
    names: {},
  });
  const featureTeams = [
    team("00000000-0000-4000-8000-0000000000f1", "Fictional Beacon", "2"),
    team("00000000-0000-4000-8000-0000000000f2", "Fictional Lighthouse", "1"),
    team("00000000-0000-4000-8000-0000000000f3", "Fictional Pier", "gone"),
    team("00000000-0000-4000-8000-0000000000f4", "Fictional Quay", null),
    {
      ...team("00000000-0000-4000-8000-0000000000f5", "Fictional Wharf", "1"),
      members: ["1"],
    },
  ];
  const open = (teams: object[]) => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/people": peopleAnswer(),
      "GET /api/lists": () => Response.json({ lists: [positions] }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": () =>
        Response.json({ people: chart, drafted: chart }),
      "GET /api/feature-teams": () => Response.json({ teams }),
    });
    return renderApp("/people?open=E2");
  };
  const section = () => screen.getByRole("region", { name: "Feature teams" });

  it("lists those they lead, then those they are a member of with who leads each, linking to the team on the org chart", async () => {
    open(featureTeams);
    await panel("Sasha Fictional");
    await waitFor(() => {
      expect(
        [...section().querySelectorAll("li")].map(
          ({ textContent }) => textContent,
        ),
      ).toEqual([
        "Fictional Beacon",
        "Fictional LighthouseLed by Robin Fictional",
        "Fictional PierLed by someone this role can't see",
        "Fictional QuayNo feature lead",
      ]);
    });
    expect(
      [...section().querySelectorAll("dt")].map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["Leads", "Member of"]);
    expect(
      within(section())
        .getByRole("link", { name: "Fictional Quay" })
        .getAttribute("href"),
    ).toBe(
      "/org-chart?view=feature-teams&featureTeam=00000000-0000-4000-8000-0000000000f4&open=E2",
    );
  });

  it("says when they are on none", async () => {
    open([]);
    await panel("Sasha Fictional");
    expect(within(section()).getByText("None")).toBeDefined();
  });

  it("names their reporting team apart from feature teams beside People", async () => {
    open([]);
    await panel("Sasha Fictional");
    expect([
      row("Reporting team").textContent,
      within(row("Reporting team name")).getByText("Fictional crew"),
    ]).toEqual([expect.stringContaining("Fictional team"), expect.anything()]);
  });
});
