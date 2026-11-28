// SPDX-License-Identifier: Apache-2.0

// Integration tests for drafting feature teams: adding and changing teams, the days members join or
// leave from, people who have left, and teams' colours.

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorOf, ok, unique } from "./test-app.ts";
import {
  test,
  editor,
  approver,
  proposer,
  datedProposer,
  approverWithoutPersonal,
  planner,
  today,
  startFeatureTeamTests,
  closeFeatureTeamTests,
  send,
  approve,
  approved,
  reject,
  person,
  personChanged,
  endDated,
  create,
  drafted,
  liveTeam,
  change,
  changed,
  remove,
  discard,
  teamSeen,
  moveTeamDates,
  liveRow,
  memberships,
  leads,
  sorted,
} from "./test-feature-teams.ts";

beforeAll(startFeatureTeamTests);

afterAll(closeFeatureTeamTests);

describe("adding a feature team", () => {
  it("drafts the team with its lead and members, the lead joining when not among them", async () => {
    const lead = await person();
    const member = await person();
    const name = unique("Fictional Feature Team");

    const { id, changeSetId } = await drafted({
      name,
      leadId: lead,
      members: [member],
    });

    expect(changeSetId).toEqual(expect.any(String));
    expect(await teamSeen(id)).toMatchObject({
      name,
      leadId: lead,
      members: sorted(lead, member),
    });
    expect(await liveRow(id)).toBeUndefined();
  });

  it("drafts a team with no members", async () => {
    const { id } = await drafted();
    expect(await teamSeen(id)).toMatchObject({ leadId: null, members: [] });
  });

  it("is refused without a name", async () => {
    const response = await create({ name: "   " });
    expect(response.statusCode).toBe(400);
  });

  it("is refused with a name another team has, live or in a draft, ignoring letter case", async () => {
    const live = unique("Fictional Taken");
    await liveTeam({ name: live });
    const draftedName = unique("Fictional Drafted");
    await drafted({ name: draftedName });

    for (const name of [live.toUpperCase(), ` ${draftedName.toLowerCase()} `]) {
      const response = await create({ name });
      expect(response.statusCode).toBe(409);
      expect(errorOf(response)).toBe("Another feature team has that name");
    }
  });

  it("is refused a name the user's own unpublished draft gives a team, and takes one only another user's gives", async () => {
    // Given one user's unpublished draft naming a team
    const other = await test.signedIn("workforce-administrator");
    const name = unique("Fictional Unpublished");
    await drafted({ name }, other, { publish: false });

    // When that user and another add a team of that name
    const own = await create({ name }, other, { publish: false });
    const taken = await create({ name });

    // Then only the user whose draft names it is refused
    expect(own.statusCode).toBe(409);
    expect(errorOf(own)).toBe("Another feature team has that name");
    await ok(taken, 201);
    await ok(await send(other, "POST", "/api/unpublished/discard"));
  });

  it("is refused with a member who is not a person", async () => {
    const response = await create({
      name: unique("Fictional Feature Team"),
      members: [randomUUID()],
    });
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe("Choose members from People");
  });

  it("is refused with the same member twice", async () => {
    const member = await person();
    const response = await create({
      name: unique("Fictional Feature Team"),
      members: [member, member],
    });
    expect(response.statusCode).toBe(400);
  });

  it("is refused with someone who has not started to a proposer who does not see Personal details, as People hides them", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const response = await create(
      { name: unique("Fictional Feature Team"), members: [starting] },
      proposer,
    );
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe("Choose members from People");

    const manager = await test.signedIn("engineering-manager");
    await drafted({ members: [starting] }, manager);
  });

  it("records members joining from the day given by someone who may change Personal details", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2025-01-15" });
    expect(await memberships(id)).toEqual([
      { personId: member, member: true, fromDate: "2025-01-15" },
    ]);
  });

  it("is refused an earlier day by someone who may not change Personal details", async () => {
    const member = await person();
    const response = await create(
      {
        name: unique("Fictional Feature Team"),
        members: [member],
        from: "2025-01-15",
      },
      datedProposer,
    );
    expect(response.statusCode).toBe(403);
  });

  it("records members joining from a later day", async () => {
    const member = await person();
    const { id } = await drafted({ members: [member], from: "2099-01-15" });

    await approved(id);

    expect(await memberships(id)).toEqual([
      { personId: member, member: true, fromDate: "2099-01-15" },
    ]);
  });

  it("is refused to those who do not edit feature teams", async () => {
    const response = await create(
      { name: unique("Fictional Feature Team") },
      planner,
    );
    expect(response.statusCode).toBe(403);
  });

  it("is drafted by a proposer, with members joining from today", async () => {
    const member = await person();
    const { id } = await drafted({ members: [member] }, proposer);
    await approved(id);
    expect(await memberships(id)).toEqual([
      { personId: member, member: true, fromDate: today },
    ]);
  });
});

