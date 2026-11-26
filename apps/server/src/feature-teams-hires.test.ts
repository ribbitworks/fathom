// SPDX-License-Identifier: Apache-2.0

// Integration tests for planned hires on feature teams: reading them on teams, in People and by
// month, for every role, naming them in the change history, and removing and filling a hire that is
// on a team. Drafts don't put planned hires on teams yet, so the tests record them there directly.

import { featureTeamLeads } from "@fathom/db";
import {
  type ChangeHistory,
  type FeatureTeam,
  type Person,
  type Role,
  roleSchema,
  type TeamMonths,
} from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { builtInChoice, errorOf, ok } from "./test-app.ts";
import {
  test,
  editor,
  approver,
  chartOnly,
  planner,
  startFeatureTeamTests,
  closeFeatureTeamTests,
  send,
  person,
  plannedHire,
  liveTeam,
  changed,
  teamSeen,
  hireMemberships,
  hireOnTeam,
  hireLeading,
  leads,
  sorted,
} from "./test-feature-teams.ts";

beforeAll(startFeatureTeamTests);

afterAll(closeFeatureTeamTests);

const approveHire = (id: string) =>
  send(approver, "POST", "/api/drafts/approval", { plannedHires: [id] });

const removeHire = (id: string) =>
  send(editor, "DELETE", `/api/planned-hires/${id}`);

// The team record of a change set, as a reader sees it.
async function teamRecordOf(changeSetId: string | null, who = editor) {
  const { entries } = await ok<ChangeHistory>(
    await send(who, "GET", "/api/changes"),
  );
  return entries
    .find((entry) => entry.id === changeSetId)
    ?.records.find((record) => record.kind === "feature-team");
}

describe("a planned hire on a team", () => {
  it("is shown as a member and the lead, by its name or its ID, to every reader of feature teams", async () => {
    // Given a team with a person, a named planned hire leading it, and an unnamed one
    const named = await plannedHire({ name: "Fictional Named Hire" });
    const unnamed = await plannedHire({
      name: null,
      requisition: "REQ-FICTIONAL-71",
    });
    const member = await person();
    const id = await liveTeam({ members: [member] });
    await hireOnTeam(id, named);
    await hireOnTeam(id, unnamed);
    await hireLeading(id, named);

    // Then each reader sees them on it
    for (const reader of [editor, planner, chartOnly]) {
      const team = await teamSeen(id, reader);
      expect(team?.members).toEqual(sorted(member, named, unnamed));
      expect(team?.leadId).toBe(named);
      expect(team?.names).toMatchObject({
        [named]: "Fictional Named Hire",
        [unnamed]: "REQ-FICTIONAL-71",
      });
    }
  });

  it("is in its People row's feature teams", async () => {
    const hire = await plannedHire();
    const id = await liveTeam();
    await hireOnTeam(id, hire);

    const { people } = await ok<{ people: Person[] }>(
      await send(editor, "GET", "/api/people"),
    );

    expect(
      people
        .find((row) => row.id === hire)
        ?.featureTeams?.map(({ id: one }) => one),
    ).toEqual([id]);
  });

  it("keeps a team whose only members are planned hires from disbanding", async () => {
    const hire = await plannedHire();
    const id = await liveTeam();
    await hireOnTeam(id, hire, { fromDate: "2026-04-01" });

    expect(await teamSeen(id)).not.toHaveProperty("disbandedFrom");
  });

  it("is on its team by month from this month when it has no target date", async () => {
    const hire = await plannedHire({ targetDate: null });
    const id = await liveTeam();
    await hireOnTeam(id, hire, { fromDate: "2026-04-01" });

    const months = await ok<TeamMonths>(
      await send(
        editor,
        "GET",
        "/api/feature-teams/months?from=2026-05&to=2026-07",
      ),
    );

    expect(months.hires?.find((one) => one.id === hire)?.teams).toEqual({
      "2026-06": [id],
      "2026-07": [id],
    });
  });

  it("is on its team by month from the month it's expected, though recorded on it earlier", async () => {
    const hire = await plannedHire({ targetDate: "2026-05-15" });
    const id = await liveTeam();
    await hireOnTeam(id, hire, { fromDate: "2026-04-01" });

    const months = await ok<TeamMonths>(
      await send(
        editor,
        "GET",
        "/api/feature-teams/months?from=2026-04&to=2026-06",
      ),
    );

    expect(months.hires?.find((one) => one.id === hire)?.teams).toEqual({
      "2026-05": [id],
      "2026-06": [id],
    });
    expect(months.people.some((one) => one.id === hire)).toBe(false);
  });
});

