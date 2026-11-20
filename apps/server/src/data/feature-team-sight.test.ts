// SPDX-License-Identifier: Apache-2.0

// Unit tests for what a reader sees of a feature team and its draft, by role and data class: whom
// of its people, which of its fields and days, and who made the draft and why it was rejected.

import {
  type ClassAccess,
  defaultClasses,
  type Permission,
  startingRoles,
  withImplied,
} from "@fathom/shared";
import { describe, expect, it } from "vitest";
import type { Draft } from "./draft-records.ts";
import type { Maker } from "./draft-makers.ts";
import type { Everyone } from "./feature-team-rules.ts";
import {
  draftAsSeen,
  draftedOn,
  draftHoldsNotStarted,
  draftShownTo,
  featureTeamTier,
  namesSeen,
  peopleAsTodayOn,
  peopleDraftChanges,
  peopleNamed,
  seenBy,
  seesTeamField,
  type TeamVersions,
  teamSight,
  withoutLeavers,
} from "./feature-team-sight.ts";
import { someone } from "./test-feature-team-people.ts";

const today = "2026-06-15";
const lead = "person-lead";
const member = "person-member";
const starter = "person-starter";
const leaver = "person-leaver";
const unknown = "person-unknown";

const everyone: Everyone = new Map([
  [lead, someone({ preferredName: "Fictional Lead" })],
  [member, someone({ preferredName: "Fictional Member" })],
  [
    starter,
    someone({
      preferredName: "Fictional Starter",
      startDate: "2099-01-01",
      started: false,
    }),
  ],
  [
    leaver,
    someone({
      preferredName: "Fictional Leaver",
      endDate: "2021-06-30",
      left: true,
    }),
  ],
]);

const roleOf = (
  permissions: readonly Permission[],
  dataClasses = defaultClasses,
): ClassAccess => ({ permissions: withImplied(permissions), dataClasses });

// Sees people, and Personal and Confidential data.
const workforceAdministrator = roleOf(
  startingRoles["workforce-administrator"].permissions,
);
// Sees people and feature teams, but not Personal data.
const teamMember = roleOf(startingRoles["team-member"].permissions);
// Sees feature teams and Personal data, but not people.
const chartOnly = roleOf(["feature-teams:view", "personal:view"]);
// Sees Personal data but not Confidential data, so not future reorganizations.
const personalOnly = roleOf(
  startingRoles["engineering-manager"].permissions.filter(
    (permission) => permission !== "confidential:view",
  ),
);
// Sees people but not Personal data, with the days members join in General.
const teamMemberSeeingDays = roleOf(startingRoles["team-member"].permissions, {
  ...defaultClasses,
  featureTeamDates: "general",
});
// Sees Personal data but not Confidential data, with the days members join in Confidential.
const personalOnlyWithConfidentialDays = roleOf(personalOnly.permissions, {
  ...defaultClasses,
  featureTeamDates: "confidential",
});

const draftOf = (
  fields: Record<string, unknown>,
  details: Partial<Draft> = {},
): Draft => ({
  action: "changed",
  fields,
  state: "waiting",
  reason: null,
  sequence: 1,
  ...details,
});

describe("a team field's class", () => {
  it.each([
    ["the days members join", "memberFrom", "personal"],
    ["the days leads change", "leadFrom", "personal"],
    ["the name", "name", "general"],
    ["the members", "members", "general"],
  ])("puts %s in its class", (_, field, tier) => {
    expect(featureTeamTier(defaultClasses)(field)).toBe(tier);
  });

  it("puts the days in the class Feature team dates is moved to", () => {
    const classes = { ...defaultClasses, featureTeamDates: "general" as const };

    expect(featureTeamTier(classes)("memberFrom")).toBe("general");
  });

  it.each([
    ["the name to a role without Personal data", teamMember, "name", true],
    [
      "no days to a role without Personal data",
      teamMember,
      "memberFrom",
      false,
    ],
    ["the days to a role with Personal data", chartOnly, "leadFrom", true],
    [
      "the days to a role without Personal data once they are General",
      teamMemberSeeingDays,
      "memberFrom",
      true,
    ],
    [
      "no days to a role without Confidential data once they are Confidential",
      personalOnlyWithConfidentialDays,
      "memberFrom",
      false,
    ],
  ])("is seen with %s", (_, access, field, seen) => {
    expect(seesTeamField(access)(field)).toBe(seen);
  });
});

