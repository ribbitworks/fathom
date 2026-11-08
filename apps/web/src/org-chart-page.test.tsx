// SPDX-License-Identifier: Apache-2.0

// Tests for the Org chart page, with the server's responses simulated: who sees it, each person's
// card and its link to People and back, hiding and showing a manager's reports and levels, finding a
// person, one team shown alone, the chart's controls, and when the chart cannot load or has nobody on
// it, and what those who see the chart but not People see.

import type { OrgChartPerson } from "@fathom/shared";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fictionalUser,
  greeting,
  renderApp,
  serverAnswers,
  signedIn,
} from "./test-support.tsx";

const viewer = () =>
  Response.json({
    ...fictionalUser,
    permissions: ["people:view", "org-chart:view", "plan:view"],
  });

// Sees the org chart but not People, as a Team Member does.
const chartOnly = () =>
  Response.json({
    ...fictionalUser,
    permissions: ["org-chart:view", "plan:view"],
  });

const person = (
  id: string,
  preferredName: string,
  managerId: string | null,
  details: Partial<OrgChartPerson> = {},
): OrgChartPerson => ({
  id,
  preferredName,
  employeeId: `FX-${id}`,
  position: "Fictional Engineer",
  teamName: null,
  teamColour: null,
  managerId,
  ...details,
});

const people = [
  person("p1", "Robin Fictional", null, { position: "Fictional Director" }),
  person("p2", "Sasha Fictional", "p1", { teamName: "Fictional team" }),
  person("p3", "Tatum Fictional", "p2", { left: true }),
  person("p4", "Uma Fictional", "p3"),
];

// The chart's answer, drawn the same with drafts applied unless given otherwise.
const chartJson = ({
  people: shown,
  drafted = shown,
}: {
  people: readonly object[];
  drafted?: readonly object[];
}) => Response.json({ people: shown, drafted });

const chartAnswer = () => chartJson({ people });

// People's answers, with one of the chart's people on it.
const peopleAnswers = {
  "GET /api/people": () =>
    Response.json({
      people: [
        {
          id: "p4",
          preferredName: "Uma Fictional",
          employeeId: "FX-p4",
          positionId: "position-1",
          values: {},
        },
      ],
      fields: [],
      order: [],
      views: [],
    }),
  "GET /api/lists": () => Response.json({ lists: [] }),
};

afterEach(() => {
  vi.unstubAllGlobals();
});

async function showLevels(choice: string) {
  await userEvent.click(
    await screen.findByRole("button", { name: "Show levels" }),
  );
  await userEvent.click(await screen.findByRole("menuitem", { name: choice }));
}

// Opens the chart with its own panel, which holds React Flow, watched for changes of width, which
// the test then makes.
async function openWatchedChart() {
  const resized: ((width: number) => void)[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      readonly callback: (entries: object[]) => void;
      constructor(callback: (entries: object[]) => void) {
        this.callback = callback;
      }
      observe(target: Element) {
        if (target.querySelector(".react-flow") !== null) {
          resized.push((width) => {
            this.callback([{ contentRect: { width } }]);
          });
        }
      }
      unobserve() {}
      disconnect() {}
    },
  );
  await openChart();
  const viewport = document.querySelector(
    ".react-flow__viewport",
  ) as HTMLElement;
  const transform = () => viewport.style.transform;
  const resize = (width: number) => {
    act(() => {
      for (const callback of resized) callback(width);
    });
  };
  return { transform, resize };
}

const settled = () => new Promise((settle) => setTimeout(settle, 400));

// Opens the chart at the address given, with every level shown unless asked not to.
async function openChart(
  answer: () => Response = chartAnswer,
  expand = true,
  path = "/org-chart",
) {
  serverAnswers({
    "GET /api/session": viewer,
    "GET /api/org-chart": answer,
    ...peopleAnswers,
  });
  const history = renderApp(path);
  await screen.findByRole("heading", { name: "Org chart" });
  if (expand) await showLevels("All levels");
  return history;
}

const card = (name: string) =>
  screen
    .getByRole("link", { name })
    .closest("div.react-flow__node") as HTMLElement;

describe("who sees the Org chart page", () => {
  it("links to it under People for users who see people", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/greeting": greeting,
      "GET /api/org-chart": chartAnswer,
    });
    const history = renderApp("/");
    await userEvent.click(
      await screen.findByRole("link", { name: "Org chart" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Org chart" }),
    ).toBeDefined();
    expect(history.location.pathname).toBe("/org-chart");
  });

  it("links to it for users who see the org chart but not People", async () => {
    serverAnswers({
      "GET /api/session": chartOnly,
      "GET /api/greeting": greeting,
      "GET /api/org-chart": chartAnswer,
    });
    renderApp("/");
    expect(
      await screen.findByRole("link", { name: "Org chart" }),
    ).toBeDefined();
    expect(screen.queryByRole("link", { name: "People" })).toBeNull();
  });

  it("is not shown to anyone else", async () => {
    serverAnswers({ "GET /api/session": signedIn });
    renderApp("/org-chart");
    expect(
      await screen.findByText("There is no page at this address."),
    ).toBeDefined();
  });
});

