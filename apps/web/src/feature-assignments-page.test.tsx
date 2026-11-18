// SPDX-License-Identifier: Apache-2.0

// Tests for the Feature assignments page against a simulated server.

import { type TeamMonths } from "@fathom/shared";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bodyOf,
  fictionalTeamMonths,
  fictionalUser,
  gridNow,
  mobile,
  monthsUrl,
  platform,
  renderApp,
  serverAnswers,
} from "./test-support.tsx";

const now = gridNow;
const months = fictionalTeamMonths;

// The page needs people's Personal details, and grouping by manager Confidential data, so every role
// here sees them.
const session = (permissions: string[]) => () =>
  Response.json({
    ...fictionalUser,
    permissions: [
      ...permissions,
      "people:view",
      "personal:view",
      "confidential:view",
    ],
  });

const reader = session(["people:view", "feature-teams:view"]);

function openPage(
  search = "",
  answers: {
    months?: () => Response;
    session?: () => Response;
  } = {},
) {
  serverAnswers({
    "GET /api/session": answers.session ?? reader,
    [monthsUrl]: answers.months ?? (() => Response.json(months)),
  });
  renderApp(`/feature-assignments${search}`);
  return screen.findByRole("grid", { name: "Feature teams by month" });
}

const rowOf = (name: string) =>
  screen.getByText(name).closest("tr") as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${now}T12:00:00Z`));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("changing a month's teams", () => {
  const proposes = session([
    "people:view",
    "feature-teams:view",
    "feature-teams:edit",
  ]);
  const caseyUrl = "/api/feature-teams/members/p-casey";
  const saved = "00000000-0000-4000-8000-000000000001";
  const undone = "00000000-0000-4000-8000-000000000002";

  async function openEditing(permissions = proposes, search = "") {
    const fetch = serverAnswers({
      "GET /api/session": permissions,
      [monthsUrl]: () => Response.json(months),
      [`PATCH ${caseyUrl}`]: () => Response.json({ changeSetId: saved }),
      [`POST /api/undo/${saved}`]: () => Response.json({ changeSetId: undone }),
    });
    renderApp(`/feature-assignments${search}`);
    await screen.findByRole("grid", { name: "Feature teams by month" });
    return fetch;
  }

  const cell = (month: string) =>
    document.getElementById(`cell-p-casey-${month}`) as HTMLElement;

  it("adds a team from a later month's first day", async () => {
    const fetch = await openEditing();
    act(() => {
      cell("2027-05").focus();
    });

    await userEvent.keyboard("mob");
    await screen.findByRole("option", { name: "Mobile apps" });
    await userEvent.keyboard("{Tab}");

    expect(bodyOf(fetch, "PATCH", caseyUrl)).toEqual([
      { add: [mobile.id], remove: [], from: "2027-05-01" },
    ]);
  });

  it("takes a team away in the current month from today", async () => {
    const fetch = await openEditing();
    act(() => {
      cell("2027-03").focus();
    });

    await userEvent.keyboard("{Delete}");

    expect(bodyOf(fetch, "PATCH", caseyUrl)).toEqual([
      { add: [], remove: [platform.id] },
    ]);
  });

  it("undoes a change with Cmd+Z", async () => {
    const fetch = await openEditing();
    act(() => {
      cell("2027-03").focus();
    });
    await userEvent.keyboard("{Delete}");

    // Undo is offered once the change is saved; pressing it before then does nothing.
    await waitFor(async () => {
      await userEvent.keyboard("{Meta>}z{/Meta}");
      expect(bodyOf(fetch, "POST", `/api/undo/${saved}`)).toEqual([{}]);
    });
  });

  it("leaves a change alone with Cmd+Z while a view is being named", async () => {
    // Given a change saved, and the Save view dialog open on a sorted view
    const fetch = await openEditing(proposes, "?sort=%5B%22name%22%5D");
    act(() => {
      cell("2027-03").focus();
    });
    await userEvent.keyboard("{Delete}");
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", caseyUrl)).toHaveLength(1);
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Views, changed" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Save view…" }),
    );
    await screen.findByRole("dialog", { name: "Save view" });

    // When Cmd+Z is pressed
    await userEvent.keyboard("{Meta>}z{/Meta}");

    // Then nothing is undone until the dialog closes
    expect(bodyOf(fetch, "POST", `/api/undo/${saved}`)).toEqual([]);
    await userEvent.keyboard("{Escape}");
    await waitFor(async () => {
      await userEvent.keyboard("{Meta>}z{/Meta}");
      expect(bodyOf(fetch, "POST", `/api/undo/${saved}`)).toEqual([{}]);
    });
  });

  it("leaves earlier months and the person as they are, with no row menu", async () => {
    await openEditing();

    expect(cell("2027-02").getAttribute("aria-readonly")).toBe("true");
    expect(cell("2027-03").hasAttribute("aria-readonly")).toBe(false);
    expect(cell("name").getAttribute("aria-readonly")).toBe("true");
    expect(screen.queryByRole("button", { name: /^Actions for/u })).toBeNull();
  });

  it("lets those who may change Personal details change earlier months", async () => {
    await openEditing(
      session([
        "people:view",
        "feature-teams:view",
        "feature-teams:edit",
        "personal:edit",
      ]),
    );

    expect(cell("2027-02").hasAttribute("aria-readonly")).toBe(false);
  });

  it("changes nothing for those who may not propose team changes", async () => {
    const fetch = await openEditing(reader);
    act(() => {
      cell("2027-03").focus();
    });

    await userEvent.keyboard("{Delete}");

    expect(bodyOf(fetch, "PATCH", caseyUrl)).toEqual([]);
    expect(within(cell("2027-03")).getByText(platform.name)).toBeDefined();
  });
});

describe("the Feature assignments page", () => {
  it("shows the strip of quarters the months fall in, marking the current one and month", async () => {
    const grid = await openPage();

    const strip = screen.getByRole("toolbar", { name: "Quarters" });
    const quarters = within(strip).getAllByRole("button");
    expect(quarters.map((quarter) => quarter.textContent)).toEqual([
      "Q1 2026Q1",
      "Q2 2026Q2",
      "Q3 2026Q3",
      "Q4 2026Q4",
      "Q1 2027Q1",
      "Q2 2027Q2",
      "Q3 2027Q3",
      "Q4 2027Q4",
      "Q1 2028Q1",
    ]);
    expect(
      within(strip).getByRole("button", { current: "date" }).textContent,
    ).toBe("Q1 2027Q1");
    expect(
      grid
        .querySelector('th[data-column="2027-03"]')
        ?.getAttribute("aria-current"),
    ).toBe("date");
  });

  it("shows people as rows and months as columns, with each month's teams by name", async () => {
    await openPage();

    expect(screen.getByRole("columnheader", { name: /Person/u })).toBeDefined();
    expect(
      screen.getByRole("columnheader", { name: /Mar 2027/u }),
    ).toBeDefined();
    expect(
      within(rowOf("Avery Fictional"))
        .getAllByText(/Mobile apps|Payments core/u)
        .map((label) => label.textContent),
    ).toEqual(["Mobile apps", "Payments core"]);
  });

  it("colours a team's label, and leaves a team with no colour neutral", async () => {
    await openPage();

    // The label is the name's box, around it.
    const label = (name: string) => screen.getByText(name).parentElement;
    expect(label("Mobile apps")?.style.background).toBe(
      "var(--mantine-color-teal-light)",
    );
    expect(label("Platform reliability")?.style.background).toBe("");
  });

  it("offers the Draft menu", async () => {
    await openPage();
    expect(screen.getByRole("button", { name: /^Draft/u })).toBeDefined();
  });

  it("is not there for those who do not see Personal details", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["people:view", "feature-teams:view"],
        }),
    });
    renderApp("/feature-assignments");

    expect(
      await screen.findByText("There is no page at this address."),
    ).toBeDefined();
    expect(
      screen.queryByRole("link", { name: /Feature assignments/u }),
    ).toBeNull();
  });

  describe("with a draft changing someone's months", () => {
    const drafted: TeamMonths = {
      ...months,
      people: months.people.map((person) =>
        person.id === "p-casey"
          ? {
              ...person,
              drafted: {
                teams: { "2027-03": [mobile.id] },
                by: [mobile.id, platform.id],
              },
            }
          : person,
      ),
      drafts: [
        { teamId: mobile.id, action: "changed", state: "waiting" },
        { teamId: platform.id, action: "changed", state: "waiting" },
      ],
    };
    const draftRow = () =>
      screen
        .getAllByText("Casey Fictional")
        .map((name) => name.closest("tr") as HTMLElement)
        .find((row) => row.getAttribute("aria-hidden") === null) as HTMLElement;

    it("marks the row as a draft, and the teams the draft adds and takes away", async () => {
      await openPage("", {
        months: () => Response.json(drafted),
      });

      const row = draftRow();
      expect(row.className).toContain("draftRow");
      expect(within(row).getByText(", added")).toBeDefined();
      expect(within(row).getByText(", removed")).toBeDefined();
    });

    it("shows the person's teams as approved in a Live row under it, as labels", async () => {
      await openPage("", {
        months: () => Response.json(drafted),
      });

      const live = draftRow().nextElementSibling as HTMLElement;
      expect(live.getAttribute("aria-hidden")).toBe("true");
      expect(within(live).getByText("Platform reliability")).toBeDefined();
      expect(within(live).queryByText("Mobile apps")).toBeNull();
    });

    it.each([
      [
        "red once the draft is rejected",
        { state: "rejected" },
        "draftRejected",
      ],
      [
        "hollow for the reader's own unpublished changes",
        { state: "waiting", unpublished: true },
        "unpublishedMark",
      ],
      ["yellow otherwise", { state: "waiting" }, "draftMark"],
    ] as const)(
      "gives an added team's dot the draft's tone: %s",
      async (_, tone, toneClass) => {
        await openPage("", {
          months: () =>
            Response.json({
              ...drafted,
              drafts: drafted.drafts.map((draft) => ({ ...draft, ...tone })),
            }),
        });

        const added = within(draftRow()).getByText(", added")
          .parentElement as HTMLElement;
        expect(added.querySelector(`[class*=${toneClass}]`)).not.toBeNull();
      },
    );

    it("marks the team the draft takes away with Live's dot in the Live row, and nothing else", async () => {
      await openPage("", {
        months: () => Response.json(drafted),
      });

      const live = draftRow().nextElementSibling as HTMLElement;
      const platformLabel = within(live).getByText("Platform reliability")
        .parentElement as HTMLElement;
      expect(within(platformLabel).getByText(", live")).toBeDefined();
      expect(within(live).getAllByText(", live")).toHaveLength(1);
    });

    it("gives an emptied month only its team's dot, with no words for an empty value", async () => {
      // Given a draft taking Casey off every team in March 2027
      const emptied: TeamMonths = {
        ...drafted,
        people: drafted.people.map((person) =>
          person.id === "p-casey"
            ? {
                ...person,
                drafted: { teams: { "2027-03": [] }, by: [platform.id] },
              }
            : person,
        ),
      };
      await openPage("", {
        months: () => Response.json(emptied),
      });

      // Then the month holds the struck-through team with its own dot alone
      const cell = within(draftRow())
        .getByText("Platform reliability")
        .closest("td") as HTMLElement;
      expect(cell.querySelectorAll("[class*=draftMark]")).toHaveLength(1);
      expect(screen.queryByText(/^No mar 2027$/iu)).toBeNull();
    });

    it("marks the team a waiting draft takes away, live only, naming the change", async () => {
      await openPage("?show=live", {
        months: () => Response.json(drafted),
      });

      const row = rowOf("Casey Fictional");
      expect(row.className).not.toContain("draftRow");
      expect(
        row.querySelector(
          '[data-tip="Live. Its removal is waiting for approval."]',
        ),
      ).not.toBeNull();
    });

    it("leaves out the team a draft takes away once drafts are applied", async () => {
      await openPage("?show=drafts", {
        months: () => Response.json(drafted),
      });

      expect(within(draftRow()).queryByText("Platform reliability")).toBeNull();
      expect(within(draftRow()).getByText("Mobile apps")).toBeDefined();
    });
  });

  it("groups only by feature team, saying nothing, for those who do not see Confidential data", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["people:view", "feature-teams:view", "personal:view"],
        }),
      [monthsUrl]: () => Response.json(months),
    });
    renderApp("/feature-assignments");
    await screen.findByRole("grid", { name: "Feature teams by month" });

    expect(screen.queryByText(/needs Confidential access/u)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Group by" }));
    expect(
      await screen.findByRole("menuitem", { name: /Feature team/u }),
    ).toBeDefined();
    expect(screen.queryByRole("menuitem", { name: /Manager/u })).toBeNull();
  });

  it("groups by manager", async () => {
    await openPage("?grouping=manager");

    expect(screen.getAllByText("Blair Fictional").length).toBeGreaterThan(1);
    expect(screen.getByText("No manager")).toBeDefined();
  });

  it("groups by feature team, listing someone under each team and counting them once", async () => {
    await openPage("?grouping=feature-team");

    expect(screen.getAllByText("Avery Fictional")).toHaveLength(2);
    expect(screen.getByText("No feature team")).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe("3 people");
  });

  it("puts the heading for none first once the headings run Z to A", async () => {
    await openPage("?grouping=feature-team&groupsReversed=true");

    const [firstOnTeam] = screen.getAllByText("Avery Fictional");
    expect(
      screen
        .getByText("No feature team")
        .compareDocumentPosition(firstOnTeam as HTMLElement) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("lists everyone once, with no grouping, to start", async () => {
    await openPage();

    expect(screen.queryByText("No manager")).toBeNull();
    expect(screen.getAllByText("Avery Fictional")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Group by" })).toBeDefined();
  });

  it("changes the grouping from the Group by menu", async () => {
    await openPage();

    await userEvent.click(screen.getByRole("button", { name: "Group by" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Manager/u }),
    );

    expect(await screen.findByText("No manager")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Group by: Manager" }),
    ).toBeDefined();
  });

  it("marks the months outside someone's employment", async () => {
    await openPage();

    const mark = screen.getByText("Not employed");

    expect(mark.closest("td")?.hasAttribute("data-shaded")).toBe(true);
    expect(rowOf("Avery Fictional").contains(mark)).toBe(true);
  });

  it("gives a label's whole name in a tooltip while the pointer is over it", async () => {
    await openPage();
    const label = screen.getByText("Platform reliability");

    fireEvent.mouseOver(label);
    expect((await screen.findByRole("tooltip")).textContent).toBe(
      "Platform reliability",
    );

    fireEvent.mouseOver(label);
    expect(screen.getByRole("tooltip")).toBeDefined();

    fireEvent.mouseOver(label.closest("td") as HTMLElement);
    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).toBeNull();
    });

    fireEvent.mouseOver(label);
    await screen.findByRole("tooltip");
    fireEvent.mouseOut(label, { relatedTarget: document.body });
    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).toBeNull();
    });
  });

  it("says when it could not load, and tries again", async () => {
    let answers = 0;
    serverAnswers({
      "GET /api/session": reader,
      [monthsUrl]: () => {
        answers += 1;
        return answers === 1
          ? Response.json({}, { status: 500 })
          : Response.json(months);
      },
    });
    renderApp("/feature-assignments");

    await screen.findByText("Fathom could not load the feature assignments.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("grid", { name: "Feature teams by month" }),
    ).toBeDefined();
  });

  it("is not there for those who do not see feature teams", async () => {
    serverAnswers({
      "GET /api/session": session(["plan:view", "features:view"]),
    });
    renderApp("/feature-assignments");

    expect(
      await screen.findByText("There is no page at this address."),
    ).toBeDefined();
  });
});

describe("the Feature assignments page's saved views", () => {
  it("saves a view with its grouping, and applies it again", async () => {
    // Given the grid grouped by manager, and no saved views
    const saved = {
      id: "00000000-0000-4000-8000-0000000000a2",
      name: "By manager",
      scope: "personal",
      definition: { grouping: "manager" },
      canChange: true,
      canShare: false,
    };
    let views: object[] = [];
    const fetch = serverAnswers({
      "GET /api/session": reader,
      [monthsUrl]: () => Response.json(months),
      "GET /api/views/feature-assignments": () => Response.json(views),
      "POST /api/views/feature-assignments": () => {
        views = [saved];
        return Response.json(
          { view: saved, changeSetId: null },
          { status: 201 },
        );
      },
    });
    const history = renderApp("/feature-assignments?grouping=manager");

    // When it is saved as a view
    await userEvent.click(
      await screen.findByRole("button", { name: "Views, changed" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Save view…" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Save view" });
    expect(within(dialog).getByText("Manager")).toBeDefined();
    await userEvent.type(
      within(dialog).getByRole("textbox"),
      "By manager{Enter}",
    );

    // Then the grouping is saved, and the view is the one applied
    await waitFor(() => {
      expect(history.location.search).toContain(`view=${saved.id}`);
    });
    expect(bodyOf(fetch, "POST", "/api/views/feature-assignments")).toEqual(
      [saved.definition].map((definition) => ({
        name: "By manager",
        scope: "personal",
        definition,
      })),
    );

    // And, cleared, it is applied again from the menu
    await userEvent.click(
      screen.getByRole("button", { name: "Views: By manager" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Clear view" }),
    );
    await waitFor(() => {
      expect(history.location.search).not.toContain("manager");
    });
    await userEvent.click(screen.getByRole("button", { name: "Views" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /^By manager/u }),
    );
    await waitFor(() => {
      expect(history.location.search).toContain("grouping=manager");
    });
  });
});

describe("the strip of quarters", () => {
  // Every column 100 pixels wide, the Person column frozen, in a table showing 400 pixels.
  const columnWidth = 100;
  const room = 400;
  const months = 27;

  beforeEach(() => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      width: columnWidth,
      left: 0,
    } as DOMRect);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(room);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(
      (months + 1) * columnWidth,
    );
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(
      columnWidth,
    );
    vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(
      function (this: HTMLElement) {
        const siblings = [...(this.parentElement?.children ?? [])];
        return siblings.indexOf(this) * columnWidth;
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const scroller = (grid: HTMLElement) => grid.parentElement as HTMLElement;
  // The grid opens with the current month, the fifteenth, just after the Person column; another
  // month is there when scrolled by its columns from it.
  const currentMonth = 14;
  let opened = 0;
  const atMonth = (index: number) =>
    opened + (index - currentMonth) * columnWidth;
  const openStrip = async () => {
    const grid = await openPage();
    opened = scroller(grid).scrollLeft;
    return grid;
  };
  const quarter = (name: string) =>
    within(screen.getByRole("toolbar", { name: "Quarters" })).getByRole(
      "button",
      { name: (label) => label.startsWith(name) },
    );
  // The grid tells the strip it has scrolled, as a browser does.
  const scrolled = (grid: HTMLElement) => {
    fireEvent.scroll(scroller(grid));
  };

  it("opens at the current month, tinting the quarters on screen", async () => {
    const grid = await openStrip();

    expect(opened).toBeGreaterThan(0);
    await waitFor(() => {
      expect(quarter("Q1 2027").getAttribute("aria-label")).toBe(
        "Q1 2027, in view",
      );
    });
    expect(quarter("Q2 2027").getAttribute("aria-label")).toBe(
      "Q2 2027, in view",
    );
    expect(quarter("Q3 2027").getAttribute("aria-label")).toBe("Q3 2027");

    // Told it scrolled without moving, it keeps what it shows.
    scrolled(grid);
    await waitFor(() => {
      expect(quarter("Q1 2027").getAttribute("aria-label")).toBe(
        "Q1 2027, in view",
      );
    });
  });

  it("scrolls a quarter chosen to just after the Person column, selected until the grid moves", async () => {
    const grid = await openStrip();

    await userEvent.click(quarter("Q4 2026"));
    scrolled(grid);

    expect(scroller(grid).scrollLeft).toBe(atMonth(9));
    await waitFor(() => {
      expect(quarter("Q4 2026").getAttribute("aria-label")).toBe(
        "Q4 2026, in view, selected",
      );
    });

    scroller(grid).scrollLeft = atMonth(10);
    scrolled(grid);

    await waitFor(() => {
      expect(quarter("Q4 2026").getAttribute("aria-label")).toBe(
        "Q4 2026, in view",
      );
    });
  });

  it("steps a quarter at a time, and goes back to the current month with Today", async () => {
    const grid = await openStrip();
    await waitFor(() => {
      expect(quarter("Q1 2027").getAttribute("aria-label")).toContain(
        "in view",
      );
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Previous quarter" }),
    );
    expect(scroller(grid).scrollLeft).toBe(atMonth(12));
    scrolled(grid);
    await waitFor(() => {
      expect(quarter("Q1 2027").getAttribute("aria-label")).toContain(
        "selected",
      );
    });

    await userEvent.click(screen.getByRole("button", { name: "Next quarter" }));
    expect(scroller(grid).scrollLeft).toBe(atMonth(15));
    scrolled(grid);

    await userEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(scroller(grid).scrollLeft).toBe(atMonth(14));
  });

  it("turns ‹ off at the grid's start, and › off at its end", async () => {
    const grid = await openStrip();

    scroller(grid).scrollLeft = 0;
    scrolled(grid);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Previous quarter" }),
      ).toHaveProperty("disabled", true);
    });

    scroller(grid).scrollLeft = (months + 1) * columnWidth - room;
    scrolled(grid);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Next quarter" }),
      ).toHaveProperty("disabled", true);
    });
  });
});
