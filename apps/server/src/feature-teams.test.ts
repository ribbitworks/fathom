// SPDX-License-Identifier: Apache-2.0

// Tests for feature teams, against a migrated PostgreSQL server: reading them, with members who have
// not started and the days a draft gives left out for readers who do not see Restricted details, and
// drafts for those who do not see people; drafting teams added, changed, and removed, with their
// names, leads, and members checked; the day members join or leave from; people who have left;
// colours; approving, rejecting, discarding, resubmitting, and undoing their drafts, and publishing
// and discarding unpublished ones; the change history naming members and leads; and refusing to
// remove a person who leads a team or is in a draft of one. Which permissions each route needs is
// checked with every other route in permissions.test.ts.

import {
  accessHistory,
  drafts,
  featureTeamMemberships,
  featureTeams,
} from "@fathom/db";
import {
  type ChangeHistory,
  type FeatureTeam,
  type FeatureTeams,
  type Unpublished,
} from "@fathom/shared";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readToday } from "./data/settings.ts";
import { startTestApp, type TestApp, testPosition } from "./test-app.ts";

interface User {
  id: string;
  cookie: string;
}

let test: TestApp;
// A Workforce Administrator, who edits feature teams and people, and sees Restricted details.
let editor: User;
// An Engineering Director, who approves feature teams and sees Restricted details.
let approver: User;
// A Feature Lead, who proposes feature teams but does not edit them or see Restricted details.
let proposer: User;
// A Project Manager, who approves feature teams but does not see Restricted details.
let projectManager: User;
// A Resource Planner, who sees the org chart and people, but not Restricted details.
let planner: User;
// Sees the org chart and has Restricted details, but does not see people.
let chartOnly: User;
let today: string;

beforeAll(async () => {
  test = await startTestApp();
  editor = await test.signedIn("workforce-administrator");
  approver = await test.signedIn("engineering-director");
  proposer = await test.signedIn("feature-lead");
  projectManager = await test.signedIn("project-manager");
  planner = await test.signedIn("resource-planner");
  chartOnly = await test.signedIn([
    "org-chart:view",
    "restricted:view",
    "changes:view",
  ]);
  today = await readToday(test.connection);
});

afterAll(async () => {
  await test.close();
});

let count = 0;

// A name or ID no other test uses, so tests sharing the database do not collide.
function unique(prefix: string): string {
  count += 1;
  return `${prefix} ${String(count)}`;
}

type Response = Awaited<ReturnType<TestApp["request"]>>;

const send = (
  who: User,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  payload?: object,
  options?: { publish?: boolean },
) => test.request(who.cookie, method, url, payload, options);

async function ok<T>(response: Response, status = 200): Promise<T> {
  expect(response.statusCode, response.body).toBe(status);
  return Promise.resolve(response.json<T>());
}

const refusal = (response: Response) =>
  response.json<{ error: string }>().error;

const approve = (id: string, who = approver) =>
  send(who, "POST", "/api/drafts/approval", { featureTeams: [id] });

async function approved(id: string, who = approver) {
  await ok(await approve(id, who));
}

const reject = (id: string, who = approver, reason = "Fictional reason") =>
  send(who, "POST", "/api/drafts/rejection", { featureTeams: [id], reason });

// A fictional person, approved so they are live, started in 2020 unless told otherwise.
async function person(details: object = {}): Promise<string> {
  const { ids } = await ok<{ ids: string[] }>(
    await send(editor, "POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("FP"),
          positionId: testPosition,
          startDate: "2020-01-01",
          ...details,
        },
      ],
    }),
    201,
  );
  const id = String(ids[0]);
  await ok(
    await send(approver, "POST", "/api/drafts/approval", { people: [id] }),
  );
  return id;
}

// Changes someone's details, approved, such as giving them an end date so they have left once it
// passes.
async function personChanged(id: string, details: object): Promise<void> {
  await ok(await send(editor, "PATCH", `/api/people/${id}`, details));
  await ok(
    await send(approver, "POST", "/api/drafts/approval", { people: [id] }),
  );
}

const endDated = (id: string, endDate: string) =>
  personChanged(id, { endDate });

// Access history records of an action, for one person, by one user.
const accessRecords = async (
  action: "restricted-viewed" | "restricted-changed",
  actorId: string,
  subjectId?: string,
) =>
  test.connection
    .select({ id: accessHistory.id })
    .from(accessHistory)
    .where(
      and(
        eq(accessHistory.actorId, actorId),
        eq(accessHistory.action, action),
        subjectId === undefined
          ? undefined
          : eq(accessHistory.subjectId, subjectId),
      ),
    );

const create = (body: object, who = editor, options?: { publish?: boolean }) =>
  send(who, "POST", "/api/feature-teams", body, options);

// Drafts a team, named uniquely unless told otherwise, and returns its identifier and change set.
async function drafted(
  body: object = {},
  who = editor,
  options?: { publish?: boolean },
): Promise<{ id: string; changeSetId: string }> {
  return ok(
    await create(
      { name: unique("Fictional Feature Team"), ...body },
      who,
      options,
    ),
    201,
  );
}

// A team drafted and approved, so it is live.
async function liveTeam(body: object = {}): Promise<string> {
  const { id } = await drafted(body);
  await approved(id);
  return id;
}

const change = (
  id: string,
  body: object,
  who = editor,
  options?: { publish?: boolean },
) => send(who, "PATCH", `/api/feature-teams/${id}`, body, options);

async function changed(id: string, body: object, who = editor) {
  return (await ok<{ changeSetId: string | null }>(await change(id, body, who)))
    .changeSetId;
}

const remove = (id: string, who = editor, options?: { publish?: boolean }) =>
  send(who, "DELETE", `/api/feature-teams/${id}`, undefined, options);

const discard = (id: string, who = editor) =>
  send(who, "DELETE", `/api/feature-teams/${id}/draft`);

