// SPDX-License-Identifier: Apache-2.0

// Unit tests for what a reader sees of a feature team, by role and data class: whom of its people,
// which of its fields and days, and which drafts.

import { defaultClasses } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  draftedOn,
  draftHoldsNotStarted,
  draftShownTo,
  featureTeamTier,
  hireLeadDaySeen,
  hireOnTeamSeen,
  type HireRead,
  type LeadRecord,
  leadRunOf,
  namesSeen,
  peopleAsTodayOn,
  peopleDraftChanges,
  peopleNamed,
  seenBy,
  seesTeamField,
  teamSight,
  withoutLeavers,
} from "./feature-team-sight.ts";
import { someone } from "./test-feature-team-people.ts";
import {
  chartOnly,
  draftOf,
  everyone,
  hire,
  lead,
  leaver,
  member,
  personalOnly,
  personalOnlyWithConfidentialDays,
  starter,
  teamMember,
  teamMemberSeeingDays,
  today,
  unknown,
  workforceAdministrator,
} from "./test-feature-team-sight.ts";

describe("a team field's class", () => {
  it.each([
    ["the days members join", "memberFrom", "personal"],
    ["the days leads change", "leadFrom", "personal"],
    ["the name", "name", "general"],
    ["the members", "members", "general"],
  ])("puts %s in its class", (_, field, tier) => {
    expect(featureTeamTier(defaultClasses)(field)).toBe(tier);
  });

  it.each([
    ["the days planned hires join", "hireFrom"],
    ["the days a planned hire becomes lead", "hireLeadFrom"],
  ])("puts %s in General, whatever class people's days are in", (_, field) => {
    const classes = {
      ...defaultClasses,
      featureTeamDates: "confidential" as const,
    };

    expect(featureTeamTier(classes)(field)).toBe("general");
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

  it("is shown to every reader when it dates only planned hires", () => {
    expect(
      draftShownTo(
        teamMember,
        draftOf({
          hireFrom: { [hire]: "2026-08-01" },
          hireLeadFrom: { [hire]: "2026-08-01" },
        }),
      ),
    ).toBe(true);
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
  it("keeps a planned hire as a member and as the lead, since a planned hire never leaves", () => {
    const team = {
      name: "Fictional Team",
      leadId: hire,
      members: [hire, leaver],
    };

    expect(withoutLeavers(team, everyone)).toEqual({
      name: "Fictional Team",
      leadId: hire,
      members: [hire],
    });
  });

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

  it("keeps planned hires' days apart from people's", () => {
    const team = {
      name: "Fictional Team",
      leadId: hire,
      members: [hire, leaver],
      memberFrom: { [leaver]: "2026-08-01" },
      hireFrom: { [hire]: "2026-08-01" },
      hireLeadFrom: { [hire]: "2026-08-01" },
    };

    expect(withoutLeavers(team, everyone)).toEqual({
      name: "Fictional Team",
      leadId: hire,
      members: [hire],
      hireFrom: { [hire]: "2026-08-01" },
      hireLeadFrom: { [hire]: "2026-08-01" },
    });
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

  it("hold no one who has not started when it changes only a planned hire", () => {
    expect(
      draftHoldsNotStarted(
        live,
        { ...live, members: [lead, member, hire] },
        everyone,
      ),
    ).toBe(false);
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
    ["a planned hire, without Personal data", hire, false, true],
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

describe("the day a planned hire leading a team started to", () => {
  const led = (leadId: string | null, fromDate: string, person = false) => ({
    leadId,
    personId: person ? leadId : null,
    fromDate,
  });
  // The run of the last record, the one in force.
  const runOf = (records: LeadRecord[]) =>
    leadRunOf(records, records.at(-1) as LeadRecord);

  it.each<[string, LeadRecord[], boolean]>([
    ["no record before it", [], false],
    [
      "no lead",
      [led(lead, "2026-03-01", true), led(null, "2026-03-15")],
      false,
    ],
    ["another planned hire", [led("hire-other", "2026-03-01")], false],
    ["a person", [led(lead, "2026-03-01", true)], true],
  ])(
    "takes over from %s on the first day of its run",
    (_, before, afterPerson) => {
      expect(
        runOf([...before, led(hire, "2026-04-01"), led(hire, "2026-04-20")]),
      ).toEqual({ from: "2026-04-01", afterPerson });
    },
  );

  it.each([
    ["a reader of Feature team dates, from a person", true, true, "2026-04-01"],
    ["any reader, from no person", false, false, "2026-04-01"],
    ["no other reader, from a person", false, true, undefined],
  ])("is shown to %s", (_, seesDays, afterPerson, shown) => {
    expect(hireLeadDaySeen({ from: "2026-04-01", afterPerson }, seesDays)).toBe(
      shown,
    );
  });

  it("is none for a team with no run", () => {
    expect(hireLeadDaySeen(undefined, true)).toBeUndefined();
  });
});

describe("a planned hire as a team's details name it", () => {
  const open: HireRead = {
    name: "Fictional Data Engineer",
    shownId: "REQ-FICTIONAL-9",
    position: "Fictional Engineer",
    positionTier: "general",
    keyNumber: 9,
    expected: "2027-03",
    undated: false,
    filledBy: null,
  };
  const seenBy = (access: typeof workforceAdministrator) =>
    teamSight(access, everyone, { day: today, today });

  it("names one with a name of its own by it, with its key and the month it's expected", () => {
    expect(hireOnTeamSeen(open, seenBy(teamMember))).toEqual({
      name: "Fictional Data Engineer",
      hire: { keyNumber: 9, expected: "2027-03" },
    });
  });

  it("names one with no name of its own by its position and ID, giving the ID", () => {
    expect(hireOnTeamSeen({ ...open, name: null }, seenBy(teamMember))).toEqual(
      {
        name: "Fictional Engineer, REQ-FICTIONAL-9",
        hire: { keyNumber: 9, shownId: "REQ-FICTIONAL-9", expected: "2027-03" },
      },
    );
  });

  it("names one by its ID alone to a reader who doesn't see its position", () => {
    expect(
      hireOnTeamSeen(
        { ...open, name: null, positionTier: "confidential" },
        seenBy(teamMember),
      ).name,
    ).toBe("REQ-FICTIONAL-9");
  });

  it("says when its month comes from no target date", () => {
    expect(
      hireOnTeamSeen({ ...open, undated: true }, seenBy(teamMember)).hire,
    ).toEqual({ keyNumber: 9, expected: "2027-03", undated: true });
  });

  it("names who fills it, and the day they start, to a reader who sees both", () => {
    expect(
      hireOnTeamSeen(
        { ...open, filledBy: starter },
        seenBy(workforceAdministrator),
      ).hire.filledBy,
    ).toEqual({ name: "Fictional Starter", starts: "2099-01-01" });
  });

  it("names who fills it without the day they start to a reader who sees them but not start dates", () => {
    expect(
      hireOnTeamSeen({ ...open, filledBy: member }, seenBy(teamMember)).hire
        .filledBy,
    ).toEqual({ name: "Fictional Member" });
  });

  it("shows it not yet filled to a reader who doesn't see who fills it, as its placeholder is", () => {
    expect(
      hireOnTeamSeen({ ...open, filledBy: starter }, seenBy(teamMember)).hire,
    ).toEqual({ keyNumber: 9, expected: "2027-03" });
  });
});
