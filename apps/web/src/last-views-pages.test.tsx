// SPDX-License-Identifier: Apache-2.0

// Tests for each page with a Views menu opening on the view it last showed, through the app's
// router.

import { startingEffortConversions } from "@fathom/shared";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fictionalStream,
  fictionalTeamMonths,
  fictionalUser,
  gridNow,
  monthsUrl,
  planAnswers,
  renderApp,
  serverAnswers,
} from "./test-support.tsx";

type Answers = Parameters<typeof serverAnswers>[0];

const session = (permissions: string[]) => () =>
  Response.json({ ...fictionalUser, permissions });

const onePerson: Answers = {
  "GET /api/people": () =>
    Response.json({
      people: [
        {
          id: "p1",
          keyNumber: 1,
          preferredName: "Uma Fictional",
          employeeId: "FX-p1",
          positionId: "position-1",
          values: {},
        },
      ],
      fields: [],
      order: [],
    }),
  "GET /api/lists": () => Response.json({ lists: [] }),
};

const noChoices = () =>
  Response.json({
    owners: [],
    statuses: [],
    featureStatuses: [],
    featureTeams: [],
    priorities: [],
    sizes: [],
    risks: [],
  });

const plan: Answers = {
  ...planAnswers([]),
  "GET /api/projects/choices": noChoices,
  "GET /api/release-streams": () =>
    Response.json({
      streams: [fictionalStream()],
      canEditStreams: false,
      canEditReleases: false,
    }),
  "GET /api/effort-conversions": () => Response.json(startingEffortConversions),
};

// Opens a page with this last view of it kept, giving the address it settled on and its history.
function openOn(
  path: string,
  page: string,
  last: object,
  permissions: string[],
  answers: Answers,
) {
  serverAnswers({
    "GET /api/session": session(permissions),
    "GET /api/last-views": () => Response.json({ [page]: last }),
    [`PUT /api/last-views/${page}`]: () => new Response(null, { status: 204 }),
    ...answers,
  });
  const history = renderApp(path);
  return {
    address: () => new URLSearchParams(history.location.search),
    history,
  };
}

describe("People opening on the view it last showed", () => {
  const open = (path: string, definition: object) =>
    openOn(path, "people", { table: "people", definition }, ["people:view"], {
      ...onePerson,
    });
  const searchBox = async () =>
    screen.findByRole<HTMLInputElement>("textbox", { name: "Search people" });

  it.each([
    ["on it when the address names no view", "/people", "Fictional"],
    [
      "on the address's own view when it names one",
      "/people?search=Other",
      "Other",
    ],
  ])("opens %s", async (_, path, search) => {
    open(path, { search: "Fictional" });
    expect((await searchBox()).value).toBe(search);
  });

  it("keeps its last view when chosen in the menu while it is open", async () => {
    // Given People open on its last view
    open("/people", { search: "Fictional" });
    expect((await searchBox()).value).toBe("Fictional");

    // When People is chosen in the left-hand menu
    await userEvent.click(screen.getByRole("link", { name: "People" }));

    // Then it still shows that view
    expect((await searchBox()).value).toBe("Fictional");
  });

  it("shows the default when chosen in the menu with no last view, leaving no mark to go back to", async () => {
    // Given People open on its default, with no last view kept
    const { address, history } = open("/people", {});
    expect((await searchBox()).value).toBe("");

    // When People is chosen in the left-hand menu
    await userEvent.click(screen.getByRole("link", { name: "People" }));

    // Then it still shows its default, and the history holds no menu choice
    expect((await searchBox()).value).toBe("");
    expect(address().toString()).toBe("");
    expect(history.location.state).not.toHaveProperty("fromMenu");
  });

  it("opens a cleared view as the page's default", async () => {
    const { address } = open("/people", {});
    expect((await searchBox()).value).toBe("");
    expect(address().toString()).toBe("");
  });
});

describe("Projects opening on the view it last showed", () => {
  it.each([
    [
      "the tab it showed, even when its view was cleared",
      { table: "proposals", definition: {} },
      "Proposals",
      ["proposals", null],
    ],
    [
      "the first tab, with no tab in the address",
      { table: "projects", definition: { search: "Fictional" } },
      "Projects",
      [null, "Fictional"],
    ],
  ])("opens on %s", async (_, last, grid, shown) => {
    const { address } = openOn(
      "/projects",
      "projects",
      last,
      ["plan:view", "features:view"],
      plan,
    );

    await screen.findByRole("grid", { name: grid });
    expect([address().get("tab"), address().get("search")]).toEqual(shown);
  });
});