describe("a draft dated from another day", () => {
  const undated = draftOf({ name: "Fictional Renamed" });

  it.each([
    ["a role without Personal data", teamMember, false],
    ["a role with Personal data", workforceAdministrator, true],
    [
      "a role without Personal data, once the days are General",
      teamMemberSeeingDays,
      true,
    ],
    [
      "no role without Confidential data, once the days are Confidential",
      personalOnlyWithConfidentialDays,
      false,
    ],
  ])("is shown to %s as the class of its days allows", (_, access, shown) => {
    expect(
      draftShownTo(access, draftOf({ memberFrom: { [member]: "2026-08-01" } })),
    ).toBe(shown);
    expect(
      draftShownTo(access, draftOf({ leadFrom: { [member]: "2026-08-01" } })),
    ).toBe(shown);
  });

  it("is told apart from an undated draft, which every reader is shown", () => {
    expect(draftShownTo(teamMember, undated)).toBe(true);
  });
});

describe("people on a later day", () => {
  it("are shown as they are today to a role that doesn't see future reorganizations", () => {
    expect(peopleAsTodayOn(personalOnly, "2099-01-01", today)).toBe(true);
  });

  it("are shown as they are then to a role that sees future reorganizations", () => {
    expect(peopleAsTodayOn(workforceAdministrator, "2099-01-01", today)).toBe(
      false,
    );
  });

  it.each([
    ["today", today],
    ["an earlier day", "2025-01-01"],
  ])("are shown as they are on %s to any role", (_, day) => {
    expect(peopleAsTodayOn(personalOnly, day, today)).toBe(false);
  });
});

describe("a team without those who have left", () => {
  it("leaves them out as members, as lead, and from the days given", () => {
    // Given a team led by someone who has left, with days for them and for another member
    const team = {
      name: "Fictional Team",
      leadId: leaver,
      members: [leaver, member],
      memberFrom: { [leaver]: "2026-08-01", [member]: "2026-08-01" },
      leadFrom: { [leaver]: "2026-09-01" },
    };

    // When those who have left are taken out
    const kept = withoutLeavers(team, everyone);

    // Then only the other member and their day remain
    expect(kept).toEqual({
      name: "Fictional Team",
      leadId: null,
      members: [member],
      memberFrom: { [member]: "2026-08-01" },
    });
  });

  it("keeps those who have not left, and those not read, as they are", () => {
    const team = {
      name: "Fictional Team",
      leadId: lead,
      members: [lead, starter, unknown],
      leadFrom: { [lead]: "2026-09-01" },
    };

    expect(withoutLeavers(team, everyone)).toEqual(team);
  });

  it("adds no members to a team that names none", () => {
    expect(withoutLeavers({ name: "Fictional Team" }, everyone)).toEqual({
      name: "Fictional Team",
    });
  });
});

describe("the people a draft changes", () => {
  const live = { leadId: lead, members: [lead, member] };

  it("are those it adds or removes", () => {
    expect(
      peopleDraftChanges(live, { leadId: lead, members: [lead, starter] }),
    ).toEqual([member, starter]);
  });

  it("are the old and the new lead when it changes the lead", () => {
    expect(
      peopleDraftChanges(live, { leadId: member, members: [lead, member] }),
    ).toEqual([lead, member]);
  });

  it("name only the lead there is, when it takes the lead away or gives the team its first", () => {
    expect(peopleDraftChanges(live, { ...live, leadId: null })).toEqual([lead]);
    expect(
      peopleDraftChanges(undefined, { leadId: member, members: [member] }),
    ).toEqual([member, member]);
  });

  it("hold someone who has not started when it changes them", () => {
    expect(
      draftHoldsNotStarted(
        live,
        { ...live, members: [lead, member, starter] },
        everyone,
      ),
    ).toBe(true);
  });

  it("hold no one who has not started when it changes only those who have", () => {
    expect(
      draftHoldsNotStarted(live, { ...live, members: [lead] }, everyone),
    ).toBe(false);
  });
});

