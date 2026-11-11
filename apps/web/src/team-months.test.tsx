// SPDX-License-Identifier: Apache-2.0

// Tests for feature teams month by month as a table of records: the months shown around today, what
// the table answers for whole records, which months can be changed, what a cell's change asks for and
// shows at once, and a person's months as drafts change them.

import type { TeamMonths } from "@fathom/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  featureTeamGrouping,
  gridMonthsAround,
  monthChange,
  noWholeRecordActions,
  type PersonMonths,
  personDraft,
  teamMonthRecords,
  teamMonthsTable,
  useTeamMonthActions,
  withMonthChange,
} from "./team-months.tsx";
import { serverAnswers } from "./test-support.tsx";

const edits = { today: "2027-03-10", changesDates: false };

describe("gridMonthsAround", () => {
  it("is twelve months back to eleven ahead of the current month", () => {
    expect(gridMonthsAround("2027-03-10")).toEqual({
      from: "2026-03",
      to: "2028-02",
    });
  });
});

describe("the table", () => {
  const table = teamMonthsTable(
    { months: [], teams: [], people: [] },
    false,
    "both",
    edits,
  );

  it("is never asked to add or remove records, and has nothing to say if it were", () => {
    expect(table.request([], "")).toEqual({});
    expect(table.newRowLabel("")).toBe("");
    expect(table.drafts([]).people).toEqual([]);
    expect(table.liveRecords([])).toEqual([]);
    expect(table.draftFields({} as never, {} as never, [], [])).toEqual([]);
    expect(table.recordProblem({}, () => [])).toBeUndefined();
    expect(table.removeLabel({} as never)).toBe("");
    expect(() => {
      (noWholeRecordActions.add as () => void)();
    }).not.toThrow();
  });

  it("names a row by its person", () => {
    expect(table.nameOf({ name: "Avery Fictional" } as never)).toBe(
      "Avery Fictional",
    );
  });

  it("names a row with no name by nothing, having no stand-in", () => {
    expect(table.nameOf({ name: "" } as never)).toBe("");
  });
});

describe("the draft of a person's row", () => {
  const waiting = { state: "waiting" as const };

  it("waits while every team draft does", () => {
    expect(personDraft([waiting, waiting])).toEqual({ state: "waiting" });
  });

  it("is rejected while any team draft is", () => {
    expect(personDraft([waiting, { state: "rejected" }])).toEqual({
      state: "rejected",
    });
  });

  it("is the reader's own while any team draft holds their unpublished changes", () => {
    expect(personDraft([waiting, { ...waiting, unpublished: true }])).toEqual({
      state: "waiting",
      unpublished: true,
    });
  });
});

