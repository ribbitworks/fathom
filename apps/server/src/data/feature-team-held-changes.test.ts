// SPDX-License-Identifier: Apache-2.0

// Unit tests for taking a change of someone's teams from a day or a month: what it changes, and why
// a team's draft or approved records refuse it.

import { describe, expect, it } from "vitest";
import {
  heldChange,
  heldTeamChange,
  monthRefusals,
  type Period,
} from "./feature-team-held-changes.ts";
import { draftingRefusals, type Everyone } from "./feature-team-rules.ts";
import { someone } from "./test-feature-team-people.ts";

const today = "2026-06-15";
const team = "team-1";
const member = "person-member";
const joining = "person-joining";
const outsider = "person-outsider";

describe("the refusals of a change of someone's teams from a month", () => {
  const refusals = monthRefusals("Fictional Person", "Fictional Team");

  it("name the person, the team and the month when a later approved change holds it", () => {
    expect(
      refusals.outOfOrder(
        { teamId: team, personId: member, from: "2026-08-01" },
        "2026-09-01",
      ),
    ).toBe(
      "Fictional Person has an approved change on Fictional Team in this month or later, so this month can't change here.",
    );
  });

  it("refuse a month outside someone's employment as drafting does", () => {
    const day = { teamId: team, personId: member, from: "2026-08-01" };

    expect(refusals.beforeStart(day)).toBe(draftingRefusals.beforeStart(day));
    expect(refusals.afterEnd(day)).toBe(draftingRefusals.afterEnd(day));
  });
});

describe("a change of someone's team from a day", () => {
  const live = { name: "Fictional Team", members: [member] };
  const names = { personName: "Fictional Person", teamName: "Fictional Team" };
  const held = (
    {
      team: drafted = live,
      member: joins,
      liveOnDay,
    }: {
      team?: Record<string, unknown>;
      member: boolean;
      liveOnDay: boolean;
    },
    personId: string,
    {
      day = "2026-08-01",
      period = "month",
    }: { day?: string; period?: Period } = {},
  ) =>
    heldTeamChange(
      { before: live, team: drafted },
      personId,
      { member: joins, liveOnDay },
      { day, today, period },
      names,
    );
  const draftAdding = (memberFrom?: Record<string, string>) => ({
    ...live,
    members: [joining, member],
    ...(memberFrom === undefined ? {} : { memberFrom }),
  });

  it("changes a team its draft removes, for drafting to refuse", () => {
    expect(
      heldTeamChange(
        { before: live, team: undefined },
        member,
        { member: false, liveOnDay: true },
        { day: "2026-08-01", today, period: "month" },
        names,
      ),
    ).toEqual({ changes: true });
  });

  it.each([
    ["adds someone not on the team", joining, true, false],
    ["takes away someone on the team", member, false, true],
    [
      "adds someone not on the team today who is on it that day",
      joining,
      true,
      true,
    ],
    [
      "takes away someone on the team today who is off it that day",
      member,
      false,
      false,
    ],
  ])("changes the team when it %s", (_, personId, joins, liveOnDay) => {
    expect(held({ member: joins, liveOnDay }, personId)).toEqual({
      changes: true,
    });
  });

  it.each([
    ["adds someone on the team that day", member, true, true],
    ["takes away someone off the team that day", joining, false, false],
  ])("changes nothing when it %s", (_, personId, joins, liveOnDay) => {
    expect(held({ member: joins, liveOnDay }, personId)).toEqual({
      changes: false,
    });
  });

  it.each(["month", "date"] as const)(
    "is refused by %s after an approved change still to come",
    (period) => {
      // Given someone on the team today, approved to leave before the day
      // When they are added from that day
      const found = held({ member: true, liveOnDay: false }, member, {
        period,
      });

      // Then the approved change is named, by the period the reader plans by
      expect(found).toEqual({
        refusal: `Fictional Person has an approved change on Fictional Team before this ${period}. This ${period} can change once it takes effect.`,
      });
    },
  );

  it("changes the team when it asks again for a change the draft makes, so the change can move", () => {
    // Given a draft adding someone from a day
    const team = draftAdding({ [joining]: "2026-10-01" });

    // When they are added again from another day
    const found = held({ team, member: true, liveOnDay: false }, joining);

    // Then the change is made, moving the draft's change
    expect(found).toEqual({ changes: true });
  });

  it.each([
    ["another day of the same month", "month", "2026-08-20"],
    ["the same date", "date", "2026-08-01"],
  ] as const)(
    "takes back a change the draft makes from %s",
    (_, period, day) => {
      // Given a draft adding someone from a day
      const team = draftAdding({ [joining]: "2026-08-01" });

      // When they are taken away from a day in the same period
      const found = held({ team, member: false, liveOnDay: false }, joining, {
        day,
        period,
      });

      // Then the change is made, taking the draft's change back
      expect(found).toEqual({ changes: true });
    },
  );

  it("takes back a change the draft makes from today, in the current month", () => {
    // Given a draft adding someone from today
    const team = draftAdding();

    // When they are taken away from today
    const found = held({ team, member: false, liveOnDay: false }, joining, {
      day: today,
    });

    // Then the change is made, taking the draft's change back
    expect(found).toEqual({ changes: true });
  });

  it.each([
    ["month", "2026-09-01"],
    ["date", "2026-08-02"],
  ] as const)(
    "is refused taking back a change the draft makes from another %s",
    (period, day) => {
      // Given a draft adding someone from a day
      const team = draftAdding({ [joining]: "2026-08-01" });

      // When they are taken away from another period
      const found = held({ team, member: false, liveOnDay: false }, joining, {
        day,
        period,
      });

      // Then the draft is named, with what to do
      expect(found).toEqual({
        refusal: `The draft of Fictional Team already changes Fictional Person from another ${period}. Approve or discard that draft first.`,
      });
    },
  );
});

