// SPDX-License-Identifier: Apache-2.0

// Integration tests for drafting planned hires on feature teams: adding, taking off and making them
// lead through drafts and approval, the days they may join from, and which roles may do it.

import { plannedHires } from "@fathom/db";
import {
  type ChangeHistory,
  defaultClasses,
  seesEmployment,
  seesHiringPlan,
  startingRoles,
  withImplied,
} from "@fathom/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorOf, ok, type User } from "./test-app.ts";
import {
  test,
  editor,
  approver,
  chartOnly,
  planner,
  proposer,
  startFeatureTeamTests,
  closeFeatureTeamTests,
  send,
  approve,
  approved,
  reject,
  resubmit,
  person,
  plannedHire,
  create,
  drafted,
  liveTeam,
  change,
  changed,
  teamSeen,
  hireMemberships,
  leads,
  accessRecords,
  today,
  sorted,
} from "./test-feature-teams.ts";

beforeAll(startFeatureTeamTests);

afterAll(closeFeatureTeamTests);

const approveHire = (id: string) =>
  send(approver, "POST", "/api/drafts/approval", { plannedHires: [id] });

describe("drafting a planned hire on a team", () => {
  it("joins and leads a team once its draft is approved, named by its placeholder name", async () => {
    // Given a planned hire with a name, and one with none
    const named = await plannedHire({ name: "Fictional Named Hire" });
    const unnamed = await plannedHire({
      name: null,
      requisition: "REQ-FICTIONAL-71",
    });
    const member = await person();

    // When a team is drafted with them, the named one leading it, and approved
    const { id } = await drafted({
      members: [member, unnamed],
      leadId: named,
    });
    await approved(id);

    // Then their records are kept by planned hire, and every reader sees them on it
    expect(await hireMemberships(id)).toEqual(
      [named, unnamed].sort().map((plannedHireId) => ({
        plannedHireId,
        member: true,
        fromDate: today,
      })),
    );
    expect(await leads(id)).toEqual([
      { leadId: null, leadPlannedHireId: named, fromDate: today },
    ]);
    for (const reader of [editor, planner, chartOnly]) {
      const team = await teamSeen(id, reader);
      expect(team?.members).toEqual(sorted(member, named, unnamed));
      expect(team?.leadId).toBe(named);
      expect(team?.names).toMatchObject({
        [named]: "Fictional Named Hire",
        [unnamed]: "Fictional Engineer, REQ-FICTIONAL-71",
      });
    }
  });

  it("leaves a team once its removal is approved", async () => {
    const hire = await plannedHire();
    const id = await liveTeam({ members: [hire] });

    await changed(id, { remove: [hire] });
    await approved(id);

    expect((await hireMemberships(id)).at(-1)).toEqual({
      plannedHireId: hire,
      member: false,
      fromDate: today,
    });
    expect((await teamSeen(id))?.members).toEqual([]);
  });

  it("replaces a person leading the team with the planned hire approved", async () => {
    const lead = await person();
    const hire = await plannedHire();
    const id = await liveTeam({ members: [lead, hire], leadId: lead });

    await changed(id, { leadId: hire, from: "2026-07-01" });
    await approved(id);

    expect((await leads(id)).at(-1)).toEqual({
      leadId: null,
      leadPlannedHireId: hire,
      fromDate: "2026-07-01",
    });
  });

  it("is refused from today before the month it's expected", async () => {
    const hire = await plannedHire({ targetDate: "2026-09-15" });

    const response = await create({ name: "Fictional Early", members: [hire] });

    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe(
      "This planned hire is expected in Sep 2026. Choose a day from then on.",
    );
  });

  it("joins from a day chosen by a role without Personal details, shown to every reader", async () => {
    // Given a planned hire expected in September, and a Feature Lead, who doesn't see Personal details
    const hire = await plannedHire({ targetDate: "2026-09-15" });
    const id = await liveTeam();

    // When the Feature Lead adds it from a day in September
    await changed(id, { add: [hire], from: "2026-09-01" }, proposer);

    // Then the day is held as General, shown to a reader without Personal details
    expect((await teamSeen(id, planner))?.draft?.hireDays).toEqual({
      [hire]: "2026-09-01",
    });
    // A planned hire is no person, so its day is no one's Personal details in the access history.
    expect(await accessRecords("personal-changed", editor.id, hire)).toEqual(
      [],
    );
  });

  it("joins and leads from an earlier day chosen by a role without Personal details", async () => {
    const hire = await plannedHire();
    const id = await liveTeam();

    await changed(id, { leadId: hire, from: "2026-04-01" }, proposer);

    expect((await teamSeen(id, planner))?.draft).toMatchObject({
      hireDays: { [hire]: "2026-04-01" },
      hireLeadDay: "2026-04-01",
    });
  });

  it("still refuses a role without Personal details another day for a person", async () => {
    const member = await person();
    const id = await liveTeam();

    const response = await change(
      id,
      { add: [member], from: "2026-09-01" },
      proposer,
    );

    expect(response.statusCode).toBe(403);
  });
});

