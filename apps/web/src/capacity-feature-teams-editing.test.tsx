// SPDX-License-Identifier: Apache-2.0

// Tests for changing a month's teams on Capacity's Feature teams tab: from which day a change takes
// effect, undoing it, who may change which months, and a planned hire's months.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  answer,
  featureTeamsAt,
  reader,
  session,
} from "./test-feature-teams.tsx";
import {
  bodyOf,
  fictionalTeamMonths,
  gridNow,
  mobile,
  monthsUrl,
  platform,
  renderApp,
} from "./test-support.tsx";

const months = fictionalTeamMonths;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${gridNow}T12:00:00Z`));
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
    const fetch = answer({
      "GET /api/session": permissions,
      [monthsUrl]: () => Response.json(months),
      [`PATCH ${caseyUrl}`]: () => Response.json({ changeSetId: saved }),
      [`POST /api/undo/${saved}`]: () => Response.json({ changeSetId: undone }),
    });
    renderApp(featureTeamsAt(search));
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

describe("changing a planned hire's months", () => {
  const hireUrl = "/api/feature-teams/members/h-tester";
  const chart = {
    people: [
      {
        id: "h-tester",
        keyNumber: 2,
        preferredName: "Fictional Tester, TBD-7",
        employeeId: null,
        position: "Fictional Tester",
        teamName: null,
        teamColour: null,
        managerId: null,
        planned: { expected: "2027-05", shownId: "TBD-7" },
      },
    ],
    drafted: [],
  };

  async function openHire(
    saved: () => Response = () => Response.json({ changeSetId: null }),
  ) {
    const fetch = answer({
      "GET /api/session": session(["feature-teams:view", "feature-teams:edit"]),
      [monthsUrl]: () =>
        Response.json({
          ...months,
          hires: [{ id: "h-tester", teams: { "2027-04": [mobile.id] } }],
        }),
      "GET /api/org-chart": () => Response.json(chart),
      [`PATCH ${hireUrl}`]: saved,
    });
    renderApp(featureTeamsAt());
    await screen.findByText("Fictional Tester, TBD-7");
    return fetch;
  }

  const hireCell = (month: string) =>
    document.getElementById(`cell-h-tester-${month}`) as HTMLElement;

  it("adds a team from the first day of the month it's expected", async () => {
    const fetch = await openHire();
    act(() => {
      hireCell("2027-05").focus();
    });

    await userEvent.keyboard("mob");
    await screen.findByRole("option", { name: "Mobile apps" });
    await userEvent.keyboard("{Tab}");

    expect(bodyOf(fetch, "PATCH", hireUrl)).toEqual([
      { add: [mobile.id], remove: [], from: "2027-05-01" },
    ]);
  });

  it("changes nothing in a month before it's expected", async () => {
    const fetch = await openHire();
    act(() => {
      hireCell("2027-04").focus();
    });

    await userEvent.keyboard("mob");
    await userEvent.keyboard("{Tab}");

    expect(bodyOf(fetch, "PATCH", hireUrl)).toEqual([]);
  });

  it("says why a month before it's expected can't change, when the month has focus", async () => {
    await openHire();
    act(() => {
      hireCell("2027-04").focus();
    });
    expect((await screen.findByRole("tooltip")).textContent).toBe(
      "Can't join before May 2027",
    );
  });

  it("takes nothing away with Delete in a month before it's expected", async () => {
    const fetch = await openHire();
    act(() => {
      hireCell("2027-04").focus();
    });

    await userEvent.keyboard("{Delete}");

    expect(bodyOf(fetch, "PATCH", hireUrl)).toEqual([]);
    expect(within(hireCell("2027-04")).getByText(mobile.name)).toBeDefined();
  });

  it("names a planned hire with no name by its position and ID when a change fails", async () => {
    await openHire(() => Response.json({}, { status: 500 }));
    act(() => {
      hireCell("2027-05").focus();
    });

    await userEvent.keyboard("mob");
    await screen.findByRole("option", { name: "Mobile apps" });
    await userEvent.keyboard("{Tab}");

    expect(
      await screen.findByText(
        "Fathom could not change the feature teams of Fictional Tester, TBD-7.",
      ),
    ).toBeDefined();
  });
});

describe("a person's months outside their employment", () => {
  it("can't be changed, as the server would refuse them", async () => {
    answer({
      "GET /api/session": session([
        "people:view",
        "feature-teams:view",
        "feature-teams:edit",
        "personal:edit",
      ]),
      [monthsUrl]: () => Response.json(months),
    });
    renderApp(featureTeamsAt());
    await screen.findByRole("grid", { name: "Feature teams by month" });
    const avery = (month: string) =>
      document.getElementById(`cell-p-avery-${month}`) as HTMLElement;

    expect([
      avery("2026-03").getAttribute("aria-readonly"),
      avery("2026-04").hasAttribute("aria-readonly"),
    ]).toEqual(["true", false]);
    act(() => {
      avery("2026-03").focus();
    });
    expect((await screen.findByRole("tooltip")).textContent).toBe(
      "Not employed this month",
    );
  });
});
