// SPDX-License-Identifier: Apache-2.0

// Unit tests for drafting a change to a feature team: the draft it makes, and the refusals of its
// members, lead, name and days.

import { describe, expect, it } from "vitest";
import {
  daysRefusal,
  draftingRefusals,
  employmentDayRefusal,
  type Everyone,
  leadDayRefusal,
  leadOffTeamRefusal,
  type Member,
  type MemberDay,
  nameIsTaken,
  hasLeft,
  nextTeamDraft,
  notYetStarted,
  onTeamTodayOrLater,
  plannedHireDaysRefusal,
} from "./feature-team-rules.ts";
import { plannedHire, someone } from "./test-feature-team-people.ts";

const today = "2026-06-15";
const team = "team-1";
const otherTeam = "team-2";
const lead = "person-lead";
const member = "person-member";
const joining = "person-joining";
const outsider = "person-outsider";
const hire = "hire-open";

describe("a team's draft with a change made", () => {
  const live = {
    name: "Fictional Team",
    leadId: lead,
    members: [lead, member],
  };

  const next = (
    change: Parameters<typeof nextTeamDraft>[1],
    from?: string,
    drafted: Record<string, unknown> = live,
  ) => nextTeamDraft({ before: live, team: drafted }, change, { from, today });

  it("adds and removes members, sorted", () => {
    const made = next({ add: [outsider, joining], remove: [member] });

    expect(made.after).toEqual({
      name: "Fictional Team",
      leadId: lead,
      members: [lead, outsider, joining].sort(),
    });
    expect(made.added).toEqual([outsider, joining]);
    expect(made.dayPeople).toEqual([outsider, joining, member]);
  });

  it("changes nothing when adding someone on the team or removing someone not on it", () => {
    const made = next({ add: [member], remove: [outsider] });

    expect(made.after).toEqual(live);
    expect(made.dayPeople).toEqual([]);
    expect(made.leadChanges).toBe(false);
  });

  it("leaves the team with no lead when the lead leaves it", () => {
    const made = next({ remove: [lead] });

    expect(made.after).toMatchObject({ leadId: null, members: [member] });
    expect(made.leadChanges).toBe(true);
  });

  it("keeps its lead when another member leaves", () => {
    const made = next({ remove: [member] });

    expect(made.after).toMatchObject({ leadId: lead, members: [lead] });
    expect(made.leadChanges).toBe(false);
  });

  it("gives the team the lead chosen when its lead leaves", () => {
    const made = next({ remove: [lead], leadId: member });

    expect(made.after).toMatchObject({ leadId: member, members: [member] });
  });

  it("adds a lead chosen from outside the team to it", () => {
    const made = next({ leadId: outsider });

    expect(made.added).toEqual([outsider]);
    expect(made.after).toMatchObject({
      leadId: outsider,
      members: [lead, member, outsider].sort(),
    });
  });

  it("keeps a lead the change removes from the team, for the members' check to refuse", () => {
    const made = next({ leadId: member, remove: [member] });

    expect(made.leadId).toBe(member);
    expect(made.members).toEqual([lead]);
  });

  it("renames the team", () => {
    expect(next({ name: "Fictional Renamed" }).after.name).toBe(
      "Fictional Renamed",
    );
  });

  it("keeps the team's name when no other is given", () => {
    expect(next({ remove: [member] }).after.name).toBe("Fictional Team");
  });

  it("holds the day given for each member it adds or removes", () => {
    const made = next({ add: [joining], remove: [member] }, "2026-08-01");

    expect(made.after.memberFrom).toEqual({
      [joining]: "2026-08-01",
      [member]: "2026-08-01",
    });
    expect(made.dated).toEqual([joining, member]);
  });

  it("keeps the days the draft holds when a later change gives no day", () => {
    // Given a draft adding someone from a day
    const drafted = next({ add: [joining] }, "2026-08-01").after;

    // When another is added from today
    const made = next({ add: [outsider] }, undefined, drafted);

    // Then the first keeps their day, and the second has none
    expect(made.after.memberFrom).toEqual({ [joining]: "2026-08-01" });
    expect(made.dated).toEqual([]);
  });

  it("moves a change the draft makes to the day given when it is asked for again", () => {
    // Given a draft adding one person and removing another from a day
    const drafted = next(
      { add: [joining], remove: [member] },
      "2026-08-01",
    ).after;

    // When both are asked for again from another day
    const made = next(
      { add: [joining], remove: [member] },
      "2026-09-01",
      drafted,
    );

    // Then both changes move to it, with no one added or removed again
    expect(made.added).toEqual([]);
    expect(made.dayPeople).toEqual([joining, member]);
    expect(made.after.memberFrom).toEqual({
      [joining]: "2026-09-01",
      [member]: "2026-09-01",
    });
  });

  it("takes back a change the draft makes from today, leaving the team as it is live, whatever day it was given", () => {
    // Given a draft removing someone from a day
    const drafted = next({ remove: [member] }, "2026-08-01").after;

    // When they are added back from today
    const made = next({ add: [member] }, undefined, drafted);

    // Then the team is as it is live
    expect(made.after).toEqual(live);
  });

  it("keeps no day for a change taken back from another day", () => {
    // Given a draft adding someone from a day
    const drafted = next({ add: [joining] }, "2026-08-01").after;

    // When they are removed again from another day
    const made = next({ remove: [joining] }, "2026-09-01", drafted);

    // Then the change is taken back, with no day kept

    expect(made.dayPeople).toEqual([joining]);
    expect(made.dated).toEqual([]);
    expect(made.after).toEqual(live);
  });

  it("holds a change of lead's day under the new lead", () => {
    const made = next({ leadId: member }, "2026-08-01");

    expect(made.after.leadFrom).toEqual({ [member]: "2026-08-01" });
    expect(made.leadChanges).toBe(true);
  });

  it("holds the day under the old lead when the lead leaves the team and no one replaces them", () => {
    const made = next({ remove: [lead] }, "2026-08-01");

    expect(made.after.leadFrom).toEqual({ [lead]: "2026-08-01" });
  });

  it("holds the day under the old lead when the team is left with no lead, keeping them as a member", () => {
    const made = next({ leadId: null }, "2026-08-01");

    expect(made.after).toMatchObject({
      leadId: null,
      members: [lead, member],
      leadFrom: { [lead]: "2026-08-01" },
    });
    expect(made.leadChanges).toBe(true);
  });

  it("holds no day for a change of lead from today", () => {
    const made = next({ leadId: member });

    expect(made.after).not.toHaveProperty("leadFrom");
    expect(made.leadChanges).toBe(true);
  });

  it("moves a drafted change of lead to the new day given for the same lead", () => {
    // Given a draft changing the lead from a day
    const drafted = next({ leadId: member }, "2026-08-01").after;

    // When the same lead is chosen from another day
    const made = next({ leadId: member }, "2026-10-01", drafted);

    // Then the change of lead takes that day

    expect(made.after.leadFrom).toEqual({ [member]: "2026-10-01" });
  });

  it("takes back a drafted change of lead whatever day is given", () => {
    // Given a draft changing the lead from a day
    const drafted = next({ leadId: member }, "2026-08-01").after;

    // When the live lead is chosen again from another day
    const made = next({ leadId: lead }, "2025-01-01", drafted);

    // Then the team is as it is live

    expect(made.after).toEqual(live);
    expect(made.leadChanges).toBe(false);
  });

  it("keeps a change of lead's day when a later edit doesn't change the lead", () => {
    // Given a draft changing the lead from a day
    const drafted = next({ leadId: member }, "2026-08-01").after;

    // When someone is added from a later day
    const made = next({ add: [joining] }, "2026-10-01", drafted);

    // Then the lead's day is kept, apart from the day they join
    expect(made.after).toMatchObject({
      leadFrom: { [member]: "2026-08-01" },
      memberFrom: { [joining]: "2026-10-01" },
    });
    expect(made.leadChanges).toBe(false);
  });

  it("keeps the day someone joins apart from the later day they become lead", () => {
    // Given a draft adding someone from a day
    const drafted = next({ add: [joining] }, "2026-08-01").after;

    // When they are made lead from a later day
    const made = next({ leadId: joining }, "2026-09-01", drafted);

    // Then each day is kept apart

    expect(made.after).toMatchObject({
      memberFrom: { [joining]: "2026-08-01" },
      leadFrom: { [joining]: "2026-09-01" },
    });
    expect(made.leadJoinsOn).toBe("2026-08-01");
  });

  it("drops a change of lead's day once the lead is changed back without one", () => {
    // Given a draft changing the lead from a day
    const drafted = next({ leadId: member }, "2026-08-01").after;

    // When the live lead is chosen again from today
    const made = next({ leadId: lead }, undefined, drafted);

    // Then the team is as it is live

    expect(made.after).toEqual(live);
  });

  it("takes today as the day a lead joins when the draft adds them from today", () => {
    // Given a draft adding someone from today
    const drafted = next({ add: [joining] }).after;

    // When they are made lead from a later day
    const made = next({ leadId: joining }, "2026-09-01", drafted);

    // Then they join today
    expect(made.leadJoinsOn).toBe(today);
  });

  it.each([
    ["a lead on the live team", member],
    ["no lead", null],
  ])("gives no day a lead joins for %s", (_, leadId) => {
    expect(next({ leadId }).leadJoinsOn).toBeUndefined();
  });

  it("makes a team with no members and no lead its first members and lead", () => {
    const made = nextTeamDraft(
      { before: undefined, team: { name: "Fictional Team", leadId: null } },
      { leadId: joining },
      { from: "2026-08-01", today },
    );

    expect(made.after).toEqual({
      name: "Fictional Team",
      leadId: joining,
      members: [joining],
      memberFrom: { [joining]: "2026-08-01" },
      leadFrom: { [joining]: "2026-08-01" },
    });
    expect(made.leadJoinsOn).toBe("2026-08-01");
  });
});

