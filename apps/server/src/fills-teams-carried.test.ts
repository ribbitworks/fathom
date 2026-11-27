// SPDX-License-Identifier: Apache-2.0

// Integration tests for what a planned hire's People row says filling it carries: the feature teams
// it is on today or later, with its records on them and as their lead, sent only on today, and for
// every role only what the role sees. The hire is recorded on its teams straight into their tables,
// to reach each state at once.

import { featureTeamLeads } from "@fathom/db";
import { type Permission, type Person, startingRoles } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ok, type User } from "./test-app.ts";
import {
  test,
  editor,
  planner,
  startFeatureTeamTests,
  closeFeatureTeamTests,
  send,
  person,
  plannedHire,
  liveTeam,
  hireOnTeam,
  hireLeading,
} from "./test-feature-teams.ts";

beforeAll(startFeatureTeamTests);

afterAll(closeFeatureTeamTests);

const on = (fromDate: string) => ({ member: true, fromDate });
const off = (fromDate: string) => ({ member: false, fromDate });

const rowOf = async (hire: string, who: User = editor, day?: string) =>
  (
    await ok<{ people: Person[] }>(
      await send(
        who,
        "GET",
        day === undefined ? "/api/people" : `/api/people?on=${day}`,
      ),
    )
  ).people.find((row) => row.id === hire);

// A team the hire is on since January, with its lead records, each naming the hire, a person, or no
// one, from its day.
async function ledInTurn(
  hire: string,
  turns: readonly (readonly ["hire" | "person" | "none", string])[],
) {
  const id = await liveTeam();
  await hireOnTeam(id, hire, { fromDate: "2026-01-01" });
  const someone = await person();
  for (const [who, fromDate] of turns) {
    if (who === "hire") await hireLeading(id, hire, fromDate);
    else {
      await test.connection.insert(featureTeamLeads).values({
        teamId: id,
        leadId: who === "person" ? someone : null,
        fromDate,
      });
    }
  }
  return id;
}

