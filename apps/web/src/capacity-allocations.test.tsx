// SPDX-License-Identifier: Apache-2.0

// Tests for the Capacity page's Allocations tab and the page's tabs: each person's and planned hire's
// features with their percentages, grouping, the tabs a role sees and the tab in the address, the
// old addresses of Allocations, what it shows when it cannot load, its cells read only, the rows it
// keeps to those over or under, its filter by what someone is allocated to in any month, and its saved
// views.

import {
  type Allocations,
  monthsBetween,
  type OrgChart,
  startingPlanningSettings,
} from "@fathom/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fictionalTeamMonths,
  fictionalUser,
  gridNow,
  recordCell,
  monthsUrl,
  renderApp,
  serverAnswers,
} from "./test-support.tsx";
import { anyMonthKey } from "./team-months.tsx";
import { unseenFeatureChoice } from "./allocation-months.tsx";

const allocations: Allocations = {
  allocations: [
    {
      id: "a-1",
      personId: "p-casey",
      plannedHireId: null,
      featureId: "f-checkout",
      months: { "2027-03": 50, "2027-05": null },
    },
    {
      id: "a-2",
      personId: null,
      plannedHireId: "h-tester",
      featureId: "f-checkout",
      months: { "2027-04": 100 },
    },
  ],
  features: [
    {
      id: "f-checkout",
      name: "Checkout",
      meaning: "in-progress",
      colour: null,
    },
  ],
};

const chart: OrgChart = {
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
      keyNumber: 1,
      preferredName: "Payments tester",
      employeeId: null,
      position: null,
      teamName: null,
      teamColour: null,
      managerId: "p-blair",
      planned: { expected: "2027-04" },
    },
  ],
  drafted: [],
};

// What Allocations reads: allocations, the feature teams' months and the org chart's planned hires, with
// the Personal details they need.
const seesAllocations = [
  "allocations:view",
  "feature-teams:view",
  "people:view",
  "personal:view",
];

const session = (permissions: readonly string[]) => () =>
  Response.json({ ...fictionalUser, permissions });

// Capacity on the tab the search names, or Allocations.
function openAllocations(
  search = "",
  {
    permissions = [
      ...seesAllocations,
      "confidential:view",
      "configuration:view",
    ],
    allocationsAnswer = () => Response.json(allocations),
  }: {
    permissions?: readonly string[];
    allocationsAnswer?: () => Response;
  } = {},
) {
  serverAnswers({
    "GET /api/session": session(permissions),
    [monthsUrl]: () => Response.json(fictionalTeamMonths),
    "GET /api/allocations": allocationsAnswer,
    "GET /api/org-chart": () => Response.json(chart),
    "GET /api/planning-settings": () => Response.json(startingPlanningSettings),
  });
  const tabbed = search.includes("mode=")
    ? search
    : `${search === "" ? "?" : `${search}&`}mode=allocations`;
  return renderApp(`/capacity${tabbed}`);
}

const grid = () => screen.findByRole("grid", { name: "Allocations by month" });

const rowOf = (name: string) =>
  screen.getByText(name).closest("tr") as HTMLElement;