describe("a team's name", () => {
  const names: [string, string][] = [
    [team, "Fictional Team"],
    [otherTeam, " Fictional Other "],
  ];

  it("is taken when another team has it, ignoring letter case and spaces around it", () => {
    expect(nameIsTaken(names, "FICTIONAL OTHER", team)).toBe(true);
    expect(nameIsTaken(names, "  fictional team", otherTeam)).toBe(true);
  });

  it("is kept by its own team in another letter case", () => {
    expect(nameIsTaken(names, "FICTIONAL TEAM", team)).toBe(false);
  });

  it("is free when no team has it", () => {
    expect(nameIsTaken(names, "Fictional New", team)).toBe(false);
  });
});

describe("the day someone joins or leaves a team", () => {
  const everyone: Everyone = new Map([
    [member, someone({ startDate: "2025-03-01", endDate: "2098-06-30" })],
  ]);
  const day = (from: string, teamId = team): MemberDay => ({
    teamId,
    memberId: member,
    from,
  });
  const record = (fromDate: string, teamId = team, memberId = member) => ({
    teamId,
    memberId,
    fromDate,
  });
  const refusal = (from: string, records = [record("2025-06-01")]) =>
    daysRefusal([day(from)], records, everyone, draftingRefusals);

  it("is refused on the day of their latest record on that team, naming it", () => {
    expect(refusal("2025-06-01")).toBe(
      "This person last joined or left this team on 2025-06-01. Choose a later date.",
    );
  });

  it("is refused before their latest record on that team, whatever order the records come in", () => {
    const records = [record("2025-08-01"), record("2025-06-01")];

    expect(refusal("2025-07-01", records)).toBe(
      "This person last joined or left this team on 2025-08-01. Choose a later date.",
    );
  });

  it("is accepted after their latest record on that team", () => {
    expect(refusal("2025-09-01")).toBeUndefined();
  });

  it("is not compared with their records on another team, or others' on that team", () => {
    const records = [
      record("2025-06-01", otherTeam),
      record("2025-06-01", team, joining),
    ];

    expect(refusal("2025-04-01", records)).toBeUndefined();
  });

  it("is refused before their start date", () => {
    expect(refusal("2025-02-28", [])).toBe(
      "Someone can't join or leave a team before their start date",
    );
  });

  it("is refused after their end date", () => {
    expect(refusal("2099-01-01", [])).toBe(
      "Someone can't join or leave a team after their end date",
    );
  });

  it.each([
    ["start date", "2025-03-01"],
    ["end date", "2098-06-30"],
  ])("is accepted on their %s", (_, from) => {
    expect(refusal(from, [])).toBeUndefined();
  });

  it("names the first of several days that would not take effect", () => {
    // Given one day too early on another team, and one after the end date
    const days = [day("2099-01-01", otherTeam), day("2025-05-01")];

    // When both are checked
    const found = daysRefusal(
      days,
      [record("2025-06-01")],
      everyone,
      draftingRefusals,
    );

    // Then the first is named
    expect(found).toBe(
      "Someone can't join or leave a team after their end date",
    );
  });

  describe("for a planned hire", () => {
    const hires: Everyone = new Map([[hire, plannedHire()]]);
    const hireDay = (from: string): MemberDay => ({
      teamId: team,
      memberId: hire,
      from,
    });
    const tooEarly =
      "This planned hire is expected in Jun 2026. Choose a day from then on.";

    it("is refused for joining before the month it's expected, naming the month", () => {
      expect(
        daysRefusal([hireDay("2026-05-31")], [], hires, draftingRefusals),
      ).toBe(tooEarly);
    });

    it.each(["2026-06-01", "2099-01-01"])(
      "is accepted from the month it's expected, as on %s, since a planned hire never leaves",
      (from) => {
        expect(
          daysRefusal([hireDay(from)], [], hires, draftingRefusals),
        ).toBeUndefined();
      },
    );

    it("is refused on the day of its latest record on that team, as a person's is", () => {
      expect(
        daysRefusal(
          [hireDay("2026-07-01")],
          [record("2026-07-01", team, hire)],
          hires,
          draftingRefusals,
        ),
      ).toBe(
        "This planned hire last joined or left this team on 2026-07-01. Choose a later date.",
      );
    });

    it("is accepted for leaving before the month it's expected, as when its target date moved later", () => {
      expect(
        daysRefusal(
          [{ ...hireDay("2026-05-01"), leaves: true }],
          [],
          hires,
          draftingRefusals,
        ),
      ).toBeUndefined();
    });

    it("is checked alone among days given with no day chosen, leaving people's alone", () => {
      // Given a person not yet started and a planned hire not yet expected, both joining today
      const both: Everyone = new Map<string, Member>([
        [joining, someone({ started: false, startDate: "2099-01-01" })],
        [hire, plannedHire({ firstDay: "2026-06-01" })],
      ]);
      const days = [joining, hire].map((memberId) => ({
        teamId: team,
        memberId,
        from: "2026-05-15",
      }));

      // When their days are checked
      const found = plannedHireDaysRefusal(days, both, draftingRefusals);

      // Then only the planned hire's is refused
      expect(found).toBe(tooEarly);
      expect(
        plannedHireDaysRefusal(days.slice(0, 1), both, draftingRefusals),
      ).toBeUndefined();
    });

    it("is accepted from today once it's expected", () => {
      expect(
        plannedHireDaysRefusal([hireDay(today)], hires, draftingRefusals),
      ).toBeUndefined();
    });
  });

  it("names someone not read as a person when their day comes too early", () => {
    expect(
      daysRefusal(
        [{ teamId: team, memberId: "person-unknown", from: "2025-06-01" }],
        [record("2025-06-01", team, "person-unknown")],
        everyone,
        draftingRefusals,
      ),
    ).toBe(
      "This person last joined or left this team on 2025-06-01. Choose a later date.",
    );
  });

  it("leaves someone who is not a person to the members' check", () => {
    expect(
      employmentDayRefusal(
        { teamId: team, memberId: "person-unknown", from: "2025-01-01" },
        everyone,
        draftingRefusals,
      ),
    ).toBeUndefined();
  });
});

