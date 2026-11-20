// SPDX-License-Identifier: Apache-2.0

// Unit tests for making the monthly grid of feature teams from what was read: which months each
// person's teams are read on, who is listed, the months outside their employment, their managers,
// the teams' colours, and what the reader's drafts would change.

import { describe, expect, it } from "vitest";
import type { DraftedTeam } from "./feature-team-reads.ts";
import { teamMonthsFrom, type TeamMonthsRead } from "./team-months.ts";

const today = "2025-06-15";
const team = "00000000-0000-4000-8000-0000000000a1";
const otherTeam = "00000000-0000-4000-8000-0000000000a2";
const member = "00000000-0000-4000-8000-0000000000b1";
const manager = "00000000-0000-4000-8000-0000000000b2";
const secondManager = "00000000-0000-4000-8000-0000000000b3";
const addedTeam = "00000000-0000-4000-8000-0000000000a9";

const personRow = (
  id: string,
  dates: { startDate?: string | null; endDate?: string | null } = {},
) => ({
  id,
  preferredName: `Fictional ${id.slice(-2)}`,
  startDate: "2024-01-01",
  endDate: null,
  ...dates,
});

const joins = (fromDate: string, teamId = team, personId = member) => ({
  teamId,
  personId,
  member: true,
  fromDate,
});

const leaves = (fromDate: string, teamId = team, personId = member) => ({
  ...joins(fromDate, teamId, personId),
  member: false,
});

const draftOf = (
  action: DraftedTeam["action"],
  {
    teamId = team,
    state = "waiting",
    unpublished = false,
  }: {
    teamId?: string;
    state?: DraftedTeam["state"];
    unpublished?: boolean;
  } = {},
): DraftedTeam => ({
  teamId,
  name: "Fictional Drafted Team",
  action,
  state,
  unpublished,
});

function grid(
  read: Partial<TeamMonthsRead>,
  months: string[],
  byManager = true,
) {
  return teamMonthsFrom(
    {
      rows: [personRow(member)],
      lines: new Map(),
      teams: [{ id: team, name: "Fictional Team", colour: null }],
      memberships: [],
      drafts: { teams: [], records: [] },
      ...read,
    },
    { months, today, byManager },
  );
}

const rowOf = (made: ReturnType<typeof grid>, id = member) =>
  made.people.find((one) => one.id === id);

describe("the months a person's teams are read on", () => {
  it("reads a past month as of its first day", () => {
    const made = grid({ memberships: [joins("2025-01-15")] }, [
      "2025-01",
      "2025-02",
    ]);
    expect(rowOf(made)?.teams).toEqual({ "2025-02": [team] });
  });

  it("reads the current month as of today", () => {
    const made = grid(
      {
        memberships: [joins("2025-06-10"), joins("2025-06-20", otherTeam)],
      },
      ["2025-05", "2025-06"],
    );
    expect(rowOf(made)?.teams).toEqual({ "2025-06": [team] });
  });

  it("shows a planned change from the month it reaches", () => {
    const made = grid({ memberships: [joins("2099-02-01")] }, [
      "2099-01",
      "2099-02",
    ]);
    expect(rowOf(made)?.teams).toEqual({ "2099-02": [team] });
  });

  it("stops showing a team from the month after someone leaves it", () => {
    const made = grid(
      { memberships: [joins("2025-01-15"), leaves("2025-02-20")] },
      ["2025-02", "2025-03"],
    );
    expect(rowOf(made)?.teams).toEqual({ "2025-02": [team] });
  });

  it("gives every team someone is on in a month, sorted", () => {
    const made = grid(
      {
        memberships: [joins("2025-01-15", otherTeam), joins("2025-01-15")],
      },
      ["2025-02"],
    );
    expect(rowOf(made)?.teams).toEqual({ "2025-02": [team, otherTeam] });
  });

  it("leaves out what a draft would change", () => {
    const made = grid(
      {
        drafts: {
          teams: [draftOf("changed")],
          records: [joins("2025-01-15")],
        },
      },
      ["2025-02"],
    );
    expect(rowOf(made)?.teams).toEqual({});
  });
});

