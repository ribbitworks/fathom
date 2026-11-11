// SPDX-License-Identifier: Apache-2.0

// Tests for what is accepted when adding and changing a feature team: its name, its members, each
// once, its lead, the day members join or leave, and its colour.

import { describe, expect, it } from "vitest";
import {
  disbandedMonth,
  featureTeamChangeSchema,
  featureTeamColourSchema,
  featureTeamDraftSchema,
  featureTeamLengths,
  featureTeamRequestSchema,
  memberTeamsChangeSchema,
  maxTeamsChanged,
} from "./feature-teams.ts";

describe("the month a team disbands", () => {
  const joined = {
    member: true,
    fromDate: "2025-01-15",
    endDate: null,
  } as const;
  const left = (fromDate: string, endDate: string | null = null) => ({
    member: false,
    fromDate,
    endDate,
  });

  it("is none for a team that has had no members", () => {
    expect(disbandedMonth([])).toBeUndefined();
    expect(disbandedMonth([[]])).toBeUndefined();
  });

  it("is none while someone stays", () => {
    expect(
      disbandedMonth([[joined, left("2025-03-15")], [joined]]),
    ).toBeUndefined();
  });

  it("is the next month when the last member leaves during a month", () => {
    expect(disbandedMonth([[joined, left("2025-03-15")]])).toBe("2025-04");
  });

  it("is that month when the last member leaves on its first day", () => {
    expect(disbandedMonth([[joined, left("2025-04-01")]])).toBe("2025-04");
  });

  it("goes by whoever leaves last, whatever order they come in", () => {
    const earlier = [joined, left("2025-03-15")];
    const later = [joined, left("2025-07-15")];

    expect(disbandedMonth([later, earlier])).toBe("2025-08");
    expect(disbandedMonth([earlier, later])).toBe("2025-08");
  });

  it("counts the day after a member's end date", () => {
    expect(disbandedMonth([[{ ...joined, endDate: "2025-03-31" }]])).toBe(
      "2025-04",
    );
  });

  it("takes the earlier of a planned leaving day and the end date", () => {
    expect(disbandedMonth([[joined, left("2025-09-15", "2025-03-31")]])).toBe(
      "2025-04",
    );
    expect(disbandedMonth([[joined, left("2025-03-15", "2025-09-30")]])).toBe(
      "2025-04",
    );
  });
});

const person = "018f4f6e-7b1a-4c3d-8e2f-000000000001";
const other = "018f4f6e-7b1a-4c3d-8e2f-000000000002";

describe("adding a feature team", () => {
  it("needs only a name, trimmed, with no lead or members", () => {
    expect(featureTeamRequestSchema.parse({ name: "  Search " })).toEqual({
      name: "Search",
      leadId: null,
      members: [],
    });
  });

  it("refuses a name that is empty or too long", () => {
    expect(featureTeamRequestSchema.safeParse({ name: "  " }).success).toBe(
      false,
    );
    expect(
      featureTeamRequestSchema.safeParse({
        name: "x".repeat(featureTeamLengths.name + 1),
      }).success,
    ).toBe(false);
  });

  it("takes at most as many members as a team could hold", () => {
    const members = (count: number) =>
      Array.from(
        { length: count },
        (_, index) =>
          `018f4f6e-7b1a-4c3d-8e2f-${String(index).padStart(12, "0")}`,
      );
    expect(
      featureTeamRequestSchema.safeParse({
        name: "Search",
        members: members(featureTeamLengths.members),
      }).success,
    ).toBe(true);
    expect(
      featureTeamRequestSchema.safeParse({
        name: "Search",
        members: members(featureTeamLengths.members + 1),
      }).success,
    ).toBe(false);
  });

  it("takes each member once", () => {
    expect(
      featureTeamRequestSchema.safeParse({
        name: "Search",
        members: [person, other],
      }).success,
    ).toBe(true);
    expect(
      featureTeamRequestSchema.safeParse({
        name: "Search",
        members: [person, person],
      }).success,
    ).toBe(false);
  });

  it("refuses a member or lead who is not named by an identifier, and a day that is not one", () => {
    for (const asked of [
      { members: ["someone"] },
      { leadId: "someone" },
      { from: "soon" },
    ]) {
      expect(
        featureTeamRequestSchema.safeParse({ name: "Search", ...asked })
          .success,
      ).toBe(false);
    }
  });
});