describe("Releases opening on the view it last showed", () => {
  it.each([
    ["with its choices", { choices: { past: "shown" } }, "shown"],
    ["when its view was cleared", {}, null],
  ])("opens on the Cycles tab %s", async (_, definition, past) => {
    const { address } = openOn(
      "/releases",
      "releases",
      { table: "cycles", definition },
      fictionalUser.permissions,
      plan,
    );

    await screen.findByRole("grid", { name: "Cycles" });
    expect([address().get("tab"), address().get("past")]).toEqual([
      "cycles",
      past,
    ]);
  });
});

describe("Features opening on the view it last showed", () => {
  it.each([
    [
      "the Board with the parts of its cards hidden",
      { choices: { hide: ["status"] } },
      "board",
      ["board", '["status"]'],
    ],
    ["the table when its view was cleared", {}, undefined, [null, null]],
  ])("opens on %s", async (_, definition, mode, shown) => {
    const { address } = openOn(
      "/features",
      "features",
      { table: "features", definition, mode },
      ["plan:view", "features:view"],
      plan,
    );

    await screen.findByRole("button", { name: /^Group by/ });
    expect([address().get("mode"), address().get("hide")]).toEqual(shown);
  });
});

describe("Drafts opening on the view it last showed", () => {
  it.each([
    ["on the tab it showed", { choices: { tab: "all" } }, /^All drafts/u],
    [
      "on the role's first tab when its view was cleared",
      {},
      /^Not published/u,
    ],
  ])("opens %s", async (_, definition, tab) => {
    openOn(
      "/drafts",
      "drafts",
      { table: "drafts", definition },
      ["people:view", "people:edit"],
      onePerson,
    );

    expect(
      await screen.findByRole("tab", { name: tab, selected: true }),
    ).toBeDefined();
  });
});

describe("the Org chart opening on the view it last showed", () => {
  it.each([
    ["with its choices", { choices: { teams: "feature" } }, "feature"],
    ["as it opens when its view was cleared", {}, null],
  ])("opens the chart %s", async (_, definition, teams) => {
    const { address } = openOn(
      "/org-chart",
      "org-chart",
      { table: "org-chart", definition },
      ["people:view", "feature-teams:view"],
      {
        ...onePerson,
        "GET /api/org-chart": () => Response.json({ people: [], drafted: [] }),
      },
    );

    await screen.findByRole("heading", { name: "Org chart" });
    expect(address().get("teams")).toBe(teams);
  });
});

describe("Capacity opening on the view it last showed", () => {
  const capacity: Answers = {
    [monthsUrl]: () => Response.json(fictionalTeamMonths),
    "GET /api/allocations": () =>
      Response.json({ allocations: [], features: [] }),
    "GET /api/org-chart": () => Response.json({ people: [], drafted: [] }),
  };
  // Allocations last showed a search.
  const onAllocations = { table: "capacity", definition: { search: "Casey" } };
  const open = (path: string) =>
    openOn(
      path,
      "capacity",
      onAllocations,
      [
        "allocations:view",
        "feature-teams:view",
        "people:view",
        "personal:view",
      ],
      capacity,
    );

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${gridNow}T12:00:00Z`));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens on the tab and view it last showed when the address names neither", async () => {
    const { address } = open("/capacity");

    await screen.findByRole("grid", { name: "Allocations by month" });
    expect([address().get("mode"), address().get("search")]).toEqual([
      "allocations",
      "Casey",
    ]);
  });

  it("opens on the last view when the address names the tab it was on", async () => {
    const { address } = open("/capacity?mode=allocations");

    await screen.findByRole("grid", { name: "Allocations by month" });
    expect(address().get("search")).toBe("Casey");
  });

  it.each([
    ["Feature assignments' old address", "/feature-assignments"],
    ["an address naming Feature teams", "/capacity?mode=feature-teams"],
  ])(
    "opens Feature teams for %s, though Allocations was last shown",
    async (_, path) => {
      const { address } = open(path);

      await screen.findByRole("grid", { name: "Feature teams by month" });
      expect([address().get("mode"), address().get("search")]).toEqual([
        "feature-teams",
        null,
      ]);
    },
  );
});
