// SPDX-License-Identifier: Apache-2.0

// Integration tests for deciding feature teams' drafts: approving, rejecting, discarding and
// resubmitting them, and publishing and discarding unpublished changes.

import { featureTeamLeads, plannedHires } from "@fathom/db";
import { type Unpublished } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  builtInChoice,
  errorOf,
  ok,
  testPosition,
  unique,
} from "./test-app.ts";
import {
  test,
  editor,
  approver,
  proposer,
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
  accessRecords,
  drafted,
  liveTeam,
  change,
  changed,
  remove,
  discard,
  resubmit,
  teamSeen,
  liveRow,
  memberships,
  leads,
} from "./test-feature-teams.ts";

beforeAll(startFeatureTeamTests);

afterAll(closeFeatureTeamTests);

describe("discarding and resubmitting a team's draft", () => {
  it("puts a changed team back as it is live", async () => {
    const name = unique("Fictional Feature Team");
    const id = await liveTeam({ name });
    await changed(id, { name: unique("Fictional Renamed Team") }, proposer);

    await ok(await discard(id, proposer));

    expect(await teamSeen(id)).toMatchObject({ name });
    expect((await teamSeen(id))?.draft).toBeUndefined();
  });

  it("takes out a team only drafted to be added", async () => {
    const { id } = await drafted();
    await ok(await discard(id));
    expect(await teamSeen(id)).toBeUndefined();
  });

  it("keeps a team drafted to be removed", async () => {
    const id = await liveTeam();
    await ok(await remove(id));
    await ok(await discard(id));
    expect((await teamSeen(id))?.draft).toBeUndefined();
  });

  it("is refused for a team with no draft", async () => {
    const id = await liveTeam();
    const response = await discard(id);
    expect(response.statusCode).toBe(404);
    expect(errorOf(response)).toBe("This feature team has no draft");
  });

  it("resubmits a rejected draft", async () => {
    const member = await person();
    const id = await liveTeam();
    await changed(id, { add: [member] });
    await ok(await reject(id));

    await ok(await resubmit(id, proposer));

    expect((await teamSeen(id))?.draft).toMatchObject({ state: "waiting" });
    expect((await teamSeen(id))?.draft).not.toHaveProperty("reason");
  });

  it("is refused for a draft that is not rejected", async () => {
    const { id } = await drafted();
    const response = await resubmit(id);
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe("Only a rejected draft can be resubmitted");
  });

  it("is resent by a proposer when the draft renames a live team", async () => {
    const id = await liveTeam();
    await changed(id, { name: unique("Fictional Renamed Team") });
    await ok(await reject(id));

    await ok(await resubmit(id, proposer));
  });

  it("is resent by a proposer when the draft adds a team or changes only its members", async () => {
    const { id: adding } = await drafted({}, proposer);
    await ok(await reject(adding));
    await ok(await resubmit(adding, proposer));

    const member = await person();
    const id = await liveTeam();
    await changed(id, { add: [member] }, proposer);
    await ok(await reject(id));
    await ok(await resubmit(id, proposer));
  });

  it("records the rejection cleared from a draft of someone who has not started as Personal", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const id = await liveTeam();
    await changed(id, { add: [starting] });
    await ok(await reject(id));

    await ok(await resubmit(id));

    const cleared = (await test.historyOf(id)).filter(
      ({ field, newValue }) => field === "rejected" && newValue === null,
    );
    expect(cleared.map(({ tier }) => tier)).toEqual(["personal"]);
  });

  it("resubmits a draft holding when members join only by someone who edits Personal details", async () => {
    const member = await person();
    const id = await liveTeam();
    await changed(id, { add: [member], from: "2025-01-01" });
    await ok(await reject(id));
    const manager = await test.signedIn("engineering-manager");

    expect((await resubmit(id, manager)).statusCode).toBe(403);
    await ok(await resubmit(id));
  });
});