describe("the day a team's lead changes", () => {
  it.each([
    ["on", "2099-03-01"],
    ["before", "2099-02-01"],
  ])("is refused %s the team's last change of lead, naming it", (_, from) => {
    expect(leadDayRefusal(from, ["2099-03-01", "2026-01-01"])).toBe(
      "This team's lead last changed on 2099-03-01. Choose a later date.",
    );
  });

  it("is accepted after the team's last change of lead", () => {
    expect(leadDayRefusal("2099-03-02", ["2099-03-01"])).toBeUndefined();
  });

  it("is accepted for a team whose lead never changed", () => {
    expect(leadDayRefusal("2026-01-01", [])).toBeUndefined();
  });
});

describe("a new lead on the team", () => {
  const offTeam = "Choose a day when the new lead is on this team";
  const records = [
    { member: true, fromDate: "2025-01-01" },
    { member: false, fromDate: "2026-01-01" },
  ];

  it("is accepted on a day their records have them on the team", () => {
    expect(
      leadOffTeamRefusal(records, "2025-06-01", undefined),
    ).toBeUndefined();
  });

  it("is judged by their records whatever order they come in", () => {
    expect(
      leadOffTeamRefusal([...records].reverse(), "2026-02-01", undefined),
    ).toBe(offTeam);
  });

  it.each([
    ["their records have them off the team", records, "2026-02-01"],
    ["before their first record", records, "2024-12-31"],
    ["they have no records", [], "2026-02-01"],
  ])("is refused on a day %s", (_, held, from) => {
    expect(leadOffTeamRefusal(held, from, undefined)).toBe(offTeam);
  });

  it.each([
    ["on", "2099-03-01"],
    ["after", "2099-02-01"],
  ])("is accepted %s the day they join in the draft", (_, joinsOn) => {
    expect(leadOffTeamRefusal([], "2099-03-01", joinsOn)).toBeUndefined();
  });

  it("is refused before the day they join in the draft, whatever their records say", () => {
    expect(leadOffTeamRefusal(records, "2025-06-01", "2099-03-01")).toBe(
      offTeam,
    );
  });
});

