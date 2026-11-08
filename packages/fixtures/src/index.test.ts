// SPDX-License-Identifier: Apache-2.0

// Tests for the fictional organization: the same records every time, identifiers that are valid and
// unique, names from several countries and scripts, people whose details are consistent and drawn
// from the lists their columns name, and the newest starters' onboarding notes.

import { en_IN } from "@faker-js/faker";
import { addDays } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  fictionalId,
  fictionalOrganization,
  onboarding,
  onboardingSteps,
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
      const progress = started.map((person) => ticked(noteOf(person)));
      expect(progress).toEqual([...progress].sort((a, b) => a - b));
      expect(progress[0]).toBeGreaterThan(0);
      expect(progress.at(-1)).toBe(onboardingSteps("").length);
      expect(new Set(progress).size).toBeGreaterThan(2);
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
      for (const hire of after.hires) {
        if (hire.targetDate !== null && hire.filledBy === null) {
          expect(hire.targetDate > referenceDate).toBe(true);
        }
      }
      expect(
        after.featureTeams.map(({ name, leadId, memberships }) => [
          name,
          leadId,
          memberships,
        ]),
      ).toEqual(
        before.featureTeams.map(({ name, leadId, memberships }) => [
          name,
          leadId,
          memberships.map(({ fromDate, ...rest }) => ({
            ...rest,
            fromDate: addDays(fromDate, days),
          })),
        ]),
      );
    },
  );
});