describe("who is listed, and the months outside their employment", () => {
  it("lists the months outside someone's employment, and no teams then", () => {
    const made = grid(
      {
        rows: [
          personRow(member, { startDate: "2025-02-10", endDate: "2025-03-20" }),
        ],
        memberships: [joins("2025-02-15")],
      },
      ["2025-01", "2025-02", "2025-03", "2025-04"],
    );
    expect(rowOf(made)?.outside).toEqual(["2025-01", "2025-04"]);
    expect(rowOf(made)?.teams).toEqual({ "2025-03": [team] });
  });

  it("leaves out a month read before someone starts", () => {
    const made = grid(
      {
        rows: [personRow(member, { startDate: "2025-02-10" })],
        memberships: [joins("2025-01-15")],
      },
      ["2025-02", "2025-03"],
    );
    expect(rowOf(made)?.teams).toEqual({ "2025-03": [team] });
  });

  it("leaves out a month read after someone leaves", () => {
    const made = grid(
      {
        rows: [personRow(member, { endDate: "2025-02-15" })],
        memberships: [joins("2025-01-15")],
      },
      ["2025-02", "2025-03"],
    );
    expect(rowOf(made)?.teams).toEqual({ "2025-02": [team] });
  });

  it("has no months outside employment for someone with no start date", () => {
    const made = grid({ rows: [personRow(member, { startDate: null })] }, [
      "2025-01",
      "2025-02",
    ]);
    expect(rowOf(made)?.outside).toBeUndefined();
  });

  it("lists no one employed in none of the months", () => {
    const made = grid(
      { rows: [personRow(member, { endDate: "2021-06-30" })] },
      ["2025-01", "2025-02"],
    );
    expect(rowOf(made)).toBeUndefined();
  });
});

describe("each person's managers", () => {
  const lines = new Map([
    [
      member,
      [
        { managerId: manager, fromDate: "2024-03-01" },
        { managerId: secondManager, fromDate: "2025-02-10" },
      ],
    ],
  ]);
  const rows = [
    personRow(member),
    personRow(manager),
    personRow(secondManager),
  ];

  it("names the manager today, and none for someone without one", () => {
    const made = grid({ rows, lines }, ["2025-01"]);
    expect(rowOf(made)?.manager).toEqual({
      id: secondManager,
      name: "Fictional b3",
    });
    expect(rowOf(made, manager)?.manager).toBeNull();
  });

  it("names the manager of someone who has not started, from their first line", () => {
    const made = grid(
      {
        rows: [
          personRow(member, { startDate: "2099-01-15" }),
          personRow(manager),
        ],
        lines: new Map([
          [member, [{ managerId: manager, fromDate: "2099-01-15" }]],
        ]),
      },
      ["2099-01"],
    );
    expect(rowOf(made)?.manager?.id).toBe(manager);
  });

  it("names whom someone reported to each month, for readers who group by manager", () => {
    const made = grid({ rows, lines }, ["2025-02", "2025-03"]);
    expect(rowOf(made)?.managers).toEqual({
      "2025-02": { id: manager, name: "Fictional b2" },
      "2025-03": { id: secondManager, name: "Fictional b3" },
    });
  });

  it("leaves out each month's managers for readers who don't group by manager", () => {
    const made = grid({ rows, lines }, ["2025-02", "2025-03"], false);
    expect(rowOf(made)?.managers).toBeUndefined();
  });
});

describe("the teams listed", () => {
  it("gives each live team's colour, and none for a colour no longer offered", () => {
    const made = grid(
      {
        teams: [
          { id: team, name: "Fictional Team", colour: "teal" },
          { id: otherTeam, name: "Fictional Other", colour: "retired" },
        ],
      },
      ["2025-02"],
    );
    expect(made.months).toEqual(["2025-02"]);
    expect(made.teams).toEqual([
      { id: team, name: "Fictional Team", colour: "teal" },
      { id: otherTeam, name: "Fictional Other", colour: null },
    ]);
  });
});