describe("a person's months as drafts change them", () => {
  const search = { id: "t-search", name: "Search", colour: null };
  const mobile = { id: "t-mobile", name: "Mobile apps", colour: null };
  const data: TeamMonths = {
    months: ["2027-03", "2027-04"],
    teams: [search, mobile],
    people: [
      {
        id: "p-casey",
        preferredName: "Casey Fictional",
        manager: null,
        teams: { "2027-03": [search.id], "2027-04": [search.id] },
        drafted: {
          teams: { "2027-04": [mobile.id] },
          by: [mobile.id, search.id],
        },
      },
    ],
    drafts: [
      { teamId: mobile.id, action: "changed", state: "waiting" },
      { teamId: search.id, action: "changed", state: "rejected" },
    ],
  };

  it("marks the teams a draft adds and takes away, leaving other months as approved", () => {
    const [record] = teamMonthRecords(data, undefined, "both");

    expect(record?.teamsIn.get("2027-04")).toEqual([
      { ...mobile, drafted: "added", addedBy: { state: "rejected" } },
      { ...search, drafted: "removed" },
    ]);
    expect(record?.teamsIn.get("2027-03")).toEqual([search]);
    expect(record?.values).toEqual({
      "2027-03": [search.id],
      "2027-04": [mobile.id],
    });
    expect(record?.draft).toMatchObject({
      action: "changed",
      changed: ["2027-04"],
      live: { values: data.people[0]?.teams },
      state: "rejected",
    });
  });

  it("leaves a team a draft keeps unmarked, and marks one added to a month with none", () => {
    const [record] = teamMonthRecords(
      {
        ...data,
        people: [
          {
            id: "p-dana",
            preferredName: "Dana Fictional",
            manager: null,
            teams: { "2027-04": [search.id] },
            drafted: {
              teams: {
                "2027-03": [mobile.id],
                "2027-04": [mobile.id, search.id],
              },
              by: [mobile.id],
            },
          },
        ],
      },
      undefined,
      "both",
    );

    const added = {
      ...mobile,
      drafted: "added",
      addedBy: { state: "waiting" },
    };
    expect(record?.teamsIn.get("2027-03")).toEqual([added]);
    expect(record?.teamsIn.get("2027-04")).toEqual([added, search]);
  });

  it("keeps the person as approved for the Live row", () => {
    const [record] = teamMonthRecords(data, undefined, "both");
    const table = teamMonthsTable(data, true, "both", edits);

    const [live] = table.liveRecords(record === undefined ? [] : [record]);

    expect(live?.draft).toBeUndefined();
    expect(live?.teamsIn.get("2027-04")).toEqual([search]);
  });

  describe("grouped by feature team, as the Draft menu shows the teams", () => {
    // Moved from Search to Mobile apps in the only month shown.
    const moved: TeamMonths = {
      ...data,
      months: ["2027-04"],
      people: [
        {
          id: "p-casey",
          preferredName: "Casey Fictional",
          manager: null,
          teams: { "2027-04": [search.id] },
          drafted: {
            teams: { "2027-04": [mobile.id] },
            by: [mobile.id, search.id],
          },
        },
      ],
    };
    const groupsOf = (show: "both" | "drafts" | "live") =>
      teamMonthRecords(moved, featureTeamGrouping, show).map(
        ({ id, group, live }) => [id, group?.id, live?.id],
      );

    it("lists someone under the teams a draft adds and takes away beside live, with the live copy under each", () => {
      expect(groupsOf("both")).toEqual([
        [`${mobile.id} p-casey`, mobile.id, `${mobile.id} p-casey`],
        [`${search.id} p-casey`, search.id, `${search.id} p-casey`],
      ]);
    });

    it("lists someone only under the teams the drafts leave them on once applied", () => {
      expect(groupsOf("drafts")).toEqual([
        [`${mobile.id} p-casey`, mobile.id, `${mobile.id} p-casey`],
      ]);
    });

    it("lists someone only under their approved teams with live only", () => {
      expect(groupsOf("live")).toEqual([
        [`${search.id} p-casey`, search.id, `${search.id} p-casey`],
      ]);
    });
  });

  it("leaves out a team a draft removes once drafts are applied, striking it through beside live", () => {
    const [record] = teamMonthRecords(data, undefined, "both");
    const month = (show: "both" | "drafts") =>
      teamMonthsTable(data, true, show, edits)
        .columnsFor([], [], [], [])
        .find(({ key }) => key === "2027-04");

    expect(month("drafts")?.content?.(record as never)).toMatchObject({
      props: { teams: [{ ...mobile, drafted: "added" }] },
    });
    expect(month("both")?.content?.(record as never)).toMatchObject({
      props: {
        teams: [
          { ...mobile, drafted: "added" },
          { ...search, drafted: "removed" },
        ],
      },
    });
  });
});