describe("a planned hire's days in a team's draft", () => {
  const live = { name: "Fictional Team", leadId: lead, members: [lead] };
  const otherHire = "hire-other";
  const isHire = (id: string) => id === hire || id === otherHire;
  const next = (
    change: Parameters<typeof nextTeamDraft>[1],
    {
      before = live,
      team = before,
      from = "2026-08-01",
    }: {
      before?: Record<string, unknown>;
      team?: Record<string, unknown>;
      // Null for no day chosen.
      from?: string | null;
    } = {},
  ) =>
    nextTeamDraft({ before, team }, change, {
      from: from ?? undefined,
      today,
      isHire,
    });

  it("holds a change dating only planned hires as General", () => {
    const made = next({ add: [hire, otherHire] });

    expect(made.after.hireFrom).toEqual({
      [hire]: "2026-08-01",
      [otherHire]: "2026-08-01",
    });
    expect(made.after.memberFrom).toBeUndefined();
    expect(made.datesOnlyHires).toBe(true);
  });

  it("holds a planned hire's day with people's when the same change dates a person", () => {
    const made = next({ add: [hire, joining] });

    expect(made.after.memberFrom).toEqual({
      [hire]: "2026-08-01",
      [joining]: "2026-08-01",
    });
    expect(made.after.hireFrom).toBeUndefined();
    expect(made.datesOnlyHires).toBe(false);
  });

  it("holds the day a planned hire takes over from a person as the lead with people's", () => {
    const made = next({ leadId: hire });

    expect(made.after.leadFrom).toEqual({ [hire]: "2026-08-01" });
    expect(made.after.hireLeadFrom).toBeUndefined();
    expect(made.datesOnlyHires).toBe(false);
  });

  it("judges a change of lead by the live lead, a person, though the draft has a planned hire leading", () => {
    // Given a live team a person leads, whose draft makes a planned hire its lead
    const drafted = next({ leadId: hire }, { from: null }).after;

    // When another planned hire is made its lead from a later day
    const made = next({ leadId: otherHire }, { team: drafted });

    // Then the day is the day the person stops leading, held with people's
    expect(made.after.leadFrom).toEqual({ [otherHire]: "2026-08-01" });
    expect(made.datesOnlyHires).toBe(false);
  });

  it("holds the day one planned hire takes over from another as the lead as General", () => {
    const hireLed = { ...live, leadId: hire, members: [lead, hire, otherHire] };

    const made = next({ leadId: otherHire }, { before: hireLed });

    expect(made.after.hireLeadFrom).toEqual({ [otherHire]: "2026-08-01" });
    expect(made.datesOnlyHires).toBe(true);
  });

  it("judges a change dating no one, such as a rename, as a person's, as before planned hires", () => {
    expect(next({ name: "Fictional Renamed" }).datesOnlyHires).toBe(false);
  });

  it("keeps each day where an earlier change held it", () => {
    // Given a draft holding a planned hire's day as General
    const drafted = next({ add: [hire] }).after;

    // When a person is added from another day, and the planned hire is kept
    const made = next(
      { add: [joining] },
      { team: drafted, from: "2026-09-01" },
    );

    // Then each day stays where its change held it
    expect(made.after.hireFrom).toEqual({ [hire]: "2026-08-01" });
    expect(made.after.memberFrom).toEqual({ [joining]: "2026-09-01" });
  });

  it("keeps a planned hire's day when a later change gives none", () => {
    const drafted = next({ add: [hire] }).after;

    const made = next({ add: [joining] }, { team: drafted, from: null });

    expect(made.after.hireFrom).toEqual({ [hire]: "2026-08-01" });
    expect(made.after.memberFrom).toBeUndefined();
  });

  it("moves a planned hire's day with people's when a change dating a person moves it", () => {
    const drafted = next({ add: [hire] }).after;

    const made = next(
      { add: [hire, joining] },
      { team: drafted, from: "2026-09-01" },
    );

    expect(made.after.memberFrom).toEqual({
      [hire]: "2026-09-01",
      [joining]: "2026-09-01",
    });
    expect(made.after.hireFrom).toBeUndefined();
  });

  it("keeps a lead day where the change of lead held it when a later change leaves the lead", () => {
    const hireLed = { ...live, leadId: hire, members: [lead, hire, otherHire] };
    const drafted = next({ leadId: otherHire }, { before: hireLed }).after;

    const made = next(
      { add: [joining] },
      { before: hireLed, team: drafted, from: null },
    );

    expect(made.after.hireLeadFrom).toEqual({ [otherHire]: "2026-08-01" });
  });
});

