// SPDX-License-Identifier: Apache-2.0

// Integration tests for drafting planned hires on feature teams: adding, taking off and making them
// lead through drafts and approval, the days they may join from, and which roles may do it.

import { startingRoles } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorOf, ok } from "./test-app.ts";
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
        [unnamed]: "REQ-FICTIONAL-71",
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
      "This planned hire is expected in 2026-09. Choose a day from then on.",
    );
  });

  it("joins from the month it's expected, chosen as the day, held as a person's day is", async () => {
    // Given a planned hire expected in September
    const hire = await plannedHire({ targetDate: "2026-09-15" });
    const id = await liveTeam();

    // When it is added from a day in September
    await changed(id, { add: [hire], from: "2026-09-01" });

    // Then the day is in Feature team dates' class, hidden from a reader without Personal details
    expect((await teamSeen(id))?.draft?.days).toEqual({
      [hire]: "2026-09-01",
    });
    expect((await teamSeen(id, planner))?.draft).toBeUndefined();
    // A planned hire is no person, so its day is no one's Personal details in the access history.
    expect(await accessRecords("personal-changed", editor.id, hire)).toEqual(
      [],
    );
  });

  it("is refused a day other than today by a role without Personal details, as a person is", async () => {
    const hire = await plannedHire({ targetDate: "2026-09-15" });
    const id = await liveTeam();

    const response = await change(
      id,
      { add: [hire], from: "2026-09-01" },
      proposer,
    );

    expect(response.statusCode).toBe(403);
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
      "This planned hire is expected in 2026-09. Choose a month from then on.",
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
      /^Fictional Moved Hire's day in the draft of .+ is now before 2026-09, the month Fictional Moved Hire is expected; reject the draft so it can be changed$/,
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
      "A planned hire drafted to be removed can't join or lead a team",
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