const address = (history: ReturnType<typeof renderApp>) =>
  decodeURIComponent(history.location.search);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${gridNow}T12:00:00Z`));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Capacity's Allocations", () => {
  it("shows each person's and planned hire's features with their percentages", async () => {
    // Given Casey on Checkout at 50% in March and April 2027, and Payments tester at 100% from
    // April 2027, the month it is expected
    openAllocations();
    await grid();

    // Then Casey's two months show the feature, under a whole month by half, and every later month
    // is not allocated
    const casey = within(rowOf("Casey Fictional"));
    expect(casey.getAllByText("Checkout")).toHaveLength(2);
    expect(casey.getAllByText("\u221250%")).toHaveLength(2);
    expect(casey.getAllByText("Not allocated")).toHaveLength(
      monthsBetween("2027-05", "2028-02").length,
    );
    // And the planned hire shows a whole month from April 2027 to February 2028, the last shown
    expect(within(rowOf("Payments tester")).getAllByText("100%")).toHaveLength(
      monthsBetween("2027-04", "2028-02").length,
    );
  });

  it("heads the total rows with their unit", async () => {
    openAllocations();
    await grid();

    expect(
      screen.getByRole("rowheader", { name: "Organization, person-months" }),
    ).toBeDefined();
  });

  it("groups only by feature team, saying nothing, for those who do not see Confidential data", async () => {
    openAllocations("", { permissions: seesAllocations });
    await grid();

    expect(screen.queryByText(/needs Confidential access/u)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Group by" }));
    expect(
      await screen.findByRole("menuitem", { name: /Feature team/u }),
    ).toBeDefined();
    expect(screen.queryByRole("menuitem", { name: /Manager/u })).toBeNull();
  });

  it("says when the allocations could not load, and tries again", async () => {
    let answers = 0;
    openAllocations("", {
      allocationsAnswer: () => {
        answers += 1;
        return answers === 1
          ? Response.json({}, { status: 500 })
          : Response.json(allocations);
      },
    });

    await screen.findByText("Fathom could not load the allocations.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await grid()).toBeDefined();
  });

  describe("with a draft taking Casey off Checkout", () => {
    const drafted: Allocations = {
      ...allocations,
      allocations: allocations.allocations.map((allocation) =>
        allocation.id === "a-1"
          ? {
              ...allocation,
              draft: {
                action: "deleted" as const,
                state: "waiting" as const,
                months: {},
                madeBy: "Engineering Manager",
                madeAt: null,
              },
            }
          : allocation,
      ),
    };

    it("marks the feature with Live's dot in the Live row", async () => {
      openAllocations("", {
        allocationsAnswer: () => Response.json(drafted),
      });
      await grid();

      const [draftRow] = screen
        .getAllByText("Casey Fictional")
        .map((name) => name.closest("tr") as HTMLElement)
        .filter((row) => row.getAttribute("aria-hidden") === null);
      const live = draftRow?.nextElementSibling as HTMLElement;
      expect(live.getAttribute("aria-hidden")).toBe("true");
      expect(within(live).getAllByText(", live")).toHaveLength(2);
    });

    it("marks the feature live only, naming the change", async () => {
      openAllocations("?show=live", {
        allocationsAnswer: () => Response.json(drafted),
      });
      await grid();

      expect(
        rowOf("Casey Fictional").querySelectorAll(
          '[data-tip="Live. Its removal is waiting for approval."]',
        ),
      ).toHaveLength(2);
    });
  });

  it("counts people and planned hires apart in Metrics", async () => {
    openAllocations();
    await grid();

    await userEvent.click(screen.getByRole("button", { name: "Metrics" }));

    expect(
      (await screen.findByRole("region", { name: "Metrics" })).textContent,
    ).toMatch(/people and 1 planned hire/u);
  });

  it("opens no cell for editing", async () => {
    openAllocations();
    await grid();

    expect(
      recordCell("p-casey", "2027-03")?.getAttribute("aria-readonly"),
    ).toBe("true");
  });
});

const tab = (name: string) => screen.getByRole("tab", { name });

describe("Allocations kept to those over or under", () => {
  // Avery is over in April, on Checkout and Billing, and not allocated in March and from May; Casey
  // is under in March; Blair, and the planned hire from April, have a whole month throughout.
  const avery = (featureId: string, at: number) => ({
    id: `a-avery-${String(at)}`,
    personId: "p-avery",
    plannedHireId: null,
    featureId,
    months: { "2027-04": 75, "2027-05": null },
  });
  const loads = () =>
    Response.json({
      allocations: [
        ...allocations.allocations,
        avery("f-checkout", 0),
        avery("f-billing", 1),
        {
          id: "a-blair",
          personId: "p-blair",
          plannedHireId: null,
          featureId: "f-checkout",
          months: { "2027-03": 100 },
        },
      ],
      features: [
        ...allocations.features,
        {
          id: "f-billing",
          name: "Billing",
          meaning: "in-progress",
          colour: null,
        },
      ],
    });

  it("keeps only the row over in a month from the current one on once Over is chosen, keeping it in the address", async () => {
    // Given Allocations, with Avery alone over
    const history = openAllocations("", { allocationsAnswer: loads });
    await grid();

    // When Over is chosen in the Views menu
    await userEvent.click(screen.getByRole("button", { name: "Views" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Over (1)" }),
    );

    // Then Avery alone shows, without the person under or the planned hire, and the address keeps
    // the choice
    await waitFor(() => {
      expect(screen.queryByText("Casey Fictional")).toBeNull();
    });
    expect(screen.queryByText("Payments tester")).toBeNull();
    expect(rowOf("Avery Fictional")).toBeDefined();
    expect(address(history)).toContain("over=shown");
  });

  it("opens on the rows under or not allocated, as the address keeps them, leaving out a whole month", async () => {
    openAllocations("?under=shown", { allocationsAnswer: loads });
    await grid();

    await userEvent.click(
      screen.getByRole("button", { name: "Views, changed" }),
    );
    expect(
      await screen.findByRole("menuitem", { name: "Under (2), chosen" }),
    ).toBeDefined();
    expect(rowOf("Casey Fictional")).toBeDefined();
    expect(
      screen.queryByText("Blair Fictional", { selector: "td *" }),
    ).toBeNull();
  });

  it("keeps every row on Feature teams, which has no such choices", async () => {
    openAllocations("?mode=feature-teams&over=shown", {
      allocationsAnswer: loads,
    });

    await screen.findByRole("grid", { name: "Feature teams by month" });
    expect(await screen.findByText("Casey Fictional")).toBeDefined();
  });
});

describe("Allocations kept to what someone is allocated to", () => {
  // Casey and the planned hire each on a feature the role can't read.
  const onUnseen = (first: string, second: string) => () => {
    const unseen = (id: string) => ({
      id,
      name: "A feature",
      meaning: "in-progress" as const,
      colour: null,
      unseen: true as const,
    });
    return Response.json({
      allocations: [
        { ...allocations.allocations[0], featureId: first },
        { ...allocations.allocations[1], featureId: second },
      ],
      features: [unseen(first), unseen(second)],
    });
  };

  it("offers features the role can't read as one choice, keeping everyone on any of them", async () => {
    const history = openAllocations("", {
      allocationsAnswer: onUnseen("f-hidden-1", "f-hidden-2"),
    });
    await grid();

    // When the one choice for them is chosen from the Allocations button
    await userEvent.click(screen.getByRole("button", { name: "Allocations" }));
    const filter = await screen.findByRole("dialog", {
      name: "Filter Allocated to",
    });
    const choices = within(filter).getAllByRole("checkbox", {
      name: "A feature",
    });
    expect(choices).toHaveLength(1);
    await userEvent.click(choices[0] as HTMLElement);

    // Then both stay, and nobody else, and the address keeps the one choice
    await waitFor(() => {
      expect(screen.queryByText("Avery Fictional")).toBeNull();
    });
    expect(rowOf("Casey Fictional")).toBeDefined();
    expect(rowOf("Payments tester")).toBeDefined();
    expect(address(history)).toContain(unseenFeatureChoice);
  });

  it("keeps a filter on features the role can't read, whichever such features there are", async () => {
    // Given the one choice kept in the address, and other hidden features than when it was chosen
    openAllocations(
      `?filters=${JSON.stringify({ [anyMonthKey]: { any: [unseenFeatureChoice] } })}`,
      { allocationsAnswer: onUnseen("f-hidden-3", "f-hidden-4") },
    );
    await grid();

    // Then everyone on any of them stays, and nobody else
    await waitFor(() => {
      expect(screen.queryByText("Avery Fictional")).toBeNull();
    });
    expect(rowOf("Casey Fictional")).toBeDefined();
    expect(rowOf("Payments tester")).toBeDefined();
    expect(
      screen.getByText(/^Allocated to:/).closest(".mantine-Pill-root")
        ?.textContent,
    ).toBe("Allocated to: A feature");
  });

  it("keeps the rows on a feature chosen from the Allocations button, in any month, keeping it in the address", async () => {
    // Given Allocations, with Casey and the planned hire on Checkout
    const history = openAllocations();
    await grid();

    // When Checkout is chosen from the Allocations button
    await userEvent.click(screen.getByRole("button", { name: "Allocations" }));
    const filter = await screen.findByRole("dialog", {
      name: "Filter Allocated to",
    });
    await userEvent.click(
      within(filter).getByRole("checkbox", { name: "Checkout" }),
    );

    // Then only they show, the pill names the filter, and the address keeps it
    await waitFor(() => {
      expect(screen.queryByText("Avery Fictional")).toBeNull();
    });
    expect(rowOf("Casey Fictional")).toBeDefined();
    expect(rowOf("Payments tester")).toBeDefined();
    expect(
      screen.getByText(/^Allocated to:/).closest(".mantine-Pill-root")
        ?.textContent,
    ).toBe("Allocated to: Checkout");
    expect(address(history)).toContain(anyMonthKey);

    // And Save view names the filter among what the view includes
    await userEvent.click(
      screen.getByRole("button", { name: "Views, changed" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Save view…" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Save view" });
    expect(within(dialog).getByText("Allocated to: Checkout")).toBeDefined();
  });

  it("applies a saved view keeping a feature, reading as unchanged", async () => {
    // Given a saved view kept to Checkout
    const saved = {
      id: "00000000-0000-4000-8000-0000000000a4",
      name: "On Checkout",
      scope: "shared",
      definition: { filters: { [anyMonthKey]: { any: ["f-checkout"] } } },
      canChange: true,
      canShare: true,
    };
    serverAnswers({
      "GET /api/session": session(seesAllocations),
      [monthsUrl]: () => Response.json(fictionalTeamMonths),
      "GET /api/allocations": () => Response.json(allocations),
      "GET /api/org-chart": () => Response.json(chart),
      "GET /api/views/capacity": () => Response.json([saved]),
    });
    renderApp("/capacity?mode=allocations");
    await grid();

    // When it is chosen in the Views menu
    await userEvent.click(screen.getByRole("button", { name: "Views" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /^On Checkout/u }),
    );

    // Then the rows are kept to Checkout, under the view's own name
    await waitFor(() => {
      expect(screen.queryByText("Avery Fictional")).toBeNull();
    });
    expect(
      screen.getByRole("button", { name: "Views: On Checkout" }),
    ).toBeDefined();
  });
});

describe("the tabs of the Capacity page", () => {
  it("opens on Feature teams for a role that sees every tab", async () => {
    const history = openAllocations("?mode=feature-teams");
    await screen.findByRole("grid", { name: "Feature teams by month" });

    expect(
      ["Feature teams", "Allocations", "Settings"].map((name) =>
        tab(name).getAttribute("aria-selected"),
      ),
    ).toEqual(["true", "false", "false"]);
    expect(address(history)).toBe("?mode=feature-teams");
  });

  it("switches to Settings and back, kept in the address", async () => {
    const history = openAllocations();
    await grid();

    await userEvent.click(tab("Settings"));
    await screen.findByText("Hours a day", { selector: "dt" });
    expect(address(history)).toBe("?mode=settings");

    await userEvent.click(tab("Allocations"));
    await grid();
    expect(address(history)).toBe("?mode=allocations");
  });

  it("keeps the tab as the view changes", async () => {
    const history = openAllocations();
    await grid();

    await userEvent.type(
      screen.getByRole("textbox", { name: "Search people" }),
      "Casey",
    );

    await waitFor(() => {
      expect(address(history)).toBe("?search=Casey&mode=allocations");
    });
  });

  it("opens Allocations for People, its name before", async () => {
    const history = openAllocations("?mode=people");
    await grid();

    expect(tab("Allocations").getAttribute("aria-selected")).toBe("true");
    expect(address(history)).toBe("?mode=allocations");
  });

  it("keeps the tab shown in the address, not one the role doesn't see", async () => {
    const history = openAllocations("?mode=settings", {
      permissions: seesAllocations,
    });
    await screen.findByRole("grid", { name: "Feature teams by month" });

    await userEvent.type(
      screen.getByRole("textbox", { name: "Search people" }),
      "Casey",
    );

    await waitFor(() => {
      expect(address(history)).toBe("?search=Casey&mode=feature-teams");
    });
  });

  it("shows Settings alone, with no tabs, to a role that sees only configuration", async () => {
    openAllocations("", {
      permissions: ["configuration:view", "people:view"],
    });

    await screen.findByText("Hours a day", { selector: "dt" });
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("grid")).toBeNull();
  });

  it("offers Allocations only with the feature teams and people its grid reads", async () => {
    openAllocations("", {
      permissions: ["allocations:view", "personal:view", "configuration:view"],
    });

    await screen.findByText("Hours a day", { selector: "dt" });
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("is not there for a role that sees no tab", async () => {
    openAllocations("", {
      permissions: ["allocations:view", "feature-teams:view", "people:view"],
    });

    expect(
      await screen.findByText("There is no page at this address."),
    ).toBeDefined();
  });
});

describe("Feature assignments' old addresses", () => {
  const answered = () => {
    serverAnswers({
      "GET /api/session": session(seesAllocations),
      [monthsUrl]: () => Response.json(fictionalTeamMonths),
      "GET /api/allocations": () => Response.json(allocations),
      "GET /api/org-chart": () => Response.json(chart),
    });
  };

  it("opens Allocations for its Allocations mode, with the same view", async () => {
    answered();
    const history = renderApp(
      "/feature-assignments?mode=allocations&grouping=feature-team",
    );

    await waitFor(() => {
      expect(history.location.pathname).toBe("/capacity");
    });
    expect(address(history)).toBe("?grouping=feature-team&mode=allocations");
    expect(await grid()).toBeDefined();
  });

  it("opens Feature teams for the page itself", async () => {
    answered();
    const history = renderApp("/feature-assignments");

    await waitFor(() => {
      expect(history.location.pathname).toBe("/capacity");
    });
    expect(address(history)).toBe("?mode=feature-teams");
  });
});

describe("Capacity's saved views", () => {
  it("applies a saved view, keeping the mode in the address", async () => {
    // Given a saved view of Casey alone
    const saved = {
      id: "00000000-0000-4000-8000-0000000000a3",
      name: "Casey",
      scope: "shared",
      definition: { search: "Casey" },
      canChange: true,
      canShare: true,
    };
    serverAnswers({
      "GET /api/session": session([...seesAllocations, "configuration:view"]),
      [monthsUrl]: () => Response.json(fictionalTeamMonths),
      "GET /api/allocations": () => Response.json(allocations),
      "GET /api/org-chart": () => Response.json(chart),
      "GET /api/views/capacity": () => Response.json([saved]),
    });
    const history = renderApp("/capacity?mode=allocations");
    await grid();

    // When it is chosen in the Views menu
    await userEvent.click(screen.getByRole("button", { name: "Views" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /^Casey/u }),
    );

    // Then the view and the mode are both in the address, and Casey is shown alone
    await waitFor(() => {
      expect(address(history)).toBe(
        `?search=Casey&view=${saved.id}&mode=allocations`,
      );
    });
    expect(screen.queryByText("Payments tester")).toBeNull();
  });

  it.each([
    ["edits allocations", ["allocations:edit"], true],
    ["only changes configuration", ["configuration:edit"], false],
  ] as const)(
    "offers the choice of sharing a view to a role that %s: %s",
    async (_role, more, offered) => {
      serverAnswers({
        "GET /api/session": session([
          ...seesAllocations,
          "configuration:view",
          ...more,
        ]),
        [monthsUrl]: () => Response.json(fictionalTeamMonths),
        "GET /api/allocations": () => Response.json(allocations),
        "GET /api/org-chart": () => Response.json(chart),
        "GET /api/views/capacity": () => Response.json([]),
      });
      renderApp("/capacity?mode=allocations&search=Casey");
      await grid();

      await userEvent.click(
        await screen.findByRole("button", { name: /^Views/u }),
      );
      await userEvent.click(
        await screen.findByRole("menuitem", { name: "Save view…" }),
      );

      const dialog = await screen.findByRole("dialog", { name: "Save view" });
      expect(
        within(dialog).queryByRole("checkbox", {
          name: "Share with everyone who sees this page",
        }) !== null,
      ).toBe(offered);
    },
  );

  it("offers no Views menu on Settings, though Allocations' view has changed", async () => {
    openAllocations("?mode=settings&search=Casey");

    await screen.findByText("Hours a day", { selector: "dt" });
    expect(screen.queryByRole("button", { name: /^Views/u })).toBeNull();
  });
});