describe("a change of a team's members from another day", () => {
  const live = { name: "Fictional Team", members: [member] };
  const when = { day: "2026-08-01", today };
  const everyone: Everyone = new Map([
    [member, someone({ preferredName: "Fictional Member" })],
    [joining, someone()],
    [outsider, someone({ left: true, endDate: "2021-06-30" })],
  ]);
  const held = (
    change: Parameters<typeof heldChange>[1],
    onDay: string[] = [member],
    team: Record<string, unknown> = live,
  ) => heldChange({ before: live, team }, change, { everyone, onDay }, when);

  it("keeps those it changes, and the rest of the change", () => {
    // Given a change adding someone, removing another, and renaming the team
    const change = {
      add: [joining],
      remove: [member],
      name: "Fictional New",
      from: "2026-08-01",
    };

    // When it is held against the team
    const found = held(change);

    // Then all of it is kept
    expect(found).toEqual({ change });
  });

  it("leaves out those it changes nothing about", () => {
    expect(held({ add: [member], remove: [joining] })).toEqual({
      change: { add: [], remove: [] },
    });
  });

  it.each([
    ["who has left", outsider],
    ["who is not a person", "person-unknown"],
  ])("keeps someone %s for drafting to refuse", (_, personId) => {
    expect(held({ add: [personId] })).toEqual({ change: { add: [personId] } });
  });

  it("adds no list the change does not hold", () => {
    expect(held({ remove: [member] })).toEqual({
      change: { remove: [member] },
    });
  });

  it("names the first refusal, of those it adds before those it removes", () => {
    // Given someone on the team today but not on the day, and someone off it today but on it then
    // When the first is added and the second removed from that day
    const found = held({ add: [member], remove: [joining] }, [joining]);

    // Then the addition's refusal is named
    expect(found).toEqual({
      refusal:
        "Fictional Member has an approved change on Fictional Team before this date. This date can change once it takes effect.",
    });
  });

  it("is refused by date, naming the person and the team, when the team's draft can't hold it", () => {
    // Given someone on the team today but not on the day
    // When they are added from that day
    const found = held({ add: [member] }, []);

    // Then the approved change before it is named by date
    expect(found).toEqual({
      refusal:
        "Fictional Member has an approved change on Fictional Team before this date. This date can change once it takes effect.",
    });
  });
});
