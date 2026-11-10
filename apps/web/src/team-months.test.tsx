// SPDX-License-Identifier: Apache-2.0

// Tests for feature teams month by month as a table of records: the months shown around today, what
// a table that never changes anything answers, and a person's months as drafts change them.

import type { TeamMonths } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  featureTeamGrouping,
  gridMonthsAround,
  noTeamMonthActions,
  personDraft,
  teamMonthRecords,
  teamMonthsTable,
} from "./team-months.tsx";

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
  );

  it("is never asked to change anything, and has nothing to say if it were", () => {
    expect(table.request([], "")).toEqual({});
    expect(table.newRowLabel("")).toBe("");
    expect(table.drafts([]).people).toEqual([]);
    expect(table.liveRecords([])).toEqual([]);
    expect(table.draftFields({} as never, {} as never, [], [])).toEqual([]);
    expect(table.recordProblem({}, () => [])).toBeUndefined();
    expect(table.removeLabel({} as never)).toBe("");
    expect(() => {
      (noTeamMonthActions.add as () => void)();
    }).not.toThrow();
  });

  it("names a row by its person", () => {
    expect(table.nameOf({ name: "Avery Fictional" } as never)).toBe(
      "Avery Fictional",
    );
  });
});

describe("the draft of a person's row", () => {
  const waiting = {
    teamId: "t1",
    action: "changed" as const,
    state: "waiting" as const,
  };

  it("waits while every team draft does", () => {
    expect(personDraft([waiting, { ...waiting, teamId: "t2" }])).toEqual({
      state: "waiting",
    });
  });

  it("is rejected while any team draft is", () => {
    expect(
      personDraft([waiting, { ...waiting, teamId: "t2", state: "rejected" }]),
    ).toEqual({ state: "rejected" });
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
    const table = teamMonthsTable(data, true, "both");

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
      teamMonthsTable(data, true, show)
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