describe("the months that can be changed", () => {
  const data: TeamMonths = {
    months: ["2027-02", "2027-03", "2027-04"],
    teams: [],
    people: [],
  };
  const readOnly = (changesDates: boolean) =>
    teamMonthsTable(data, true, "both", { ...edits, changesDates })
      .columnsFor([], [], [], [])
      .map(({ key, readOnly: fixed }) => [key, fixed]);

  it("are the current month and later, never the person", () => {
    expect(readOnly(false)).toEqual([
      ["name", true],
      ["2027-02", true],
      ["2027-03", false],
      ["2027-04", false],
    ]);
  });

  it("include earlier months for those who may change Personal details", () => {
    expect(readOnly(true)).toEqual([
      ["name", true],
      ["2027-02", false],
      ["2027-03", false],
      ["2027-04", false],
    ]);
  });
});

describe("a cell's change", () => {
  const record = {
    id: "t-search p-casey",
    personId: "p-casey",
    values: { "2027-04": ["t-search", "t-web"] },
  } as unknown as PersonMonths;

  it("adds and removes teams from the first of a later month", () => {
    expect(
      monthChange(
        record,
        { values: { "2027-04": ["t-mobile", "t-web"] } },
        "2027-03-10",
      ),
    ).toEqual({
      month: "2027-04",
      request: {
        add: ["t-mobile"],
        remove: ["t-search"],
        from: "2027-04-01",
      },
    });
  });

  it("changes the current month from today, giving no day", () => {
    expect(
      monthChange(
        record,
        { values: { "2027-03": ["t-mobile"] } },
        "2027-03-10",
      ),
    ).toEqual({
      month: "2027-03",
      request: { add: ["t-mobile"], remove: [] },
    });
  });

  it("asks for nothing when the teams are as they were, or no month is given", () => {
    expect(
      monthChange(
        record,
        { values: { "2027-04": ["t-web", "t-search"] } },
        "2027-03-10",
      ),
    ).toBeUndefined();
    expect(monthChange(record, {}, "2027-03-10")).toBeUndefined();
  });
});

describe("changing a month's teams", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves nothing when the teams are as they were", () => {
    const fetch = serverAnswers({});
    const client = new QueryClient();
    const { result } = renderHook(
      () =>
        useTeamMonthActions({ from: "2027-03", to: "2027-04" }, "2027-03-10"),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );
    const record = {
      personId: "p-casey",
      values: { "2027-04": ["t-search"] },
    } as unknown as PersonMonths;

    result.current.update(record, { values: { "2027-04": ["t-search"] } });

    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("the months shown at once while a change saves", () => {
  const data: TeamMonths = {
    months: ["2027-03", "2027-04", "2027-05"],
    teams: [],
    people: [
      {
        id: "p-casey",
        preferredName: "Casey Fictional",
        manager: null,
        teams: { "2027-03": ["t-search"], "2027-04": ["t-search"] },
        drafted: { teams: { "2027-05": [] }, by: ["t-search"] },
      },
      {
        id: "p-avery",
        preferredName: "Avery Fictional",
        manager: null,
        teams: { "2027-04": ["t-web"] },
      },
    ],
    drafts: [{ teamId: "t-search", action: "changed", state: "waiting" }],
  };

  it("changes that month and every later one as the person's own draft, leaving others as they were", () => {
    const shown = withMonthChange(data, "p-casey", "2027-04", {
      add: ["t-mobile"],
      remove: ["t-search"],
    });

    expect(shown.people[0]?.drafted).toEqual({
      teams: { "2027-04": ["t-mobile"], "2027-05": ["t-mobile"] },
      by: ["t-search", "t-mobile"],
    });
    expect(shown.people[1]).toBe(data.people[1]);
    expect(shown.drafts).toEqual([
      { teamId: "t-search", action: "changed", state: "waiting" },
      {
        teamId: "t-mobile",
        action: "changed",
        state: "waiting",
        unpublished: true,
      },
    ]);
  });

  it("starts a draft for someone with none", () => {
    const shown = withMonthChange(
      { months: data.months, teams: data.teams, people: data.people },
      "p-avery",
      "2027-05",
      { add: [], remove: ["t-web"] },
    );

    expect(shown.people[1]?.drafted).toEqual({
      teams: { "2027-05": [] },
      by: ["t-web"],
    });
  });
});
