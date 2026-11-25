// SPDX-License-Identifier: Apache-2.0

// Tests for Capacity's Feature teams tab against a simulated server: its teams by month, drafts,
// grouping, its filter across every month, planned hires' rows and saved views.

import { type TeamMonths } from "@fathom/shared";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  answer,
  featureTeamsAt,
  openPage,
  reader,
  session,
} from "./test-feature-teams.tsx";
import {
  bodyOf,
  fictionalTeamMonths,
  fictionalUser,
  gridNow,
  mobile,
  monthsUrl,
  platform,
  renderApp,
} from "./test-support.tsx";

const now = gridNow;
const months = fictionalTeamMonths;

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

// The colour of the square drawn before a name, if any.
const squareIn = (element: Element | null | undefined) =>
  element?.querySelector("[data-colour]")?.getAttribute("data-colour") ??
  undefined;

describe("Capacity's Feature teams", () => {
  it("shows the strip of quarters the months fall in, marking the current one and month", async () => {
    const grid = await openPage();

    const strip = screen.getByRole("toolbar", { name: "Quarters" });
    const quarters = within(strip).getAllByRole("button");
    expect(quarters.map((quarter) => quarter.textContent)).toEqual([
      "Q1 2026",
      "Q2 2026",
      "Q3 2026",
      "Q4 2026",
      "Q1 2027",
      "Q2 2027",
      "Q3 2027",
      "Q4 2027",
      "Q1 2028",
    ]);
    expect(
      within(strip).getByRole("button", { current: "date" }).textContent,
    ).toBe("Q1 2027");
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

  it("names a team after its colour's square, and a team with no colour with none", async () => {
    await openPage();

    const square = (name: string) =>
      screen
        .getAllByText(name)[0]
        ?.parentElement?.querySelector("[data-colour]")
        ?.getAttribute("data-colour");
    expect([square("Mobile apps"), square("Platform reliability")]).toEqual([
      "teal",
      undefined,
    ]);
  });

  it("offers the Draft menu", async () => {
    await openPage();
    expect(screen.getByRole("button", { name: /^Draft/u })).toBeDefined();
  });

  it("is not there for those who do not see Personal details", async () => {
    answer({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["people:view", "feature-teams:view"],
        }),
    });
    renderApp(featureTeamsAt());

    expect(
      await screen.findByText("There is no page at this address."),
    ).toBeDefined();
    expect(
      screen.queryByRole("link", { name: /Feature assignments|Capacity/u }),
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
    answer({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["people:view", "feature-teams:view", "personal:view"],
        }),
      [monthsUrl]: () => Response.json(months),
    });
    renderApp(featureTeamsAt());
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
    expect(
      squareIn(screen.getByRole("rowheader", { name: /^Mobile apps/ })),
    ).toBe("teal");
    expect(screen.getByText("No feature team")).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe("3 people in Mar 2027");
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

  it("keeps the people on a feature team chosen from the Feature teams button, in any month", async () => {
    // Given the grid, with Avery alone on Mobile apps
    await openPage();

    // When Mobile apps is chosen from the Feature teams button
    await userEvent.click(
      screen.getByRole("button", { name: "Feature teams" }),
    );
    const filter = await screen.findByRole("dialog", {
      name: "Filter Feature team",
    });
    const box = within(filter).getByRole("checkbox", { name: mobile.name });
    expect(squareIn(box.closest(".mantine-Checkbox-root"))).toBe("teal");
    await userEvent.click(box);

    // Then Avery alone shows, the pill names the filter after the team's square, and the button is
    // marked
    await waitFor(() => {
      expect(screen.queryByText("Casey Fictional")).toBeNull();
    });
    expect(rowOf("Avery Fictional")).toBeDefined();
    const pill = screen
      .getByText(/^Feature team:/)
      .closest(".mantine-Pill-root");
    expect([pill?.textContent, squareIn(pill)]).toEqual([
      `Feature team: ${mobile.name}`,
      "teal",
    ]);

    // And Esc closes the filter, back on its button, marked as filtering
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Feature teams, filtered" }),
      );
    });
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
    answer({
      "GET /api/session": reader,
      [monthsUrl]: () => {
        answers += 1;
        return answers === 1
          ? Response.json({}, { status: 500 })
          : Response.json(months);
      },
    });
    renderApp(featureTeamsAt());

    await screen.findByText("Fathom could not load the feature teams.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("grid", { name: "Feature teams by month" }),
    ).toBeDefined();
  });

  it("is not there for those who do not see feature teams", async () => {
    answer({
      "GET /api/session": session(["plan:view", "features:view"]),
    });
    renderApp(featureTeamsAt());

    expect(
      await screen.findByText("There is no page at this address."),
    ).toBeDefined();
  });
});