describe("the people a team names", () => {
  it("are its members, those given days, and its lead", () => {
    const team = {
      leadId: lead,
      members: [member],
      memberFrom: { [starter]: "2026-08-01" },
      leadFrom: { [leaver]: "2026-08-01" },
    };

    expect(peopleNamed(team)).toEqual([member, starter, leaver, lead]);
  });

  it("are none for no team, or a team with no lead", () => {
    expect(peopleNamed(undefined)).toEqual([]);
    expect(peopleNamed({ leadId: null })).toEqual([]);
  });
});

describe("whether a reader sees someone on a team", () => {
  it.each([
    ["someone who has started", member, false, true],
    ["someone who has not started, with Personal data", starter, true, true],
    [
      "someone who has not started, without Personal data",
      starter,
      false,
      false,
    ],
    ["someone who has left, with Personal data", leaver, true, false],
    ["someone not read", unknown, true, false],
    ["no one", null, true, false],
  ])("decides for %s", (_, personId, seesPersonal, seen) => {
    expect(seenBy(everyone, seesPersonal)(personId)).toBe(seen);
  });
});

describe("a team on a day with its draft laid over it", () => {
  const onDay = {
    name: "Fictional Team",
    leadId: lead,
    members: [lead, member],
  };
  const teamToday = { name: "Fictional Team", leadId: lead, members: [lead] };

  it("is the team today when there is no draft", () => {
    expect(draftedOn(onDay, teamToday, undefined)).toEqual(teamToday);
  });

  it("is the team as drafted when the draft adds it", () => {
    const fields = {
      name: "Fictional New Team",
      leadId: null,
      members: [member],
    };

    expect(
      draftedOn(undefined, undefined, draftOf(fields, { action: "created" })),
    ).toEqual(fields);
  });

  it("is no team when the draft removes it", () => {
    expect(
      draftedOn(onDay, teamToday, draftOf({}, { action: "deleted" })),
    ).toBeUndefined();
  });

  it("is no team when the draft changes a team that is not live", () => {
    expect(
      draftedOn(undefined, undefined, draftOf({ name: "Fictional Lost Team" })),
    ).toBeUndefined();
  });

  it("puts on that day's team those the draft adds, and takes off those it removes", () => {
    // Given a draft against today's team adding someone who has not started
    const draft = draftOf({ members: [lead, starter] });

    // When it is laid over a day when another member is on the team too
    const team = draftedOn(onDay, teamToday, draft);

    // Then that day's members keep the other member, with the one added
    expect(team).toMatchObject({
      leadId: lead,
      members: [lead, member, starter],
    });
  });

  it("gives that day's team the lead the draft chooses", () => {
    // Given a draft making the member the lead, and removing the lead
    const today = {
      name: "Fictional Team",
      leadId: lead,
      members: [lead, member],
    };
    const draft = draftOf({ leadId: member, members: [member] });

    // When it is laid over a day when both are on the team
    const team = draftedOn(onDay, today, draft);

    // Then the member leads, and the lead is off the team
    expect(team).toMatchObject({ leadId: member, members: [member] });
  });

  it("keeps that day's lead when the draft doesn't change the lead", () => {
    const later = { ...onDay, leadId: member };

    expect(
      draftedOn(later, teamToday, draftOf({ name: "Fictional Renamed" })),
    ).toMatchObject({ name: "Fictional Renamed", leadId: member });
  });

  it("has no lead on a day when the draft takes that day's lead off the team", () => {
    // Given a team led by the member that day, and a draft removing the member
    const later = { ...onDay, leadId: member };
    const today = {
      name: "Fictional Team",
      leadId: lead,
      members: [lead, member],
    };

    // When the draft is laid over that day
    const team = draftedOn(later, today, draftOf({ members: [lead] }));

    // Then the team has no lead then
    expect(team).toMatchObject({ leadId: null, members: [lead] });
  });
});

