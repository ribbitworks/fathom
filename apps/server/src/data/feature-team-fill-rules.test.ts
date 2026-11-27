// SPDX-License-Identifier: Apache-2.0

// Unit tests for the server's rules on filling a planned hire on feature teams: a fill putting its
// person on a team after they leave, and the team drafts a fill waits on.

import { describe, expect, it } from "vitest";
import { joinsAfterEnd, teamDraftsBlockingFill } from "./feature-team-rules.ts";

const team = "team-1";
const otherTeam = "team-2";
const person = "person-filling";

const on = (fromDate: string, teamId = team) => ({
  teamId,
  member: true,
  fromDate,
});

describe("whether a fill would put its person on a team after they leave", () => {
  const carried = (fromDate: string, member = true) => ({
    person: [{ ...on(fromDate), member, memberId: person }],
    ended: [],
  });

  it.each([
    ["a join after their end date", carried("2027-02-01"), "2027-01-31", true],
    ["a join on their end date", carried("2027-01-31"), "2027-01-31", false],
    ["a leave after it", carried("2027-02-01", false), "2027-01-31", false],
    ["no end date", carried("2099-01-01"), null, false],
  ])("is answered for %s", (_, records, endDate, after) => {
    expect(joinsAfterEnd(records, endDate)).toBe(after);
  });
});

describe("the team drafts a fill waits on", () => {
  const hire = "hire-filled";
  const draft = (teamId: string, fields: Record<string, unknown>) => ({
    teamId,
    fields,
  });

  it.each([
    ["names the hire as a member", draft(otherTeam, { members: [hire] })],
    ["makes the hire the lead", draft(otherTeam, { leadId: hire })],
    ["is of a team the hire is on, whatever it changes", draft(team, {})],
  ])("include a draft that %s", (_, one) => {
    expect(teamDraftsBlockingFill([one], [team], hire)).toEqual([one.teamId]);
  });

  it("leave out a draft of another team that doesn't name the hire", () => {
    expect(
      teamDraftsBlockingFill(
        [draft(otherTeam, { members: ["person-other"], leadId: null })],
        [team],
        hire,
      ),
    ).toEqual([]);
  });
});
