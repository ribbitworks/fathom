// SPDX-License-Identifier: Apache-2.0

// Tests for building a person's timeline from its sources: its days in order, each day's changes in
// order, first values and changes, a change shared with others, and leaving, which ends feature teams
// without listing them again; and the days someone began and stopped leading a team.

import { describe, expect, it } from "vitest";
import {
  leadingDays,
  seenLines,
  type TimelineSources,
  timelineDays,
} from "./person-timeline.ts";

const team = { id: "t1", name: "Fictional Search" };
const ana = { id: "m1", name: "Fictional Ana" };
const ben = { id: "m2", name: "Fictional Ben" };

const sources = (more: Partial<TimelineSources> = {}): TimelineSources => ({
  start: null,
  end: null,
  fills: [],
  lines: [],
  memberships: [],
  leads: [],
  ...more,
});

describe("a person's timeline days", () => {
  it("lists each day once, earliest first, its changes in the order a day lists them", () => {
    const days = timelineDays(
      sources({
        start: "2025-02-03",
        fills: [{ day: "2024-12-09", hire: { id: "h1", name: "HIRE-42" } }],
        lines: [{ fromDate: "2025-02-03", manager: ana, others: 3 }],
        memberships: [{ fromDate: "2025-02-03", team, member: true }],
      }),
    );

    expect(days).toEqual([
      {
        day: "2024-12-09",
        changes: [{ field: "filled", value: { id: "h1", name: "HIRE-42" } }],
      },
      {
        day: "2025-02-03",
        changes: [
          { field: "start" },
          { field: "manager", value: ana },
          { field: "featureTeams", value: team, part: "added" },
        ],
      },
    ]);
  });

  it("gives a new manager what it changed from, with the others given the same, and none for no manager", () => {
    const days = timelineDays(
      sources({
        lines: [
          { fromDate: "2025-02-03", manager: ana, others: 0 },
          { fromDate: "2026-07-01", manager: ben, others: 11 },
          { fromDate: "2026-09-01", manager: null, others: 0 },
        ],
      }),
    );

    expect(days.map(({ changes }) => changes)).toEqual([
      [{ field: "manager", value: ana }],
      [{ field: "manager", value: ben, was: ana, others: 11 }],
      [{ field: "manager", value: null, was: ben }],
    ]);
  });

  it("lists End alone on the day someone leaves, not the teams and leads ending with them", () => {
    const days = timelineDays(
      sources({
        start: "2019-04-01",
        end: "2027-01-29",
        memberships: [
          { fromDate: "2019-04-01", team, member: true },
          { fromDate: "2027-01-29", team, member: false },
        ],
        leads: [
          { fromDate: "2026-03-02", team, leads: true },
          { fromDate: "2027-01-30", team, leads: false },
        ],
      }),
    );

    expect(days.at(-1)).toEqual({
      day: "2027-01-29",
      changes: [{ field: "end" }],
    });
    expect(days).toHaveLength(3);
  });

  it("lists a team left and a lead stopped before someone leaves", () => {
    const days = timelineDays(
      sources({
        end: "2027-01-29",
        memberships: [{ fromDate: "2026-03-02", team, member: false }],
        leads: [{ fromDate: "2026-03-02", team, leads: false }],
      }),
    );

    expect(days[0]?.changes).toEqual([
      { field: "featureTeams", value: team, part: "removed" },
      { field: "leads", value: team, part: "removed" },
    ]);
  });
});

describe("the days someone began and stopped leading a team", () => {
  const member = (fromDate: string, isMember = true, teamId = "t1") => ({
    teamId,
    member: isMember,
    fromDate,
  });

  it("begins with a record naming them and stops with the team's next, skipping records that change nothing for them", () => {
    expect(
      leadingDays(
        "p1",
        [
          { teamId: "t1", leadId: "p2", fromDate: "2024-01-01" },
          { teamId: "t1", leadId: "p1", fromDate: "2026-03-02" },
          { teamId: "t1", leadId: null, fromDate: "2027-01-04" },
          { teamId: "t1", leadId: "p3", fromDate: "2027-02-01" },
          { teamId: "t2", leadId: "p1", fromDate: "2025-05-05" },
        ],
        [member("2020-01-01"), member("2025-05-05", true, "t2")],
      ),
    ).toEqual([
      { teamId: "t1", fromDate: "2026-03-02", leads: true },
      { teamId: "t1", fromDate: "2027-01-04", leads: false },
      { teamId: "t2", fromDate: "2025-05-05", leads: true },
    ]);
  });

  it("counts a lead only while a member, as a team's lead is read on any day", () => {
    expect(
      leadingDays(
        "p1",
        [{ teamId: "t1", leadId: "p1", fromDate: "2026-01-05" }],
        [member("2026-03-02"), member("2026-09-14", false)],
      ),
    ).toEqual([
      { teamId: "t1", fromDate: "2026-03-02", leads: true },
      { teamId: "t1", fromDate: "2026-09-14", leads: false },
    ]);
  });
});

describe("the reporting lines a reader sees", () => {
  const lines = [
    { fromDate: "2021-01-04" },
    { fromDate: "2025-06-01" },
    { fromDate: "2099-01-01" },
  ];

  it("are those until today with Past managers, and those from a later day with Future reorganizations", () => {
    expect(seenLines(lines, "2025-06-01", { past: true, later: true })).toEqual(
      lines,
    );
    expect(
      seenLines(lines, "2025-06-01", { past: true, later: false }),
    ).toEqual(lines.slice(0, 2));
    expect(
      seenLines(lines, "2025-06-01", { past: false, later: true }),
    ).toEqual(lines.slice(2));
  });
});