describe("what a reader sees of the people on a team", () => {
  const team = { leadId: starter, members: [member, starter, leaver] };

  it("is everyone who has not left, to a role with Personal data", () => {
    const { shown, seesPeople } = teamSight(workforceAdministrator, everyone, {
      day: today,
      today,
    });

    expect(seesPeople).toBe(true);
    expect(team.members.filter(shown)).toEqual([member, starter]);
  });

  it("is those who have started, to a role without Personal data", () => {
    const { shown, seesPeople } = teamSight(teamMember, everyone, {
      day: today,
      today,
    });

    expect(seesPeople).toBe(false);
    expect(team.members.filter(shown)).toEqual([member]);
  });

  it("is those who have started by today, on a later day, to a role that sees people as they are today", () => {
    const { shown } = teamSight(personalOnly, everyone, {
      day: "2099-06-01",
      today,
    });

    expect(team.members.filter(shown)).toEqual([member]);
  });

  it("names those it sees, on the team or before it was drafted", () => {
    // Given a team as drafted and as it was, naming each kind of person, and someone read whom
    // neither names
    const sight = teamSight(
      teamMember,
      new Map([
        ...everyone,
        ["person-other", someone({ preferredName: "Fictional Other" })],
      ]),
      { day: today, today },
    );

    // When the names are read
    const names = namesSeen(sight, team, { leadId: lead, members: [lead] });

    // Then only those seen are named
    expect(names).toEqual({
      [lead]: "Fictional Lead",
      [member]: "Fictional Member",
    });
  });
});

describe("what a reader sees of the days a draft gives", () => {
  it.each([
    ["a role with Personal data", workforceAdministrator, true],
    ["a role without Personal data", teamMember, false],
    [
      "a role without Personal data, once the days are General",
      teamMemberSeeingDays,
      true,
    ],
    [
      "no role without Confidential data, once the days are Confidential",
      personalOnlyWithConfidentialDays,
      false,
    ],
  ])("is shown to %s", (_, access, seesDays) => {
    expect(teamSight(access, everyone, { day: today, today }).seesDays).toBe(
      seesDays,
    );
  });
});