describe("changing a feature team", () => {
  it("takes any of its details, or none", () => {
    expect(featureTeamChangeSchema.parse({})).toEqual({});
    expect(
      featureTeamChangeSchema.parse({
        name: "Search",
        leadId: null,
        add: [person],
        remove: [other],
        from: "2026-01-05",
      }),
    ).toEqual({
      name: "Search",
      leadId: null,
      add: [person],
      remove: [other],
      from: "2026-01-05",
    });
  });

  it("takes each member added or removed once", () => {
    expect(
      featureTeamChangeSchema.safeParse({ add: [person, person] }).success,
    ).toBe(false);
    expect(
      featureTeamChangeSchema.safeParse({ remove: [other, other] }).success,
    ).toBe(false);
  });
});

describe("changing the teams someone is on", () => {
  it("changes at most so many teams at once", () => {
    const teams = (count: number) =>
      Array.from(
        { length: count },
        (_, index) =>
          `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      );

    expect(
      memberTeamsChangeSchema.safeParse({ add: teams(maxTeamsChanged) })
        .success,
    ).toBe(true);
    expect(
      memberTeamsChangeSchema.safeParse({ add: teams(maxTeamsChanged + 1) })
        .success,
    ).toBe(false);
  });

  it("takes the teams added and removed, and a day, or none of them", () => {
    expect(memberTeamsChangeSchema.parse({})).toEqual({ add: [], remove: [] });
    expect(
      memberTeamsChangeSchema.parse({
        add: [person],
        remove: [other],
        from: "2026-01-01",
      }),
    ).toEqual({ add: [person], remove: [other], from: "2026-01-01" });
  });

  it("refuses a team named twice, or both added and removed", () => {
    for (const asked of [
      { add: [person, person] },
      { remove: [other, other] },
      { add: [person], remove: [person] },
    ]) {
      expect(memberTeamsChangeSchema.safeParse(asked).success).toBe(false);
    }
  });

  it("refuses a team not named by an identifier, and a day that is not one", () => {
    for (const asked of [{ add: ["search"] }, { from: "soon" }]) {
      expect(memberTeamsChangeSchema.safeParse(asked).success).toBe(false);
    }
  });
});

describe("a feature team's draft", () => {
  const draft = {
    action: "changed",
    changed: ["members"],
    live: {},
    state: "waiting",
    madeBy: null,
    madeAs: null,
    madeAt: null,
    editors: [],
    changedBy: {},
  };

  it("may give the days members join or leave, by person", () => {
    expect(
      featureTeamDraftSchema.parse({
        ...draft,
        days: { [person]: "2026-01-05" },
      }).days,
    ).toEqual({ [person]: "2026-01-05" });
    expect(featureTeamDraftSchema.parse(draft).days).toBeUndefined();
  });

  it("refuses a day that is not one", () => {
    expect(
      featureTeamDraftSchema.safeParse({ ...draft, days: { [person]: "soon" } })
        .success,
    ).toBe(false);
  });
});

describe("a feature team's colour", () => {
  it("is one of the palette, or none", () => {
    expect(featureTeamColourSchema.parse({ colour: "teal" })).toEqual({
      colour: "teal",
    });
    expect(featureTeamColourSchema.parse({ colour: null })).toEqual({
      colour: null,
    });
    expect(featureTeamColourSchema.safeParse({ colour: "sea" }).success).toBe(
      false,
    );
  });
});