describe("who sees a planned hire on a team", () => {
  const roles = roleSchema.options;
  const seesTeams = new Set<Role>(
    roles.filter((role) => role !== "administrator"),
  );
  // Capacity's Feature teams needs Personal details.
  const seesMonths = new Set<Role>([
    "project-manager",
    "engineering-manager",
    "engineering-director",
    "workforce-administrator",
    "executive",
  ]);
  let hire: string;
  let team: string;

  beforeAll(async () => {
    hire = await plannedHire({ name: "Fictional Seen Hire" });
    team = await liveTeam();
    await hireOnTeam(team, hire);
  });

  it.each(roles.map((role) => [role]))(
    "shows the %s it on its team, or refuses the read",
    async (role) => {
      const who = await test.signedIn(role);
      const response = await send(who, "GET", "/api/feature-teams");

      if (!seesTeams.has(role)) {
        expect(response.statusCode).toBe(403);
        return;
      }
      const seen = (await ok<{ teams: FeatureTeam[] }>(response)).teams.find(
        ({ id }) => id === team,
      );
      expect(seen?.members).toEqual([hire]);
      expect(seen?.names).toEqual({ [hire]: "Fictional Seen Hire" });
    },
  );

  it.each(roles.map((role) => [role]))(
    "gives the %s its row in People with its team, or refuses the read",
    async (role) => {
      const who = await test.signedIn(role);
      const response = await send(who, "GET", "/api/people");

      if (!seesTeams.has(role)) {
        expect(response.statusCode).toBe(403);
        return;
      }
      const row = (await ok<{ people: Person[] }>(response)).people.find(
        ({ id }) => id === hire,
      );
      expect(row?.featureTeams?.map(({ id }) => id)).toEqual([team]);
    },
  );

  it.each(roles.map((role) => [role]))(
    "gives the %s its teams by month, or refuses the read",
    async (role) => {
      const who = await test.signedIn(role);
      const response = await send(
        who,
        "GET",
        "/api/feature-teams/months?from=2026-06&to=2026-06",
      );

      if (!seesMonths.has(role)) {
        expect(response.statusCode).toBe(403);
        return;
      }
      expect(
        (await ok<TeamMonths>(response)).hires?.find(({ id }) => id === hire)
          ?.teams,
      ).toEqual({ "2026-06": [team] });
    },
  );
});

describe("planned hires by month, to a reader who doesn't see people", () => {
  it("are only those on a team, since placeholders are for those who see people", async () => {
    // Given a planned hire on a team, and one on none
    const onTeam = await plannedHire();
    const alone = await plannedHire();
    await hireOnTeam(await liveTeam(), onTeam);

    // When a reader who sees feature teams and Personal details, but not people, reads the months
    const { hires } = await ok<TeamMonths>(
      await send(
        chartOnly,
        "GET",
        "/api/feature-teams/months?from=2026-06&to=2026-06",
      ),
    );

    // Then only the hire on a team is sent
    const ids = (hires ?? []).map(({ id }) => id);
    expect(ids).toContain(onTeam);
    expect(ids).not.toContain(alone);
  });
});