describe("changing a feature team", () => {
  it("adds and removes members", async () => {
    const staying = await person();
    const leaving = await person();
    const joining = await person();
    const id = await liveTeam({ members: [staying, leaving] });

    await changed(id, { add: [joining], remove: [leaving] }, proposer);

    expect((await teamSeen(id))?.members).toEqual(sorted(staying, joining));
  });

  it("saves nothing when the change changes nothing", async () => {
    const member = await person();
    const outsider = await person();
    const id = await liveTeam({ members: [member] });

    expect(await changed(id, { add: [member], remove: [outsider] })).toBeNull();
    expect((await teamSeen(id))?.draft).toBeUndefined();
  });

  it("is refused a lead the change removes from the team", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member] });

    const response = await change(id, { leadId: member, remove: [member] });

    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe(
      "The feature lead must be one of the members",
    );
  });

  it("is refused a member who has left, as such, from another day", async () => {
    const left = await person({ endDate: "2021-06-30" });
    const id = await liveTeam();

    const response = await change(id, { add: [left], from: "2026-08-03" });

    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe("Someone who has left can't join a team");
  });

  it("records members joining and leaving from the day given, and keeps it for the members it still adds or removes", async () => {
    const leaving = await person();
    const joining = await person();
    const later = await person();
    const id = await liveTeam({ members: [leaving], from: "2024-01-01" });
    await changed(id, {
      add: [joining],
      remove: [leaving],
      from: "2025-06-01",
    });
    // A later change without a day keeps the days the draft already holds.
    await changed(id, { add: [later] });

    await approved(id);

    expect(await memberships(id)).toEqual([
      { personId: leaving, member: true, fromDate: "2024-01-01" },
      { personId: leaving, member: false, fromDate: "2025-06-01" },
      { personId: joining, member: true, fromDate: "2025-06-01" },
      { personId: later, member: true, fromDate: today },
    ]);
  });

  it("refuses another day, saying why, to a proposer who does not see Personal details", async () => {
    const member = await person();
    const id = await liveTeam();
    const response = await change(
      id,
      { add: [member], from: "2099-01-15" },
      proposer,
    );
    expect(response.statusCode).toBe(403);
    expect(errorOf(response)).toBe("Other dates need Personal access.");
  });

  it("is refused an earlier day by someone who may not change Personal details", async () => {
    const member = await person();
    const id = await liveTeam();
    const response = await change(
      id,
      { add: [member], from: "2025-01-01" },
      datedProposer,
    );
    expect(response.statusCode).toBe(403);
    expect(errorOf(response)).toBe(
      "This role can't choose an earlier date. Use today or a later date.",
    );
  });

  it("is given an earlier day by someone who may change the class the days are in", async () => {
    const member = await person();
    const id = await liveTeam();
    await moveTeamDates("general");
    try {
      const response = await change(
        id,
        { add: [member], from: "2025-01-01" },
        datedProposer,
      );
      expect(response.statusCode).toBe(200);
    } finally {
      await moveTeamDates("personal");
    }
  });

  it("changes the lead from the day given, keeping the lead before it", async () => {
    const first = await person();
    const second = await person();
    const id = await liveTeam({ leadId: first, members: [second] });

    await changed(id, { leadId: second, from: "2099-03-01" });
    await approved(id);

    expect(await leads(id)).toEqual([
      { leadId: first, fromDate: today },
      { leadId: second, fromDate: "2099-03-01" },
    ]);
    expect((await teamSeen(id))?.leadId).toBe(first);
  });

  it("is refused a change of lead on or before the last one", async () => {
    const first = await person();
    const second = await person();
    const id = await liveTeam({ leadId: first, members: [second] });
    await changed(id, { leadId: second, from: "2099-03-01" });
    await approved(id);

    for (const from of ["2099-03-01", "2099-02-01"]) {
      const response = await change(id, { leadId: null, from });

      expect(response.statusCode).toBe(400);
      expect(errorOf(response)).toBe(
        "This team's lead last changed on 2099-03-01. Choose a later date.",
      );
    }
  });

  it("is refused moving a drafted change of lead to on or before the last one", async () => {
    // Given a lead changed from 2099-03-01, and a drafted change of lead from a later day
    const first = await person();
    const second = await person();
    const id = await liveTeam({ leadId: first, members: [second] });
    await changed(id, { leadId: second, from: "2099-03-01" });
    await approved(id);
    await changed(id, { leadId: null, from: "2099-04-01" });

    // When the same change is moved to an earlier day
    const response = await change(id, { leadId: null, from: "2099-02-01" });

    // Then it is refused as a new change of lead would be
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe(
      "This team's lead last changed on 2099-03-01. Choose a later date.",
    );
  });

  it("sends its maker the day of a change not yet published", async () => {
    const member = await person();
    const id = await liveTeam();

    await ok(
      await change(id, { add: [member], from: "2025-10-01" }, editor, {
        publish: false,
      }),
    );

    expect((await teamSeen(id))?.draft?.days).toEqual({
      [member]: "2025-10-01",
    });
    await ok(await send(editor, "POST", "/api/unpublished/discard"));
  });

  it("is refused a change from a day after an approved change still to come, by its date", async () => {
    // Given someone approved to leave a team later
    const member = await person({ preferredName: unique("Fictional Leaver") });
    const id = await liveTeam({
      name: unique("Fictional Dated Team"),
      members: [member],
      from: "2025-01-01",
    });
    await changed(id, { remove: [member], from: "2026-09-01" });
    await approved(id);

    // When they are added from a day after that
    const response = await change(id, { add: [member], from: "2026-10-05" });

    // Then it is refused, by date for a reader who sees days
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toMatch(
      /has an approved change on .* before this date\. This date can change once it takes effect\.$/,
    );
  });

  it("is refused, from another day, for a team its draft removes", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2025-01-01" });
    await ok(await remove(id));

    const response = await change(id, { add: [member], from: "2026-08-03" });

    expect(response.statusCode).toBe(409);
  });

  it("puts a member's day back when changing it is undone", async () => {
    const member = await person();
    const id = await liveTeam();
    await changed(id, { add: [member], from: "2025-10-01" });
    const moved = await changed(id, { add: [member], from: "2025-11-03" });

    await ok(await send(editor, "POST", `/api/undo/${String(moved)}`));

    expect((await teamSeen(id))?.draft?.days).toEqual({
      [member]: "2025-10-01",
    });
  });

  it("is refused a lead from today who joins later", async () => {
    const joining = await person();
    const id = await liveTeam();
    await changed(id, { add: [joining], from: "2099-02-01" });

    const response = await change(id, { leadId: joining });

    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe(
      "Choose a day when the new lead is on this team",
    );
  });

  it("sends a change of lead's day apart from the days members join, only to readers who see Personal details, and the dated draft to no one else", async () => {
    const joining = await person();
    const id = await liveTeam();
    await changed(id, { add: [joining], from: "2099-02-01" });
    await changed(id, { leadId: joining, from: "2099-03-01" });

    expect((await teamSeen(id, approver))?.draft).toMatchObject({
      days: { [joining]: "2099-02-01" },
      leadDay: "2099-03-01",
    });
    expect((await teamSeen(id, approver))?.draft?.changed).toContain(
      "leadFrom",
    );
    expect((await teamSeen(id, planner))?.draft).toBeUndefined();
  });

  it("leaves a team with no lead from the day given, keeping them as a member", async () => {
    const lead = await person();
    const id = await liveTeam({ leadId: lead });

    await changed(id, { leadId: null, from: "2099-03-01" });
    await approved(id);

    expect(await leads(id)).toEqual([
      { leadId: lead, fromDate: today },
      { leadId: null, fromDate: "2099-03-01" },
    ]);
    expect((await memberships(id)).at(-1)?.member).toBe(true);
  });

  it("is refused a lead from a day after their end date", async () => {
    const member = await person({ endDate: "2098-06-30" });
    const id = await liveTeam({ members: [member] });

    const response = await change(id, {
      leadId: member,
      from: "2099-01-01",
    });

    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe(
      "Someone can't join or leave a team after their end date",
    );
  });

  it("is renamed by those who edit feature teams", async () => {
    const id = await liveTeam();
    const manager = await test.signedIn("engineering-manager");
    const name = unique("Fictional Renamed Team");

    await changed(id, { name }, manager);

    expect((await teamSeen(id))?.name).toBe(name);
  });

  it("is not renamed by those who only approve feature teams", async () => {
    const id = await liveTeam();
    const name = unique("Fictional Renamed Team");

    expect(
      (await change(id, { name }, approverWithoutPersonal)).statusCode,
    ).toBe(403);
  });

  it("is refused a name another team has", async () => {
    const taken = unique("Fictional Taken");
    await liveTeam({ name: taken });
    const id = await liveTeam();
    const response = await change(id, { name: taken.toLowerCase() });
    expect(response.statusCode).toBe(409);
  });

  it("answers a team that does not exist as not found", async () => {
    const response = await change(randomUUID(), { leadId: null });
    expect(response.statusCode).toBe(404);
    expect(errorOf(response)).toBe("There is no such feature team");
  });

  it("is refused for a team its draft removes", async () => {
    const id = await liveTeam();
    await ok(await remove(id));
    const response = await change(id, { leadId: null });
    expect(response.statusCode).toBe(409);
  });

  it("is saved while another user is changing it, unpublished", async () => {
    const id = await liveTeam();
    const other = await test.signedIn("workforce-administrator");
    await ok(
      await change(id, { name: unique("Fictional Theirs") }, other, {
        publish: false,
      }),
    );
    const name = unique("Fictional Mine");

    await ok(await change(id, { name }));

    expect((await teamSeen(id))?.name).toBe(name);
    await ok(await send(other, "POST", "/api/unpublished/discard"));
  });

  it("changes a team only drafted to be added", async () => {
    const member = await person();
    const { id } = await drafted();
    await changed(id, { add: [member] });
    expect((await teamSeen(id))?.draft?.action).toBe("created");
    expect((await teamSeen(id))?.members).toEqual([member]);
  });

  it("sends a rejected draft for approval again when changed", async () => {
    const member = await person();
    const id = await liveTeam();
    await changed(id, { add: [member] });
    await ok(await reject(id));

    await changed(id, { name: unique("Fictional Changed Again") });

    expect((await teamSeen(id))?.draft?.state).toBe("waiting");
  });
});

