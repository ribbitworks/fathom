// SPDX-License-Identifier: Apache-2.0

// Tests for a person's details in a side panel, with the server's responses simulated: what it shows
// of them, their manager and reports, their details and added columns, drafted values beside live
// ones, following the Draft menu, opening it from People and the org chart, moving to another
// person, closing it, and someone it cannot find.

import type { OrgChartPerson } from "@fathom/shared";
import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { fictionalUser, renderApp, serverAnswers } from "./test-support.tsx";

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
    const team = row("Team name");
    expect(within(team).getByText("Fictional crew")).toBeDefined();
    expect(within(team).getByText("Draft")).toBeDefined();
    expect(within(team).getByText("Live")).toBeDefined();
  });

  it("follows the Draft menu of the page beside it", async () => {
    answers();
    renderApp("/people?open=E2&show=live");
    await panel("Sasha Fictional");
    expect(within(row("Team name")).queryByText("Fictional crew")).toBeNull();
    expect(within(row("Team name")).queryByText("Live")).toBeNull();
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
      expect(within(row("Team name")).queryByText("Uma's crew")).toBeNull();
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
    expect(within(row("Team name")).getByText("Fictional team")).toBeDefined();
  });

  it("draws no colour for a team without a name", async () => {
    answers();
    renderApp("/people?open=E3");
    await panel("Uma Fictional");
    expect(within(row("Team name")).getByText("None")).toBeDefined();
    expect(
      row("Team name").querySelector(".mantine-ColorSwatch-root"),
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
      row("Team name").querySelector(".mantine-ColorSwatch-root"),
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

  it("offers no details for planned hires", async () => {
    answers([
      robin,
      sasha,
      uma,
      { ...person("h1", "Fictional Hire"), kind: "planned-hire" },
    ]);
    renderApp("/people");
    await screen.findByRole("button", {
      name: "Show details of Robin Fictional",
    });
    expect(
      screen.queryByRole("button", { name: "Show details of Fictional Hire" }),
    ).toBeNull();
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