describe("a team's draft as a reader sees it", () => {
  const live = {
    name: "Fictional Team",
    leadId: lead,
    members: [lead, member],
  };
  const sightOf = (access: ClassAccess) =>
    teamSight(access, everyone, { day: today, today });
  const versionsOf = (after: Record<string, unknown>): TeamVersions => ({
    before: live,
    teamToday: live,
    after,
    team: after,
  });
  const seenAs = (
    access: ClassAccess,
    fields: Record<string, unknown>,
    details: Partial<Draft> = {},
    maker?: Maker,
  ) =>
    draftAsSeen(
      sightOf(access),
      versionsOf({ ...live, ...fields }),
      draftOf(fields, details),
      maker,
    ).draft;

  it("is none for a team with no draft", () => {
    expect(
      draftAsSeen(
        sightOf(workforceAdministrator),
        versionsOf(live),
        undefined,
        undefined,
      ),
    ).toEqual({});
  });

  it("names the fields a draft changes, with their live values", () => {
    const seen = seenAs(teamMember, {
      name: "Fictional Renamed",
      leadId: member,
    });

    expect(seen).toMatchObject({
      action: "changed",
      changed: ["name", "leadId"],
      live: { name: "Fictional Team", leadId: lead },
      state: "waiting",
    });
  });

  it("has no live values for a team only drafted to be added", () => {
    // Given a draft adding a team
    const fields = {
      name: "Fictional New Team",
      leadId: null,
      members: [member],
    };

    // When a reader without Personal data sees it
    const seen = draftAsSeen(
      sightOf(teamMember),
      { before: undefined, teamToday: undefined, after: fields, team: fields },
      draftOf(fields, { action: "created" }),
      undefined,
    ).draft;

    // Then it changes its name and members, with nothing live
    expect(seen).toMatchObject({
      action: "created",
      changed: ["name", "members"],
      live: {},
    });
  });

  it("shows the live members but not a lead who has not started, to a role without Personal data", () => {
    // Given a team led by someone who has not started
    const before = { ...live, leadId: starter, members: [member, starter] };
    const after = { ...before, leadId: member };

    // When a draft makes the member lead
    const seen = draftAsSeen(
      sightOf(teamMember),
      { before, teamToday: before, after, team: after },
      draftOf({ leadId: member }),
      undefined,
    ).draft;

    // Then the live lead is shown as none
    expect(seen?.live).toEqual({ leadId: null });
  });

  it("shows the live members it sees when the draft changes them", () => {
    expect(
      seenAs(workforceAdministrator, { members: [lead, member, starter] })
        ?.live,
    ).toEqual({ members: [lead, member] });
  });

  describe("adding only someone who has not started", () => {
    const fields = { members: [lead, member, starter] };

    it("is no draft to a role without Personal data", () => {
      expect(seenAs(teamMember, fields)).toBeUndefined();
    });

    it("is a draft of the members to a role with Personal data", () => {
      expect(seenAs(workforceAdministrator, fields)?.changed).toEqual([
        "members",
      ]);
    });
  });

  describe("making someone who has not started the lead of a team with none", () => {
    const before = {
      name: "Fictional Team",
      leadId: null,
      members: [lead, member],
    };
    const fields = { leadId: starter, members: [lead, member, starter] };
    const leadDraftAs = (access: ClassAccess) =>
      draftAsSeen(
        sightOf(access),
        {
          before,
          teamToday: before,
          after: { ...before, ...fields },
          team: { ...before, ...fields },
        },
        draftOf(fields),
        undefined,
      ).draft;

    it("is no draft to a role without Personal data", () => {
      expect(leadDraftAs(teamMember)).toBeUndefined();
    });

    it("is a draft of the lead and members to a role with Personal data", () => {
      expect(leadDraftAs(workforceAdministrator)?.changed).toEqual([
        "leadId",
        "members",
      ]);
    });
  });

  it("keeps a rename but not the members who have not started, to a role without Personal data", () => {
    const seen = seenAs(teamMember, {
      name: "Fictional Renamed",
      members: [lead, member, starter],
    });

    expect(seen?.changed).toEqual(["name"]);
  });

  it("stays listed with no change, to a role with Personal data, when only someone who has left remains in it", () => {
    // Given a draft whose only change is someone who has since left
    const fields = { members: [lead, member, leaver] };

    // When readers see it
    const withPersonal = seenAs(workforceAdministrator, fields);
    const withoutPersonal = seenAs(teamMember, fields);

    // Then only those with Personal data are shown it, to clear it
    expect(withPersonal).toMatchObject({ changed: [], live: {} });
    expect(withoutPersonal).toBeUndefined();
  });

  describe("the days a draft gives", () => {
    const fields = {
      members: [lead, member, starter],
      memberFrom: { [starter]: "2026-08-01" },
      leadId: member,
      leadFrom: { [member]: "2026-09-01" },
    };

    it("are shown, with the lead's day apart, to a role that sees them", () => {
      const seen = seenAs(workforceAdministrator, fields);

      expect(seen).toMatchObject({
        days: { [starter]: "2026-08-01" },
        leadDay: "2026-09-01",
      });
      expect(seen?.changed).toEqual([
        "members",
        "memberFrom",
        "leadId",
        "leadFrom",
      ]);
    });

    it("are shown to a role without Personal data once they are General", () => {
      const seen = seenAs(teamMemberSeeingDays, {
        ...fields,
        memberFrom: { [member]: "2026-08-01" },
      });

      expect(seen).toMatchObject({ days: { [member]: "2026-08-01" } });
    });

    it("are not told to a role that doesn't see them, nor the fields that hold them", () => {
      const unseen = seenAs(teamMember, fields);

      expect(unseen).not.toHaveProperty("days");
      expect(unseen).not.toHaveProperty("leadDay");
      expect(unseen?.changed).toEqual(["leadId"]);
    });

    it("leave out the day of someone the reader doesn't see", () => {
      // Given a role that sees the days, but not Personal data
      // When a draft gives a day only to someone who has not started
      const seen = seenAs(teamMemberSeeingDays, fields);

      // Then that day is not shown, nor the field that holds it
      expect(seen).not.toHaveProperty("days");
      expect(seen?.changed).toEqual(["leadId", "leadFrom"]);
    });
  });

  describe("why a draft was rejected", () => {
    const rejected = { state: "rejected" as const, reason: "Fictional reason" };

    it("is shown to a reader who sees all the draft", () => {
      expect(
        seenAs(teamMember, { name: "Fictional Renamed" }, rejected),
      ).toMatchObject({ state: "rejected", reason: "Fictional reason" });
    });

    it("is not shown to a reader who doesn't see one of the draft's fields", () => {
      const seen = seenAs(
        teamMember,
        { name: "Fictional Renamed", memberFrom: { [member]: "2026-08-01" } },
        rejected,
      );

      expect(seen).not.toHaveProperty("reason");
    });

    it("is not shown to a role without Personal data when the draft changes someone who has not started", () => {
      const fields = {
        name: "Fictional Renamed",
        members: [lead, member, starter],
      };

      expect(seenAs(teamMember, fields, rejected)).not.toHaveProperty("reason");
      expect(seenAs(workforceAdministrator, fields, rejected)?.reason).toBe(
        "Fictional reason",
      );
    });

    it("is not shown for a waiting draft, or a rejection with no reason", () => {
      const fields = { name: "Fictional Renamed" };

      expect(seenAs(workforceAdministrator, fields)).not.toHaveProperty(
        "reason",
      );
      expect(
        seenAs(workforceAdministrator, fields, {
          state: "rejected",
          reason: null,
        }),
      ).not.toHaveProperty("reason");
    });
  });

  it("is marked as the reader's own when not yet published", () => {
    expect(
      seenAs(
        workforceAdministrator,
        { name: "Fictional Renamed" },
        { unpublished: true },
      )?.unpublished,
    ).toBe(true);
  });

  it("names who made it, and who changed each field", () => {
    // Given a draft made by one editor and changed by another
    const maker: Maker = {
      madeBy: "Fictional Editor",
      madeAs: "Fictional Role",
      madeAt: new Date("2026-06-01T09:00:00.000Z"),
      editors: ["Fictional Maker", "Fictional Editor"],
      fieldEditors: new Map([["name", "Fictional Editor"]]),
      needsOtherApprover: true,
    };

    // When a reader sees it
    const seen = seenAs(
      workforceAdministrator,
      { name: "Fictional Renamed", leadId: member },
      {},
      maker,
    );

    // Then its makers are named, and the field no one is named for has none
    expect(seen).toMatchObject({
      madeBy: "Fictional Editor",
      madeAs: "Fictional Role",
      madeAt: "2026-06-01T09:00:00.000Z",
      editors: ["Fictional Maker", "Fictional Editor"],
      needsOtherApprover: true,
      changedBy: { name: "Fictional Editor", leadId: null },
    });
  });

  it("names no one for a draft written without the change history", () => {
    expect(
      seenAs(workforceAdministrator, { name: "Fictional Renamed" }),
    ).toMatchObject({
      madeBy: null,
      madeAs: null,
      madeAt: null,
      editors: [],
      changedBy: { name: null },
    });
    expect(
      seenAs(workforceAdministrator, { name: "Fictional Renamed" }),
    ).not.toHaveProperty("needsOtherApprover");
  });
});