describe("approving a team's draft", () => {
  it("adds the team with its lead, its members joining from today", async () => {
    const lead = await person();
    const member = await person();
    const name = unique("Fictional Feature Team");
    const { id } = await drafted({ name, leadId: lead, members: [member] });

    await approved(id);

    expect(await liveRow(id)).toMatchObject({ name });
    expect(await leads(id)).toEqual([
      { leadId: lead, leadPlannedHireId: null, fromDate: today },
    ]);
    expect(await memberships(id)).toEqual(
      expect.arrayContaining([
        { personId: lead, member: true, fromDate: today },
        { personId: member, member: true, fromDate: today },
      ]),
    );
    expect((await teamSeen(id))?.draft).toBeUndefined();
  });

  it("renames the team and changes its lead", async () => {
    const lead = await person();
    const id = await liveTeam();
    const name = unique("Fictional Renamed Team");
    await changed(id, { name, leadId: lead });

    await approved(id);

    expect(await liveRow(id)).toMatchObject({ name });
    expect(await leads(id)).toEqual([
      { leadId: lead, leadPlannedHireId: null, fromDate: today },
    ]);
  });

  it("replaces a planned hire leading the team from the same day with the person approved", async () => {
    // Given a team a planned hire leads from today
    const lead = await person();
    const id = await liveTeam();
    const hire = randomUUID();
    await test.connection.insert(plannedHires).values({
      id: hire,
      temporaryNumber: 960_001,
      positionId: testPosition,
      stateId: await builtInChoice(test.connection, "hiring-states", "open"),
    });
    await test.connection
      .delete(featureTeamLeads)
      .where(eq(featureTeamLeads.teamId, id));
    await test.connection
      .insert(featureTeamLeads)
      .values({ teamId: id, leadPlannedHireId: hire, fromDate: today });

    // When a person is approved as its lead from today
    await changed(id, { leadId: lead });
    await approved(id);

    // Then the person alone leads it from today
    expect(
      await test.connection
        .select({
          leadId: featureTeamLeads.leadId,
          leadPlannedHireId: featureTeamLeads.leadPlannedHireId,
        })
        .from(featureTeamLeads)
        .where(eq(featureTeamLeads.teamId, id)),
    ).toEqual([{ leadId: lead, leadPlannedHireId: null }]);
  });

  it("records someone joining and leaving on the same day as not a member", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member] });
    await changed(id, { remove: [member] });

    await approved(id);

    expect(await memberships(id)).toEqual([
      { personId: member, member: false, fromDate: today },
    ]);
    expect((await teamSeen(id))?.members).toEqual([]);
  });

  it("is approved without a day by an Approver who does not see Personal details", async () => {
    const member = await person();
    const { id } = await drafted({ members: [member] });
    await approved(id, approverWithoutPersonal);
    expect(await liveRow(id)).toBeDefined();
  });

  it("needs an Approver who sees Personal details when it holds when members join", async () => {
    const member = await person();
    const { id } = await drafted({ members: [member], from: "2025-01-01" });

    const response = await approve(id, approverWithoutPersonal);

    expect(response.statusCode).toBe(403);
    expect(errorOf(response)).toBe(
      "One of these drafts holds details this role can't see, so an Approver who sees them must decide it",
    );
    expect(await liveRow(id)).toBeUndefined();
  });

  it("is refused to an Approver who does not see Personal details when it changes someone who has not started, and not when it renames a team with them", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const started = await person();
    const adding = await liveTeam({ members: [started] });
    await changed(adding, { add: [starting] });

    const response = await approve(adding, approverWithoutPersonal);
    expect(response.statusCode).toBe(403);
    expect(errorOf(response)).toBe(
      "One of these drafts holds details this role can't see, so an Approver who sees them must decide it",
    );
    expect((await reject(adding, approverWithoutPersonal)).statusCode).toBe(
      403,
    );

    await approved(adding);
    await changed(adding, { name: unique("Fictional Renamed Team") });
    await approved(adding, approverWithoutPersonal);
  });

  it("records the access history of the people whose days it makes", async () => {
    const member = await person();
    const { id } = await drafted({ members: [member], from: "2025-01-01" });
    const before = await accessRecords("personal-changed", approver.id, member);

    await approved(id);

    expect(
      await accessRecords("personal-changed", approver.id, member),
    ).toHaveLength(before.length + 1);
  });

  it("is refused to an Approver who does not see people", async () => {
    const { id } = await drafted();
    const other = await test.signedIn([
      "feature-teams:view",
      "feature-teams:approve",
    ]);
    expect((await approve(id, other)).statusCode).toBe(403);
  });

  it("is refused to an Approver who does not approve feature teams", async () => {
    const { id } = await drafted();
    const other = await test.signedIn([
      "people:view",
      "feature-teams:view",
      "people:approve",
    ]);
    expect((await approve(id, other)).statusCode).toBe(403);
  });

  it("is refused for a rejected draft", async () => {
    const { id } = await drafted();
    await ok(await reject(id));
    expect((await approve(id)).statusCode).toBe(409);
    expect(await liveRow(id)).toBeUndefined();
  });

  it("answers a team with no draft as not found", async () => {
    const id = await liveTeam();
    const response = await approve(id);
    expect(response.statusCode).toBe(404);
    expect(errorOf(response)).toBe(
      "One of these feature teams has no draft; refresh to see the latest",
    );
  });

  it("is refused while someone is changing the team", async () => {
    const id = await liveTeam();
    await changed(id, { name: unique("Fictional Renamed Team") });
    const other = await test.signedIn("workforce-administrator");
    await ok(
      await change(id, { name: unique("Fictional Held") }, other, {
        publish: false,
      }),
    );

    expect((await approve(id)).statusCode).toBe(409);
    await ok(await send(other, "POST", "/api/unpublished/discard"));
  });
});

