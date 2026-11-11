// SPDX-License-Identifier: Apache-2.0

// Tests for a person's details in a side panel, with the server's responses simulated: what it shows
// of them, their manager and reports, their feature teams, their details and added columns, drafted
// values beside live ones, following the Draft menu, opening it from People and the org chart, moving
// to another person, closing it, someone it cannot find, and changing a manager from an earlier day
// beside the org chart.

import type { OrgChartPerson } from "@fathom/shared";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  bodyOf,
  fictionalUser,
  renderApp,
  serverAnswers,
} from "./test-support.tsx";

const session = (permissions: string[]) => () =>
  Response.json({ ...fictionalUser, permissions });
const viewer = session([
  "people:view",
  "org-chart:view",
  "restricted:view",
  "plan:view",
]);

const background = {
  id: "f1",
  name: "Background",
  type: "note",
  listId: null,
  visibility: "general",
  multiple: false,
  required: false,
};
const profile = {
  ...background,
  id: "f2",
  name: "Profile",
  type: "link",
};

const person = (
  id: string,
  preferredName: string,
  details: object = {},
): object => ({
  id,
  preferredName,
  employeeId: `E${id}`,
  positionId: "position-1",
  startDate: "2020-01-01",
  endDate: null,
  isManager: false,
  manager: null,
  team: null,
  teamName: null,
  values: {},
  links: {},
  notes: {},
  ...details,
});

const robin = person("1", "Robin Fictional", {
  isManager: true,
  teamName: "Fictional team",
});
const sasha = person("2", "Sasha Fictional", {
  manager: { id: "1", preferredName: "Robin Fictional" },
  managerFrom: "2024-03-01",
  team: "Fictional team",
  isManager: true,
  notes: { f1: "**Joined** from the platform team" },
  links: { f2: { address: "https://example.com/sasha", text: "Profile page" } },
  teamName: "Fictional crew",
  draft: {
    action: "changed",
    changed: ["teamName"],
    live: { teamName: null, values: {}, links: {} },
    state: "waiting",
    madeBy: null,
    madeAt: null,
  },
});
const uma = person("3", "Uma Fictional", {
  manager: { id: "2", preferredName: "Sasha Fictional" },
  team: "Fictional crew",
});

const peopleAnswer =
  (people: object[] = [robin, sasha, uma]) =>
  () =>
    Response.json({
      people,
      fields: [background, profile],
      order: ["preferredName", "employeeId", "positionId", "f1", "f2"],
      views: [],
    });
const positions = {
  id: "positions",
  name: "Positions",
  description: "",
  visibility: "general",
  retired: false,
  builtIn: "positions",
  choices: [
    {
      id: "position-1",
      label: "Fictional Engineer",
      description: "",
      retired: false,
    },
  ],
};
const chartPerson = (
  id: string,
  name: string,
  managerId: string | null,
): OrgChartPerson => ({
  id,
  preferredName: name,
  employeeId: `E${id}`,
  position: "Fictional Engineer",
  teamName: null,
  teamColour: null,
  managerId,
});
const chart = [
  {
    ...chartPerson("1", "Robin Fictional", null),
    teamName: "Fictional team",
    teamColour: "teal" as const,
  },
  chartPerson("2", "Sasha Fictional", "1"),
  // A colour for a team with no name, as a chart drawn before a name came off may hold.
  { ...chartPerson("3", "Uma Fictional", "2"), teamColour: "grape" as const },
];

beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function answers(
  people?: object[],
  lists: () => Response = () => Response.json({ lists: [positions] }),
  positionHidden = false,
) {
  serverAnswers({
    "GET /api/session": viewer,
    "GET /api/people": positionHidden
      ? () =>
          Response.json({
            people: people ?? [robin, sasha, uma],
            fields: [],
            order: [],
            views: [],
            positionHidden: true,
          })
      : peopleAnswer(people),
    "GET /api/lists": lists,
    "GET /api/unpublished": () => Response.json({ changes: [] }),
    "GET /api/org-chart": () =>
      Response.json({ people: chart, drafted: chart }),
  });
}

const panel = (name: string) => screen.findByRole("region", { name });