describe("a planned hire's day in a change that dates a person", () => {
  // The fields of a change set's team record a reader is shown.
  async function fieldsSeen(changeSetId: string | null, who: User) {
    const { entries } = await ok<ChangeHistory>(
      await send(who, "GET", "/api/changes"),
    );
    return (
      entries
        .find((entry) => entry.id === changeSetId)
        ?.records.find((record) => record.kind === "feature-team")
        ?.fields.map(({ field }) => field) ?? []
    );
  }

  it("is refused to a role without Personal details, adding a person and a planned hire from one later day", async () => {
    const hire = await plannedHire();
    const member = await person();
    const id = await liveTeam();

    const response = await change(
      id,
      { add: [member, hire], from: "2026-09-01" },
      proposer,
    );

    expect(response.statusCode).toBe(403);
  });

  it("is held with the person's, so a reader without Feature team dates sees neither day", async () => {
    // Given a person and a planned hire added from one later day by a role that may
    const hire = await plannedHire();
    const member = await person();
    const id = await liveTeam();

    const changeSetId = await changed(id, {
      add: [member, hire],
      from: "2026-09-01",
    });

    // Then a reader without Feature team dates is shown neither the draft nor the days
    expect((await teamSeen(id, planner))?.draft).toBeUndefined();
    expect(await fieldsSeen(changeSetId, planner)).toEqual(["members"]);
    expect((await teamSeen(id))?.draft?.days).toEqual({
      [member]: "2026-09-01",
      [hire]: "2026-09-01",
    });
  });

  it("is refused to a role without Personal details making a planned hire take over from a person as the lead", async () => {
    const lead = await person();
    const hire = await plannedHire();
    const id = await liveTeam({ members: [lead, hire], leadId: lead });

    const response = await change(
      id,
      { leadId: hire, from: "2026-09-01" },
      proposer,
    );

    expect(response.statusCode).toBe(403);
  });

  it("holds the day a planned hire takes over from a person as the lead with people's", async () => {
    const lead = await person();
    const hire = await plannedHire();
    const id = await liveTeam({ members: [lead, hire], leadId: lead });

    const changeSetId = await changed(id, {
      leadId: hire,
      from: "2026-09-01",
    });

    expect((await teamSeen(id, planner))?.draft).toBeUndefined();
    expect(await fieldsSeen(changeSetId, planner)).toEqual(["leadId"]);
  });

  it("is refused to a role without Personal details changing a drafted planned hire lead while a person leads live", async () => {
    // Given a team a person leads live, whose draft makes a planned hire its lead
    const lead = await person();
    const first = await plannedHire();
    const second = await plannedHire();
    const id = await liveTeam({ members: [lead, first, second], leadId: lead });
    await changed(id, { leadId: first });

    // When a role without Personal details makes another planned hire its lead from a later day
    const response = await change(
      id,
      { leadId: second, from: "2026-09-01" },
      proposer,
    );

    // Then it is refused, since the day is the day the person stops leading
    expect(response.statusCode).toBe(403);
  });
});

