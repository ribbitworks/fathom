// SPDX-License-Identifier: Apache-2.0

// Tests for the Capacity page's People mode and its switch: each person's and planned hire's
// features with their percentages, grouping, the modes a role sees and the mode in the address, the
// old address of Feature assignments' Allocations mode, what it shows when it cannot load, its cells
// read only, and its saved views.

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
  features: [{ id: "f-checkout", name: "Checkout", meaning: "in-progress" }],
};

const chart: OrgChart = {
  people: [
    {
      id: "p-blair",
      preferredName: "Blair Fictional",
      employeeId: null,
      position: null,
      teamName: null,
      teamColour: null,
      managerId: null,
    },
    {
      id: "h-tester",
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

// What People reads: allocations, the feature teams' months and the org chart's planned hires, with
// the Personal details they need.
const seesPeople = [
  "allocations:view",
  "feature-teams:view",
  "people:view",
  "personal:view",
];

const session = (permissions: readonly string[]) => () =>
  Response.json({ ...fictionalUser, permissions });

function openPeople(
  search = "",
  {
    permissions = [...seesPeople, "confidential:view", "configuration:view"],
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
  return renderApp(`/capacity${search}`);
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

describe("Capacity's People mode", () => {
  it("shows each person's and planned hire's features with their percentages", async () => {
    // Given Casey on Checkout at 50% in March and April 2027, and Payments tester at 100% from
    // April 2027, the month it is expected
    openPeople();
    await grid();

    // Then Casey's two months show the feature, and every month from the current one on, March
    // 2027, is under a whole month, the empty ones included
    const casey = within(rowOf("Casey Fictional"));
    expect(casey.getAllByText("Checkout")).toHaveLength(2);
    expect(casey.getAllByText("Under")).toHaveLength(
      monthsBetween("2027-03", "2028-02").length,
    );
    // And the planned hire shows a whole month from April 2027 to February 2028, the last shown
    expect(within(rowOf("Payments tester")).getAllByText("100%")).toHaveLength(
      monthsBetween("2027-04", "2028-02").length,
    );
  });

  it("heads the total rows with their unit", async () => {
    openPeople();
    await grid();

    expect(
      screen.getByRole("rowheader", { name: "Organization, PM" }),
    ).toBeDefined();
  });

  it("groups only by feature team, saying nothing, for those who do not see Confidential data", async () => {
    openPeople("", { permissions: seesPeople });
    await grid();

    expect(screen.queryByText(/needs Confidential access/u)).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Group by: Feature team" }),
    );
    expect(
      await screen.findByRole("menuitem", { name: /None/u }),
    ).toBeDefined();
    expect(screen.queryByRole("menuitem", { name: /Manager/u })).toBeNull();
  });

  it("says when the allocations could not load, and tries again", async () => {
    let answers = 0;
    openPeople("", {
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
      openPeople("?grouping=none", {
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
      openPeople("?grouping=none&show=live", {
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

  it("opens no cell for editing", async () => {
    openPeople();
    await grid();

    expect(
      recordCell("p-casey", "2027-03")?.getAttribute("aria-readonly"),
    ).toBe("true");
  });
});

describe("the modes of the Capacity page", () => {
  it("opens on People, and switches to Settings and back, kept in the address", async () => {
    const history = openPeople();
    await grid();
    expect(
      screen.getByRole<HTMLInputElement>("radio", { name: "People" }).checked,
    ).toBe(true);

    await userEvent.click(screen.getByRole("radio", { name: "Settings" }));
    await screen.findByText("Hours a day", { selector: "dt" });
    expect(address(history)).toBe("?mode=settings");

    await userEvent.click(screen.getByRole("radio", { name: "People" }));
    await grid();
    expect(address(history)).toBe("?mode=people");
  });

  it("keeps the mode as the view changes", async () => {
    const history = openPeople("?mode=people");
    await grid();

    await userEvent.type(
      screen.getByRole("textbox", { name: "Search people" }),
      "Casey",
    );

    await waitFor(() => {
      expect(address(history)).toBe("?search=Casey&mode=people");
    });
  });

  it("keeps the mode shown in the address, not one the role doesn't see", async () => {
    const history = openPeople("?mode=settings", { permissions: seesPeople });
    await grid();

    await userEvent.type(
      screen.getByRole("textbox", { name: "Search people" }),
      "Casey",
    );

    await waitFor(() => {
      expect(address(history)).toBe("?search=Casey&mode=people");
    });
  });

  it("shows Settings alone, with no switch, to a role that sees only configuration", async () => {
    openPeople("?mode=people", {
      permissions: ["configuration:view", "personal:view"],
    });

    await screen.findByText("Hours a day", { selector: "dt" });
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByRole("grid")).toBeNull();
  });

  it("offers People only with the feature teams and people its grid reads", async () => {
    openPeople("", {
      permissions: ["allocations:view", "personal:view", "configuration:view"],
    });

    await screen.findByText("Hours a day", { selector: "dt" });
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("shows People alone, with no switch, to a role that sees it without configuration", async () => {
    openPeople("", { permissions: seesPeople });

    await grid();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("is not there for a role that sees neither mode", async () => {
    openPeople("", {
      permissions: ["allocations:view", "feature-teams:view", "people:view"],
    });

    expect(
      await screen.findByText("There is no page at this address."),
    ).toBeDefined();
  });
});

describe("the old address of Feature assignments' Allocations mode", () => {
  it("opens Capacity's People mode with the same view", async () => {
    serverAnswers({
      "GET /api/session": session(seesPeople),
      [monthsUrl]: () => Response.json(fictionalTeamMonths),
      "GET /api/allocations": () => Response.json(allocations),
      "GET /api/org-chart": () => Response.json(chart),
    });
    const history = renderApp(
      "/feature-assignments?mode=allocations&grouping=feature-team",
    );

    await waitFor(() => {
      expect(history.location.pathname).toBe("/capacity");
    });
    expect(address(history)).toBe("?grouping=feature-team&mode=people");
    expect(await grid()).toBeDefined();
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
      "GET /api/session": session([...seesPeople, "configuration:view"]),
      [monthsUrl]: () => Response.json(fictionalTeamMonths),
      "GET /api/allocations": () => Response.json(allocations),
      "GET /api/org-chart": () => Response.json(chart),
      "GET /api/views/capacity": () => Response.json([saved]),
    });
    const history = renderApp("/capacity?mode=people");
    await grid();

    // When it is chosen in the Views menu
    await userEvent.click(screen.getByRole("button", { name: "Views" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /^Casey/u }),
    );

    // Then the view and the mode are both in the address, and Casey is shown alone
    await waitFor(() => {
      expect(address(history)).toBe(
        `?search=Casey&view=${saved.id}&mode=people`,
      );
    });
    expect(screen.queryByText("Payments tester")).toBeNull();
  });

  it("offers no Views menu on Settings, though People's view has changed", async () => {
    openPeople("?mode=settings&search=Casey");

    await screen.findByText("Hours a day", { selector: "dt" });
    expect(screen.queryByRole("button", { name: /^Views/u })).toBeNull();
  });
});