describe("rejecting a team's draft", () => {
  it("rejects it with a reason, recording the rejection once", async () => {
    const { id } = await drafted();

    await ok(await reject(id));
    await ok(await reject(id));

    expect((await teamSeen(id))?.draft).toMatchObject({
      state: "rejected",
      reason: "Fictional reason",
    });
    const rejections = (await test.historyOf(id)).filter(
      ({ field }) => field === "rejected",
    );
    expect(rejections).toHaveLength(1);
  });

  it("records a new reason for a draft already rejected", async () => {
    const { id } = await drafted();
    await ok(await reject(id));

    await ok(await reject(id, approver, "Another fictional reason"));

    expect((await teamSeen(id))?.draft?.reason).toBe(
      "Another fictional reason",
    );
  });

  it("records the rejection of a draft holding only when its lead changes as Personal", async () => {
    const first = await person();
    const second = await person();
    const id = await liveTeam({ leadId: first, members: [second] });
    await changed(id, { leadId: second, from: "2099-03-01" });

    await ok(await reject(id));

    const [rejection] = (await test.historyOf(id)).filter(
      ({ field }) => field === "rejected",
    );
    expect(rejection?.tier).toBe("personal");
  });

  it("records the rejection of a draft holding when members join as Personal", async () => {
    const member = await person();
    const { id } = await drafted({ members: [member], from: "2025-01-01" });

    await ok(await reject(id));

    const [rejection] = (await test.historyOf(id)).filter(
      ({ field }) => field === "rejected",
    );
    expect(rejection?.tier).toBe("personal");
  });

  it("is refused to an Approver who does not see when members join, when the draft holds it", async () => {
    const member = await person();
    const { id } = await drafted({ members: [member], from: "2025-01-01" });
    expect((await reject(id, approverWithoutPersonal)).statusCode).toBe(403);
    expect((await teamSeen(id))?.draft?.state).toBe("waiting");
  });
});