const resubmit = (id: string, who = editor) =>
  send(who, "DELETE", `/api/feature-teams/${id}/draft/rejection`);

async function teamsSeen(who = editor): Promise<FeatureTeam[]> {
  return (await ok<FeatureTeams>(await send(who, "GET", "/api/feature-teams")))
    .teams;
}

async function teamSeen(
  id: string,
  who = editor,
): Promise<FeatureTeam | undefined> {
  return (await teamsSeen(who)).find((team) => team.id === id);
}

async function liveRow(id: string) {
  const [row] = await test.connection
    .select()
    .from(featureTeams)
    .where(eq(featureTeams.id, id));
  return row;
}

const memberships = (id: string) =>
  test.connection
    .select({
      personId: featureTeamMemberships.personId,
      member: featureTeamMemberships.member,
      fromDate: featureTeamMemberships.fromDate,
    })
    .from(featureTeamMemberships)
    .where(eq(featureTeamMemberships.teamId, id))
    .orderBy(
      asc(featureTeamMemberships.fromDate),
      asc(featureTeamMemberships.member),
    );

const sorted = (...ids: string[]) => [...ids].sort();

describe("reading feature teams", () => {
  it("shows each team, with its lead and members, to everyone who sees the org chart", async () => {
    const lead = await person();
    const member = await person();
    const name = unique("Fictional Feature Team");
    const id = await liveTeam({ name, leadId: lead, members: [member] });

    for (const who of [editor, planner, proposer]) {
      expect(await teamSeen(id, who)).toMatchObject({
        id,
        name,
        leadId: lead,
        colour: null,
        members: sorted(lead, member),
      });
    }
  });

  it("is refused to those who do not see the org chart", async () => {
    const outsider = await test.signedIn("administrator");
    expect((await send(outsider, "GET", "/api/feature-teams")).statusCode).toBe(
      403,
    );
  });

  it("sends the days a draft gives only to readers who see Restricted details, and records that they saw them", async () => {
    const member = await person();
    const { id } = await drafted({ members: [member], from: "2025-02-03" });
    const reader = await test.signedIn("engineering-director");

    expect((await teamSeen(id, reader))?.draft?.days).toEqual({
      [member]: "2025-02-03",
    });
    expect(await accessRecords("restricted-viewed", reader.id)).not.toEqual([]);
    expect((await teamSeen(id, planner))?.draft).not.toHaveProperty("days");
  });

  describe("a reader who sees the org chart with Restricted details but not people", () => {
    it("sees members who have started, and no one who has not", async () => {
      const starting = await person({ startDate: "2099-01-01" });
      const started = await person();
      const id = await liveTeam({ leadId: starting, members: [started] });

      expect(await teamSeen(id, chartOnly)).toMatchObject({
        leadId: null,
        members: [started],
      });
    });

    it("gets teams as approved, with no drafts, no holder, and no team only drafted", async () => {
      const member = await person();
      const name = unique("Fictional Feature Team");
      const id = await liveTeam({ name, members: [member] });
      const { id: drafting } = await drafted();
      await changed(id, { name: unique("Fictional Renamed Team") });
      const other = await test.signedIn("workforce-administrator");
      await ok(
        await change(id, { name: unique("Fictional Held") }, other, {
          publish: false,
        }),
      );

      const seen = await teamSeen(id, chartOnly);
      expect(seen).toMatchObject({ name });
      expect(seen).not.toHaveProperty("draft");
      expect(seen).not.toHaveProperty("heldBy");
      expect(await teamSeen(drafting, chartOnly)).toBeUndefined();
      await ok(await send(other, "POST", "/api/unpublished/discard"));
    });
  });

  it("leaves out members and a lead who have not started for readers who do not see Restricted details", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const started = await person();
    const id = await liveTeam({ leadId: starting, members: [started] });

    expect(await teamSeen(id, planner)).toMatchObject({
      leadId: null,
      members: [started],
    });
    expect(await teamSeen(id, editor)).toMatchObject({
      leadId: starting,
      members: sorted(starting, started),
    });
  });

  it("shows a team only drafted to be added, with a draft that has no live values", async () => {
    const member = await person();
    const { id } = await drafted({ members: [member] });

    expect((await teamSeen(id, planner))?.draft).toMatchObject({
      action: "created",
      changed: expect.arrayContaining(["name", "members"]) as unknown,
      live: {},
      state: "waiting",
    });
  });

  it("shows a team as its draft makes it, with the fields it changes and their live values", async () => {
    const lead = await person();
    const joining = await person();
    const name = unique("Fictional Feature Team");
    const id = await liveTeam({ name, leadId: lead });
    const renamed = unique("Fictional Renamed Team");
    await changed(id, { name: renamed, leadId: joining });

    const shown = await teamSeen(id, planner);

    expect(shown).toMatchObject({
      name: renamed,
      leadId: joining,
      members: sorted(lead, joining),
    });
    expect(shown?.draft).toMatchObject({
      action: "changed",
      live: { name, leadId: lead, members: [lead] },
      state: "waiting",
    });
    expect(shown?.draft?.changed.sort()).toEqual(
      ["leadId", "members", "name"].sort(),
    );
  });

  it("shows the live members but not a lead who has not started when another is chosen, to readers who do not see Restricted details", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const started = await person();
    const id = await liveTeam({ leadId: starting, members: [started] });
    await changed(id, { leadId: started });

    expect((await teamSeen(id, planner))?.draft?.live).toEqual({
      leadId: null,
    });
  });

  it("sends no draft when all it does is add someone who has not started, to readers who do not see Restricted details", async () => {
    // Given a live team and a draft making someone who has not started its lead
    const starting = await person({ startDate: "2099-01-01" });
    const started = await person();
    const id = await liveTeam({ members: [started] });
    await changed(id, { leadId: starting });

    // Then those who do not see Restricted details see nothing of it
    const seen = await teamSeen(id, planner);
    expect(seen).toMatchObject({ leadId: null, members: [started] });
    expect(seen).not.toHaveProperty("draft");
    // And those who do see it
    expect((await teamSeen(id))?.draft?.changed.sort()).toEqual([
      "leadId",
      "members",
    ]);
  });

  it("keeps a team's rename in its draft but not the members who have not started", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const id = await liveTeam();
    await changed(id, {
      add: [starting],
      name: unique("Fictional Renamed Team"),
    });

    expect((await teamSeen(id, planner))?.draft?.changed).toEqual(["name"]);
  });

  it("does not show why a draft of someone who has not started was rejected, to readers who do not see Restricted details", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const id = await liveTeam();
    await changed(id, {
      add: [starting],
      name: unique("Fictional Renamed Team"),
    });
    await ok(await reject(id));

    const seen = (await teamSeen(id, planner))?.draft;
    expect(seen?.state).toBe("rejected");
    expect(seen).not.toHaveProperty("reason");
    expect((await teamSeen(id, editor))?.draft?.reason).toBe(
      "Fictional reason",
    );
  });

  it("leaves no draft when a member's change is taken back, whatever days were given", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2024-01-01" });
    await changed(id, { remove: [member], from: "2025-03-03" });
    await changed(id, { add: [member], from: "2025-04-04" });

    expect((await teamSeen(id))?.draft).toBeUndefined();
  });

  it("shows why a draft was rejected only to readers who see all it changes", async () => {
    const member = await person();
    const id = await liveTeam();
    await changed(id, { add: [member], from: "2025-05-05" });
    await ok(await reject(id));

    expect((await teamSeen(id, editor))?.draft).toMatchObject({
      state: "rejected",
      reason: "Fictional reason",
    });
    const seen = (await teamSeen(id, planner))?.draft;
    expect(seen?.state).toBe("rejected");
    expect(seen).not.toHaveProperty("reason");
  });

  it("shows who else is changing a team, and the maker's unpublished draft as theirs", async () => {
    const id = await liveTeam();
    const other = await test.signedIn("workforce-administrator");
    await ok(
      await change(id, { name: unique("Fictional Held Team") }, other, {
        publish: false,
      }),
    );

    expect((await teamSeen(id, editor))?.heldBy).toBeDefined();
    expect((await teamSeen(id, other))?.draft?.unpublished).toBe(true);
    await ok(await send(other, "POST", "/api/unpublished/discard"));
  });

  it("shows a draft written without the change history without who made it", async () => {
    const id = await liveTeam();
    await test.connection.insert(drafts).values({
      recordType: "feature-team",
      recordId: id,
      action: "changed",
      fields: { name: unique("Fictional Unrecorded Team") },
    });

    expect((await teamSeen(id))?.draft).toMatchObject({
      changed: ["name"],
      madeBy: null,
      madeAs: null,
      madeAt: null,
      editors: [],
      changedBy: { name: null },
    });
    await ok(await discard(id));
  });

  it("shows no colour for a team whose colour is no longer on the palette", async () => {
    const id = await liveTeam();
    await test.connection
      .update(featureTeams)
      .set({ colour: "fictional-retired-colour" })
      .where(eq(featureTeams.id, id));
    expect((await teamSeen(id))?.colour).toBeNull();
  });

  it("lists teams by name, ignoring letter case", async () => {
    const prefix = unique("Fictional Sorting");
    const later = await liveTeam({ name: `${prefix} b` });
    const earlier = await liveTeam({ name: `${prefix} A` });
    const ids = (await teamsSeen()).map(({ id }) => id);
    expect(ids.indexOf(earlier)).toBeLessThan(ids.indexOf(later));
  });
});

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
      expect(refusal(response)).toBe(
        "Another feature team already has that name",
      );
    }
  });

  it("is refused with a name another user's unpublished draft gives a team", async () => {
    const other = await test.signedIn("workforce-administrator");
    const name = unique("Fictional Unpublished");
    await drafted({ name }, other, { publish: false });

    expect((await create({ name })).statusCode).toBe(409);
    await ok(await send(other, "POST", "/api/unpublished/discard"));
  });

  it("is refused with a member who is not a person", async () => {
    const response = await create({
      name: unique("Fictional Feature Team"),
      members: [randomUUID()],
    });
    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toBe("Choose members from People");
  });

  it("is refused with the same member twice", async () => {
    const member = await person();
    const response = await create({
      name: unique("Fictional Feature Team"),
      members: [member, member],
    });
    expect(response.statusCode).toBe(400);
  });

  it("is refused with someone who has left", async () => {
    const left = await person({ endDate: "2021-06-30" });
    const response = await create({
      name: unique("Fictional Feature Team"),
      leadId: left,
    });
    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toBe("Someone who has left can't join a team");
  });

  it("is refused with someone who has not started to a proposer who does not see Restricted details, as People hides them", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const response = await create(
      { name: unique("Fictional Feature Team"), members: [starting] },
      proposer,
    );
    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toBe("Choose members from People");

    const restricted = await test.signedIn("engineering-manager");
    await drafted({ members: [starting] }, restricted);
  });

  it("records members joining from the day given by someone who may change Restricted details", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2025-01-15" });
    expect(await memberships(id)).toEqual([
      { personId: member, member: true, fromDate: "2025-01-15" },
    ]);
  });

  it("is refused a day by someone who may not change Restricted details", async () => {
    const member = await person();
    const response = await create(
      {
        name: unique("Fictional Feature Team"),
        members: [member],
        from: "2025-01-15",
      },
      proposer,
    );
    expect(response.statusCode).toBe(403);
  });

  it("is refused a day after today", async () => {
    const response = await create({
      name: unique("Fictional Feature Team"),
      from: "2099-01-01",
    });
    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toBe(
      "Members join or leave from today or an earlier day",
    );
  });

  it("is refused to those who neither propose nor edit feature teams", async () => {
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

  it("ignores adding a member already on it and removing someone not on it", async () => {
    const member = await person();
    const outsider = await person();
    const id = await liveTeam({ members: [member] });

    expect(await changed(id, { add: [member], remove: [outsider] })).toBeNull();
    expect((await teamSeen(id))?.draft).toBeUndefined();
  });

  it("leaves the team with no lead when the lead leaves it", async () => {
    const lead = await person();
    const member = await person();
    const id = await liveTeam({ leadId: lead, members: [member] });

    await changed(id, { remove: [lead] });

    expect(await teamSeen(id)).toMatchObject({
      leadId: null,
      members: [member],
    });
  });

  it("keeps its lead when another member leaves", async () => {
    const lead = await person();
    const member = await person();
    const id = await liveTeam({ leadId: lead, members: [member] });

    await changed(id, { remove: [member] });

    expect(await teamSeen(id)).toMatchObject({ leadId: lead, members: [lead] });
  });

  it("gives the team the lead chosen when its lead leaves", async () => {
    const lead = await person();
    const member = await person();
    const id = await liveTeam({ leadId: lead, members: [member] });

    await changed(id, { remove: [lead], leadId: member });

    expect(await teamSeen(id)).toMatchObject({
      leadId: member,
      members: [member],
    });
  });

  it("adds a lead chosen from outside the team to it", async () => {
    const member = await person();
    const outsider = await person();
    const id = await liveTeam({ members: [member] });

    await changed(id, { leadId: outsider }, proposer);

    expect(await teamSeen(id)).toMatchObject({
      leadId: outsider,
      members: sorted(member, outsider),
    });
  });

  it("is refused a lead the change removes from the team", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member] });

    const response = await change(id, { leadId: member, remove: [member] });

    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toBe(
      "The feature lead must be one of the members",
    );
  });

  it("is refused a member who has left", async () => {
    const left = await person({ endDate: "2021-06-30" });
    const id = await liveTeam();
    expect((await change(id, { add: [left] })).statusCode).toBe(400);
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

  it("is refused a day by someone who may not change Restricted details", async () => {
    const member = await person();
    const id = await liveTeam();
    const response = await change(
      id,
      { add: [member], from: "2025-01-01" },
      proposer,
    );
    expect(response.statusCode).toBe(403);
    expect(refusal(response)).toBe(
      "Your role can't set a date, so leave it as today",
    );
  });

  it("is refused a day after today", async () => {
    const member = await person();
    const id = await liveTeam();
    expect(
      (await change(id, { add: [member], from: "2099-01-01" })).statusCode,
    ).toBe(400);
  });

  it("is renamed by those who edit feature teams, but not by those who only propose them", async () => {
    const id = await liveTeam();
    const name = unique("Fictional Renamed Team");

    expect((await change(id, { name }, proposer)).statusCode).toBe(403);
    const manager = await test.signedIn("engineering-manager");
    expect((await change(id, { name }, manager)).statusCode).toBe(403);
    await changed(id, { name });

    expect((await teamSeen(id))?.name).toBe(name);
  });

  it("is refused a name another team has", async () => {
    const taken = unique("Fictional Taken");
    await liveTeam({ name: taken });
    const id = await liveTeam();
    const response = await change(id, { name: taken.toLowerCase() });
    expect(response.statusCode).toBe(409);
  });

  it("keeps its own name in another letter case", async () => {
    const name = unique("Fictional Cased");
    const id = await liveTeam({ name });
    await changed(id, { name: name.toUpperCase() });
    expect((await teamSeen(id))?.name).toBe(name.toUpperCase());
  });

  it("answers a team that does not exist as not found", async () => {
    const response = await change(randomUUID(), { leadId: null });
    expect(response.statusCode).toBe(404);
    expect(refusal(response)).toBe("There is no such feature team");
  });

  it("is refused for a team its draft removes", async () => {
    const id = await liveTeam();
    await ok(await remove(id));
    const response = await change(id, { leadId: null });
    expect(response.statusCode).toBe(409);
  });

  it("is refused while another user is changing it", async () => {
    const id = await liveTeam();
    const other = await test.signedIn("workforce-administrator");
    await ok(
      await change(id, { name: unique("Fictional Held") }, other, {
        publish: false,
      }),
    );

    const response = await change(id, { name: unique("Fictional Mine") });

    expect(response.statusCode).toBe(409);
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

describe("the names of those on a team", () => {
  it("names members and leads, drafted or live, to readers who see them, including someone who has not started", async () => {
    // Given a team with a lead, and a draft adding someone who has not started
    const leadName = unique("Fictional Lead");
    const lead = await person({ preferredName: leadName });
    const startingName = unique("Fictional Starter");
    const starting = await person({
      preferredName: startingName,
      startDate: "2099-01-01",
    });
    const id = await liveTeam({ leadId: lead });
    await changed(id, { add: [starting] });

    // Then those who see Restricted details are told both names
    expect((await teamSeen(id, approver))?.names).toEqual({
      [lead]: leadName,
      [starting]: startingName,
    });

    // And those who do not are told only the lead's
    expect((await teamSeen(id, planner))?.names).toEqual({ [lead]: leadName });
  });

  it("does not name someone who has left", async () => {
    const member = await person();
    const staying = await person();
    const id = await liveTeam({ members: [member, staying] });
    await endDated(member, "2024-12-31");

    expect(Object.keys((await teamSeen(id, approver))?.names ?? {})).toEqual([
      staying,
    ]);
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
    expect(refusal(response)).toBe(
      "Choose a day after the last time this person joined or left this team",
    );
  });

  it("is refused before their latest record on that team", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2025-06-01" });
    await changed(id, { remove: [member], from: "2025-08-01" });
    await approved(id);

    const response = await change(id, { add: [member], from: "2025-07-01" });

    expect(response.statusCode).toBe(400);
  });

  it("is accepted after their latest record on that team", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2025-06-01" });
    await changed(id, { remove: [member], from: "2025-08-01" });
    await approved(id);

    await changed(id, { add: [member], from: "2025-09-01" });
    await approved(id);

    expect((await memberships(id)).at(-1)).toEqual({
      personId: member,
      member: true,
      fromDate: "2025-09-01",
    });
  });

  it("is not compared with their records on another team", async () => {
    const member = await person();
    await liveTeam({ members: [member], from: "2025-06-01" });
    await drafted({ members: [member], from: "2025-01-01" });
  });

  it("is refused before their start date", async () => {
    const member = await person({ startDate: "2025-03-01" });
    const response = await create({
      name: unique("Fictional Feature Team"),
      members: [member],
      from: "2025-02-28",
    });
    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toBe(
      "Someone can't join or leave a team before their start date",
    );
  });

  it("is refused after their end date", async () => {
    const left = await person({ endDate: "2021-06-30" });
    const response = await create({
      name: unique("Fictional Feature Team"),
      members: [left],
      from: "2022-01-01",
    });
    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toBe(
      "Someone can't join or leave a team after their end date",
    );
  });

  it("asks for someone from People when a day is given for someone who is not a person", async () => {
    const response = await create({
      name: unique("Fictional Feature Team"),
      members: [randomUUID()],
      from: "2025-01-01",
    });
    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toBe("Choose members from People");
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
    expect(refusal(response)).toBe(
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

  it("is not shown among a draft's members or as its lead", async () => {
    const member = await person();
    const staying = await person();
    const id = await liveTeam({ members: [staying] });
    await changed(id, { add: [member], leadId: member, from: "2025-01-01" });
    await endDated(member, "2025-06-30");

    const seen = await teamSeen(id, editor);

    expect(seen).toMatchObject({ leadId: null, members: [staying] });
    expect(seen?.draft).not.toHaveProperty("days");
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
    expect(await liveRow(id)).toMatchObject({ name, leadId: null });
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

    expect(await liveRow(id)).toMatchObject({ leadId: null });
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

    it("shows the draft to readers who see Restricted details with no change, and others no draft", async () => {
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

  it("is refused joining as before", async () => {
    const left = await person({ endDate: "2021-06-30" });
    const id = await liveTeam();
    const response = await change(id, { add: [left] });
    expect(refusal(response)).toBe("Someone who has left can't join a team");
  });
});

describe("removing a feature team", () => {
  it("drafts its removal, which approving makes", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member] });

    await ok(await remove(id));
    expect((await teamSeen(id))?.draft?.action).toBe("deleted");
    await approved(id);

    expect(await teamSeen(id)).toBeUndefined();
    expect(await liveRow(id)).toBeUndefined();
    expect(await memberships(id)).toEqual([]);
  });

  it("is refused to those who only propose feature teams", async () => {
    const id = await liveTeam();
    expect((await remove(id, proposer)).statusCode).toBe(403);
  });

  it("discards the draft of a team only drafted to be added", async () => {
    const { id } = await drafted();
    const { changeSetId } = await ok<{ changeSetId: string }>(await remove(id));
    expect(changeSetId).toEqual(expect.any(String));
    expect(await teamSeen(id)).toBeUndefined();
  });

  it("changes nothing for a team already drafted to be removed", async () => {
    const id = await liveTeam();
    await ok(await remove(id));
    expect(
      (await ok<{ changeSetId: string | null }>(await remove(id))).changeSetId,
    ).toBeNull();
  });

  it("answers a team that does not exist as not found", async () => {
    expect((await remove(randomUUID())).statusCode).toBe(404);
  });
});

describe("discarding and resubmitting a team's draft", () => {
  it("puts a changed team back as it is live", async () => {
    const name = unique("Fictional Feature Team");
    const id = await liveTeam({ name });
    await changed(id, { name: unique("Fictional Renamed Team") });

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
    expect(refusal(response)).toBe("This feature team has no draft");
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
    expect(refusal(response)).toBe("Only a rejected draft can be resubmitted");
  });

  it("needs the right to edit teams to resend a draft renaming a live team", async () => {
    const id = await liveTeam();
    await changed(id, { name: unique("Fictional Renamed Team") });
    await ok(await reject(id));

    expect((await resubmit(id, proposer)).statusCode).toBe(403);
    await ok(await resubmit(id));
  });

  it("needs the right to edit teams to resend a draft removing a team", async () => {
    const id = await liveTeam();
    await ok(await remove(id));
    await ok(await reject(id));

    expect((await resubmit(id, proposer)).statusCode).toBe(403);
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

  it("records the rejection cleared from a draft of someone who has not started as Restricted", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const id = await liveTeam();
    await changed(id, { add: [starting] });
    await ok(await reject(id));

    await ok(await resubmit(id));

    const cleared = (await test.historyOf(id)).filter(
      ({ field, newValue }) => field === "rejected" && newValue === null,
    );
    expect(cleared.map(({ tier }) => tier)).toEqual(["restricted"]);
  });

  it("resubmits a draft holding when members join only by someone who edits Restricted details", async () => {
    const member = await person();
    const id = await liveTeam();
    await changed(id, { add: [member], from: "2025-01-01" });
    await ok(await reject(id));
    const manager = await test.signedIn("engineering-manager");

    expect((await resubmit(id, manager)).statusCode).toBe(403);
    await ok(await resubmit(id));
  });
});

describe("a team's colour", () => {
  const colour = (id: string, value: string | null, who = editor) =>
    send(who, "PUT", `/api/feature-teams/${id}/colour`, { colour: value });

  it("is set and removed at once by those who colour teams", async () => {
    const id = await liveTeam();

    expect((await colour(id, "teal")).statusCode).toBe(204);
    expect((await teamSeen(id, planner))?.colour).toBe("teal");
    expect((await teamSeen(id))?.draft).toBeUndefined();
    expect((await colour(id, null)).statusCode).toBe(204);
    expect((await teamSeen(id))?.colour).toBeNull();
  });

  it("is refused to those who do not colour teams", async () => {
    const id = await liveTeam();
    expect((await colour(id, "teal", proposer)).statusCode).toBe(403);
  });

  it("is refused for a team not yet approved", async () => {
    const { id } = await drafted();
    const response = await colour(id, "teal");
    expect(response.statusCode).toBe(404);
    expect(refusal(response)).toBe(
      "This feature team is not approved yet, so it cannot have a colour",
    );
  });
});

describe("approving a team's draft", () => {
  it("adds the team with its lead, its members joining from today", async () => {
    const lead = await person();
    const member = await person();
    const name = unique("Fictional Feature Team");
    const { id } = await drafted({ name, leadId: lead, members: [member] });

    await approved(id);

    expect(await liveRow(id)).toMatchObject({ name, leadId: lead });
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

    expect(await liveRow(id)).toMatchObject({ name, leadId: lead });
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

  it("is approved without a day by an Approver who does not see Restricted details", async () => {
    const member = await person();
    const { id } = await drafted({ members: [member] });
    await approved(id, projectManager);
    expect(await liveRow(id)).toBeDefined();
  });

  it("needs an Approver who sees Restricted details when it holds when members join", async () => {
    const member = await person();
    const { id } = await drafted({ members: [member], from: "2025-01-01" });

    const response = await approve(id, projectManager);

    expect(response.statusCode).toBe(403);
    expect(refusal(response)).toBe(
      "One of these drafts holds details your role does not let you see, so an Approver who sees them must decide it",
    );
    expect(await liveRow(id)).toBeUndefined();
  });

  it("is refused to an Approver who does not see Restricted details when it changes someone who has not started, and not when it renames a team with them", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const started = await person();
    const adding = await liveTeam({ members: [started] });
    await changed(adding, { add: [starting] });

    const response = await approve(adding, projectManager);
    expect(response.statusCode).toBe(403);
    expect(refusal(response)).toBe(
      "One of these drafts holds details your role does not let you see, so an Approver who sees them must decide it",
    );
    expect((await reject(adding, projectManager)).statusCode).toBe(403);

    await approved(adding);
    await changed(adding, { name: unique("Fictional Renamed Team") });
    await approved(adding, projectManager);
  });

  it("records the access history of the people whose days it makes", async () => {
    const member = await person();
    const { id } = await drafted({ members: [member], from: "2025-01-01" });
    const before = await accessRecords(
      "restricted-changed",
      approver.id,
      member,
    );

    await approved(id);

    expect(
      await accessRecords("restricted-changed", approver.id, member),
    ).toHaveLength(before.length + 1);
  });

  it("is refused to an Approver who does not see people", async () => {
    const { id } = await drafted();
    const other = await test.signedIn([
      "org-chart:view",
      "feature-teams:approve",
    ]);
    expect((await approve(id, other)).statusCode).toBe(403);
  });

  it("is refused to an Approver who does not approve feature teams", async () => {
    const { id } = await drafted();
    const other = await test.signedIn([
      "org-chart:view",
      "people:view",
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
    expect(refusal(response)).toBe(
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

  it("records the rejection of a draft holding when members join as Restricted", async () => {
    const member = await person();
    const { id } = await drafted({ members: [member], from: "2025-01-01" });

    await ok(await reject(id));

    const [rejection] = (await test.historyOf(id)).filter(
      ({ field }) => field === "rejected",
    );
    expect(rejection?.tier).toBe("restricted");
  });

  it("is refused to an Approver who does not see when members join, when the draft holds it", async () => {
    const member = await person();
    const { id } = await drafted({ members: [member], from: "2025-01-01" });
    expect((await reject(id, projectManager)).statusCode).toBe(403);
    expect((await teamSeen(id))?.draft?.state).toBe("waiting");
  });
});

describe("a draft rejected for changing someone who has not started", () => {
  it("is recorded as Restricted", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const id = await liveTeam();
    await changed(id, { add: [starting] });

    await ok(await reject(id));

    const [rejection] = (await test.historyOf(id)).filter(
      ({ field }) => field === "rejected",
    );
    expect(rejection?.tier).toBe("restricted");
  });
});

describe("undoing a change to a team", () => {
  const undo = (changeSetId: string | null, who = editor) =>
    send(who, "POST", `/api/undo/${String(changeSetId)}`);

  it("takes out a team its change drafted to add", async () => {
    const { id, changeSetId } = await drafted();
    await ok(await undo(changeSetId));
    expect(await teamSeen(id)).toBeUndefined();
  });

  it("puts back the members a change drafted", async () => {
    const member = await person();
    const joining = await person();
    const id = await liveTeam({ members: [member] });
    const changeSetId = await changed(id, {
      add: [joining],
      remove: [member],
    });

    await ok(await undo(changeSetId));

    expect(await teamSeen(id)).toMatchObject({ members: [member] });
    expect((await teamSeen(id))?.draft).toBeUndefined();
  });

  it("puts back a team its change drafted to remove", async () => {
    const id = await liveTeam();
    const { changeSetId } = await ok<{ changeSetId: string }>(await remove(id));
    await ok(await undo(changeSetId));
    expect((await teamSeen(id))?.draft).toBeUndefined();
  });

  it("is refused once the name it puts back is another team's", async () => {
    // Given a team only drafted to be added, discarded, and its name then taken
    const name = unique("Fictional Feature Team");
    const { id } = await drafted({ name });
    const { changeSetId } = await ok<{ changeSetId: string }>(
      await discard(id),
    );
    await liveTeam({ name: name.toLowerCase() });

    // When the discard is undone
    const response = await undo(changeSetId);

    // Then it is refused, and the team stays gone
    expect(response.statusCode).toBe(409);
    expect(await teamSeen(id)).toBeUndefined();
  });

  it("is refused once a member it puts back is no longer someone the actor may see", async () => {
    const member = await person();
    const maker = await test.signedIn("feature-lead");
    const id = await liveTeam();
    await changed(id, { add: [member] }, maker);
    const { changeSetId } = await ok<{ changeSetId: string }>(
      await discard(id, maker),
    );
    await personChanged(member, { startDate: "2099-01-01" });

    expect((await undo(changeSetId, maker)).statusCode).toBe(409);
  });

  it("needs the right to edit teams to put back a team it drafted to remove, or to put back a name", async () => {
    const maker = await test.signedIn("workforce-administrator");
    const id = await liveTeam();
    const { changeSetId } = await ok<{ changeSetId: string }>(
      await remove(id, maker),
    );
    await test.holdOnly(maker.id, [
      "org-chart:view",
      "people:view",
      "feature-teams:propose",
    ]);

    expect((await undo(changeSetId, maker)).statusCode).toBe(403);

    const renaming = await test.signedIn("workforce-administrator");
    const renamed = await liveTeam();
    const changeSet = await changed(
      renamed,
      { name: unique("Fictional Renamed Team") },
      renaming,
    );
    await test.holdOnly(renaming.id, [
      "org-chart:view",
      "people:view",
      "feature-teams:propose",
    ]);
    expect((await undo(changeSet, renaming)).statusCode).toBe(403);
  });

  it("needs the right to edit teams to bring back a removal that was discarded", async () => {
    const id = await liveTeam();
    await ok(await remove(id));
    const discarder = await test.signedIn("feature-lead");
    const { changeSetId } = await ok<{ changeSetId: string }>(
      await discard(id, discarder),
    );

    expect((await undo(changeSetId, discarder)).statusCode).toBe(403);
  });

  it("is made by a proposer to bring back a discarded draft adding a team", async () => {
    const maker = await test.signedIn("feature-lead");
    const { id } = await drafted({}, maker);
    const { changeSetId } = await ok<{ changeSetId: string }>(
      await discard(id, maker),
    );
    expect(await teamSeen(id)).toBeUndefined();

    await ok(await undo(changeSetId, maker));

    expect((await teamSeen(id, maker))?.draft?.action).toBe("created");
  });

  it("is made by a proposer for a change of members", async () => {
    const member = await person();
    const maker = await test.signedIn("feature-lead");
    const id = await liveTeam({ members: [member] });
    const removed = await changed(id, { remove: [member] }, maker);

    await ok(await undo(removed, maker));

    expect((await teamSeen(id))?.draft).toBeUndefined();
  });

  it("records the access history of people whose days it puts back", async () => {
    const member = await person();
    const id = await liveTeam();
    const dated = await changed(id, { add: [member], from: "2025-01-01" });
    const before = await accessRecords("restricted-changed", editor.id, member);

    await ok(await undo(dated));

    expect(
      await accessRecords("restricted-changed", editor.id, member),
    ).toHaveLength(before.length + 1);
  });

  it("is refused to its maker once they neither propose nor edit feature teams", async () => {
    const maker = await test.signedIn("feature-lead");
    const { changeSetId } = await drafted({}, maker);
    await test.holdOnly(maker.id, ["org-chart:view"]);
    expect((await undo(changeSetId, maker)).statusCode).toBe(403);
  });
});

describe("the change history of a team", () => {
  async function recordOf(changeSetId: string | null, who: User) {
    const { entries } = await ok<ChangeHistory>(
      await send(who, "GET", "/api/changes"),
    );
    return entries
      .find((entry) => entry.id === changeSetId)
      ?.records.find((record) => record.kind === "feature-team");
  }

  const valueOf = (
    record: Awaited<ReturnType<typeof recordOf>>,
    field: string,
  ) => record?.fields.find((one) => one.field === field)?.newValue;

  it("names the team, its members, and its lead", async () => {
    const lead = await person({ preferredName: unique("Fictional Lead") });
    const id = await liveTeam();
    const name = String((await teamSeen(id))?.name);
    const changeSetId = await changed(id, { leadId: lead });
    const leadName = (
      await ok<{ people: { id: string; preferredName: string }[] }>(
        await send(editor, "GET", "/api/people"),
      )
    ).people.find((one) => one.id === lead)?.preferredName;

    const record = await recordOf(changeSetId, planner);

    expect(record?.name).toBe(name);
    expect(valueOf(record, "members")).toEqual([leadName]);
    expect(valueOf(record, "leadId")).toBe(leadName);
  });

  it("shows nothing of a draft adding someone who has not started to readers who do not see Restricted details", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const started = await person();
    const id = await liveTeam({ members: [started] });
    const changeSetId = await changed(id, { leadId: starting });

    expect(await recordOf(changeSetId, planner)).toBeUndefined();
    const edited = await recordOf(changeSetId, editor);
    expect(valueOf(edited, "members")).toHaveLength(2);
    expect(valueOf(edited, "leadId")).toEqual(expect.any(String));
  });

  it("keeps a member's change someone sees, with those not started taken out", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const started = await person();
    const id = await liveTeam();
    const changeSetId = await changed(id, { add: [starting, started] });

    const seen = await recordOf(changeSetId, planner);

    expect(valueOf(seen, "members")).toHaveLength(1);
  });

  it("drops only the lead field when members are also changed, to readers who do not see Restricted details", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const started = await person();
    const id = await liveTeam();
    const changeSetId = await changed(id, {
      leadId: starting,
      add: [started],
    });

    const seen = await recordOf(changeSetId, planner);

    expect(seen?.fields.map(({ field }) => field)).toEqual(["members"]);
  });

  it("hides a resubmission of a draft that only adds someone who has not started, whose rejection was recorded as Restricted, and a change clearing it", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const id = await liveTeam();
    await changed(id, { add: [starting] });
    await ok(await reject(id));

    const resent = (await ok<{ changeSetId: string }>(await resubmit(id)))
      .changeSetId;

    expect(await recordOf(resent, planner)).toBeUndefined();
  });

  it("shows nothing of a change adding only someone not started, with the rejection it clears, to readers who do not see Restricted details", async () => {
    // Given a rejected draft of someone everyone sees
    const member = await person();
    const starting = await person({ startDate: "2099-01-01" });
    const id = await liveTeam();
    await changed(id, { add: [member] });
    await ok(await reject(id));

    // When someone not started is added too, clearing the rejection
    const adding = await changed(id, { add: [starting] });

    // Then those who do not see Restricted details see nothing of that change
    expect(await recordOf(adding, planner)).toBeUndefined();
    expect(await recordOf(adding, editor)).toBeDefined();
  });

  it("shows a reader who does not see people only approved changes, without when members join", async () => {
    const member = await person();
    const name = unique("Fictional Feature Team");
    const { id, changeSetId } = await drafted({
      name,
      members: [member],
      from: "2025-01-01",
    });

    expect(await recordOf(changeSetId, chartOnly)).toBeUndefined();
    await approved(id);
    const { entries } = await ok<ChangeHistory>(
      await send(chartOnly, "GET", "/api/changes"),
    );
    const record = entries
      .flatMap((entry) => entry.records)
      .find((one) => one.name === name);
    expect(record).toBeDefined();
    expect(record?.draft).toBe(false);
    expect(record?.fields.map(({ field }) => field)).not.toContain(
      "memberFrom",
    );
  });

  it("names nobody who has not started to a reader who sees the org chart but not People", async () => {
    const preferredName = unique("Fictional Starter");
    const starting = await person({ preferredName, startDate: "2099-01-01" });
    const id = await liveTeam();
    const changeSetId = await changed(id, { leadId: starting });
    const reader = await test.signedIn("product-manager");

    const seen = await recordOf(changeSetId, reader);

    expect(JSON.stringify(seen ?? null)).not.toContain(preferredName);
  });

  it("labels a team with its approved name, not a name only drafted, for a reader who does not see people", async () => {
    const name = unique("Fictional Feature Team");
    const id = await liveTeam({ name });
    const renamed = unique("Fictional Renamed Team");
    await changed(id, { name: renamed });

    const { entries } = await ok<ChangeHistory>(
      await send(chartOnly, "GET", "/api/changes"),
    );
    const names = entries
      .flatMap((entry) => entry.records)
      .map((record) => record.name);

    expect(names).toContain(name);
    expect(names).not.toContain(renamed);
  });

  it("is seen with the org chart", async () => {
    const { changeSetId } = await drafted();
    const reader = await test.signedIn(["changes:view"]);
    expect(await recordOf(changeSetId, reader)).toBeUndefined();
    expect(await recordOf(changeSetId, planner)).toBeDefined();
  });
});

describe("a person named in a team's draft", () => {
  it("cannot be removed from People while a draft names them as a member", async () => {
    const member = await person();
    await drafted({ members: [member] });

    const response = await send(editor, "DELETE", `/api/people/${member}`);

    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toBe(
      "This person is in a feature team's draft; take them out of it or discard it first",
    );
  });

  it("cannot be removed while another user's unpublished draft names them as a member", async () => {
    const member = await person();
    const other = await test.signedIn("workforce-administrator");
    await drafted({ members: [member] }, other, { publish: false });

    expect(
      (await send(editor, "DELETE", `/api/people/${member}`)).statusCode,
    ).toBe(409);
    await ok(await send(other, "POST", "/api/unpublished/discard"));
  });

  it("cannot be removed by approving a removal drafted before a draft named them", async () => {
    const member = await person();
    await ok(await send(editor, "DELETE", `/api/people/${member}`));
    await drafted({ members: [member] });

    const response = await send(approver, "POST", "/api/drafts/approval", {
      people: [member],
    });

    expect(response.statusCode).toBe(409);
  });
});

describe("a team's lead", () => {
  it("cannot be removed from People while they lead a team, live or in a draft", async () => {
    const live = await person();
    await liveTeam({ leadId: live });
    const inDraft = await person();
    await drafted({ leadId: inDraft });

    for (const id of [live, inDraft]) {
      const response = await send(editor, "DELETE", `/api/people/${id}`);
      expect(response.statusCode).toBe(409);
      expect(refusal(response)).toBe(
        "This person leads a feature team; choose another lead first",
      );
    }
  });

  it("cannot be removed from People while another user's unpublished draft makes them a lead", async () => {
    const lead = await person();
    const other = await test.signedIn("workforce-administrator");
    await drafted({ leadId: lead }, other, { publish: false });

    expect(
      (await send(editor, "DELETE", `/api/people/${lead}`)).statusCode,
    ).toBe(409);
    await ok(await send(other, "POST", "/api/unpublished/discard"));
  });

  it("cannot be removed by approving a removal drafted before they led a team", async () => {
    const lead = await person();
    await ok(await send(editor, "DELETE", `/api/people/${lead}`));
    await liveTeam({ leadId: lead });

    const response = await send(approver, "POST", "/api/drafts/approval", {
      people: [lead],
    });

    expect(response.statusCode).toBe(409);
  });

  it("can be removed once they lead no team", async () => {
    const lead = await person();
    const id = await liveTeam({ leadId: lead });
    await changed(id, { remove: [lead] });
    await approved(id);
    expect(
      (await send(editor, "DELETE", `/api/people/${lead}`)).statusCode,
    ).toBe(200);
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
    const before = await accessRecords("restricted-changed", maker.id, member);

    await ok(await send(maker, "POST", "/api/unpublished/discard"));

    expect(
      await accessRecords("restricted-changed", maker.id, member),
    ).toHaveLength(before.length + 1);
  });

  it("are published by those who only propose feature teams", async () => {
    const { id } = await drafted({}, proposer, unpublished);
    await ok(await send(proposer, "POST", "/api/unpublished/publish"));
    expect((await teamSeen(id, planner))?.draft?.unpublished).toBeUndefined();
  });
});