describe("a planned hire's past day, put back or sent again", () => {
  it("is undone by a role without the right to change Feature team dates", async () => {
    // Given a role without Personal details that added a planned hire from April, then moved it to May
    const hire = await plannedHire();
    const id = await liveTeam();
    await changed(id, { add: [hire], from: "2026-04-01" }, proposer);
    const moved = await changed(
      id,
      { add: [hire], from: "2026-05-01" },
      proposer,
    );

    // When it undoes the move
    await ok(await send(proposer, "POST", `/api/undo/${String(moved)}`));

    // Then the April day is back
    expect((await teamSeen(id, planner))?.draft?.hireDays).toEqual({
      [hire]: "2026-04-01",
    });
  });

  it("is sent again by a role without the right to change Feature team dates", async () => {
    const hire = await plannedHire();
    const id = await liveTeam();
    await changed(id, { add: [hire], from: "2026-04-01" }, proposer);
    await ok(await reject(id));

    await ok(await resubmit(id, proposer));

    expect((await teamSeen(id, planner))?.draft?.state).toBe("waiting");
  });
});

describe("a planned hire on a team, refused", () => {
  it("names the month to choose from the monthly grid, before the month it's expected", async () => {
    const hire = await plannedHire({ targetDate: "2026-09-15" });
    const id = await liveTeam();

    const response = await send(
      editor,
      "PATCH",
      `/api/feature-teams/members/${hire}`,
      { add: [id], from: "2026-07-01" },
    );

    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe(
      "This planned hire is expected in Sep 2026. Choose a month from then on.",
    );
  });

  it("is refused on approval once its Expected month moves after the day it joins", async () => {
    // Given a team's draft adding a planned hire from July
    const hire = await plannedHire({ name: "Fictional Moved Hire" });
    const id = await liveTeam();
    await changed(id, { add: [hire], from: "2026-07-01" });

    // When its target date moves to September, and the team's draft is approved
    await ok(
      await send(editor, "PATCH", `/api/planned-hires/${hire}`, {
        targetDate: "2026-09-15",
      }),
    );
    await ok(await approveHire(hire));
    const response = await approve(id);

    // Then the approval is refused, naming the month, not the target date
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toMatch(
      /^Fictional Moved Hire's day in the draft of .+ is now before Sep 2026, the month Fictional Moved Hire is expected; reject the draft so it can be changed$/,
    );
  });

  it("is refused on approval from today once its Expected month moves after today", async () => {
    const hire = await plannedHire();
    const id = await liveTeam();
    await changed(id, { add: [hire] });

    await ok(
      await send(editor, "PATCH", `/api/planned-hires/${hire}`, {
        targetDate: "2026-09-15",
      }),
    );
    await ok(await approveHire(hire));
    const response = await approve(id);

    expect(response.statusCode).toBe(400);
  });

  it("leaves a team before its Expected month once that month moves later", async () => {
    // Given a planned hire on a team whose target date then moves to September
    const hire = await plannedHire();
    const id = await liveTeam({ members: [hire] });
    await ok(
      await send(editor, "PATCH", `/api/planned-hires/${hire}`, {
        targetDate: "2026-09-15",
      }),
    );
    await ok(await approveHire(hire));

    // When it is taken off the team from July and approved
    await changed(id, { remove: [hire], from: "2026-07-01" });
    await approved(id);

    // Then it leaves from July
    expect((await hireMemberships(id)).at(-1)).toEqual({
      plannedHireId: hire,
      member: false,
      fromDate: "2026-07-01",
    });
  });

  it("is refused once a draft removes it, though not yet published", async () => {
    const hire = await plannedHire();
    const id = await liveTeam();
    await ok(
      await send(editor, "DELETE", `/api/planned-hires/${hire}`, undefined, {
        publish: false,
      }),
    );

    const response = await change(id, { add: [hire] }, editor, {
      publish: false,
    });

    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe(
      "This planned hire is drafted to be removed, so it can't join or lead a team.",
    );
  });

  it("joins while a draft changes something else about it", async () => {
    const hire = await plannedHire();
    await ok(
      await send(editor, "PATCH", `/api/planned-hires/${hire}`, {
        targetDate: "2026-04-15",
      }),
    );
    const id = await liveTeam();

    await changed(id, { add: [hire] });

    expect((await teamSeen(id))?.members).toEqual([hire]);
  });

  it("joins a team from a month of the monthly grid", async () => {
    const hire = await plannedHire();
    const id = await liveTeam();

    await ok(
      await send(editor, "PATCH", `/api/feature-teams/members/${hire}`, {
        add: [id],
      }),
    );

    expect((await teamSeen(id))?.members).toEqual([hire]);
  });
});

