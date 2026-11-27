// SPDX-License-Identifier: Apache-2.0

// Tests for the fictional organization: its people, lists, feature teams and planned hires, the
// same every time.

import { en_IN } from "@faker-js/faker";
import { addDays, addMonths } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  fictionalId,
  fictionalOrganization,
  firstUnnamed,
  lastOnNoTeam,
  leavingInDays,
  onboarding,
  onboardingSteps,
  starterHandbook,
} from "./index.ts";

const version5 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("fictional identifiers", () => {
  it("are version 5 UUIDs, the same for the same name and different for others", () => {
    expect(fictionalId("person:1")).toMatch(version5);
    expect(fictionalId("person:1")).toBe(fictionalId("person:1"));
    expect(fictionalId("person:1")).not.toBe(fictionalId("person:2"));
  });
});

describe("a fictional organization", () => {
  const organization = fictionalOrganization({ size: 150 });

  it("comes out the same every time, and differently from another seed", () => {
    expect(fictionalOrganization({ size: 150 })).toEqual(organization);
    expect(fictionalOrganization({ size: 150, seed: 7 }).people).not.toEqual(
      organization.people,
    );
  });

  it("names people mostly as in Canada, then India, and some from elsewhere, accented and in other scripts", () => {
    const names = organization.people.map(({ preferredName }) => preferredName);
    const given = en_IN.person?.first_name;
    const indian = new Set([...(given?.female ?? []), ...(given?.male ?? [])]);
    const latin = names.filter((name) =>
      /^[\p{Script=Latin}' .-]+$/u.test(name),
    );
    const fromIndia = latin.filter((name) =>
      indian.has(name.split(" ")[0] ?? ""),
    );
    expect(latin.length).toBeGreaterThan(names.length * 0.7);
    expect(names.some((name) => /[À-ÿ]/u.test(name))).toBe(true);
    expect(fromIndia.length).toBeGreaterThan(0);
    expect(fromIndia.length).toBeLessThan(latin.length / 2);
    for (const script of [
      /\p{Script=Hangul}/u,
      /\p{Script=Han}/u,
      /\p{Script=Cyrillic}/u,
    ]) {
      expect(
        names.some((name) => script.test(name)),
        String(script),
      ).toBe(true);
    }
    // Never with a title, such as Dr. or PhD.
    expect(
      names.filter((name) => /\b(Dr|Mr|Mrs|Ms|Miss|PhD|MD|Sr|Jr)\b/.test(name)),
    ).toEqual([]);
  });

  it("has unique identifiers and Employee IDs, and end dates after start dates", () => {
    const ids = [
      ...organization.lists.flatMap((list) => [
        list.id,
        ...list.choices.map(({ id }) => id),
      ]),
      ...organization.positions.map(({ id }) => id),
      ...organization.columns.map(({ id }) => id),
      ...organization.people.map(({ id }) => id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    const employeeIds = organization.people.map(({ employeeId }) => employeeId);
    expect(new Set(employeeIds).size).toBe(employeeIds.length);
    for (const person of organization.people) {
      if (person.endDate !== null) {
        expect(person.endDate >= String(person.startDate)).toBe(true);
      }
    }
  });

  it("includes current and former staff, and people who start after the reference date", () => {
    const { people } = organization;
    expect(people.some(({ endDate }) => endDate !== null)).toBe(true);
    expect(
      people.some(({ startDate }) => String(startDate) > "2026-11-01"),
    ).toBe(true);
    expect(
      people.filter(({ endDate }) => endDate === null).length,
    ).toBeGreaterThan(people.length / 2);
  });

  it("gives each person choices from the lists their columns draw on, one each unless a column takes several", () => {
    for (const person of organization.people) {
      for (const [columnId, chosen] of Object.entries(person.values)) {
        const column = organization.columns.find(({ id }) => id === columnId);
        const list = organization.lists.find(({ id }) => id === column?.listId);
        const offered = list?.choices.map(({ id }) => id) ?? [];
        expect(chosen.every((id) => offered.includes(id))).toBe(true);
        if (!column?.multiple) expect(chosen).toHaveLength(1);
      }
    }
  });

  describe("feature teams", () => {
    const { referenceDate } = organization;
    const membersOn = (
      team: (typeof organization.featureTeams)[number],
      day: string,
    ) => {
      const latest = new Map<string, boolean>();
      for (const { personId, member, fromDate } of [...team.memberships].sort(
        (a, b) => a.fromDate.localeCompare(b.fromDate),
      )) {
        if (fromDate <= day) latest.set(personId, member);
      }
      return [...latest].filter(([, member]) => member).map(([id]) => id);
    };

    it("hold over half the current people who manage no one", () => {
      const onTeams = new Set(
        organization.featureTeams.flatMap((team) =>
          membersOn(team, referenceDate),
        ),
      );
      const working = organization.people.filter(
        ({ startDate, endDate, isManager }) =>
          !isManager &&
          String(startDate) <= referenceDate &&
          (endDate === null || endDate > referenceDate),
      );
      expect(
        working.filter(({ id }) => onTeams.has(id)).length / working.length,
      ).toBeGreaterThan(0.5);
    });

    it("let people join only once they start", () => {
      const startOf = new Map(
        organization.people.map(({ id, startDate }) => [id, startDate]),
      );
      for (const { memberships } of organization.featureTeams) {
        for (const { personId, fromDate } of memberships) {
          expect(String(startOf.get(personId)) <= fromDate).toBe(true);
        }
      }
    });

    it("move people from one team to another, leaving it the day they join the next", () => {
      const moves = organization.featureTeams.flatMap((from) =>
        from.memberships
          .filter(({ member }) => !member)
          .flatMap(({ personId, fromDate }) => {
            const to = organization.featureTeams.find(
              (team) =>
                team !== from &&
                team.memberships.some(
                  (joined) =>
                    joined.member &&
                    joined.personId === personId &&
                    joined.fromDate === fromDate,
                ),
            );
            return to === undefined ? [] : [{ from, personId, fromDate }];
          }),
      );
      expect(moves.length).toBeGreaterThan(0);
      for (const { from, personId, fromDate } of moves) {
        expect(membersOn(from, addDays(fromDate, -1))).toContain(personId);
        expect(membersOn(from, fromDate)).not.toContain(personId);
      }
    });

    it.each([[2026], [3], [7], [20]])(
      "with seed %d, have each lead on their team from the day they lead it, in order",
      (seed) => {
        const seeded = fictionalOrganization({ size: 150, seed });
        for (const team of seeded.featureTeams) {
          const joinedOn = (personId: string | null) =>
            team.memberships
              .filter((one) => one.member && one.personId === personId)
              .map(({ fromDate }) => fromDate)
              .sort()[0];
          const leads = [
            ...(team.formerLead === undefined
              ? []
              : [
                  {
                    id: team.formerLead.personId,
                    from: joinedOn(team.formerLead.personId),
                  },
                ]),
            {
              id: team.leadId,
              from: team.formerLead?.until ?? joinedOn(team.leadId),
            },
          ].filter(({ id }) => id !== null);
          for (const { id, from } of leads) {
            expect(membersOn(team, String(from))).toContain(id);
          }
          const days = leads.map(({ from }) => String(from));
          expect(days).toEqual([...days].sort());
        }
      },
    );

    it("have a team whose lead took over from a former lead, both on it then", () => {
      const changed = organization.featureTeams.filter(
        ({ formerLead }) => formerLead !== undefined,
      );
      expect(changed.map(({ name }) => name)).toEqual(["Data pipeline"]);
      for (const team of changed) {
        const until = String(team.formerLead?.until);
        expect(membersOn(team, until)).toContain(team.formerLead?.personId);
        expect(membersOn(team, until)).toContain(team.leadId);
      }
    });

    it("have someone joining a team a month from now", () => {
      const ahead = organization.featureTeams.flatMap(({ name, memberships }) =>
        memberships
          .filter(({ fromDate }) => fromDate > referenceDate)
          .map(({ fromDate }) => [name, fromDate]),
      );
      expect(ahead).toEqual([["Integrations", addDays(referenceDate, 30)]]);
    });

    it("put the late hire on a team from its month, and the planned manager on it, leading, later", () => {
      const onTeams = organization.featureTeams.flatMap(
        ({ name, hires = [] }) => hires.map((hire) => ({ name, ...hire })),
      );
      const late = organization.hires.find(
        ({ requisition }) => requisition === "REQ-2053",
      );
      const planned = organization.hires.find(
        ({ isManager, managerId }) => isManager && managerId === null,
      );

      expect(onTeams).toEqual([
        {
          name: "Field tools",
          plannedHireId: late?.id,
          fromDate: `${String(late?.targetDate).slice(0, 7)}-01`,
          leads: false,
        },
        {
          name: "Field tools",
          plannedHireId: planned?.id,
          fromDate: `${addMonths(referenceDate, 3).slice(0, 7)}-01`,
          leads: true,
        },
      ]);
      expect(String(late?.targetDate) < referenceDate).toBe(true);
    });

    it("put no hire on a team in an organization too small for it", () => {
      const small = fictionalOrganization({ size: 20 });

      expect(small.featureTeams.flatMap(({ hires = [] }) => hires)).toEqual([]);
    });
  });

  describe("Confidential values", () => {
    const labelOf = new Map(
      organization.lists.flatMap(({ choices }) =>
        choices.map(({ id, label }) => [id, label]),
      ),
    );
    const columnId = (name: string) =>
      String(organization.columns.find((column) => column.name === name)?.id);
    const valueOf = (
      person: (typeof organization.people)[number],
      name: string,
    ) => labelOf.get(String(person.values[columnId(name)]?.[0]));
    const everyone = [...organization.people, ...organization.newcomers];

    it("are in two Confidential lists", () => {
      expect(
        organization.lists
          .filter(({ visibility }) => visibility === "confidential")
          .map(({ name }) => name),
      ).toEqual(["Compensation bands", "Performance ratings"]);
    });

    it("give everyone, newcomers too, the compensation band of their level, as it finally is", () => {
      const bands = {
        "Co-op": "Band 1",
        P1: "Band 1",
        P2: "Band 2",
        P3: "Band 3",
        P4: "Band 4",
        P5: "Band 5",
        M1: "Band 4",
        M2: "Band 4",
        M3: "Band 5",
        M4: "Band 5",
        M5: "Band 6",
      } as Record<string, string>;
      for (const person of everyone) {
        expect(valueOf(person, "Compensation band")).toBe(
          bands[String(valueOf(person, "Level"))],
        );
      }
    });

    it("give a rating a year in, Too early before, each rating given", () => {
      const yearAgo = addDays(organization.referenceDate, -365);
      for (const person of everyone) {
        expect(valueOf(person, "Performance rating") === "Too early").toBe(
          String(person.startDate) > yearAgo,
        );
      }
      expect(
        new Set(
          everyone.map((person) => valueOf(person, "Performance rating")),
        ),
      ).toEqual(new Set(["Exceeds", "Meets", "Developing", "Too early"]));
    });

    it("go with a filled planned hire's other values to it", () => {
      for (const hire of organization.hires.filter(
        ({ filledBy }) => filledBy,
      )) {
        const person = organization.people.find(
          ({ id }) => id === hire.filledBy,
        );
        expect(hire.values).toEqual(person?.values);
      }
    });
  });

  describe("onboarding notes", () => {
    const [column] = organization.columns.filter(({ type }) => type === "note");
    const noteOf = (person: { notes: Record<string, string> }) =>
      new Map(Object.entries(person.notes)).get(String(column?.id));
    const reference = "2026-11-01";
    const current = organization.people.filter(
      ({ endDate }) => endDate === null,
    );
    const newest = (people: typeof current, count: number) =>
      people
        .map(({ startDate }) => String(startDate))
        .sort()
        .reverse()
        .slice(0, count);
    const noted = organization.people.filter(
      (person) => noteOf(person) !== undefined,
    );
    const starting = noted.filter(
      ({ startDate }) => String(startDate) > reference,
    );
    const started = noted
      .filter(({ startDate }) => String(startDate) <= reference)
      .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
    const ticked = (note: string | undefined) =>
      (note ?? "").split("- [x]").length - 1;

    it("go to the newest starters still employed, some still to start, and no one else", () => {
      expect(newest(starting, onboarding.starting)).toEqual(
        newest(
          current.filter(({ startDate }) => String(startDate) > reference),
          onboarding.starting,
        ),
      );
      expect(newest(started, onboarding.started)).toEqual(
        newest(
          current.filter(({ startDate }) => String(startDate) <= reference),
          onboarding.started,
        ),
      );
      expect(noted).toHaveLength(onboarding.starting + onboarding.started);
    });

    it("have nothing done before day one, and are further along the earlier someone started, the earliest done", () => {
      for (const person of starting) {
        expect([
          ticked(noteOf(person)),
          noteOf(person)?.split("\n")[0],
        ]).toEqual([0, "## Before day one"]);
      }
      // The handbook the starter furthest along keeps has checkboxes of its own.
      const progress = started.map((person) =>
        ticked(noteOf(person)?.split(starterHandbook)[0]),
      );
      expect(progress).toEqual([...progress].sort((a, b) => a - b));
      expect(progress[0]).toBeGreaterThan(0);
      expect(progress.at(-1)).toBe(onboardingSteps("").length);
      expect(new Set(progress).size).toBeGreaterThan(2);
    });

    it("give the starter furthest along a handbook a few pages long, as notes allow", () => {
      const withHandbook = noted.filter((person) =>
        noteOf(person)?.includes(starterHandbook),
      );
      expect(withHandbook).toEqual([started.at(-1)]);
      const length = withHandbook.map(
        (person) => String(noteOf(person)).length,
      );
      expect(length[0]).toBeGreaterThan(5000);
      expect(length[0]).toBeLessThan(10_000);
    });

    it("name a buddy already working, who started before every starter with a note", () => {
      const earliest = String(started.at(-1)?.startDate);
      for (const person of noted) {
        const buddy = current.find(({ preferredName }) =>
          noteOf(person)?.includes(`**${preferredName}**`),
        );
        expect(buddy).toBeDefined();
        expect(buddy?.id).not.toBe(person.id);
        expect(String(buddy?.startDate) <= earliest).toBe(true);
      }
    });

    it("go to fewer starters when too few people are working to be their buddies, never their own", () => {
      const small = fictionalOrganization({ size: 16 });
      const [smallColumn] = small.columns.filter(({ type }) => type === "note");
      const smallNoted = small.people.filter(({ notes }) =>
        new Map(Object.entries(notes)).has(String(smallColumn?.id)),
      );
      expect(smallNoted.length).toBeGreaterThan(0);
      expect(smallNoted.length).toBeLessThan(
        onboarding.starting + onboarding.started,
      );
      for (const person of smallNoted) {
        const note = new Map(Object.entries(person.notes)).get(
          String(smallColumn?.id),
        );
        expect(note).not.toContain(`**${person.preferredName}**`);
      }
      const done = smallNoted.filter((person) =>
        new Map(Object.entries(person.notes))
          .get(String(smallColumn?.id))
          ?.includes("Done"),
      );
      expect(done.length).toBeGreaterThan(0);
    });
  });

  it("gives each person a position, never Architect, so a choice no one has can be removed", () => {
    const offered = new Map(
      organization.positions.map(({ id, label }) => [id, label]),
    );
    for (const person of organization.people) {
      expect(offered.has(person.positionId)).toBe(true);
      expect(offered.get(person.positionId)).not.toBe("Architect");
    }
  });

  it("gives people managers who are employed when each line starts, with no loops", () => {
    const byId = new Map(organization.people.map((one) => [one.id, one]));
    const managerOf = new Map(
      organization.reportingLines.map((line) => [
        line.personId,
        line.managerId,
      ]),
    );
    for (const line of organization.reportingLines) {
      const person = byId.get(line.personId);
      const manager = byId.get(line.managerId);
      expect(line.personId).not.toBe(line.managerId);
      for (const one of [person, manager]) {
        expect(line.fromDate >= String(one?.startDate)).toBe(true);
        expect(one?.endDate == null || line.fromDate <= one.endDate).toBe(true);
      }
      expect(
        line.fromDate <= "2026-11-01" || line.fromDate === person?.startDate,
      ).toBe(true);
      const seen = new Set([line.personId]);
      for (let at = managerOf.get(line.personId); at; at = managerOf.get(at)) {
        expect(seen.has(at)).toBe(false);
        seen.add(at);
      }
    }
  });

  it("has a person with no manager, a manager who has left with reports, named and unnamed teams, and teams with and without colours", () => {
    const { people, reportingLines, teams } = organization;
    const current = people.filter(({ endDate }) => endDate === null);
    expect(
      current.some(
        ({ id }) => !reportingLines.some((line) => line.personId === id),
      ),
    ).toBe(true);
    const left = new Set(
      people.filter(({ endDate }) => endDate !== null).map(({ id }) => id),
    );
    expect(
      reportingLines.some(
        (line) =>
          left.has(line.managerId) &&
          current.some(({ id }) => id === line.personId),
      ),
    ).toBe(true);
    const managers = new Set(reportingLines.map(({ managerId }) => managerId));
    const named = new Set(teams.map(({ managerId }) => managerId));
    expect([...managers].some((id) => named.has(id))).toBe(true);
    expect([...managers].some((id) => !named.has(id))).toBe(true);
    const names = teams.map(({ name }) => name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    expect(teams.some(({ colour }) => colour !== null)).toBe(true);
    expect(teams.some(({ colour }) => colour === null)).toBe(true);
  });

  it("marks as managers everyone whose position is Engineering Manager, and so everyone a line names", () => {
    const named = new Set(
      organization.reportingLines.map(({ managerId }) => managerId),
    );
    const manager = organization.positions.find(
      ({ label }) => label === "Engineering Manager",
    )?.id;
    for (const person of organization.people) {
      expect(person.isManager).toBe(person.positionId === manager);
      if (named.has(person.id)) expect(person.isManager).toBe(true);
    }
  });

  it("has two current non-managers leaving soon whom nothing else uses", () => {
    const { referenceDate } = organization;
    const leaving = organization.people.filter(
      ({ endDate }) => endDate !== null && endDate > referenceDate,
    );
    expect(leaving.map(({ endDate }) => endDate)).toEqual(
      leavingInDays.map((days) => addDays(referenceDate, days)),
    );
    const onTeams = organization.featureTeams.flatMap(({ memberships }) =>
      memberships.map(({ personId }) => personId),
    );
    const notes = organization.people
      .flatMap(({ notes }) => Object.values(notes))
      .join("\n");
    for (const person of leaving) {
      expect(organization.people.indexOf(person)).toBeGreaterThanOrEqual(
        firstUnnamed,
      );
      expect(String(person.startDate) <= referenceDate).toBe(true);
      expect(person.isManager).toBe(false);
      expect(person.notes).toEqual({});
      expect(notes).not.toContain(`**${person.preferredName}**`);
      expect(onTeams).not.toContain(person.id);
      expect(organization.hires.map(({ filledBy }) => filledBy)).not.toContain(
        person.id,
      );
    }
  });

  it.each([[2026], [7]])(
    "with seed %d, leaves the person a seed draft adds to a feature team as they were",
    (seed) => {
      const seeded = fictionalOrganization({ size: 150, seed });
      const unchanged = fictionalOrganization({ size: 150, seed });
      for (const person of unchanged.people) {
        if (
          person.endDate !== null &&
          person.endDate > unchanged.referenceDate
        ) {
          person.endDate = null;
        }
      }
      expect(
        lastOnNoTeam(seeded.people, seeded.featureTeams, seeded.referenceDate)
          ?.id,
      ).toBe(
        lastOnNoTeam(
          unchanged.people,
          unchanged.featureTeams,
          unchanged.referenceDate,
        )?.id,
      );
    },
  );

  it("has a late open hire and a proposed hire, each under a current manager", () => {
    const { referenceDate } = organization;
    const byName = (name: string) =>
      organization.hires.find((hire) => hire.name === name);
    const late = byName("Data engineer");
    const proposed = byName("Mobile developer");
    expect(late).toMatchObject({ meaning: "open", requisition: "REQ-2053" });
    expect(late?.targetDate).toBeDefined();
    expect(String(late?.targetDate) < referenceDate).toBe(true);
    expect(proposed).toMatchObject({
      meaning: "proposed",
      requisition: "REQ-2055",
    });
    for (const hire of [late, proposed]) {
      const manager = organization.people.find(
        ({ id }) => id === hire?.managerId,
      );
      expect(manager?.isManager).toBe(true);
      expect(manager?.endDate).toBeNull();
    }
  });

  it("leaves people with no manager when none is employed for them, as in a tiny organization", () => {
    // With this seed, nobody has left and no manager is among the three.
    const tiny = fictionalOrganization({ size: 3, seed: 1 });
    expect(tiny.people.every(({ endDate }) => endDate === null)).toBe(true);
    expect(tiny.reportingLines).toEqual([]);
  });
});

describe("the organization on another day", () => {
  const before = fictionalOrganization({ size: 150 });
  const shifted = (day: string | null, days: number) =>
    day === null ? null : addDays(day, days);
  it.each(["2027-02-28", "2027-12-31", "2028-02-29"])(
    "on %s, has the same people and planned hires, with every person's dates moved by as many days",
    (referenceDate) => {
      const after = fictionalOrganization({ size: 150, referenceDate });
      const days =
        (Date.parse(referenceDate) - Date.parse(before.referenceDate)) /
        86_400_000;
      expect(after.referenceDate).toBe(referenceDate);
      expect(
        after.people.map(({ id, preferredName, startDate, endDate }) => [
          id,
          preferredName,
          startDate,
          endDate,
        ]),
      ).toEqual(
        before.people.map(({ id, preferredName, startDate, endDate }) => [
          id,
          preferredName,
          shifted(startDate, days),
          shifted(endDate, days),
        ]),
      );
      expect(
        after.hires.map(({ id, targetDate }) => [id, targetDate === null]),
      ).toEqual(
        before.hires.map(({ id, targetDate }) => [id, targetDate === null]),
      );
      expect(
        after.hires
          .filter(
            ({ targetDate, filledBy }) =>
              targetDate !== null &&
              filledBy === null &&
              targetDate <= referenceDate,
          )
          .map(({ name }) => name),
      ).toEqual(["Data engineer"]);
      expect(
        after.featureTeams.map(({ name, leadId, memberships, formerLead }) => [
          name,
          leadId,
          memberships,
          formerLead,
        ]),
      ).toEqual(
        before.featureTeams.map(({ name, leadId, memberships, formerLead }) => [
          name,
          leadId,
          memberships.map(({ fromDate, ...rest }) => ({
            ...rest,
            fromDate: addDays(fromDate, days),
          })),
          formerLead === undefined
            ? undefined
            : { ...formerLead, until: addDays(formerLead.until, days) },
        ]),
      );
    },
  );
});

describe("organizations built in one run", () => {
  it("share no lists, columns or positions, so changing one leaves the next as it was", () => {
    // Given
    const changed = fictionalOrganization({ size: 5 });
    const expected = structuredClone(fictionalOrganization({ size: 5 }));

    // When
    changed.lists.push({
      id: "added",
      name: "Added",
      visibility: "general",
      choices: [],
    });
    for (const list of changed.lists) {
      list.name = "Renamed";
      list.choices.push({ id: "added", label: "Added" });
      for (const option of list.choices) option.label = "Relabelled";
    }
    changed.columns.pop();
    for (const column of changed.columns) column.name = "Renamed";
    changed.positions.push({ id: "added", label: "Added" });
    for (const position of changed.positions) position.label = "Relabelled";
    const next = fictionalOrganization({ size: 5 });

    // Then
    expect(next.lists).toEqual(expected.lists);
    expect(next.columns).toEqual(expected.columns);
    expect(next.positions).toEqual(expected.positions);
  });
});