describe("the day someone joins or leaves a team", () => {
  it("is refused on the day of their latest record on that team", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2025-01-01" });

    const response = await change(id, {
      remove: [member],
      from: "2025-01-01",
    });

    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe(
      "This person last joined or left this team on 2025-01-01. Choose a later date.",
    );
  });

  it("asks for someone from People when a day is given for someone who is not a person", async () => {
    const response = await create({
      name: unique("Fictional Feature Team"),
      members: [randomUUID()],
      from: "2025-01-01",
    });
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe("Choose members from People");
  });

  it("is refused to take effect at approval once it is before the person's start date", async () => {
    const preferredName = unique("Fictional Person");
    const member = await person({ preferredName, startDate: "2025-03-01" });
    const name = unique("Fictional Feature Team");
    const { id } = await drafted({
      name,
      members: [member],
      from: "2025-04-01",
    });
    await personChanged(member, { startDate: "2025-05-01" });

    const response = await approve(id);

    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe(
      `${preferredName}'s day in the draft of ${name} is now before their start date; reject the draft so it can be changed`,
    );
    expect(await liveRow(id)).toBeUndefined();
  });
});

describe("someone who has left", () => {
  it("is off the team from the day after their end date, and a team they led shows no lead", async () => {
    const lead = await person();
    const member = await person();
    const id = await liveTeam({ leadId: lead, members: [member] });

    await endDated(lead, "2024-12-31");

    expect(await teamSeen(id, planner)).toMatchObject({
      leadId: null,
      members: [member],
    });
    expect(await memberships(id)).toHaveLength(2);
  });

  it("stays on the team on their end date", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member] });
    await endDated(member, today);
    expect((await teamSeen(id))?.members).toEqual([member]);
  });

  it("does not stop a change to a team's draft", async () => {
    const member = await person();
    const staying = await person();
    const id = await liveTeam({ members: [staying] });
    await changed(id, { add: [member], leadId: member });
    await endDated(member, "2024-12-31");

    await changed(id, { name: unique("Fictional Renamed Team") });

    expect(await teamSeen(id)).toMatchObject({
      leadId: null,
      members: [staying],
    });
  });

  it("is left out at approval, leaving a team they led with no lead, and no draft is held up", async () => {
    // Given a team with a lead and a draft adding someone else, who both then leave
    const lead = await person();
    const adding = await person();
    const id = await liveTeam({ leadId: lead });
    const name = unique("Fictional Renamed Team");
    await changed(id, { add: [adding], name });
    await endDated(lead, "2024-12-31");
    await endDated(adding, "2024-12-31");

    // When the draft is approved
    await approved(id);

    // Then the rest of it is made, and neither is on the team
    expect(await liveRow(id)).toMatchObject({ name });
    expect((await teamSeen(id))?.leadId).toBeNull();
    expect((await teamSeen(id))?.members).toEqual([]);
    expect(await memberships(id)).toEqual([
      { personId: lead, member: true, fromDate: today },
    ]);
  });

  it("is left out at approval of a team only drafted, with no records of days", async () => {
    const lead = await person();
    const { id } = await drafted({ leadId: lead, from: "2025-01-01" });
    await endDated(lead, "2024-12-31");

    await approved(id);

    expect(await leads(id)).toEqual([]);
    expect(await memberships(id)).toEqual([]);
  });

  it("is not added back by undoing a change, and undoing it is not refused", async () => {
    const lead = await person();
    const staying = await person();
    const id = await liveTeam({ leadId: lead, members: [staying] });
    const undone = await changed(id, { remove: [lead] });
    await endDated(lead, "2024-12-31");

    await ok(await send(editor, "POST", `/api/undo/${String(undone)}`));

    expect(await teamSeen(id)).toMatchObject({
      leadId: null,
      members: [staying],
    });
  });

  it("does not stop an undo of a rename", async () => {
    const lead = await person();
    const name = unique("Fictional Feature Team");
    const id = await liveTeam({ name, leadId: lead });
    const renamed = await changed(id, {
      name: unique("Fictional Renamed Team"),
    });
    await endDated(lead, "2024-12-31");

    await ok(await send(editor, "POST", `/api/undo/${String(renamed)}`));

    expect((await teamSeen(id))?.name).toBe(name);
  });

  describe("when a draft's only change was someone who has since left", () => {
    async function leftAlone() {
      const member = await person();
      const staying = await person();
      const id = await liveTeam({ members: [staying] });
      await changed(id, { add: [member], from: "2025-01-01" });
      await endDated(member, "2025-06-30");
      return { id, staying };
    }

    it("shows the draft to readers who see Personal details with no change, and others no draft", async () => {
      const { id, staying } = await leftAlone();

      const seen = await teamSeen(id, approver);

      expect(seen).toMatchObject({ members: [staying] });
      expect(seen?.draft?.changed).toEqual([]);
      expect(seen?.draft?.live).toEqual({});
      expect(seen?.draft).not.toHaveProperty("days");
      expect((await teamSeen(id, planner))?.draft).toBeUndefined();
    });

    it("can be cleared by discarding it", async () => {
      const { id } = await leftAlone();
      await ok(await discard(id));
      expect((await teamSeen(id, approver))?.draft).toBeUndefined();
    });

    it("can be cleared by an Approver approving it, recording nothing", async () => {
      const { id } = await leftAlone();
      const before = await memberships(id);

      await approved(id);

      expect((await teamSeen(id, approver))?.draft).toBeUndefined();
      expect(await memberships(id)).toEqual(before);
    });
  });
});

