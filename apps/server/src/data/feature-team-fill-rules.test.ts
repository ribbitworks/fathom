// SPDX-License-Identifier: Apache-2.0

// Unit tests for what filling a planned hire carries to its person: the feature teams the hire is on,
// and the teams it leads, today or later.

import { describe, expect, it } from "vitest";
import {
  carriedOnFill,
  joinsAfterEnd,
  leadsWhileOn,
  teamDraftsBlockingFill,
} from "./feature-team-rules.ts";

const today = "2026-06-15";
const start = "2026-09-01";
const team = "team-1";
const otherTeam = "team-2";
const person = "person-filling";

const on = (fromDate: string, teamId = team) => ({
  teamId,
  member: true,
  fromDate,
});
const off = (fromDate: string, teamId = team) => ({
  teamId,
  member: false,
  fromDate,
});
const personOn = (fromDate: string, teamId = team) => ({
  ...on(fromDate, teamId),
  memberId: person,
});
const personOff = (fromDate: string, teamId = team) => ({
  ...off(fromDate, teamId),
  memberId: person,
});
const ended = (fromDate: string, wasOn: boolean, teamId = team) => ({
  teamId,
  fromDate,
  wasOn,
});

describe("what filling a planned hire carries to its person", () => {
  it("moves a record in force today to the person's start, ending the hire's there", () => {
    expect(carriedOnFill([on("2026-04-01")], person, start, today)).toEqual({
      person: [personOn(start)],
      ended: [ended(start, true)],
    });
  });

  it("moves a record in force today to today when the person started before then, so no past day changes", () => {
    expect(
      carriedOnFill([on("2026-06-01")], person, "2026-03-01", today),
    ).toEqual({
      person: [personOn(today)],
      ended: [ended(today, true)],
    });
  });

  it("keeps the day of a record the person's start comes on", () => {
    expect(carriedOnFill([on(start)], person, start, today)).toEqual({
      person: [personOn(start)],
      ended: [ended(start, false)],
    });
  });

  it("keeps the day of a later record after the person's start", () => {
    expect(carriedOnFill([on("2026-10-01")], person, start, today)).toEqual({
      person: [personOn("2026-10-01")],
      ended: [ended("2026-10-01", false)],
    });
  });

  it("moves a later record before the person's start to it", () => {
    expect(carriedOnFill([on("2026-07-01")], person, start, today)).toEqual({
      person: [personOn(start)],
      ended: [ended(start, true)],
    });
  });

  it("carries leaving later, after the person's start", () => {
    expect(
      carriedOnFill(
        [on("2026-04-01"), off("2026-12-01")],
        person,
        start,
        today,
      ),
    ).toEqual({
      person: [personOn(start), personOff("2026-12-01")],
      ended: [ended(start, true)],
    });
  });

  it("carries nothing of a team the hire leaves before the person's start", () => {
    expect(
      carriedOnFill(
        [on("2026-04-01"), off("2026-08-01")],
        person,
        start,
        today,
      ),
    ).toEqual({ person: [], ended: [] });
  });

  it("carries nothing of a team the hire left before today", () => {
    expect(
      carriedOnFill(
        [on("2026-01-01"), off("2026-02-01")],
        person,
        "2026-01-15",
        today,
      ),
    ).toEqual({ person: [], ended: [] });
  });

  it("takes the latest of the records moved to the person's start", () => {
    expect(
      carriedOnFill(
        [on("2026-04-01"), off("2026-07-01"), on("2026-08-01")],
        person,
        start,
        today,
      ),
    ).toEqual({ person: [personOn(start)], ended: [ended(start, true)] });
  });

  it("leaves the hire's records before the one in force today with the hire", () => {
    expect(
      carriedOnFill(
        [on("2026-01-01"), off("2026-02-01"), on("2026-03-01")],
        person,
        "2026-02-15",
        today,
      ),
    ).toEqual({
      person: [personOn(today)],
      ended: [ended(today, true)],
    });
  });

  it("moves a record in force today to today when the person has no start date", () => {
    expect(carriedOnFill([on("2026-01-01")], person, null, today)).toEqual({
      person: [personOn(today)],
      ended: [ended(today, true)],
    });
  });

  it("keeps a later record's day when the person has no start date", () => {
    expect(carriedOnFill([on("2026-07-01")], person, null, today)).toEqual({
      person: [personOn("2026-07-01")],
      ended: [ended("2026-07-01", false)],
    });
  });

  it("carries each team apart, whatever order the records come in", () => {
    expect(
      carriedOnFill(
        [
          off("2026-12-01"),
          on("2026-10-01", otherTeam),
          on("2026-04-01"),
          off("2026-05-01", otherTeam),
          on("2026-02-01", otherTeam),
        ],
        person,
        start,
        today,
      ),
    ).toEqual({
      person: [
        personOn(start),
        personOff("2026-12-01"),
        personOn("2026-10-01", otherTeam),
      ],
      ended: [ended(start, true), ended("2026-10-01", false, otherTeam)],
    });
  });

  it("passes a lead to the person until the team's next lead, given the team's leads as the hire's or not", () => {
    // Given the hire leading from April, then someone else from December
    const leads = [on("2026-04-01"), off("2026-12-01")];

    // Then the person leads from their start, until December
    expect(carriedOnFill(leads, person, start, today)).toEqual({
      person: [personOn(start), personOff("2026-12-01")],
      ended: [ended(start, true)],
    });
  });

  it("carries nothing of a team the hire never leads today or later", () => {
    expect(
      carriedOnFill(
        [off("2026-01-01"), off("2026-10-01")],
        person,
        start,
        today,
      ),
    ).toEqual({ person: [], ended: [] });
  });

  it("carries a lead only while its membership carries, since a lead leaves with the team", () => {
    // Given the hire on the team and leading it from April, both ending in August, before the start
    const records = [on("2026-04-01"), off("2026-08-01")];

    // Then neither carries
    expect(carriedOnFill(records, person, start, today)).toEqual({
      person: [],
      ended: [],
    });
  });

  it("leaves the person's own records on a team they are on today, ending the hire's there", () => {
    expect(
      carriedOnFill(
        [on("2026-04-01"), off("2026-12-01")],
        person,
        start,
        today,
        [on("2020-01-01")],
      ),
    ).toEqual({ person: [], ended: [ended(start, true)] });
  });

  it("leaves the person's own records on a team they join later", () => {
    expect(
      carriedOnFill([on("2026-04-01")], person, start, today, [
        on("2026-11-01"),
      ]),
    ).toEqual({ person: [], ended: [ended(start, true)] });
  });

  it("carries a team the person left before today, or another team they are on", () => {
    expect(
      carriedOnFill([on("2026-04-01")], person, start, today, [
        on("2020-01-01"),
        off("2021-01-01"),
        on("2020-01-01", otherTeam),
      ]),
    ).toEqual({ person: [personOn(start)], ended: [ended(start, true)] });
  });
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

describe("the days a carried lead passes to the person", () => {
  const leads = (...records: ReturnType<typeof on>[]) => ({
    person: records.map((record) => ({ ...record, memberId: person })),
    ended: [],
  });
  const leading = (fromDate: string) => ({
    teamId: team,
    fromDate,
    leadId: person,
  });
  const noLead = (fromDate: string) => ({
    teamId: team,
    fromDate,
    leadId: null,
  });

  it("passes the lead from its day while the person joins with it", () => {
    expect(
      leadsWhileOn(
        leads(on(start), off("2026-12-01")),
        leads(on(start)),
        [],
        person,
      ),
    ).toEqual([leading(start)]);
  });

  it("ends the lead with no lead when the carried membership leaves", () => {
    expect(
      leadsWhileOn(
        leads(on(start)),
        leads(on(start), off("2026-12-01")),
        [],
        person,
      ),
    ).toEqual([leading(start), noLead("2026-12-01")]);
  });

  it("gives no lead until a person on the team only later joins it", () => {
    expect(
      leadsWhileOn(leads(on(start)), leads(), [on("2026-11-01")], person),
    ).toEqual([noLead(start), leading("2026-11-01")]);
  });

  it("ends the lead when the person leaves the team by their own record", () => {
    expect(
      leadsWhileOn(
        leads(on(start)),
        leads(),
        [on("2020-01-01"), off("2026-10-01")],
        person,
      ),
    ).toEqual([leading(start), noLead("2026-10-01")]);
  });

  it("passes the lead only while the person is on the team, joining later and leaving again", () => {
    expect(
      leadsWhileOn(
        leads(on(start)),
        leads(),
        [on("2026-11-01"), off("2026-12-15")],
        person,
      ),
    ).toEqual([noLead(start), leading("2026-11-01"), noLead("2026-12-15")]);
  });

  it("gives no lead to a person on none of the team's days", () => {
    expect(leadsWhileOn(leads(on(start)), leads(), [], person)).toEqual([
      noLead(start),
    ]);
  });

  it("leaves another lead's days to them", () => {
    expect(
      leadsWhileOn(
        leads(on(start), off("2026-10-01"), on("2026-11-01")),
        leads(),
        [on("2020-01-01"), off("2026-10-15")],
        person,
      ),
    ).toEqual([leading(start), noLead("2026-11-01")]);
  });
});