describe("whether a planned hire is on a team today or later", () => {
  const joins = (fromDate: string) => ({ member: true, fromDate });
  const leaves = (fromDate: string) => ({ member: false, fromDate });

  it.each([
    ["it joined before today", [joins("2026-01-01")]],
    ["it joins later", [joins("2099-01-01")]],
    ["it leaves later", [joins("2026-01-01"), leaves("2099-01-01")]],
    [
      "it left and joins again later, whatever order its records come in",
      [joins("2099-01-01"), leaves("2026-02-01"), joins("2026-01-01")],
    ],
  ])("is when %s", (_, records) => {
    expect(onTeamTodayOrLater(records, today)).toBe(true);
  });

  it.each([
    ["it left today", [joins("2026-01-01"), leaves(today)]],
    ["it left before today", [joins("2026-01-01"), leaves("2026-02-01")]],
    ["it has no records", []],
  ])("isn't when %s", (_, records) => {
    expect(onTeamTodayOrLater(records, today)).toBe(false);
  });
});

describe("whether a member has left or not yet started", () => {
  it.each([
    ["a person who has left", someone({ left: true }), true, false],
    ["a person not yet started", someone({ started: false }), false, true],
    ["a current person", someone(), false, false],
    ["a planned hire, which has no dates", plannedHire(), false, false],
    ["someone not read", undefined, false, false],
  ])("is answered for %s", (_, member, left, notStarted) => {
    expect(hasLeft(member)).toBe(left);
    expect(notYetStarted(member)).toBe(notStarted);
  });
});