describe("a team's colour", () => {
  const colour = (id: string, value: string | null, who = editor) =>
    send(who, "PUT", `/api/feature-teams/${id}/colour`, { colour: value });

  it("is set and removed at once by those who edit feature teams", async () => {
    const id = await liveTeam();

    expect((await colour(id, "teal")).statusCode).toBe(204);
    expect((await teamSeen(id, planner))?.colour).toBe("teal");
    expect((await teamSeen(id))?.draft).toBeUndefined();
    expect((await colour(id, null)).statusCode).toBe(204);
    expect((await teamSeen(id))?.colour).toBeNull();
  });

  it("is refused to those who do not edit feature teams", async () => {
    const id = await liveTeam();
    expect((await colour(id, "teal", planner)).statusCode).toBe(403);
  });

  it("is refused to a role that edits feature teams without seeing people", async () => {
    const id = await liveTeam();
    const unseeing = await test.signedIn("feature-lead");
    await test.holdOnly(unseeing.id, ["feature-teams:edit"]);
    expect((await colour(id, "teal", unseeing)).statusCode).toBe(403);
  });

  it("is refused for a team not yet approved", async () => {
    const { id } = await drafted();
    const response = await colour(id, "teal");
    expect(response.statusCode).toBe(404);
    expect(errorOf(response)).toBe(
      "This feature team is not approved yet, so it cannot have a colour",
    );
  });
});