describe("removing a planned hire on a team", () => {
  it("is refused while it leads a team", async () => {
    const hire = await plannedHire();
    const id = await liveTeam();
    await hireOnTeam(id, hire);
    await hireLeading(id, hire);

    const response = await removeHire(hire);

    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "This planned hire leads a feature team; choose another lead first",
    );
  });

  it("is refused while a team's draft names it", async () => {
    // Given a team with a planned hire, whose draft adds a person
    const hire = await plannedHire();
    const id = await liveTeam();
    await hireOnTeam(id, hire);
    await changed(id, { add: [await person()] });

    // When the planned hire's removal is drafted
    const response = await removeHire(hire);

    // Then it is refused
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "This planned hire is in a feature team's draft; take it out of the draft or discard the draft first",
    );
  });

  it("is refused when approved while a team's draft names it", async () => {
    const hire = await plannedHire();
    const id = await liveTeam();
    await hireOnTeam(id, hire);
    await ok(await removeHire(hire));
    await changed(id, { add: [await person()] });

    const response = await approveHire(hire);

    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "This planned hire is in a feature team's draft; take it out of the draft or discard the draft first",
    );
  });

  it("is refused while it leads a team only later", async () => {
    const hire = await plannedHire();
    const id = await liveTeam();
    await hireOnTeam(id, hire);
    await hireLeading(id, hire, "2026-09-01");

    const response = await removeHire(hire);

    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "This planned hire leads a feature team; choose another lead first",
    );
  });

  it("takes it off its teams once approved, naming it in the team's change", async () => {
    // Given a planned hire on a team with a person
    const member = await person();
    const hire = await plannedHire({ name: "Fictional Leaving Hire" });
    const id = await liveTeam({ members: [member] });
    await hireOnTeam(id, hire);

    // When its removal is drafted and approved
    await ok(await removeHire(hire));
    const { changeSetId } = await ok<{ changeSetId: string }>(
      await approveHire(hire),
    );

    // Then its records are gone, and the team's change names it among the members before
    expect(await hireMemberships(id)).toEqual([]);
    expect((await teamSeen(id))?.members).toEqual([member]);
    const members = (await teamRecordOf(changeSetId, planner))?.fields.find(
      ({ field }) => field === "members",
    );
    expect(members?.oldValue).toContain("Fictional Leaving Hire");
  });

  it("takes it off a team it joins only later, recording it gone from the team's members", async () => {
    const hire = await plannedHire({ targetDate: "2026-09-15" });
    const id = await liveTeam();
    await hireOnTeam(id, hire, { fromDate: "2026-09-01" });

    await ok(await removeHire(hire));
    const { changeSetId } = await ok<{ changeSetId: string }>(
      await approveHire(hire),
    );

    expect(await hireMemberships(id)).toEqual([]);
    expect((await teamRecordOf(changeSetId))?.fields).toContainEqual(
      expect.objectContaining({ field: "members", newValue: [] }),
    );
  });

  it("records no change to a team it has left", async () => {
    const hire = await plannedHire();
    const id = await liveTeam();
    await hireOnTeam(id, hire, { fromDate: "2026-04-01" });
    await hireOnTeam(id, hire, { fromDate: "2026-05-01", member: false });

    await ok(await removeHire(hire));
    const { changeSetId } = await ok<{ changeSetId: string }>(
      await approveHire(hire),
    );

    expect(await teamRecordOf(changeSetId)).toBeUndefined();
  });

  it("clears it as a team's past lead", async () => {
    // Given a planned hire that led a team from April until a person took over in May
    const hire = await plannedHire();
    const lead = await person();
    const id = await liveTeam({ members: [lead] });
    await hireOnTeam(id, hire, { fromDate: "2026-04-01" });
    await hireLeading(id, hire, "2026-04-01");
    await test.connection
      .insert(featureTeamLeads)
      .values({ teamId: id, leadId: lead, fromDate: "2026-05-01" });

    // When its removal is approved
    await ok(await removeHire(hire));
    await ok(await approveHire(hire));

    // Then the team had no lead in April
    expect(
      (await leads(id)).filter(({ fromDate }) => fromDate < "2026-06-01"),
    ).toEqual([
      { leadId: null, leadPlannedHireId: null, fromDate: "2026-04-01" },
      { leadId: lead, leadPlannedHireId: null, fromDate: "2026-05-01" },
    ]);
  });
});

describe("filling a planned hire on a team", () => {
  const onTeamRefusal =
    "This planned hire is on a feature team now or later, or in a team's draft. Take it off its teams before filling it.";
  const openHire = async () =>
    plannedHire({
      stateId: await builtInChoice(test.connection, "hiring-states", "open"),
    });
  const fill = async (hire: string) =>
    send(editor, "POST", `/api/planned-hires/${hire}/fill`, {
      by: "existing person",
      personId: await person(),
    });

  it("is refused while it is on a team", async () => {
    const hire = await openHire();
    await hireOnTeam(await liveTeam(), hire);

    const response = await fill(hire);

    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(onTeamRefusal);
  });

  it("is refused while it leaves its team only later", async () => {
    const hire = await openHire();
    const id = await liveTeam();
    await hireOnTeam(id, hire, { fromDate: "2026-04-01" });
    await hireOnTeam(id, hire, { fromDate: "2026-07-01", member: false });

    expect((await fill(hire)).statusCode).toBe(409);
  });

  it("is refused while it leads a team", async () => {
    const hire = await openHire();
    await hireLeading(await liveTeam(), hire);

    expect((await fill(hire)).statusCode).toBe(409);
  });

  it("is refused while it joins a team only later", async () => {
    const hire = await openHire();
    await hireOnTeam(await liveTeam(), hire, { fromDate: "2026-09-01" });

    expect((await fill(hire)).statusCode).toBe(409);
  });

  it("is refused while a team's draft names it", async () => {
    // Given a team with the planned hire, whose draft adds a person
    const hire = await openHire();
    const id = await liveTeam();
    await hireOnTeam(id, hire);
    await changed(id, { add: [await person()] });

    // When the hire's fill is drafted
    const response = await fill(hire);

    // Then it is refused
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(onTeamRefusal);
  });

  it("is drafted once it has left its teams", async () => {
    const hire = await openHire();
    const id = await liveTeam();
    await hireOnTeam(id, hire, { fromDate: "2026-04-01" });
    await hireOnTeam(id, hire, { fromDate: "2026-05-01", member: false });

    expect((await fill(hire)).statusCode).toBe(200);
  });

  it("is refused when approved once it is on a team", async () => {
    // Given a fill drafted, then the planned hire on a team
    const hire = await openHire();
    await ok(await fill(hire));
    await hireOnTeam(await liveTeam(), hire);

    // When the fill is approved
    const response = await approveHire(hire);

    // Then it is refused
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(onTeamRefusal);
  });
});