describe("who may add a planned hire to a team", () => {
  const changingTeams = new Set([
    "feature-lead",
    "engineering-manager",
    "engineering-director",
    "workforce-administrator",
  ]);

  it.each(Object.keys(startingRoles).map((role) => [role]))(
    "allows or refuses the %s",
    async (role) => {
      const hire = await plannedHire();
      const who = await test.signedIn(role as keyof typeof startingRoles);

      const response = await create(
        { name: `Fictional Team of ${role}`, members: [hire] },
        who,
      );

      expect(response.statusCode).toBe(changingTeams.has(role) ? 201 : 403);
    },
  );
});

describe("refusing a planned hire that can't join to each starting role", () => {
  const changingTeams = [
    "feature-lead",
    "engineering-manager",
    "engineering-director",
    "workforce-administrator",
  ] as const;

  it.each(changingTeams.map((role) => [role]))(
    "names the fill to the %s only where the role sees it",
    async (role) => {
      // Given a planned hire filled by someone
      const hire = await plannedHire();
      await test.connection
        .update(plannedHires)
        .set({ filledBy: await person() })
        .where(eq(plannedHires.id, hire));
      const who = await test.signedIn(role);

      // When the role adds it to a team
      const response = await create(
        { name: `Fictional Team Filled for ${role}`, members: [hire] },
        who,
      );

      // Then only a role that sees Personal details is told it was filled
      const seesFill = seesEmployment({
        // The key is one of the starting roles' own.
        // eslint-disable-next-line security/detect-object-injection
        permissions: withImplied(startingRoles[role].permissions),
        dataClasses: defaultClasses,
      });
      expect(response.statusCode).toBe(400);
      expect(errorOf(response)).toBe(
        seesFill
          ? "This planned hire has been filled. Choose the person who filled it."
          : "This planned hire can't join or lead a team.",
      );
    },
  );

  it.each(changingTeams.map((role) => [role]))(
    "names a removal draft to the %s only where the role sees the hiring plan",
    async (role) => {
      // Given a planned hire a waiting draft removes
      const hire = await plannedHire();
      await ok(await send(editor, "DELETE", `/api/planned-hires/${hire}`));
      const who = await test.signedIn(role);

      // When the role adds it to a team
      const response = await create(
        { name: `Fictional Team Removing for ${role}`, members: [hire] },
        who,
      );

      // Then only a role that sees the hiring plan's drafts is told of the removal
      const seesDrafts = seesHiringPlan({
        // The key is one of the starting roles' own.
        // eslint-disable-next-line security/detect-object-injection
        permissions: withImplied(startingRoles[role].permissions),
        dataClasses: defaultClasses,
      });
      expect(response.statusCode).toBe(400);
      expect(errorOf(response)).toBe(
        seesDrafts
          ? "This planned hire is drafted to be removed, so it can't join or lead a team."
          : "This planned hire can't join or lead a team.",
      );
    },
  );
});