describe("what the reader's drafts would change", () => {
  it("shows a draft's change from the month it reaches, naming its team and draft", () => {
    const made = grid(
      {
        drafts: {
          teams: [draftOf("changed")],
          records: [joins("2025-02-15")],
        },
      },
      ["2025-02", "2025-03"],
    );
    expect(rowOf(made)?.drafted).toEqual({
      teams: { "2025-03": [team] },
      by: [team],
    });
    expect(made.drafts).toEqual([
      { teamId: team, action: "changed", state: "waiting" },
    ]);
  });

  it("shows someone leaving only in the months they would be gone", () => {
    const made = grid(
      {
        memberships: [joins("2025-01-15")],
        drafts: {
          teams: [draftOf("changed")],
          records: [leaves("2025-03-01")],
        },
      },
      ["2025-02", "2025-03"],
    );
    expect(rowOf(made)?.teams).toEqual({
      "2025-02": [team],
      "2025-03": [team],
    });
    expect(rowOf(made)?.drafted?.teams).toEqual({ "2025-03": [] });
  });

  it("lets a draft's record win over an approved one on the same day", () => {
    const made = grid(
      {
        memberships: [joins(today)],
        drafts: { teams: [draftOf("changed")], records: [leaves(today)] },
      },
      ["2025-06"],
    );
    expect(rowOf(made)?.drafted?.teams).toEqual({ "2025-06": [] });
  });

  it("lists a team drafted to be added by its name, with no colour", () => {
    const made = grid(
      {
        drafts: {
          teams: [draftOf("created", { teamId: addedTeam })],
          records: [joins("2025-01-15", addedTeam)],
        },
      },
      ["2025-02"],
    );
    expect(made.teams).toContainEqual({
      id: addedTeam,
      name: "Fictional Drafted Team",
      colour: null,
    });
    expect(rowOf(made)?.drafted?.teams).toEqual({ "2025-02": [addedTeam] });
    expect(made.drafts).toEqual([
      { teamId: addedTeam, action: "created", state: "waiting" },
    ]);
  });

  it("takes a team drafted to be removed out of every month", () => {
    const made = grid(
      {
        memberships: [joins("2025-01-15")],
        drafts: { teams: [draftOf("deleted")], records: [] },
      },
      ["2025-02", "2025-03"],
    );
    expect(rowOf(made)?.drafted?.teams).toEqual({
      "2025-02": [],
      "2025-03": [],
    });
    expect(made.drafts).toEqual([
      { teamId: team, action: "deleted", state: "waiting" },
    ]);
  });

  it("gives a draft's state, and marks the reader's own unpublished change", () => {
    const made = grid(
      {
        drafts: {
          teams: [
            draftOf("changed", { state: "rejected" }),
            draftOf("changed", { teamId: otherTeam, unpublished: true }),
          ],
          records: [joins("2025-02-15"), joins("2025-02-15", otherTeam)],
        },
      },
      ["2025-03"],
    );
    expect(made.drafts).toEqual([
      { teamId: team, action: "changed", state: "rejected" },
      {
        teamId: otherTeam,
        action: "changed",
        state: "waiting",
        unpublished: true,
      },
    ]);
  });

  it("leaves out a draft that changes no one's months, and a team added by it", () => {
    const made = grid(
      {
        drafts: {
          teams: [
            draftOf("changed"),
            draftOf("created", { teamId: addedTeam }),
          ],
          records: [joins("2025-04-01")],
        },
      },
      ["2025-02"],
    );
    expect(rowOf(made)?.drafted).toBeUndefined();
    expect(made.drafts).toEqual([]);
    expect(made.teams.map(({ id }) => id)).toEqual([team]);
  });
});