describe("the teams a planned hire's People row says filling it carries", () => {
  it("names the teams it is on today or later, with its records from today and as their lead", async () => {
    // Given a hire on one team since before today, leading it from April, joining another later,
    // and gone from a third
    const hire = await plannedHire();
    const led = await liveTeam();
    await hireOnTeam(led, hire, { fromDate: "2025-01-01" });
    await hireOnTeam(led, hire, { fromDate: "2026-01-01" });
    await hireLeading(led, hire, "2026-04-01");
    const later = await liveTeam();
    await hireOnTeam(later, hire, { fromDate: "2026-10-01" });
    const left = await liveTeam();
    await hireOnTeam(left, hire, { fromDate: "2026-01-01" });
    await hireOnTeam(left, hire, { fromDate: "2026-02-01", member: false });

    // When its row is read
    const carried = (await rowOf(hire))?.teamsCarried ?? [];

    // Then it names the first two, each with its records from the one in force today
    expect(
      carried
        .map(({ team, memberships, leads }) => ({
          id: team.id,
          memberships,
          leads,
        }))
        .sort((one, other) => one.id.localeCompare(other.id)),
    ).toEqual(
      [
        { id: led, memberships: [on("2026-01-01")], leads: [on("2026-04-01")] },
        { id: later, memberships: [on("2026-10-01")], leads: [] },
      ].sort((one, other) => one.id.localeCompare(other.id)),
    );
    expect(carried.map(({ team }) => team.name)).toEqual(
      carried.map(({ team }) => team.name).sort(),
    );
  });

  it("is left out for a hire that left its team before today", async () => {
    const hire = await plannedHire();
    const id = await liveTeam();
    await hireOnTeam(id, hire, { fromDate: "2026-01-01" });
    await hireOnTeam(id, hire, { fromDate: "2026-02-01", member: false });

    const row = await rowOf(hire);

    expect(row).toBeDefined();
    expect(row?.teamsCarried).toBeUndefined();
  });

  it("is left out on another day, since a hire is filled on today", async () => {
    const hire = await plannedHire();
    await hireOnTeam(await liveTeam(), hire);

    const row = await rowOf(hire, editor, "2026-07-01");

    expect(row).toBeDefined();
    expect(row?.teamsCarried).toBeUndefined();
  });

  it("is left out for a reader who doesn't see feature teams", async () => {
    const hire = await plannedHire();
    await hireOnTeam(await liveTeam(), hire);
    const who = await test.signedIn(
      startingRoles["engineering-director"].permissions.filter(
        (permission: Permission) => !permission.startsWith("feature-teams:"),
      ),
    );

    const row = await rowOf(hire, who);

    expect(row).toBeDefined();
    expect(row?.teamsCarried).toBeUndefined();
  });

  it.each([
    [
      "the hire taking over from a person later",
      [
        ["person", "2026-01-01"],
        ["hire", "2026-09-01"],
      ],
      [on("2026-09-01")],
      [],
    ],
    [
      "a person taking over from the hire",
      [
        ["hire", "2026-04-01"],
        ["person", "2026-09-01"],
      ],
      [on("2026-04-01"), off("2026-09-01")],
      [on("2026-04-01")],
    ],
    [
      "the hire leading again after taking over from a person before today",
      [
        ["person", "2026-01-01"],
        ["hire", "2026-04-01"],
        ["none", "2026-09-01"],
        ["hire", "2026-10-01"],
      ],
      [on("2026-04-01"), off("2026-09-01"), on("2026-10-01")],
      [],
    ],
    [
      "the hire taking over from a person before today",
      [
        ["person", "2026-01-01"],
        ["hire", "2026-04-01"],
      ],
      [on("2026-04-01")],
      [],
    ],
    [
      "no lead after a person who took over from the hire",
      [
        ["hire", "2026-04-01"],
        ["person", "2026-09-01"],
        ["none", "2026-10-01"],
      ],
      [on("2026-04-01"), off("2026-09-01"), off("2026-10-01")],
      [on("2026-04-01")],
    ],
    [
      "the hire leading again after a person",
      [
        ["hire", "2026-04-01"],
        ["person", "2026-09-01"],
        ["hire", "2026-10-01"],
      ],
      [on("2026-04-01"), off("2026-09-01"), on("2026-10-01")],
      [on("2026-04-01")],
    ],
  ] as const)(
    "leaves out the days of %s for a reader who doesn't see the days people join teams",
    async (_, turns, seen, unseen) => {
      const hire = await plannedHire();
      const id = await ledInTurn(hire, turns);
      const leadsOf = async (who: User) =>
        (await rowOf(hire, who))?.teamsCarried?.find(
          ({ team }) => team.id === id,
        )?.leads;

      expect(await leadsOf(editor)).toEqual(seen);
      expect(await leadsOf(planner)).toEqual(unseen);
    },
  );
});

describe("reading what filling a planned hire carries, for every role", () => {
  // Every role but the Administrator sees People and feature teams; only those who see Personal
  // details see the day the hire takes a team's lead over from a person.
  const readers = new Set(Object.keys(startingRoles));
  readers.delete("administrator");
  const seesDays = new Set([
    "project-manager",
    "engineering-manager",
    "engineering-director",
    "workforce-administrator",
    "executive",
  ]);

  it.each(Object.keys(startingRoles).map((role) => [role]))(
    "sends the %s only what the role sees",
    async (role) => {
      const hire = await plannedHire();
      const id = await ledInTurn(hire, [
        ["person", "2026-01-01"],
        ["hire", "2026-04-01"],
      ]);
      const who = await test.signedIn(role as keyof typeof startingRoles);

      const response = await send(who, "GET", "/api/people");

      if (!readers.has(role)) {
        expect(response.statusCode).toBe(403);
        return;
      }
      const carried = (await ok<{ people: Person[] }>(response)).people.find(
        (row) => row.id === hire,
      )?.teamsCarried;
      expect(carried).toEqual([
        {
          team: expect.objectContaining({ id }) as unknown,
          memberships: [on("2026-01-01")],
          leads: seesDays.has(role) ? [on("2026-04-01")] : [],
        },
      ]);
    },
  );
});