const row = (label: string) =>
  screen.getByText(label, { selector: "dt" }).parentElement as HTMLElement;

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
    expect(within(team).getByText("Draft")).toBeDefined();
    expect(within(team).getByText("Live")).toBeDefined();
  });

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
      expect(
        within(await panel("Xan Fictional")).getByText("Draft: added"),
      ).toBeDefined();
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

  it("marks reports drafted in and away beside live", async () => {
    const moving = (
      id: string,
      name: string,
      managerId: string,
      liveManagerId: string,
    ) =>
      person(id, name, {
        manager: {
          id: managerId,
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
    expect(within(item("Yan Fictional")).getByText("Draft")).toBeDefined();
    expect(within(item("Uma Fictional")).getByText("Live")).toBeDefined();
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

  it("is not offered to those who see the chart but not people", async () => {
    const fetch = serverAnswers({
      "GET /api/session": session(["org-chart:view", "plan:view"]),
      "GET /api/org-chart": () =>
        Response.json({
          people: chart.map((one) => ({ ...one, employeeId: null })),
          drafted: [],
        }),
    });
    renderApp("/org-chart?open=E1");
    await screen.findAllByText("Robin Fictional");
    expect(
      screen.queryByRole("region", { name: "Robin Fictional" }),
    ).toBeNull();
    expect(
      fetch.mock.calls.some(([url]) => url.startsWith("/api/people")),
    ).toBe(false);
  });

  it("links to the org chart, and draws team colours, only for those who see it", async () => {
    const fetch = serverAnswers({
      "GET /api/session": session(["people:view", "plan:view"]),
      "GET /api/people": peopleAnswer(),
      "GET /api/lists": () => Response.json({ lists: [positions] }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
    });
    renderApp("/people?open=E1");
    await panel("Robin Fictional");
    expect(
      screen.queryByRole("link", { name: "Show on org chart" }),
    ).toBeNull();
    expect(fetch.mock.calls.some(([url]) => url === "/api/org-chart")).toBe(
      false,
    );
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

describe("changing a manager beside the org chart on an earlier day", () => {
  const day = "2025-01-01";
  const saved = Response.json.bind(Response, {
    changeSetId: "00000000-0000-4000-8000-0000000000c1",
  });
  const changesDates = [
    "people:view",
    "people:edit",
    "org-chart:view",
    "restricted:view",
    "restricted:edit",
    "plan:view",
  ];

  function onDay(
    permissions = changesDates,
    shown = day,
    people = [robin, sasha, uma],
  ) {
    const fetch = serverAnswers({
      "GET /api/session": session(permissions),
      "GET /api/people": peopleAnswer(people),
      "GET /api/lists": () => Response.json({ lists: [positions] }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": () =>
        Response.json({ people: chart, drafted: chart }),
      [`GET /api/org-chart?on=${shown}`]: () =>
        Response.json({ people: chart, drafted: chart }),
      "PATCH /api/people/3": saved,
    });
    return fetch;
  }

  const change = (label: string) =>
    screen.queryByRole("button", { name: `Change ${label}` });

  it("offers only the manager, and changes it from that day", async () => {
    const fetch = onDay();
    renderApp(`/org-chart?open=E3&day=${day}`);
    await panel("Uma Fictional");
    expect(change("Name")).toBeNull();
    expect(change("Position")).toBeNull();
    expect(change("Manager assigned")).toBeNull();
    await userEvent.click(change("Manager") as HTMLElement);
    await userEvent.click(
      await screen.findByRole("option", { name: /Robin Fictional/ }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", "/api/people/3")).toEqual([
        { managerId: "1", managerFrom: day },
      ]);
    });
  });

  it("withdraws a drafted move when the live manager is chosen again, keeping the live line's date", async () => {
    // Given Uma drafted from Sasha, since 2024-05-01, to Robin
    const fetch = onDay(changesDates, day, [
      robin,
      sasha,
      person("3", "Uma Fictional", {
        manager: { id: "1", preferredName: "Robin Fictional" },
        managerFrom: day,
        draft: {
          action: "changed",
          changed: ["managerId", "managerFrom"],
          live: {
            managerId: "2",
            managerFrom: "2024-05-01",
            values: {},
            links: {},
          },
          state: "waiting",
          madeBy: null,
          madeAt: null,
        },
      }),
    ]);
    renderApp(`/org-chart?open=E3&day=${day}`);
    await panel("Uma Fictional");
    await userEvent.click(change("Manager") as HTMLElement);
    await userEvent.click(
      await screen.findByRole("option", { name: /Sasha Fictional/ }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", "/api/people/3")).toEqual([
        { managerId: "2", managerFrom: "2024-05-01" },
      ]);
    });
  });

  it("offers no change to someone whose current line started after that day", async () => {
    // Given Sasha's current line, from 2024-03-01
    onDay(changesDates, "2024-02-29");
    renderApp("/org-chart?open=E2&day=2024-02-29");
    await panel("Sasha Fictional");
    expect(change("Manager")).toBeNull();
  });

  it("offers no change to those who may not change Restricted details", async () => {
    onDay(changesDates.filter((one) => one !== "restricted:edit"));
    renderApp(`/org-chart?open=E3&day=${day}`);
    await panel("Uma Fictional");
    expect(change("Manager")).toBeNull();
  });
});

describe("a person's feature teams", () => {
  const team = (id: string, name: string, leadId: string | null) => ({
    id,
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

  it("lists those they are on, with who leads each, linking to the team on the org chart", async () => {
    open(featureTeams);
    await panel("Sasha Fictional");
    await waitFor(() => {
      expect(
        [...section().querySelectorAll("li")].map(
          ({ textContent }) => textContent,
        ),
      ).toEqual([
        "Fictional BeaconLead",
        "Fictional LighthouseLed by Robin Fictional",
        "Fictional PierLed by someone this role can't see",
        "Fictional QuayNo feature lead",
      ]);
    });
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

describe("changing a person's details", () => {
  const editor = session([
    "people:view",
    "people:edit",
    "org-chart:view",
    "restricted:view",
    "plan:view",
  ]);
  const saved = "00000000-0000-4000-8000-0000000000c1";
  const savedAs = () => Response.json({ changeSetId: saved });
  const architect = {
    id: "position-2",
    label: "Fictional Architect",
    description: "",
    retired: false,
  };

  function editAnswers(more: Record<string, () => Response> = {}) {
    return serverAnswers({
      "GET /api/session": editor,
      "GET /api/people": peopleAnswer(),
      "GET /api/lists": () =>
        Response.json({
          lists: [{ ...positions, choices: [...positions.choices, architect] }],
        }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": () =>
        Response.json({ people: chart, drafted: chart }),
      "PATCH /api/people/1": savedAs,
      [`POST /api/undo/${saved}`]: () => Response.json({ changeSetId: null }),
      ...more,
    });
  }

  const undone = (fetch: ReturnType<typeof serverAnswers>) =>
    fetch.mock.calls.filter(([url]) => url === `/api/undo/${saved}`).length;

  const change = (label: string) =>
    screen.getByRole("button", { name: `Change ${label}` });

  // Waits for a change to finish saving, once the count of unsaved changes is asked for again.
  const settled = (fetch: ReturnType<typeof serverAnswers>) =>
    waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/unpublished", expect.anything());
    });

  async function typeInto(label: string, text: string) {
    await userEvent.click(change(label));
    const field = await screen.findByRole("textbox", { name: label });
    await userEvent.clear(field);
    await userEvent.type(field, text);
    return field;
  }

  const drafting = (action: string) => ({
    action,
    changed: [],
    live: { values: {}, links: {} },
    state: "waiting",
    madeBy: null,
    madeAt: null,
  });

  // People as the server has them, with Robin's ID as last saved or undone.
  function renaming() {
    let employeeId = "E1";
    const fetch = editAnswers({
      "GET /api/people": () =>
        peopleAnswer([{ ...robin, employeeId }, sasha, uma])(),
      "PATCH /api/people/1": () => {
        employeeId = "E7";
        return savedAs();
      },
      [`POST /api/undo/${saved}`]: () => {
        employeeId = "E1";
        return Response.json({ changeSetId: null });
      },
    });
    return fetch;
  }

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
    await panel("Robin Fictional");
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
    expect(within(manager).getByText("Draft")).toBeDefined();
    expect(within(manager).getByText("Live")).toBeDefined();
  });

  it("names the problem under a value whose editor does not name it", async () => {
    // Given a required Skills column holding one skill
    const skills = {
      ...background,
      id: "f3",
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
          views: [],
        }),
      "GET /api/lists": () =>
        Response.json({
          lists: [
            positions,
            {
              ...positions,
              id: "skills",
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
          views: [],
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

  describe("writing a note", () => {
    const sashasNote = "Background for Sasha Fictional";
    const plans = { ...background, id: "f9", name: "Plans" };

    it("opens it in a panel under the details, which stay", async () => {
      // Given Sasha's details
      editAnswers();
      renderApp("/people?open=E2");
      await panel("Sasha Fictional");
      // When her note is opened
      await userEvent.click(change("Background"));
      // Then it opens under her details, named for her, with focus on its title, as it opens to be read
      expect(await panel(sashasNote)).toBeDefined();
      expect(
        screen.getByRole("region", { name: "Sasha Fictional" }),
      ).toBeDefined();
      await waitFor(() => {
        expect(document.activeElement).toBe(
          screen.getByRole("heading", { name: sashasNote }),
        );
      });
    });

    it("saves it, closing its panel and putting focus back on its button", async () => {
      // Given Sasha's note opened
      const fetch = editAnswers({ "PATCH /api/people/2": savedAs });
      renderApp("/people?open=E2");
      await panel("Sasha Fictional");
      await userEvent.click(change("Background"));
      await panel(sashasNote);
      // When it is cleared and saved
      await userEvent.click(screen.getByRole("radio", { name: "Editor" }));
      await userEvent.click(screen.getByRole("button", { name: "Clear" }));
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      // Then it is saved, its panel closes, and focus is on the note's button
      expect(bodyOf(fetch, "PATCH", "/api/people/2")).toEqual([
        { notes: { f1: null } },
      ]);
      await waitFor(() => {
        expect(screen.queryByRole("region", { name: sashasNote })).toBeNull();
      });
      await waitFor(() => {
        expect(document.activeElement).toBe(change("Background"));
      });
    });

    it("puts focus in the editor of an empty note", async () => {
      editAnswers();
      renderApp("/people?open=E1");
      await panel("Robin Fictional");
      await userEvent.click(change("Background"));
      await waitFor(() => {
        expect(document.activeElement).toBe(
          screen.getByRole("textbox", { name: "Note" }),
        );
      });
    });

    it("closes a note with no changes when someone else is shown", async () => {
      // Given Sasha's note opened to be read
      editAnswers();
      renderApp("/people?open=E2");
      await panel("Sasha Fictional");
      await userEvent.click(change("Background"));
      await panel(sashasNote);
      // When Robin's details are asked for from the table
      await userEvent.click(
        screen.getByRole("button", { name: "Show details of Robin Fictional" }),
      );
      // Then Robin's details show, and Sasha's note has closed
      expect(await panel("Robin Fictional")).toBeDefined();
      expect(screen.queryByRole("region", { name: sashasNote })).toBeNull();
    });

    it("asks before discarding a changed note when someone else is shown", async () => {
      // Given Sasha's note changed
      const fetch = editAnswers({ "PATCH /api/people/2": savedAs });
      renderApp("/people?open=E2");
      await panel("Sasha Fictional");
      await userEvent.click(change("Background"));
      await panel(sashasNote);
      await userEvent.click(screen.getByRole("radio", { name: "Markdown" }));
      await userEvent.type(
        screen.getByRole("textbox", { name: "Markdown" }),
        " more",
      );
      const showRobin = screen.getByRole("button", {
        name: "Show details of Robin Fictional",
      });
      // When Robin's details are asked for, and writing is kept
      await userEvent.click(showRobin);
      const asked = await screen.findByRole("dialog", {
        name: "Discard changes to the note?",
      });
      await userEvent.click(
        within(asked).getByRole("button", { name: "Keep writing" }),
      );
      // Then Sasha's details and her note stay
      await waitFor(() => {
        expect(
          screen.queryByRole("dialog", {
            name: "Discard changes to the note?",
          }),
        ).toBeNull();
      });
      expect(
        screen.getByRole("region", { name: "Sasha Fictional" }),
      ).toBeDefined();
      expect(screen.getByRole("region", { name: sashasNote })).toBeDefined();
      // When Robin's are asked for again, and the note discarded
      await userEvent.click(showRobin);
      await userEvent.click(
        within(
          await screen.findByRole("dialog", {
            name: "Discard changes to the note?",
          }),
        ).getByRole("button", { name: "Discard" }),
      );
      // Then Robin's details show, the note has closed, and nothing was saved
      expect(await panel("Robin Fictional")).toBeDefined();
      await waitFor(() => {
        expect(screen.queryByRole("region", { name: sashasNote })).toBeNull();
      });
      expect(bodyOf(fetch, "PATCH", "/api/people/2")).toEqual([]);
    });

    it("closes, with no changes, once the address names an ID nobody has", async () => {
      // Given Robin's note open, with no changes
      editAnswers();
      const history = renderApp("/people?open=E1");
      await panel("Robin Fictional");
      await userEvent.click(change("Background"));
      await panel("Background for Robin Fictional");
      // When the address names an ID nobody has
      act(() => {
        history.push("/people?open=E9");
      });
      // Then the note closes
      await screen.findByText("Nobody in People has the ID E9.");
      expect(
        screen.queryByRole("region", {
          name: "Background for Robin Fictional",
        }),
      ).toBeNull();
    });

    it("saves nothing, and closes, when saved with no changes", async () => {
      // Given Robin's empty note open
      const fetch = editAnswers();
      renderApp("/people?open=E1");
      await panel("Robin Fictional");
      await userEvent.click(change("Background"));
      await panel("Background for Robin Fictional");
      // When it is saved as it is
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      // Then it closes, and nothing is sent
      await waitFor(() => {
        expect(
          screen.queryByRole("region", {
            name: "Background for Robin Fictional",
          }),
        ).toBeNull();
      });
      expect(bodyOf(fetch, "PATCH", "/api/people/1")).toEqual([]);
    });

    it("stays open when its person's ID changes", async () => {
      // Given Robin's note open, with no changes
      renaming();
      const history = renderApp("/people?open=E1");
      await panel("Robin Fictional");
      await userEvent.click(change("Background"));
      await panel("Background for Robin Fictional");
      // When Robin's ID is changed in the details
      await typeInto("ID", "E7{Enter}");
      await waitFor(() => {
        expect(history.location.search).toContain("open=E7");
      });
      // Then the note stays open
      expect(
        screen.getByRole("region", { name: "Background for Robin Fictional" }),
      ).toBeDefined();
    });

    it("keeps naming why it was refused while a value is changed in the details", async () => {
      // Given a required note refused, empty
      editAnswers({
        "GET /api/people": () =>
          Response.json({
            people: [robin, sasha, uma],
            fields: [{ ...background, required: true }],
            order: [],
            views: [],
          }),
      });
      renderApp("/people?open=E2");
      await panel("Sasha Fictional");
      await userEvent.click(change("Background"));
      await userEvent.click(
        await screen.findByRole("radio", { name: "Editor" }),
      );
      await userEvent.click(screen.getByRole("button", { name: "Clear" }));
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      await screen.findByText("Background needed");
      // When her team name's editor is opened
      await userEvent.click(change("Reporting team name"));
      await screen.findByRole("textbox", { name: "Reporting team name" });
      // Then the note still names why it was refused
      expect(screen.getByText("Background needed")).toBeDefined();
    });

    function twoNotes() {
      editAnswers({
        "GET /api/people": () =>
          Response.json({
            people: [robin, sasha, uma],
            fields: [background, plans],
            order: [],
            views: [],
          }),
      });
    }

    it("opens another note in place of one with no changes", async () => {
      // Given Sasha's note opened to be read
      twoNotes();
      renderApp("/people?open=E2");
      await panel("Sasha Fictional");
      await userEvent.click(change("Background"));
      await panel(sashasNote);
      // When another of her notes is opened
      await userEvent.click(change("Plans"));
      // Then it takes the first's place
      expect(await panel("Plans for Sasha Fictional")).toBeDefined();
      expect(screen.queryByRole("region", { name: sashasNote })).toBeNull();
    });

    it("keeps a note being changed when another of the person's notes is asked for", async () => {
      // Given Sasha's note being changed
      twoNotes();
      renderApp("/people?open=E2");
      await panel("Sasha Fictional");
      await userEvent.click(change("Background"));
      await panel(sashasNote);
      await userEvent.click(screen.getByRole("radio", { name: "Editor" }));
      await userEvent.click(screen.getByRole("button", { name: "Clear" }));
      // When another of her notes is asked for
      await userEvent.click(change("Plans"));
      // Then focus goes back to the note being changed, which stays, and the other does not open
      await waitFor(() => {
        expect(document.activeElement).toBe(
          screen.getByRole("heading", { name: sashasNote }),
        );
      });
      expect(
        screen.queryByRole("region", { name: "Plans for Sasha Fictional" }),
      ).toBeNull();
    });

    it("keeps it being written when it is refused", async () => {
      // Given a required note
      const fetch = editAnswers({
        "GET /api/people": () =>
          Response.json({
            people: [robin, sasha, uma],
            fields: [{ ...background, required: true }],
            order: [],
            views: [],
          }),
      });
      renderApp("/people?open=E2");
      await panel("Sasha Fictional");
      // When it is cleared and saved
      await userEvent.click(change("Background"));
      await userEvent.click(
        await screen.findByRole("radio", { name: "Editor" }),
      );
      await userEvent.click(screen.getByRole("button", { name: "Clear" }));
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      // Then it stays open, naming why, and nothing is saved
      expect(await screen.findByText("Background needed")).toBeDefined();
      expect(screen.getByRole("region", { name: sashasNote })).toBeDefined();
      expect(bodyOf(fetch, "PATCH", "/api/people/2")).toEqual([]);
    });

    it("leaves Cmd+Z in the note to the note's own undo, undoing no saved change", async () => {
      // Given a change saved from Sasha's details, and her note open in the editor
      const fetch = editAnswers({ "PATCH /api/people/2": savedAs });
      renderApp("/people?open=E2");
      await panel("Sasha Fictional");
      await typeInto("Reporting team name", "Harbour team{Enter}");
      await settled(fetch);
      await userEvent.click(change("Background"));
      await panel(sashasNote);
      await userEvent.click(screen.getByRole("radio", { name: "Editor" }));
      const editor = screen.getByRole("textbox", { name: "Note" });
      // When Cmd+Z is pressed in the note
      const leftToNote = fireEvent.keyDown(editor, { key: "z", metaKey: true });
      // Then the page leaves it to the note, and the change is undone only from outside it
      expect(leftToNote).toBe(true);
      act(() => {
        screen.getByRole("heading", { name: sashasNote }).focus();
      });
      await userEvent.keyboard("{Meta>}z{/Meta}");
      await waitFor(() => {
        expect(undone(fetch)).toBe(1);
      });
    });

    it("keeps a changed note while the address moves on its own, with focus on the details once it closes", async () => {
      // Given Sasha's note changed
      editAnswers();
      const history = renderApp("/people?open=E2");
      await panel("Sasha Fictional");
      await userEvent.click(change("Background"));
      await panel(sashasNote);
      await userEvent.click(screen.getByRole("radio", { name: "Markdown" }));
      await userEvent.type(
        screen.getByRole("textbox", { name: "Markdown" }),
        " more",
      );
      // When the address moves to Robin, as by Back
      act(() => {
        history.push("/people?open=E1");
      });
      // Then Robin's details show, with Sasha's note still open
      expect(await panel("Robin Fictional")).toBeDefined();
      expect(screen.getByRole("region", { name: sashasNote })).toBeDefined();
      // When the note is closed
      await userEvent.click(screen.getByRole("button", { name: "Close note" }));
      // Then focus goes to Robin's name
      await waitFor(() => {
        expect(document.activeElement).toBe(
          screen.getByRole("heading", { name: "Robin Fictional" }),
        );
      });
    });

    it("asks before discarding a changed note when someone else is shown beside the org chart", async () => {
      // Given Sasha's note changed, beside the org chart
      editAnswers();
      renderApp("/org-chart?open=E2");
      await panel("Sasha Fictional");
      await userEvent.click(change("Background"));
      await panel(sashasNote);
      await userEvent.click(screen.getByRole("radio", { name: "Markdown" }));
      await userEvent.type(
        screen.getByRole("textbox", { name: "Markdown" }),
        " more",
      );
      // When her manager is chosen, and the note discarded
      await userEvent.click(
        within(row("Manager")).getByText("Robin Fictional"),
      );
      await userEvent.click(
        within(
          await screen.findByRole("dialog", {
            name: "Discard changes to the note?",
          }),
        ).getByRole("button", { name: "Discard" }),
      );
      // Then Robin's details show, and the note has closed
      expect(await panel("Robin Fictional")).toBeDefined();
      await waitFor(() => {
        expect(screen.queryByRole("region", { name: sashasNote })).toBeNull();
      });
    });

    it("opens under the details beside the org chart too", async () => {
      editAnswers();
      renderApp("/org-chart?open=E2");
      await panel("Sasha Fictional");
      await userEvent.click(change("Background"));
      expect(await panel(sashasNote)).toBeDefined();
      expect(
        screen.getByRole("region", { name: "Sasha Fictional" }),
      ).toBeDefined();
    });
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
          "org-chart:view",
          "team-colours:edit",
          "plan:view",
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

describe("changing a planned hire's details", () => {
  const hiringEditor = session([
    "people:view",
    "people:edit",
    "hiring-plan:view",
    "hiring-plan:edit",
    "org-chart:view",
    "restricted:view",
    "plan:view",
  ]);
  const peopleEditor = session([
    "people:view",
    "people:edit",
    "hiring-plan:view",
    "org-chart:view",
    "restricted:view",
    "plan:view",
  ]);
  const states = {
    ...positions,
    id: "states",
    name: "Hiring states",
    builtIn: "hiring-states",
    choices: [
      ["s-proposed", "Request to hire", "proposed"],
      ["s-open", "Approved to hire", "open"],
      ["s-hired", "Hired", "hired"],
      ["s-left", "Fictional Resigned", "left"],
    ].map(([id, label, meaning]) => ({
      id,
      label,
      meaning,
      description: "",
      retired: false,
    })),
  };
  const opening = person("h1", "Fictional Opening", {
    kind: "planned-hire",
    employeeId: "REQ-7",
    stateId: "s-open",
    expected: "2027-01",
    startDate: null,
  });

  function hireAnswers(who: () => Response) {
    return serverAnswers({
      "GET /api/session": who,
      "GET /api/people": peopleAnswer([robin, opening]),
      "GET /api/lists": () => Response.json({ lists: [positions, states] }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": () =>
        Response.json({ people: chart, drafted: chart }),
      "PATCH /api/planned-hires/h1": () =>
        Response.json({ changeSetId: "00000000-0000-4000-8000-0000000000c2" }),
    });
  }

  it("offers a planned hire only the hiring states", async () => {
    hireAnswers(hiringEditor);
    renderApp("/people?open=REQ-7");
    await panel("Fictional Opening");
    await userEvent.click(screen.getByRole("button", { name: "Change State" }));
    const options = await screen.findAllByRole("option");
    expect(options.map(({ textContent }) => textContent)).toEqual([
      "Request to hire",
      "Approved to hire",
    ]);
  });

  it("saves a change through the planned hires' route for those who may change the hiring plan", async () => {
    const fetch = hireAnswers(hiringEditor);
    renderApp("/people?open=REQ-7");
    await panel("Fictional Opening");
    await userEvent.click(screen.getByRole("button", { name: "Change Name" }));
    const field = await screen.findByRole("textbox", { name: "Name" });
    await userEvent.clear(field);
    await userEvent.type(field, "Fictional Lead{Enter}");
    await waitFor(() => {
      expect(
        fetch.mock.calls
          .filter(
            ([url, init]) =>
              url === "/api/planned-hires/h1" && init?.method === "PATCH",
          )
          .map(([, init]) => JSON.parse(init?.body as string) as unknown),
      ).toEqual([{ name: "Fictional Lead" }]);
    });
  });

  it("offers no changes to a planned hire to those who may change people but not the hiring plan", async () => {
    hireAnswers(peopleEditor);
    renderApp("/people?open=REQ-7");
    await panel("Fictional Opening");
    expect(screen.queryByRole("button", { name: "Change Name" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Change State" })).toBeNull();
  });
});