describe("planned hires on Feature teams", () => {
  const chart = {
    people: [
      {
        id: "p-blair",
        keyNumber: 1,
        preferredName: "Blair Fictional",
        employeeId: null,
        position: null,
        teamName: null,
        teamColour: null,
        managerId: null,
      },
      {
        id: "h-tester",
        keyNumber: 2,
        preferredName: "Payments tester",
        employeeId: null,
        position: null,
        teamName: null,
        teamColour: null,
        managerId: "p-blair",
        planned: { expected: "2027-05" },
      },
      {
        id: "h-unnamed",
        keyNumber: 3,
        preferredName: "SDET, TBD-7",
        employeeId: null,
        position: null,
        teamName: null,
        teamColour: null,
        managerId: "p-blair",
        planned: { expected: "2027-05", shownId: "TBD-7" },
      },
    ],
    drafted: [],
  };

  it("gives each planned hire a row with no teams, read only, shaded before it is expected", async () => {
    // Given a role that sees planned hires, and one expected in May 2027
    answer({
      "GET /api/session": session(["feature-teams:view", "feature-teams:edit"]),
      [monthsUrl]: () => Response.json(months),
      "GET /api/org-chart": () => Response.json(chart),
    });

    // When Feature teams opens
    renderApp(featureTeamsAt());
    await screen.findByText("Payments tester");

    // Then the hire's months are read only, and those before May 2027 are shaded
    const cell = (month: string) =>
      document.getElementById(`cell-h-tester-${month}`) as HTMLElement;
    expect([
      cell("2027-04").getAttribute("aria-readonly"),
      cell("2027-04").hasAttribute("data-shaded"),
      cell("2027-05").hasAttribute("data-shaded"),
      cell("2027-05").textContent,
    ]).toEqual(["true", true, false, ""]);
  });

  it("names a planned hire with no name by its position and ID", async () => {
    answer({
      "GET /api/session": reader,
      [monthsUrl]: () => Response.json(months),
      "GET /api/org-chart": () => Response.json(chart),
    });
    renderApp(featureTeamsAt());

    expect(await screen.findByText("SDET, TBD-7")).toBeDefined();
  });

  it("counts planned hires apart from people, once they are expected", async () => {
    // Given both hires expected before the current month, the one counted
    const expected = {
      ...chart,
      people: chart.people.map((card) =>
        card.planned === undefined
          ? card
          : { ...card, planned: { ...card.planned, expected: "2026-01" } },
      ),
    };
    answer({
      "GET /api/session": reader,
      [monthsUrl]: () => Response.json(months),
      "GET /api/org-chart": () => Response.json(expected),
    });
    renderApp(featureTeamsAt());
    await screen.findByText("Payments tester");

    expect(screen.getByRole("status").textContent).toMatch(
      /and 2 planned hires in Mar 2027$/u,
    );
  });

  it("asks for no planned hires, and shows none, for a role that doesn't see them", async () => {
    // Given a role that sees feature teams and Personal details, but not people
    const fetch = answer({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["feature-teams:view", "personal:view"],
        }),
      [monthsUrl]: () => Response.json(months),
    });

    // When Feature teams opens
    renderApp(featureTeamsAt());
    await screen.findByRole("grid", { name: "Feature teams by month" });

    // Then the org chart isn't asked for
    expect(fetch.mock.calls.some(([url]) => url === "/api/org-chart")).toBe(
      false,
    );
  });
});

describe("Feature teams' saved views", () => {
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
    const fetch = answer({
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
    const history = renderApp(featureTeamsAt("?grouping=manager"));

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