describe("the org chart", () => {
  it("shows each person's name, position, and the team they lead, and marks a manager who has left", async () => {
    await openChart();
    await screen.findByRole("link", { name: "Robin Fictional" });
    const top = card("Robin Fictional");
    expect(within(top).getByText("Fictional Director")).toBeDefined();
    const sasha = card("Sasha Fictional");
    expect(within(sasha).getByText("Fictional team")).toBeDefined();
    expect(within(card("Tatum Fictional")).getByText("Left")).toBeDefined();
    expect(within(sasha).queryByText("Left")).toBeNull();
  });

  it("draws each team in its colour, reaching down to teams with none, even when a team is shown alone, whose top has no band", async () => {
    const coloured = [
      person("p1", "Robin Fictional", null, {
        teamName: "Fictional top team",
        teamColour: "teal",
      }),
      person("p2", "Sasha Fictional", "p1", {
        teamName: "Fictional team",
        teamColour: "grape",
      }),
      person("p3", "Tatum Fictional", "p2"),
      person("p4", "Uma Fictional", "p3"),
    ];
    const colourOf = (name: string) =>
      card(name)
        .querySelector<HTMLElement>("[data-coloured]")
        ?.style.getPropertyValue("--team-colour") ?? null;
    await openChart(() => chartJson({ people: coloured }));
    await screen.findByRole("link", { name: "Robin Fictional" });
    expect(colourOf("Robin Fictional")).toBeNull();
    expect(colourOf("Sasha Fictional")).toBe(
      "var(--mantine-color-teal-filled)",
    );
    expect(colourOf("Tatum Fictional")).toBe(
      "var(--mantine-color-grape-filled)",
    );
    expect(colourOf("Uma Fictional")).toBe("var(--mantine-color-grape-filled)");
    await userEvent.click(
      screen.getByRole("button", {
        name: "Show only the team of Tatum Fictional",
      }),
    );
    await screen.findByText("You're seeing only the team of Tatum Fictional.");
    expect(colourOf("Uma Fictional")).toBe("var(--mantine-color-grape-filled)");
    expect(colourOf("Tatum Fictional")).toBeNull();
  });

  it("lets those who may colour teams choose a named team's colour from its manager's card, and undo it", async () => {
    let colour: string | null = null;
    const fetch = serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: [
            "people:view",
            "org-chart:view",
            "people:edit",
            "team-colours:edit",
          ],
        }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": () =>
        chartJson({
          people: people.map((one) =>
            one.id === "p2" ? { ...one, teamColour: colour } : one,
          ),
        }),
      "PUT /api/org-chart/teams/p2/colour": () =>
        new Response(null, {
          status: 204,
        }),
    });
    renderApp("/org-chart");
    await showLevels("All levels");
    await screen.findByRole("link", { name: "Tatum Fictional" });
    expect(
      screen.queryByRole("button", { name: /^Colour of Robin Fictional/ }),
    ).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: /^Colour of Fictional team:/ }),
    );
    colour = "grape";
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Grape" }),
    );
    const sent = () =>
      fetch.mock.calls
        .filter(([, init]) => init?.method === "PUT")
        .map(([, init]) => JSON.parse(init?.body as string) as unknown);
    expect(sent()).toEqual([{ colour: "grape" }]);
    expect(
      await screen.findByText("Fictional team is now drawn in Grape."),
    ).toBeDefined();
    expect(
      card("Tatum Fictional")
        .querySelector<HTMLElement>("[data-coloured]")
        ?.style.getPropertyValue("--team-colour"),
    ).toBe("var(--mantine-color-grape-filled)");
    colour = null;
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(sent()).toEqual([{ colour: "grape" }, { colour: null }]);
  });

  it("lets those who change people rename a team from its manager's card, as a draft", async () => {
    const fetch = serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: [
            "people:view",
            "org-chart:view",
            "people:edit",
            "team-colours:edit",
          ],
        }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": chartAnswer,
      "PATCH /api/people/p2": () =>
        Response.json({ changeSetId: "00000000-0000-4000-8000-000000000002" }),
    });
    renderApp("/org-chart");
    await screen.findByRole("link", { name: "Sasha Fictional" });
    expect(
      screen.queryByRole("button", {
        name: "Add a name for the team of Robin Fictional",
      }),
    ).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Rename Fictional team" }),
    );
    const field = await screen.findByRole("textbox", {
      name: /Team name/,
    });
    await userEvent.clear(field);
    await userEvent.type(field, "Harbour Crew{Enter}");
    expect(
      await screen.findByText(
        "Draft saved. The team's name becomes Harbour Crew once approved.",
      ),
    ).toBeDefined();
    const patch = fetch.mock.calls.find(
      ([url, init]) => url === "/api/people/p2" && init?.method === "PATCH",
    );
    expect(JSON.parse(patch?.[1]?.body as string)).toEqual({
      teamName: "Harbour Crew",
    });
  });

  it("draws planned hires as placeholders, one with no name by its ID with its position under it, a planned manager heading its hires, opening nothing and left out of the Teams panel", async () => {
    const planned = [
      ...people,
      person("h1", "Fictional Engineer, TBD-7", null, {
        employeeId: null,
        planned: { expected: "2027-03", shownId: "TBD-7" },
      }),
      person("h2", "Fictional Planned Report", "h1", {
        employeeId: null,
        planned: { expected: "2026-11" },
      }),
    ];
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["people:view", "org-chart:view", "people:edit"],
        }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": () => chartJson({ people: planned }),
    });
    renderApp("/org-chart");
    const onCard = (name: string) =>
      screen
        .getAllByText(name)
        .map((shown) => shown.closest<HTMLElement>("div.react-flow__node"))
        .find((node) => node !== null) as HTMLElement;
    await screen.findAllByText("TBD-7");
    const placeholder = onCard("TBD-7");
    expect(within(placeholder).queryByRole("link")).toBeNull();
    expect(within(placeholder).getByText(/^Planned, expected/)).toBeDefined();
    expect(within(placeholder).getByText("Fictional Engineer")).toBeDefined();
    const report = onCard("Fictional Planned Report").textContent;
    expect(report).toContain("Fictional Engineer");
    await userEvent.click(screen.getByRole("button", { name: "Teams" }));
    const panel = await screen.findByRole("dialog", { name: "Teams" });
    expect(within(panel).queryByText(/Fictional Engineer, TBD-7/)).toBeNull();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(
      screen.getByRole("button", {
        name: "Show only the team of Fictional Engineer, TBD-7",
      }),
    );
    await screen.findByText(
      "You're seeing only the team of Fictional Engineer, TBD-7.",
    );
  });

  it("lists every manager's team in the Teams panel, where an unnamed one can be named", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: [
            "people:view",
            "org-chart:view",
            "people:edit",
            "team-colours:edit",
          ],
        }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": chartAnswer,
    });
    renderApp("/org-chart");
    await screen.findByRole("link", { name: "Sasha Fictional" });
    await userEvent.click(screen.getByRole("button", { name: "Teams" }));
    const panel = await screen.findByRole("dialog", { name: "Teams" });
    expect(
      within(panel).getByRole("button", { name: /^Colour of Fictional team:/ }),
    ).toBeDefined();
    expect(within(panel).getByText("Led by Sasha Fictional")).toBeDefined();
    expect(
      within(panel).getByRole("button", {
        name: "Add a name for the team of Robin Fictional",
      }).textContent,
    ).toBe("Add a name");
  });

  it("marks a drafted team name in the Teams panel, with the live one under it", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: [
            "people:view",
            "org-chart:view",
            "people:edit",
            "team-colours:edit",
          ],
        }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": () =>
        chartJson({
          people: people.map((one) =>
            one.id === "p2"
              ? {
                  ...one,
                  draft: {
                    teamName: "Fictional crew",
                    state: "waiting",
                    unpublished: false,
                  },
                }
              : one,
          ),
        }),
    });
    renderApp("/org-chart");
    await screen.findByRole("link", { name: "Sasha Fictional" });
    await userEvent.click(screen.getByRole("button", { name: "Teams" }));
    const panel = await screen.findByRole("dialog", { name: "Teams" });
    expect(within(panel).getByText("Fictional crew")).toBeDefined();
    expect(within(panel).getByText("Draft")).toBeDefined();
    expect(within(panel).getByText("Fictional team")).toBeDefined();
    expect(within(panel).getByText("Live")).toBeDefined();
  });

  it("shows those who may only colour teams a name drafted to come off, and a Live copy in its team's colour, and goes back to drafts beside live", async () => {
    const history = await openChart(() =>
      chartJson({
        people: people.map((one) =>
          one.id === "p2"
            ? {
                ...one,
                teamColour: "teal",
                draft: { teamName: null, state: "waiting", unpublished: false },
              }
            : one.id === "p4"
              ? {
                  ...one,
                  draft: {
                    managerId: "p2",
                    state: "waiting",
                    unpublished: false,
                  },
                }
              : one,
        ),
      }),
    );
    await screen.findByRole("link", { name: "Sasha Fictional" });
    expect(within(card("Sasha Fictional")).getByText("No name")).toBeDefined();
    const copy = screen
      .getAllByText("Uma Fictional")
      .find((name) => name.tagName === "SPAN")
      ?.closest("[data-coloured]");
    expect(copy).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Draft" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Drafts applied" }),
    );
    expect(history.location.search).toContain("show=drafts");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Drafts beside live" }),
    );
    expect(history.location.search).not.toContain("show=");
  });

  it("lists a team whose name a draft takes off, for those who may only colour teams", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["people:view", "org-chart:view", "team-colours:edit"],
        }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": () =>
        chartJson({
          people: people.map((one) =>
            one.id === "p2"
              ? {
                  ...one,
                  draft: {
                    teamName: null,
                    state: "waiting",
                    unpublished: false,
                  },
                }
              : one,
          ),
        }),
    });
    renderApp("/org-chart");
    await screen.findByRole("link", { name: "Sasha Fictional" });
    await userEvent.click(screen.getByRole("button", { name: "Teams" }));
    const panel = await screen.findByRole("dialog", { name: "Teams" });
    expect(within(panel).getByText("No name")).toBeDefined();
    expect(within(panel).getByText("Fictional team")).toBeDefined();
    expect(within(panel).getByText("Live")).toBeDefined();
  });

  it("lets those who may only colour teams, such as Engineering Managers, colour them without renaming", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["people:view", "org-chart:view", "team-colours:edit"],
        }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": chartAnswer,
    });
    renderApp("/org-chart");
    await screen.findByRole("link", { name: "Sasha Fictional" });
    expect(
      screen.getByRole("button", { name: /^Colour of Fictional team:/ }),
    ).toBeDefined();
    expect(
      screen.queryByRole("button", { name: "Rename Fictional team" }),
    ).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Teams" }));
    const panel = await screen.findByRole("dialog", { name: "Teams" });
    expect(
      within(panel).getByRole("button", { name: /^Colour of Fictional team:/ }),
    ).toBeDefined();
    expect(within(panel).getByText("Fictional team")).toBeDefined();
    expect(within(panel).queryByText("Add a name")).toBeNull();
    expect(within(panel).queryByText("Led by Robin Fictional")).toBeNull();
  });

  it("lets those who may colour teams but do not see People colour them, from cards and the Teams panel", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["org-chart:view", "team-colours:edit"],
        }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": () =>
        chartJson({
          people: people.map((one) => ({ ...one, employeeId: null })),
        }),
    });
    renderApp("/org-chart");
    await screen.findAllByText("Sasha Fictional");
    expect(
      screen.getByRole("button", { name: /^Colour of Fictional team:/ }),
    ).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Teams" }));
    const panel = await screen.findByRole("dialog", { name: "Teams" });
    expect(within(panel).getByText("Fictional team")).toBeDefined();
  });

  // The chart for one who may change people and colour teams, with the answers given added.
  function openAsEditor(
    answers: Record<string, () => Response>,
    chart: readonly OrgChartPerson[] = people,
  ) {
    const fetch = serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: [
            "people:view",
            "org-chart:view",
            "people:edit",
            "team-colours:edit",
          ],
        }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": () => chartJson({ people: chart }),
      ...answers,
    });
    renderApp("/org-chart");
    return fetch;
  }

  // The chart for one who may change people and colour teams, at the address given.
  function openEditableAt(path: string, answer: () => Response) {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: [
            "people:view",
            "org-chart:view",
            "people:edit",
            "team-colours:edit",
          ],
        }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": answer,
    });
    return renderApp(path);
  }

  it("offers no renaming, colouring or Teams panel with Live only", async () => {
    openEditableAt("/org-chart?show=live", chartAnswer);
    await screen.findByRole("link", { name: "Sasha Fictional" });
    expect(
      screen.getByRole("button", { name: "Draft, changed" }),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "Teams" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Rename Fictional team" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /^Colour of Fictional team/ }),
    ).toBeNull();
  });

  it("draws no team name where drafts take it off, with Drafts applied", async () => {
    openEditableAt("/org-chart?show=drafts", () =>
      chartJson({
        people,
        drafted: people.map((one) =>
          one.id === "p2" ? { ...one, teamName: null } : one,
        ),
      }),
    );
    await screen.findByRole("link", { name: "Sasha Fictional" });
    const team = card("Sasha Fictional");
    expect(
      within(team).queryByRole("button", { name: "Rename Fictional team" }),
    ).toBeNull();
    expect(
      within(team).queryByRole("button", {
        name: "Add a name for the team of Sasha Fictional",
      }),
    ).toBeNull();
    expect(within(team).queryByText("No name")).toBeNull();
  });

  it("starts with the reports hidden of a manager who first appears when the Draft menu changes", async () => {
    openEditableAt("/org-chart?show=drafts", () =>
      chartJson({
        people,
        drafted: [
          person("p1", "Robin Fictional", null),
          person("p2", "Sasha Fictional", "p1"),
        ],
      }),
    );
    await screen.findByRole("link", { name: "Sasha Fictional" });
    await userEvent.click(
      screen.getByRole("button", { name: "Draft, changed" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Drafts beside live" }),
    );
    expect(
      await within(card("Sasha Fictional")).findByRole("button", {
        name: /^Show 1 report/,
      }),
    ).toBeDefined();
  });

  it("shows the reports of a manager who first appears when the Draft menu changes, after All levels", async () => {
    openEditableAt("/org-chart?show=drafts", () =>
      chartJson({
        people,
        drafted: [
          person("p1", "Robin Fictional", null),
          person("p2", "Sasha Fictional", "p1"),
        ],
      }),
    );
    await screen.findByRole("link", { name: "Sasha Fictional" });
    await showLevels("All levels");
    await userEvent.click(
      screen.getByRole("button", { name: "Draft, changed" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Drafts beside live" }),
    );
    expect(
      await within(card("Sasha Fictional")).findByRole("button", {
        name: /^Hide 1 report/,
      }),
    ).toBeDefined();
  });

  it("names someone moved between managers outside a team shown alone once", async () => {
    await openChart(
      () =>
        chartJson({
          people: [
            ...people,
            person("p5", "Wren Fictional", "p1"),
            {
              ...person("p6", "Vic Fictional", "p1"),
              draft: { managerId: "p5", state: "waiting", unpublished: false },
            },
          ],
        }),
      false,
      "/org-chart?team=FX-p2",
    );
    await screen.findByRole("link", { name: "Sasha Fictional" });
    await userEvent.type(
      screen.getByRole("combobox", { name: "Find a person or team" }),
      "Vic",
    );
    expect(
      await screen.findByText("Vic Fictional is not in this team"),
    ).toBeDefined();
  });

  it("takes a team's colour away with No colour", async () => {
    const fetch = openAsEditor(
      {
        "PUT /api/org-chart/teams/p2/colour": () =>
          new Response(null, { status: 204 }),
      },
      people.map((one) =>
        one.id === "p2" ? { ...one, teamColour: "teal" as const } : one,
      ),
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Colour of Fictional team: Teal",
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "No colour" }),
    );
    expect(
      await screen.findByText("Fictional team no longer has a colour."),
    ).toBeDefined();
    const put = fetch.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(put?.[1]?.body as string)).toEqual({ colour: null });
  });

  it("says so, and keeps the colour, when it cannot be changed", async () => {
    openAsEditor({
      "PUT /api/org-chart/teams/p2/colour": () =>
        new Response(null, { status: 500 }),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: /^Colour of Fictional team:/ }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Lime" }),
    );
    expect(
      await screen.findByText(/could not change the colour of Fictional team/),
    ).toBeDefined();
    expect(card("Sasha Fictional").querySelector("[data-coloured]")).toBeNull();
  });

  it("empties the name with the ×, and changes nothing on Cancel", async () => {
    const fetch = openAsEditor({});
    await userEvent.click(
      await screen.findByRole("button", { name: "Rename Fictional team" }),
    );
    const field = await screen.findByRole<HTMLInputElement>("textbox", {
      name: "Team name",
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Clear the name" }),
    );
    expect(field.value).toBe("");
    expect(screen.queryByRole("button", { name: "Clear the name" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fetch.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(
      false,
    );
  });

  it("says so when a team's name cannot be changed", async () => {
    openAsEditor({
      "PATCH /api/people/p2": () => new Response(null, { status: 500 }),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Rename Fictional team" }),
    );
    const field = await screen.findByRole("textbox", { name: "Team name" });
    await userEvent.clear(field);
    await userEvent.type(field, "Harbour Crew{Enter}");
    expect(
      await screen.findByText(/could not change the name of Fictional team/),
    ).toBeDefined();
  });

  it("closes the Teams panel", async () => {
    openAsEditor({});
    await userEvent.click(await screen.findByRole("button", { name: "Teams" }));
    await screen.findByRole("dialog", { name: "Teams" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Teams" })).toBeNull();
    });
  });

  it("does nothing when the colour chosen is the team's already", async () => {
    const fetch = openAsEditor(
      {},
      people.map((one) =>
        one.id === "p2" ? { ...one, teamColour: "teal" as const } : one,
      ),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /^Colour of Fictional team:/ }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Teal/ }),
    );
    expect(fetch.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(
      false,
    );
  });

  it("removes a team's name as a draft when the field is emptied, and saves nothing unchanged", async () => {
    const fetch = openAsEditor({
      "PATCH /api/people/p2": () =>
        Response.json({ changeSetId: "00000000-0000-4000-8000-000000000002" }),
    });
    const rename = await screen.findByRole("button", {
      name: "Rename Fictional team",
    });
    await userEvent.click(rename);
    await userEvent.click(await screen.findByRole("button", { name: "Save" }));
    expect(fetch.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(
      false,
    );
    await userEvent.click(rename);
    await userEvent.click(
      await screen.findByRole("button", { name: "Clear the name" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText(
        "Draft saved. The team's name comes off once approved.",
      ),
    ).toBeDefined();
    const patch = fetch.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(patch?.[1]?.body as string)).toEqual({ teamName: "" });
  });

  it("names an unnamed team from the Teams panel, as a draft", async () => {
    const fetch = openAsEditor({
      "PATCH /api/people/p1": () =>
        Response.json({ changeSetId: "00000000-0000-4000-8000-000000000002" }),
    });
    await userEvent.click(await screen.findByRole("button", { name: "Teams" }));
    const panel = await screen.findByRole("dialog", { name: "Teams" });
    await userEvent.click(
      within(panel).getByRole("button", {
        name: "Add a name for the team of Robin Fictional",
      }),
    );
    const field = await screen.findByRole<HTMLInputElement>("textbox", {
      name: "Team name",
    });
    expect(field.value).toBe("");
    await userEvent.type(field, "Fictional top team{Enter}");
    expect(
      await screen.findByText(
        "Draft saved. The team's name becomes Fictional top team once approved.",
      ),
    ).toBeDefined();
    const patch = fetch.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(patch?.[1]?.body as string)).toEqual({
      teamName: "Fictional top team",
    });
  });

  it("shows those who may name teams but not colour them each team's colour, without a menu", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["people:view", "org-chart:view", "people:edit"],
        }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": () =>
        chartJson({
          people: [
            person("p1", "Robin Fictional", null, {
              teamName: "Fictional top team",
            }),
            person("p2", "Sasha Fictional", "p1", {
              teamName: "Fictional team",
              teamColour: "teal",
            }),
            person("p3", "Tatum Fictional", "p2"),
          ],
        }),
    });
    renderApp("/org-chart");
    await userEvent.click(await screen.findByRole("button", { name: "Teams" }));
    const panel = await screen.findByRole("dialog", { name: "Teams" });
    expect(
      within(panel).queryByRole("button", { name: /^Colour of/ }),
    ).toBeNull();
    const names = within(panel)
      .getAllByRole("button", { name: /^Rename/ })
      .map((button) => button.textContent);
    expect(names).toEqual(["Fictional team", "Fictional top team"]);
  });

  it("offers no colour menu, renaming or Teams panel to those who cannot change people", async () => {
    await openChart();
    await screen.findByRole("link", { name: "Sasha Fictional" });
    expect(screen.queryByRole("button", { name: "Teams" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /^Colour of Fictional team:/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Rename Fictional team" }),
    ).toBeNull();
  });

  it("draws drafts beside live, as drafts make the chart, or not at all, from the Draft menu, kept in the address", async () => {
    const history = await openChart(() =>
      chartJson({
        people: people.map((one) =>
          one.id === "p4"
            ? {
                ...one,
                draft: {
                  managerId: "p2",
                  state: "waiting",
                  unpublished: false,
                },
              }
            : one.id === "p2"
              ? {
                  ...one,
                  draft: {
                    teamName: "Fictional crew",
                    state: "rejected",
                    unpublished: false,
                  },
                }
              : one.id === "p1"
                ? {
                    ...one,
                    draft: {
                      position: "Fictional Chief",
                      state: "waiting",
                      unpublished: false,
                    },
                  }
                : one,
        ),
        drafted: [
          person("p1", "Robin Fictional", null),
          person("p5", "Vic Fictional", "p1"),
        ],
      }),
    );
    await screen.findByRole("link", { name: "Uma Fictional" });
    expect(within(card("Uma Fictional")).getByText("Draft")).toBeDefined();
    const copy = screen
      .getAllByText("Uma Fictional")
      .find((name) => name.tagName === "SPAN")
      ?.closest("div.react-flow__node") as HTMLElement;
    expect(within(copy).getByText("Live")).toBeDefined();
    const team = card("Sasha Fictional");
    expect(within(team).getByText("Fictional crew")).toBeDefined();
    expect(within(team).getByText("Rejected")).toBeDefined();
    expect(within(team).getByText("Fictional team")).toBeDefined();
    const top = card("Robin Fictional");
    expect(within(top).getByText("Fictional Chief")).toBeDefined();
    expect(within(top).getByText("Draft")).toBeDefined();
    expect(within(top).getByText("Fictional Director")).toBeDefined();
    expect(within(top).getByText("Live")).toBeDefined();
    await userEvent.type(
      screen.getByRole("combobox", { name: "Find a person or team" }),
      "Robin",
    );
    expect(
      await screen.findByRole("option", {
        name: /Robin Fictional\s*Fictional Director/,
      }),
    ).toBeDefined();
    await userEvent.keyboard("{Escape}");

    await userEvent.click(screen.getByRole("button", { name: "Draft" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Drafts applied" }),
    );
    expect(
      await screen.findByRole("link", { name: "Vic Fictional" }),
    ).toBeDefined();
    expect(screen.queryByText("Uma Fictional")).toBeNull();
    expect(history.location.search).toContain("show=drafts");

    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Live only" }),
    );
    await screen.findByRole("link", { name: "Uma Fictional" });
    expect(within(card("Uma Fictional")).queryByText("Draft")).toBeNull();
    expect(screen.queryByText("Fictional crew")).toBeNull();
    expect(screen.queryByText("Fictional Chief")).toBeNull();
    expect(screen.queryByText("Live")).toBeNull();
  });

  it("opens with the top two levels shown, and shows the levels chosen", async () => {
    await openChart(chartAnswer, false);
    await screen.findByRole("link", { name: "Sasha Fictional" });
    expect(screen.queryByRole("link", { name: "Tatum Fictional" })).toBeNull();
    await showLevels("All levels");
    expect(
      await screen.findByRole("link", { name: "Uma Fictional" }),
    ).toBeDefined();
    await showLevels("3 levels");
    expect(
      await screen.findByRole("link", { name: "Tatum Fictional" }),
    ).toBeDefined();
    expect(screen.queryByRole("link", { name: "Uma Fictional" })).toBeNull();
    await showLevels("1 level");
    expect(screen.queryByRole("link", { name: "Sasha Fictional" })).toBeNull();
    expect(screen.getByRole("link", { name: "Robin Fictional" })).toBeDefined();
  });

  it("offers no levels when everyone is on one", async () => {
    await openChart(
      () => chartJson({ people: [person("a", "Avery Fictional", null)] }),
      false,
    );
    await screen.findByRole("link", { name: "Avery Fictional" });
    expect(screen.queryByRole("button", { name: "Show levels" })).toBeNull();
  });

  it("shows the person's details beside the chart from their name, and finds them", async () => {
    const history = await openChart();
    await userEvent.click(
      await screen.findByRole("link", { name: "Uma Fictional" }),
    );
    expect(history.location.pathname).toBe("/org-chart");
    expect(history.location.search).toContain("open=FX-p4");
    expect(
      await screen.findByRole("region", { name: "Uma Fictional" }),
    ).toBeDefined();
    expect(history.location.search).toContain("person=FX-p4");
    expect(card("Uma Fictional").querySelector("[data-found]")).not.toBeNull();
  });

  it("keeps the person whose details are opened centred as the chart's width changes, until the chart is moved", async () => {
    const { transform, resize } = await openWatchedChart();
    resize(800);
    // Zoomed out, so finding the person zooms in.
    await userEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    await settled();
    expect(transform()).not.toContain("scale(1)");
    await userEvent.click(
      await screen.findByRole("link", { name: "Uma Fictional" }),
    );
    await screen.findByRole("region", { name: "Uma Fictional" });
    // Narrowing while the chart moves to the person centres them at once, well before the move
    // would have ended.
    resize(600);
    await new Promise((settle) => setTimeout(settle, 60));
    const soon = transform();
    await settled();
    expect(soon).toBe(transform());
    // It is kept at the zoom finding them moves to.
    expect(soon).toContain("scale(1)");
    // Zooming is moving the chart.
    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    await settled();
    const zoomed = transform();
    resize(400);
    expect(transform()).toBe(zoomed);
  });

  it("keeps a person already found at the zoom chosen when their details open again", async () => {
    const { transform, resize } = await openWatchedChart();
    resize(800);
    const uma = await screen.findByRole("link", { name: "Uma Fictional" });
    await userEvent.click(uma);
    await screen.findByRole("region", { name: "Uma Fictional" });
    await settled();
    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    await settled();
    const scale = /scale\([^)]*\)/.exec(transform())?.[0];
    expect(scale).not.toBe("scale(1)");
    await userEvent.click(uma);
    resize(600);
    expect(transform()).toContain(scale);
  });

  it("stops keeping the person centred once the chart is moved by hand", async () => {
    const { transform, resize } = await openWatchedChart();
    resize(800);
    await userEvent.click(
      await screen.findByRole("link", { name: "Uma Fictional" }),
    );
    await screen.findByRole("region", { name: "Uma Fictional" });
    await new Promise((settle) => setTimeout(settle, 400));
    fireEvent.wheel(
      document.querySelector(".react-flow__pane") as HTMLElement,
      { deltaY: 100 },
    );
    await new Promise((settle) => setTimeout(settle, 50));
    const moved = transform();
    resize(600);
    expect(transform()).toBe(moved);
  });

  it.each([
    ["showing a number of levels", () => showLevels("1 level")],
    [
      "hiding reports",
      async () => {
        await userEvent.click(
          screen.getByRole("button", {
            name: "Hide 1 report of Sasha Fictional",
          }),
        );
      },
    ],
  ])("stops keeping the person centred after %s", async (_, move) => {
    const { transform, resize } = await openWatchedChart();
    resize(800);
    await userEvent.click(
      await screen.findByRole("link", { name: "Uma Fictional" }),
    );
    await screen.findByRole("region", { name: "Uma Fictional" });
    await settled();
    await move();
    await settled();
    const moved = transform();
    resize(600);
    expect(transform()).toBe(moved);
  });

  it("closes the details with the browser's back button", async () => {
    const history = await openChart();
    await userEvent.click(
      await screen.findByRole("link", { name: "Uma Fictional" }),
    );
    await screen.findByRole("region", { name: "Uma Fictional" });
    history.back();
    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: "Uma Fictional" }),
      ).toBeNull();
    });
    expect(history.location.search).not.toContain("open=");
  });

  it("leaves a click that opens a new tab to the browser", async () => {
    const history = await openChart();
    const link = await screen.findByRole("link", { name: "Uma Fictional" });
    let leftToBrowser = false;
    // Seen after the page has handled the click; the simulated browser cannot open a tab, so it is
    // then stopped.
    const browser = (event: MouseEvent) => {
      leftToBrowser = !event.defaultPrevented;
      event.preventDefault();
    };
    document.addEventListener("click", browser);
    fireEvent.click(link, { ctrlKey: true });
    document.removeEventListener("click", browser);
    expect(leftToBrowser).toBe(true);
    expect(history.location.pathname).toBe("/org-chart");
  });

  it("gives cards and lines no focus of their own", async () => {
    await openChart();
    await screen.findByRole("link", { name: "Uma Fictional" });
    const own = document.querySelectorAll(
      ".react-flow__node[tabindex], .react-flow__edge[tabindex]",
    );
    expect(own).toHaveLength(0);
    expect(
      [...document.querySelectorAll(".react-flow__edge")].every(
        (line) => line.getAttribute("aria-hidden") === "true",
      ),
    ).toBe(true);
  });

  it("shows the person's details from anywhere else on the card", async () => {
    const history = await openChart();
    await screen.findByRole("link", { name: "Uma Fictional" });
    fireEvent.click(
      within(card("Uma Fictional")).getByText("Fictional Engineer"),
    );
    expect(history.location.search).toContain("open=FX-p4");
  });

  it("hides a manager's reports, and everyone below them, and shows them again", async () => {
    await openChart();
    await screen.findByRole("link", { name: "Uma Fictional" });
    const hide = screen.getByRole("button", {
      name: "Hide 1 report of Sasha Fictional",
    });
    expect(hide.getAttribute("aria-expanded")).toBe("true");
    await userEvent.click(hide);
    expect(screen.queryByRole("link", { name: "Tatum Fictional" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Uma Fictional" })).toBeNull();
    const show = screen.getByRole("button", {
      name: "Show 1 report of Sasha Fictional",
    });
    expect(show.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(show);
    expect(
      await screen.findByRole("link", { name: "Uma Fictional" }),
    ).toBeDefined();
  });

  it("counts several reports, shown or hidden", async () => {
    await openChart(() =>
      chartJson({
        people: [
          person("a", "Avery Fictional", null),
          person("b", "Blake Fictional", "a"),
          person("c", "Casey Fictional", "a"),
        ],
      }),
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Hide 2 reports of Avery Fictional",
      }),
    );
    expect(
      screen.getByRole("button", { name: "Show 2 reports of Avery Fictional" }),
    ).toBeDefined();
  });

  it("finds a person by name, showing them even below a hidden manager, and marks them", async () => {
    await openChart();
    await screen.findByRole("link", { name: "Uma Fictional" });
    await userEvent.click(
      screen.getByRole("button", {
        name: "Hide 1 report of Robin Fictional",
      }),
    );
    expect(screen.queryByRole("link", { name: "Uma Fictional" })).toBeNull();
    const finder = screen.getByRole("combobox", {
      name: "Find a person or team",
    });
    await userEvent.type(finder, "Uma");
    await userEvent.click(
      await screen.findByRole("option", { name: /Uma Fictional/ }),
    );
    await screen.findByRole("link", { name: "Uma Fictional" });
    expect(card("Uma Fictional").querySelector("[data-found]")).not.toBeNull();
  });

  it("finds someone already shown, and clears the search", async () => {
    await openChart();
    await screen.findByRole("link", { name: "Uma Fictional" });
    const finder = screen.getByRole("combobox", {
      name: "Find a person or team",
    });
    await userEvent.type(finder, "Robin");
    await userEvent.click(
      await screen.findByRole("option", { name: /Robin Fictional/ }),
    );
    expect(
      card("Robin Fictional").querySelector("[data-found]"),
    ).not.toBeNull();
    // Mantine keeps its clear button from screen readers.
    await userEvent.click(
      within(finder.parentElement as HTMLElement).getByRole("button", {
        hidden: true,
      }),
    );
    expect(card("Robin Fictional").querySelector("[data-found]")).toBeNull();
  });

  it("finds a team by its name, centring the manager who leads it", async () => {
    await openChart(chartAnswer, false);
    await screen.findByRole("link", { name: "Sasha Fictional" });
    await userEvent.type(
      screen.getByRole("combobox", { name: "Find a person or team" }),
      "Fictional team",
    );
    await userEvent.click(
      await screen.findByRole("option", {
        name: /Fictional team\s*Led by Sasha Fictional/,
      }),
    );
    expect(
      card("Sasha Fictional").querySelector("[data-found]"),
    ).not.toBeNull();
    expect(
      await screen.findByRole("link", { name: "Tatum Fictional" }),
    ).toBeDefined();
  });

  it("clears what is typed in the finder before anyone is chosen", async () => {
    await openChart();
    await screen.findByRole("link", { name: "Uma Fictional" });
    const finder = screen.getByRole("combobox", {
      name: "Find a person or team",
    });
    const clear = () =>
      within(finder.parentElement as HTMLElement).queryByRole("button", {
        hidden: true,
      });
    expect(clear()).toBeNull();
    await userEvent.type(finder, "Zz");
    await userEvent.click(clear() as HTMLElement);
    expect((finder as HTMLInputElement).value).toBe("");
    expect(clear()).toBeNull();
  });

  it("shows one manager's team alone, and everyone again", async () => {
    const history = await openChart();
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Show only the team of Sasha Fictional",
      }),
    );
    expect(
      await screen.findByText(
        "You're seeing only the team of Sasha Fictional.",
      ),
    ).toBeDefined();
    expect(screen.queryByRole("link", { name: "Robin Fictional" })).toBeNull();
    expect(screen.getByRole("link", { name: "Tatum Fictional" })).toBeDefined();
    expect(
      screen.queryByRole("button", {
        name: "Show only the team of Sasha Fictional",
      }),
    ).toBeNull();
    expect(history.location.search).toBe("?team=FX-p2");
    await userEvent.type(
      screen.getByRole("combobox", { name: "Find a person or team" }),
      "Robin",
    );
    expect(
      await screen.findByText("Robin Fictional is not in this team"),
    ).toBeDefined();
    await userEvent.click(
      screen.getByRole("button", { name: "Show everyone" }),
    );
    expect(
      await screen.findByRole("link", { name: "Robin Fictional" }),
    ).toBeDefined();
    expect(screen.queryByText(/You're seeing only/)).toBeNull();
  });

  it("shows everyone when the team in the address is not on the chart", async () => {
    await openChart(chartAnswer, false, "/org-chart?team=FX-p4");
    expect(
      await screen.findByRole("link", { name: "Robin Fictional" }),
    ).toBeDefined();
    expect(screen.queryByText(/You're seeing only/)).toBeNull();
  });

  it("zooms in and out, and fits the chart to the screen", async () => {
    await openChart();
    await screen.findByRole("link", { name: "Uma Fictional" });
    const viewport = document.querySelector(
      ".react-flow__viewport",
    ) as HTMLElement;
    const scale = () =>
      Number(/scale\(([\d.]+)\)/.exec(viewport.style.transform)?.[1]);
    const before = scale();
    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    await vi.waitFor(() => {
      expect(scale()).toBeGreaterThan(before);
    });
    const zoomed = scale();
    await userEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    await vi.waitFor(() => {
      expect(scale()).toBeLessThan(zoomed);
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Fit to screen" }),
    );
    expect(screen.getByRole("link", { name: "Uma Fictional" })).toBeDefined();
  });

  it("shows a manager People does not show the reader by name alone, opening nothing, and finds them without keeping them in the address", async () => {
    const history = await openChart(() =>
      chartJson({
        people: [
          person("g", "Gale Fictional", null, {
            employeeId: null,
            position: null,
            nameOnly: true,
          }),
          person("h", "Harper Fictional", "g"),
        ],
      }),
    );
    await screen.findByRole("link", { name: "Harper Fictional" });
    expect(screen.queryByRole("link", { name: "Gale Fictional" })).toBeNull();
    const gale = screen
      .getAllByText("Gale Fictional")
      .map((name) => name.closest("div.react-flow__node"))
      .find((node) => node !== null) as HTMLElement;
    expect(within(gale).queryByText("Fictional Engineer")).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "Show only the team of Gale Fictional",
      }),
    ).toBeNull();
    fireEvent.click(gale);
    expect(history.location.pathname).toBe("/org-chart");
    await userEvent.type(
      screen.getByRole("combobox", { name: "Find a person or team" }),
      "Gale",
    );
    await userEvent.click(
      await screen.findByRole("option", { name: /Gale Fictional/ }),
    );
    expect(gale.querySelector("[data-found]")).not.toBeNull();
    expect(history.location.search).toBe("");
  });

  it("offers no Draft menu to those who do not see People, whatever the address says", async () => {
    serverAnswers({
      "GET /api/session": chartOnly,
      "GET /api/org-chart": () =>
        chartJson({
          people: people.map((one) => ({ ...one, employeeId: null })),
          drafted: [],
        }),
    });
    renderApp("/org-chart?show=drafts");
    await screen.findAllByText("Robin Fictional");
    expect(screen.queryByRole("button", { name: /^Draft/ })).toBeNull();
  });

  it("shows those who do not see People each card without opening it, keeping Fathom's own IDs in the address", async () => {
    serverAnswers({
      "GET /api/session": chartOnly,
      "GET /api/org-chart": () =>
        chartJson({
          people: people.map((one) => ({ ...one, employeeId: null })),
        }),
    });
    const history = renderApp("/org-chart");
    await showLevels("All levels");
    await screen.findAllByText("Uma Fictional");
    expect(screen.queryByRole("link", { name: "Uma Fictional" })).toBeNull();
    const uma = screen
      .getAllByText("Uma Fictional")
      .map((name) => name.closest("div.react-flow__node"))
      .find((node) => node !== null) as HTMLElement;
    expect(within(uma).getByText("Fictional Engineer")).toBeDefined();
    expect(screen.getAllByText("Fictional team").length).toBeGreaterThan(0);
    fireEvent.click(uma);
    expect(history.location.pathname).toBe("/org-chart");
    await userEvent.type(
      screen.getByRole("combobox", { name: "Find a person or team" }),
      "Uma",
    );
    await userEvent.click(
      await screen.findByRole("option", { name: /Uma Fictional/ }),
    );
    expect(history.location.search).toBe("?person=p4");
    await userEvent.click(
      screen.getByRole("button", {
        name: "Show only the team of Sasha Fictional",
      }),
    );
    expect(
      await screen.findByText(
        "You're seeing only the team of Sasha Fictional.",
      ),
    ).toBeDefined();
    expect(history.location.search).toBe("?team=p2");
  });

  it("keeps those who do not see People able to show one team when no position may be shown", async () => {
    serverAnswers({
      "GET /api/session": chartOnly,
      "GET /api/org-chart": () =>
        chartJson({
          people: people.map((one) => ({
            ...one,
            employeeId: null,
            position: null,
          })),
        }),
    });
    const history = renderApp("/org-chart");
    await showLevels("All levels");
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Show only the team of Sasha Fictional",
      }),
    );
    expect(history.location.search).toBe("?team=p2");
  });

  it("brings back the person found when chosen again after their card was hidden", async () => {
    await openChart();
    const finder = await screen.findByRole("combobox", {
      name: "Find a person or team",
    });
    await userEvent.type(finder, "Uma");
    await userEvent.click(
      await screen.findByRole("option", { name: /Uma Fictional/ }),
    );
    await screen.findByRole("link", { name: "Uma Fictional" });
    await showLevels("1 level");
    expect(screen.queryByRole("link", { name: "Uma Fictional" })).toBeNull();
    await userEvent.click(finder);
    await userEvent.click(
      await screen.findByRole("option", { name: /Uma Fictional/ }),
    );
    expect(
      await screen.findByRole("link", { name: "Uma Fictional" }),
    ).toBeDefined();
    expect(card("Uma Fictional").querySelector("[data-found]")).not.toBeNull();
  });

  it("keeps the team shown alone while showing someone's details", async () => {
    const history = await openChart(chartAnswer, true, "/org-chart?team=FX-p2");
    await userEvent.click(
      await screen.findByRole("link", { name: "Uma Fictional" }),
    );
    expect(history.location.search).toContain("team=FX-p2");
    expect(history.location.search).toContain("open=FX-p4");
    expect(
      await screen.findByText(
        "You're seeing only the team of Sasha Fictional.",
      ),
    ).toBeDefined();
  });

  it("shows everyone, with nobody found, when the address names a person or team too long to be one", async () => {
    // Employee IDs on the chart one character longer than an Employee ID may be.
    const tooLong = "X".repeat(41);
    await openChart(
      () =>
        chartJson({
          people: [
            person("p1", "Robin Fictional", null, {
              employeeId: `${tooLong}1`,
            }),
            person("p2", "Sasha Fictional", "p1", { employeeId: tooLong }),
            person("p3", "Tatum Fictional", "p2"),
          ],
        }),
      false,
      `/org-chart?person=${tooLong}&team=${tooLong}1`,
    );
    expect(
      await screen.findByRole("link", { name: "Robin Fictional" }),
    ).toBeDefined();
    expect(screen.queryByText(/You're seeing only/)).toBeNull();
    expect(
      screen.getByRole<HTMLInputElement>("combobox", {
        name: "Find a person or team",
      }).value,
    ).toBe("");
  });

  it("finds nobody when the person in the address is not on the chart", async () => {
    await openChart(chartAnswer, false, "/org-chart?person=FX-nobody");
    await screen.findByRole("link", { name: "Sasha Fictional" });
    expect(document.querySelector("[data-found]")).toBeNull();
  });

  it("says so when nobody is on it", async () => {
    await openChart(() => chartJson({ people: [] }), false);
    expect(
      await screen.findByText("Nobody is on the org chart yet."),
    ).toBeDefined();
  });

  it("says so when it cannot load, and tries again", async () => {
    let fail = true;
    await openChart(
      () =>
        fail
          ? Response.json({ error: "Down" }, { status: 500 })
          : chartJson({ people }),
      false,
    );
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Fathom could not load the org chart.");
    fail = false;
    await userEvent.click(
      within(alert).getByRole("button", { name: "Try again" }),
    );
    expect(
      await screen.findByRole("link", { name: "Robin Fictional" }),
    ).toBeDefined();
  });
});
