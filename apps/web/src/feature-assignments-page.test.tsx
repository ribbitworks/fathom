// SPDX-License-Identifier: Apache-2.0

// Tests for the Feature assignments page: people as rows and months as columns, their teams shown as
// labels, the three ways of grouping them, each person counted once, months outside someone's
// employment, a label's tooltip, drafts and the Draft menu, changing a month's teams, and what it
// shows when it cannot load.

import { monthsBetween, type TeamMonths } from "@fathom/shared";
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
  fictionalUser,
  renderApp,
  serverAnswers,
} from "./test-support.tsx";

const now = "2027-03-10";
const monthsUrl = "GET /api/feature-teams/months?from=2026-03&to=2028-02";

const mobile = { id: "t-mobile", name: "Mobile apps", colour: "teal" as const };
const payments = {
  id: "t-payments",
  name: "Payments core",
  colour: "grape" as const,
};
const platform = {
  id: "t-platform",
  name: "Platform reliability",
  colour: null,
};

const months: TeamMonths = {
  months: monthsBetween("2026-03", "2028-02"),
  teams: [payments, platform, mobile],
  people: [
    {
      id: "p-casey",
      preferredName: "Casey Fictional",
      manager: { id: "p-blair", name: "Blair Fictional" },
      teams: { "2027-03": [platform.id] },
    },
    {
      id: "p-avery",
      preferredName: "Avery Fictional",
      manager: { id: "p-blair", name: "Blair Fictional" },
      teams: { "2027-03": [payments.id, mobile.id] },
      outside: ["2026-03"],
    },
    {
      id: "p-blair",
      preferredName: "Blair Fictional",
      manager: null,
      teams: {},
    },
  ],
};

const session = (permissions: string[]) => () =>
  Response.json({ ...fictionalUser, permissions });

const seesPeople = session(["org-chart:view", "people:view"]);

function openPage(
  search = "",
  answers: {
    months?: () => Response;
    session?: () => Response;
  } = {},
) {
  serverAnswers({
    "GET /api/session": answers.session ?? seesPeople,
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
    "org-chart:view",
    "people:view",
    "feature-teams:propose",
  ]);
  const caseyUrl = "/api/feature-teams/members/p-casey";
  const saved = "00000000-0000-4000-8000-000000000001";
  const undone = "00000000-0000-4000-8000-000000000002";

  async function openEditing(permissions = proposes) {
    const fetch = serverAnswers({
      "GET /api/session": permissions,
      [monthsUrl]: () => Response.json(months),
      [`PATCH ${caseyUrl}`]: () => Response.json({ changeSetId: saved }),
      [`POST /api/undo/${saved}`]: () => Response.json({ changeSetId: undone }),
    });
    renderApp("/feature-assignments?grouping=none");
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

  it("leaves earlier months and the person as they are, with no row menu", async () => {
    await openEditing();

    expect(cell("2027-02").getAttribute("aria-readonly")).toBe("true");
    expect(cell("2027-03").hasAttribute("aria-readonly")).toBe(false);
    expect(cell("name").getAttribute("aria-readonly")).toBe("true");
    expect(screen.queryByRole("button", { name: /^Actions for/u })).toBeNull();
  });

  it("lets those who may change Restricted details change earlier months", async () => {
    await openEditing(
      session([
        "org-chart:view",
        "people:view",
        "feature-teams:propose",
        "restricted:edit",
      ]),
    );

    expect(cell("2027-02").hasAttribute("aria-readonly")).toBe(false);
  });

  it("changes nothing for those who may not propose team changes", async () => {
    const fetch = await openEditing(seesPeople);
    act(() => {
      cell("2027-03").focus();
    });

    await userEvent.keyboard("{Delete}");

    expect(bodyOf(fetch, "PATCH", caseyUrl)).toEqual([]);
    expect(within(cell("2027-03")).getByText(platform.name)).toBeDefined();
  });
});

describe("the Feature assignments page", () => {
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

    expect(screen.getByText("Mobile apps").style.background).toBe(
      "var(--mantine-color-teal-light)",
    );
    expect(screen.getByText("Platform reliability").style.background).toBe("");
  });

  it("offers the Draft menu to those who see people", async () => {
    await openPage();
    expect(screen.getByRole("button", { name: /^Draft/u })).toBeDefined();
  });

  it("offers no Draft menu to those who do not see people", async () => {
    await openPage("", { session: session(["org-chart:view"]) });

    expect(screen.queryByRole("button", { name: /^Draft/u })).toBeNull();
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
      await openPage("?grouping=none", {
        months: () => Response.json(drafted),
      });

      const row = draftRow();
      expect(within(row).getByText("Draft")).toBeDefined();
      expect(within(row).getByText(", added")).toBeDefined();
      expect(within(row).getByText(", removed")).toBeDefined();
    });

    it("shows the person's teams as approved in a Live row under it, as labels", async () => {
      await openPage("?grouping=none", {
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
        await openPage("?grouping=none", {
          months: () =>
            Response.json({
              ...drafted,
              drafts: drafted.drafts?.map((draft) => ({ ...draft, ...tone })),
            }),
        });

        const added = within(draftRow()).getByText(", added")
          .parentElement as HTMLElement;
        expect(added.querySelector(`[class*=${toneClass}]`)).not.toBeNull();
      },
    );

    it("leaves out the team a draft takes away once drafts are applied", async () => {
      await openPage("?grouping=none&show=drafts", {
        months: () => Response.json(drafted),
      });

      expect(within(draftRow()).queryByText("Platform reliability")).toBeNull();
      expect(within(draftRow()).getByText("Mobile apps")).toBeDefined();
    });
  });

  it("groups by manager at first, for those who see people", async () => {
    await openPage();

    expect(
      screen.getByRole("button", { name: "Group by: Manager" }),
    ).toBeDefined();
    expect(screen.getAllByText("Blair Fictional").length).toBeGreaterThan(1);
    expect(screen.getByText("No manager")).toBeDefined();
  });

  it("groups by feature team, listing someone under each team and counting them once", async () => {
    await openPage("?grouping=feature-team");

    expect(screen.getAllByText("Avery Fictional")).toHaveLength(2);
    expect(screen.getByText("No feature team")).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe("3 people");
  });

  it("lists everyone once with no grouping", async () => {
    await openPage("?grouping=none");

    expect(screen.queryByText("No manager")).toBeNull();
    expect(screen.getAllByText("Avery Fictional")).toHaveLength(1);
  });

  it("changes the grouping from the Group by menu", async () => {
    await openPage();

    await userEvent.click(
      screen.getByRole("button", { name: "Group by: Manager" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /None/u }),
    );

    await waitFor(() => {
      expect(screen.queryByText("No manager")).toBeNull();
    });
    expect(
      screen.getByRole("button", { name: "Group by: None" }),
    ).toBeDefined();
  });

  it("does not offer grouping by manager to those who do not see people", async () => {
    await openPage("", { session: session(["org-chart:view"]) });

    await userEvent.click(
      screen.getByRole("button", { name: "Group by: Feature team" }),
    );

    expect(
      await screen.findByRole("menuitem", { name: /None/u }),
    ).toBeDefined();
    expect(screen.queryByRole("menuitem", { name: /Manager/u })).toBeNull();
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
      "GET /api/session": seesPeople,
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

  it("is not there for those who do not see the org chart", async () => {
    serverAnswers({ "GET /api/session": session(["plan:view"]) });
    renderApp("/feature-assignments");

    expect(
      await screen.findByText("There is no page at this address."),
    ).toBeDefined();
  });
});