describe("a draft rejected for changing someone who has not started", () => {
  it("is recorded as Personal", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const id = await liveTeam();
    await changed(id, { add: [starting] });

    await ok(await reject(id));

    const [rejection] = (await test.historyOf(id)).filter(
      ({ field }) => field === "rejected",
    );
    expect(rejection?.tier).toBe("personal");
  });
});

describe("unpublished changes to teams", () => {
  const unpublished = { publish: false };

  it("are seen only by their maker until published, named by the team", async () => {
    const maker = await test.signedIn("workforce-administrator");
    const name = unique("Fictional Unpublished Team");
    const { id } = await drafted({ name }, maker, unpublished);

    expect(await teamSeen(id, planner)).toBeUndefined();
    const { changes } = await ok<Unpublished>(
      await send(maker, "GET", "/api/unpublished"),
    );
    expect(changes).toContainEqual(
      expect.objectContaining({ subject: `the feature team ${name}` }),
    );

    await ok(await send(maker, "POST", "/api/unpublished/publish"));
    expect((await teamSeen(id, planner))?.draft?.state).toBe("waiting");
  });

  it("are listed by the team's name for a team drafted to be removed", async () => {
    const maker = await test.signedIn("workforce-administrator");
    const name = unique("Fictional Removed Team");
    const id = await liveTeam({ name });
    await ok(await remove(id, maker, unpublished));

    const { changes } = await ok<Unpublished>(
      await send(maker, "GET", "/api/unpublished"),
    );

    expect(changes).toContainEqual(
      expect.objectContaining({ subject: `the feature team ${name}` }),
    );
    await ok(await send(maker, "POST", "/api/unpublished/discard"));
  });

  it("are discarded, leaving teams added gone, and teams changed and removed as they were", async () => {
    const maker = await test.signedIn("feature-lead");
    const member = await person();
    const name = unique("Fictional Feature Team");
    const changing = await liveTeam({ name });
    const removing = await liveTeam();
    const { id: adding } = await drafted({}, maker, unpublished);
    await ok(await change(changing, { add: [member] }, maker, unpublished));
    const lister = await test.signedIn("workforce-administrator");
    await ok(await remove(removing, lister, unpublished));

    await ok(await send(maker, "POST", "/api/unpublished/discard"));
    await ok(await send(lister, "POST", "/api/unpublished/discard"));

    expect(await teamSeen(adding, maker)).toBeUndefined();
    expect(await teamSeen(changing, maker)).toMatchObject({
      name,
      members: [],
    });
    expect((await teamSeen(changing, maker))?.draft).toBeUndefined();
    expect((await teamSeen(removing, lister))?.draft).toBeUndefined();
  });

  it("are discarded back to the published draft of a team", async () => {
    const member = await person();
    const id = await liveTeam();
    const name = unique("Fictional Published Name");
    await changed(id, { name });
    await ok(await change(id, { add: [member] }, editor, unpublished));

    await ok(await send(editor, "POST", "/api/unpublished/discard"));

    expect(await teamSeen(id)).toMatchObject({ name, members: [] });
    expect((await teamSeen(id))?.draft?.unpublished).toBeUndefined();
  });

  it("record the access history when discarded with the days they gave", async () => {
    const member = await person();
    const maker = await test.signedIn("workforce-administrator");
    await drafted(
      { members: [member], from: "2025-01-01" },
      maker,
      unpublished,
    );
    const before = await accessRecords("personal-changed", maker.id, member);

    await ok(await send(maker, "POST", "/api/unpublished/discard"));

    expect(
      await accessRecords("personal-changed", maker.id, member),
    ).toHaveLength(before.length + 1);
  });

  it("are published by those who edit feature teams", async () => {
    const { id } = await drafted({}, proposer, unpublished);
    await ok(await send(proposer, "POST", "/api/unpublished/publish"));
    expect((await teamSeen(id, planner))?.draft?.unpublished).toBeUndefined();
  });
});
