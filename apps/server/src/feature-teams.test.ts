// SPDX-License-Identifier: Apache-2.0

// Tests for feature teams, against a migrated PostgreSQL server: reading them, with members who have
// not started and the days a draft gives left out for readers who do not see Personal details, and
// drafts for those who do not see people; drafting teams added, changed, and removed, with their
// names, leads, and members checked; the day members join or leave from; people who have left;
// colours; each month's teams for the monthly table; approving, rejecting, discarding, resubmitting,
// and undoing their drafts, and publishing and discarding unpublished ones; the change history
// naming members and leads; and refusing to remove a person who leads a team or is in a draft of
// one. Which permissions each route needs is checked with every other route in permissions.test.ts.

import {
  accessHistory,
  drafts,
  features,
  featureTeamLeads,
  featureTeamMemberships,
  featureTeams,
} from "@fathom/db";
import {
  addMonths,
  monthOf,
  type ChangeHistory,
  type FeatureTeam,
  type FeatureTeams,
  startingRoles,
  type TeamMonths,
  type Unpublished,
} from "@fathom/shared";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readToday } from "./data/settings.ts";
import {
  generalApprover,
  generalReader,
  builtInChoice,
  personalReader,
  startTestApp,
  type TestApp,
  testPosition,
} from "./test-app.ts";

// The server takes today's date from the clock, so the tests fix it, to give the same days on every
// run, however long the run takes.
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));

interface User {
  id: string;
  cookie: string;
}

let test: TestApp;
// A Workforce Administrator, who edits feature teams and people, and sees Personal details.
let editor: User;
// An Engineering Director, who approves feature teams and sees Personal details.
let approver: User;
// A Feature Lead, who edits feature teams but does not see Personal details.
let proposer: User;
// A Feature Lead given Personal details, which choosing another day needs, but not changing them.
let datedProposer: User;
// An Approver of feature teams who does not see Personal details.
let approverWithoutPersonal: User;
// A reader who sees people and feature teams, but not Personal details.
let planner: User;
// Sees feature teams and has Personal details, but does not see people.
let chartOnly: User;
let today: string;

beforeAll(async () => {
  test = await startTestApp();
  editor = await test.signedIn("workforce-administrator");
  approver = await test.signedIn("engineering-director");
  proposer = await test.signedIn("feature-lead");
  datedProposer = await test.signedIn([
    ...startingRoles["feature-lead"].permissions,
    "personal:view",
  ]);
  approverWithoutPersonal = await test.signedIn(generalApprover);
  planner = await test.signedIn(generalReader);
  chartOnly = await test.signedIn(["feature-teams:view", "personal:view"]);
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
  action: "personal-viewed" | "personal-changed",
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

// Moves the days members join and leave to another class, as the Engineering Director may.
async function moveTeamDates(dataClass: string): Promise<void> {
  await ok(
    await send(approver, "PUT", "/api/data-classes/featureTeamDates", {
      dataClass,
    }),
  );
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

const leads = (id: string) =>
  test.connection
    .select({
      leadId: featureTeamLeads.leadId,
      fromDate: featureTeamLeads.fromDate,
    })
    .from(featureTeamLeads)
    .where(eq(featureTeamLeads.teamId, id))
    .orderBy(asc(featureTeamLeads.fromDate));

const sorted = (...ids: string[]) => [...ids].sort();

describe("reading feature teams", () => {
  it("shows each team, with its lead and members, to everyone who sees feature teams", async () => {
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

  it("is refused to those who do not see feature teams", async () => {
    const outsider = await test.signedIn("administrator");
    expect((await send(outsider, "GET", "/api/feature-teams")).statusCode).toBe(
      403,
    );
  });

  it("sends a dated draft, with its days, only to readers who see Personal details, and records that they saw them", async () => {
    const member = await person();
    const { id } = await drafted({ members: [member], from: "2025-02-03" });
    const reader = await test.signedIn("engineering-director");

    expect((await teamSeen(id, reader))?.draft?.days).toEqual({
      [member]: "2025-02-03",
    });
    expect(await accessRecords("personal-viewed", reader.id)).not.toEqual([]);
    expect((await teamSeen(id, planner))?.draft).toBeUndefined();
  });

  describe("a reader who sees feature teams with Personal details but not people", () => {
    it("sees members who have not started yet too, as Personal details allow", async () => {
      const starting = await person({ startDate: "2099-01-01" });
      const started = await person();
      const id = await liveTeam({ leadId: starting, members: [started] });

      expect(await teamSeen(id, chartOnly)).toMatchObject({
        leadId: starting,
        members: expect.arrayContaining([started, starting]) as string[],
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

  it("leaves out members and a lead who have not started for readers who do not see Personal details", async () => {
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

  it("shows the live members but not a lead who has not started when another is chosen, to readers who do not see Personal details", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const started = await person();
    const id = await liveTeam({ leadId: starting, members: [started] });
    await changed(id, { leadId: started });

    expect((await teamSeen(id, planner))?.draft?.live).toEqual({
      leadId: null,
    });
  });

  it("sends no draft when all it does is add someone who has not started, to readers who do not see Personal details", async () => {
    // Given a live team and a draft making someone who has not started its lead
    const starting = await person({ startDate: "2099-01-01" });
    const started = await person();
    const id = await liveTeam({ members: [started] });
    await changed(id, { leadId: starting });

    // Then those who do not see Personal details see nothing of it
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

  it("does not show why a draft of someone who has not started was rejected, to readers who do not see Personal details", async () => {
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

  it("leaves no draft when a member's change is taken back from today, whatever day it was given", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2024-01-01" });
    await changed(id, { remove: [member], from: "2025-03-03" });
    await changed(id, { add: [member] });

    expect((await teamSeen(id))?.draft).toBeUndefined();
  });

  it("shows why a dated draft was rejected only to readers who see its days", async () => {
    const member = await person();
    const id = await liveTeam();
    await changed(id, { add: [member], from: "2025-05-05" });
    await ok(await reject(id));

    expect((await teamSeen(id, editor))?.draft).toMatchObject({
      state: "rejected",
      reason: "Fictional reason",
    });
    expect((await teamSeen(id, planner))?.draft).toBeUndefined();
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

  it("is refused with someone who has not started to a proposer who does not see Personal details, as People hides them", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const response = await create(
      { name: unique("Fictional Feature Team"), members: [starting] },
      proposer,
    );
    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toBe("Choose members from People");

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

  it("is refused a member who has left, as such, from another day", async () => {
    const left = await person({ endDate: "2021-06-30" });
    const id = await liveTeam();

    const response = await change(id, { add: [left], from: "2026-08-03" });

    expect(response.statusCode).toBe(400);
    expect(refusal(response)).not.toMatch(/approved change/);
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

  it("answers someone who has left as no one to a proposer who does not see Personal details", async () => {
    const gone = await person();
    await endDated(gone, "2026-01-31");
    const id = await liveTeam();

    const response = await change(id, { add: [gone] }, proposer);

    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toBe("Choose members from People");
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
    expect(refusal(response)).toBe("Other dates need Personal access.");
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
    expect(refusal(response)).toBe(
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

  it("leaves a team with no lead from the day its lead leaves", async () => {
    const lead = await person();
    const member = await person();
    const id = await liveTeam({ leadId: lead, members: [member] });

    await changed(id, { remove: [lead], from: "2099-03-01" });
    await approved(id);

    expect(await leads(id)).toEqual([
      { leadId: lead, fromDate: today },
      { leadId: null, fromDate: "2099-03-01" },
    ]);
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
      expect(refusal(response)).toBe(
        "This team's lead last changed on 2099-03-01. Choose a later date.",
      );
    }
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
    expect(refusal(response)).toMatch(
      /has an approved change on .* before this date\. This date can change once it takes effect\.$/,
    );
  });

  it("is refused taking back a change the draft makes from another date", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2025-01-01" });
    await changed(id, { remove: [member], from: "2026-08-03" });

    const response = await change(id, { add: [member], from: "2026-08-10" });

    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toMatch(
      /already changes .* from another date\. Approve or discard that draft first\.$/,
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

  it("takes back a change the draft makes from the same date", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2025-01-01" });
    await changed(id, { remove: [member], from: "2026-08-03" });

    await changed(id, { add: [member], from: "2026-08-03" });

    expect((await teamSeen(id))?.draft).toBeUndefined();
  });

  it("is refused a lead from today who joins later", async () => {
    const joining = await person();
    const id = await liveTeam();
    await changed(id, { add: [joining], from: "2099-02-01" });

    const response = await change(id, { leadId: joining });

    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toBe(
      "Choose a day when the new lead is on this team",
    );
  });

  it("moves a drafted change of lead to the new day given for the same lead", async () => {
    const first = await person();
    const second = await person();
    const id = await liveTeam({ leadId: first, members: [second] });
    await changed(id, { leadId: second, from: "2099-03-01" });

    await changed(id, { leadId: second, from: "2099-05-01" });
    await approved(id);

    expect((await leads(id)).at(-1)).toEqual({
      leadId: second,
      fromDate: "2099-05-01",
    });
  });

  it("takes back a drafted change of lead whatever day is given", async () => {
    const first = await person();
    const second = await person();
    const id = await liveTeam({ leadId: first, members: [second] });
    await changed(id, { leadId: second, from: "2099-03-01" });

    await changed(id, { leadId: first, from: "2025-01-01" });

    expect((await teamSeen(id))?.draft).toBeUndefined();
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

  it("changes the lead from an earlier day given by someone who may change Personal details", async () => {
    const first = await person();
    const second = await person();
    const id = await liveTeam({
      leadId: first,
      members: [second],
      from: "2025-01-15",
    });

    await changed(id, { leadId: second, from: "2025-06-01" });
    await approved(id);

    expect(await leads(id)).toEqual([
      { leadId: first, fromDate: "2025-01-15" },
      { leadId: second, fromDate: "2025-06-01" },
    ]);
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

  it("keeps a change of lead's day when a later edit does not change the lead", async () => {
    const first = await person();
    const second = await person();
    const joining = await person();
    const id = await liveTeam({ leadId: first, members: [second] });

    await changed(id, { leadId: second, from: "2099-03-01" });
    await changed(id, { add: [joining], from: "2099-05-01" });
    await approved(id);

    expect(await leads(id)).toEqual([
      { leadId: first, fromDate: today },
      { leadId: second, fromDate: "2099-03-01" },
    ]);
    expect((await memberships(id)).at(-1)).toEqual({
      personId: joining,
      member: true,
      fromDate: "2099-05-01",
    });
  });

  it("keeps the day someone joins apart from the later day they become lead", async () => {
    const joining = await person();
    const id = await liveTeam();

    await changed(id, { add: [joining], from: "2099-02-01" });
    await changed(id, { leadId: joining, from: "2099-03-01" });
    await approved(id);

    expect(await memberships(id)).toEqual([
      { personId: joining, member: true, fromDate: "2099-02-01" },
    ]);
    expect(await leads(id)).toEqual([
      { leadId: joining, fromDate: "2099-03-01" },
    ]);
  });

  it("lets someone this draft adds from today lead from a later day", async () => {
    const joining = await person();
    const id = await liveTeam();

    await changed(id, { add: [joining] });
    await changed(id, { leadId: joining, from: "2099-03-01" });
    await approved(id);

    expect(await leads(id)).toEqual([
      { leadId: joining, fromDate: "2099-03-01" },
    ]);
  });

  it("is refused a lead from a day before they join", async () => {
    const joining = await person();
    const id = await liveTeam();
    await changed(id, { add: [joining], from: "2099-03-01" });

    const response = await change(id, {
      leadId: joining,
      from: "2099-02-01",
    });

    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toBe(
      "Choose a day when the new lead is on this team",
    );
  });

  it("is refused a lead from a day after their end date", async () => {
    const member = await person({ endDate: "2098-06-30" });
    const id = await liveTeam({ members: [member] });

    const response = await change(id, {
      leadId: member,
      from: "2099-01-01",
    });

    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toBe(
      "Someone can't join or leave a team after their end date",
    );
  });

  it("keeps a day for a change of lead only while the lead is changed", async () => {
    const first = await person();
    const second = await person();
    const id = await liveTeam({ leadId: first, members: [second] });

    await changed(id, { leadId: second, from: "2099-03-01" });
    await changed(id, { leadId: first });

    expect((await teamSeen(id))?.draft).toBeUndefined();
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

describe("changing the teams someone is on from a month", () => {
  const changeTeams = (personId: string, body: object, who = editor) =>
    send(who, "PATCH", `/api/feature-teams/members/${personId}`, body);

  async function teamsChanged(personId: string, body: object, who = editor) {
    return (
      await ok<{ changeSetId: string | null }>(
        await changeTeams(personId, body, who),
      )
    ).changeSetId;
  }

  // A fictional person with a known name.
  async function named(): Promise<{ id: string; name: string }> {
    const name = unique("Fictional Person");
    return { id: await person({ preferredName: name }), name };
  }

  async function namedTeam(body: object = {}) {
    const name = unique("Fictional Feature Team");
    return { id: await liveTeam({ name, ...body }), name };
  }

  it("drafts joining the teams added and leaving those removed, from the day given, undone together", async () => {
    // Given
    const member = await person();
    const leaving = await liveTeam({ members: [member], from: "2025-01-01" });
    const joining = await liveTeam();

    // When
    const changeSetId = await teamsChanged(member, {
      add: [joining],
      remove: [leaving],
      from: "2026-08-01",
    });

    // Then
    expect((await teamSeen(joining))?.draft?.days).toEqual({
      [member]: "2026-08-01",
    });
    expect((await teamSeen(leaving))?.draft?.days).toEqual({
      [member]: "2026-08-01",
    });
    await ok(await send(editor, "POST", `/api/undo/${String(changeSetId)}`));
    expect((await teamSeen(joining))?.draft).toBeUndefined();
    expect((await teamSeen(leaving))?.draft).toBeUndefined();
  });

  it("drafts a change from today when no day is given", async () => {
    const member = await person();
    const id = await liveTeam();

    await teamsChanged(member, { add: [id] });
    await approved(id);

    expect(await memberships(id)).toEqual([
      { personId: member, member: true, fromDate: today },
    ]);
  });

  it("moves a change the draft already makes to an earlier month", async () => {
    const joining = await person();
    const leaving = await person();
    const id = await liveTeam({ members: [leaving], from: "2025-01-01" });
    await changed(id, {
      add: [joining],
      remove: [leaving],
      from: "2026-10-01",
    });

    await teamsChanged(joining, { add: [id], from: "2026-08-01" });
    await teamsChanged(leaving, { remove: [id] });

    expect((await teamSeen(id))?.draft?.days).toEqual({
      [joining]: "2026-08-01",
    });
  });

  it("takes back a change the draft makes from the same month", async () => {
    const member = await person();
    const id = await liveTeam({ from: "2025-01-01" });
    await changed(id, { add: [member], from: "2026-08-01" });

    expect(
      await teamsChanged(member, { remove: [id], from: "2026-08-01" }),
    ).not.toBeNull();

    expect((await teamSeen(id))?.draft).toBeUndefined();
  });

  it("takes back a change the draft makes from today, in the current month", async () => {
    const member = await person();
    const id = await liveTeam();
    await changed(id, { add: [member] });

    await teamsChanged(member, { remove: [id] });

    expect((await teamSeen(id))?.draft).toBeUndefined();
  });

  it("is refused taking back a change the draft makes from another month", async () => {
    const { id: member, name } = await named();
    const team = await namedTeam({ from: "2025-01-01" });
    await changed(team.id, { add: [member], from: "2026-08-01" });

    const response = await changeTeams(member, {
      remove: [team.id],
      from: "2026-10-01",
    });

    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toBe(
      `The draft of ${team.name} already changes ${name} from another month. Approve or discard that draft first.`,
    );
  });

  it("is refused a month after an approved change still to come", async () => {
    const { id: member, name } = await named();
    const team = await namedTeam({ members: [member], from: "2025-01-01" });
    await changed(team.id, { remove: [member], from: "2026-09-01" });
    await approved(team.id);

    const response = await changeTeams(member, {
      add: [team.id],
      from: "2026-10-01",
    });

    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toBe(
      `${name} has an approved change on ${team.name} before this month. This month can change once it takes effect.`,
    );
  });

  it("is refused a month in or before an approved change", async () => {
    const { id: member, name } = await named();
    const team = await namedTeam({ from: "2025-01-01" });
    await changed(team.id, { add: [member], from: "2026-09-01" });
    await approved(team.id);

    const response = await changeTeams(member, {
      add: [team.id],
      from: "2026-09-01",
    });

    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toBe(
      `${name} has an approved change on ${team.name} in this month or later, so this month can't change here.`,
    );
  });

  it("changes a past month for a role that may change Personal details, and refuses one for a role that may not", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2025-01-01" });

    const response = await changeTeams(
      member,
      { remove: [id], from: "2026-03-01" },
      proposer,
    );
    await teamsChanged(member, { remove: [id], from: "2026-03-01" });

    expect(response.statusCode).toBe(403);
    expect((await teamSeen(id))?.draft?.days).toEqual({
      [member]: "2026-03-01",
    });
  });

  it("lets a proposer change a later month", async () => {
    const member = await person();
    const id = await liveTeam();

    await teamsChanged(
      member,
      { add: [id], from: "2026-08-01" },
      datedProposer,
    );

    expect((await teamSeen(id, datedProposer))?.members).toContain(member);
  });

  it("is refused for someone who is not a person, or has left", async () => {
    const id = await liveTeam();
    const gone = await person();
    await endDated(gone, "2026-01-31");

    const missing = await changeTeams(randomUUID(), { add: [id] });
    const left = await changeTeams(gone, { add: [id] });

    expect(missing.statusCode).toBe(404);
    expect(refusal(missing)).toBe("There is no such person");
    expect(left.statusCode).toBe(400);
    expect(refusal(left)).toBe(
      "Someone who has left can't join or leave a team",
    );
  });

  it("is refused for a team its draft removes", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2025-01-01" });
    await ok(await remove(id));

    const response = await changeTeams(member, { remove: [id] });

    expect(response.statusCode).toBe(409);
  });

  it.each([
    ["adds someone already on the team", true, { from: "2026-08-01" }],
    ["takes away someone not on it", false, { from: "2026-08-01" }],
    ["adds someone already on it from today", true, {}],
  ])("saves nothing when it %s", async (_, onTeam, day) => {
    const member = await person();
    const id = await liveTeam(onTeam ? { members: [member] } : {});

    expect(
      await teamsChanged(member, {
        ...(onTeam ? { add: [id] } : { remove: [id] }),
        ...day,
      }),
    ).toBeNull();
    expect((await teamSeen(id))?.draft).toBeUndefined();
  });

  it("saves nothing when it changes nothing", async () => {
    expect(await teamsChanged(await person(), {})).toBeNull();
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

    // Then those who see Personal details are told both names
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
      "This person last joined or left this team on 2025-01-01. Choose a later date.",
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
    const leaving = await person({ endDate: "2098-06-30" });
    const response = await create({
      name: unique("Fictional Feature Team"),
      members: [leaving],
      from: "2099-01-01",
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

  it("is refused to those who see feature teams without editing them", async () => {
    const id = await liveTeam();
    expect((await remove(id, planner)).statusCode).toBe(403);
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

    expect(await liveRow(id)).toMatchObject({ name });
    expect(await leads(id)).toEqual([{ leadId: lead, fromDate: today }]);
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
    expect(await leads(id)).toEqual([{ leadId: lead, fromDate: today }]);
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
    expect(refusal(response)).toBe(
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
    expect(refusal(response)).toBe(
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

describe("a team a feature names", () => {
  it("is not drafted to be removed again by undoing the discard of its removal", async () => {
    const team = await liveTeam();
    await ok(await remove(team));
    const { changeSetId } = await ok<{ changeSetId: string }>(
      await send(editor, "DELETE", `/api/feature-teams/${team}/draft`),
    );
    await test.connection.insert(features).values({
      name: unique("Fictional Feature"),
      featureTeamId: team,
      statusId: await builtInChoice(test.connection, "feature-statuses"),
    });
    const undone = await send(editor, "POST", `/api/undo/${changeSetId}`);
    expect(undone.statusCode).toBe(409);
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

  it("is made by a proposer for a change of members from a later month", async () => {
    const member = await person();
    const maker = datedProposer;
    const id = await liveTeam();
    const added = await changed(
      id,
      { add: [member], from: "2026-08-01" },
      maker,
    );

    await ok(await undo(added, maker));

    expect((await teamSeen(id))?.draft).toBeUndefined();
  });

  it("is made by a proposer for a change of lead from a later month", async () => {
    const member = await person();
    const maker = datedProposer;
    const id = await liveTeam({ members: [member] });
    const led = await changed(
      id,
      { leadId: member, from: "2026-08-01" },
      maker,
    );

    await ok(await undo(led, maker));

    expect((await teamSeen(id))?.draft).toBeUndefined();
  });

  // Any answer that turned on the day would say something of it to someone who may not see it.
  it.each(["2026-03-01", "2026-08-01", "2026-08-15"])(
    "is refused to a proposer who doesn't see the days, putting back any day, %s",
    async (day) => {
      const member = await person({ startDate: "2026-01-01" });
      const maker = await test.signedIn("feature-lead");
      const id = await liveTeam();
      await changed(id, { add: [member], from: day });
      const removed = await changed(id, { remove: [member] }, maker);

      expect((await undo(removed, maker)).statusCode).toBe(403);
    },
  );

  it("records the access history of people whose days it puts back", async () => {
    const member = await person();
    const id = await liveTeam();
    const dated = await changed(id, { add: [member], from: "2025-01-01" });
    const before = await accessRecords("personal-changed", editor.id, member);

    await ok(await undo(dated));

    expect(
      await accessRecords("personal-changed", editor.id, member),
    ).toHaveLength(before.length + 1);
  });

  it("is refused to its maker once they no longer edit feature teams", async () => {
    const maker = await test.signedIn("feature-lead");
    const { changeSetId } = await drafted({}, maker);
    await test.holdOnly(maker.id, ["people:view", "feature-teams:view"]);
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

  it("hides the days members joined from readers once those days move out of their sight", async () => {
    const holdsDays = async (changeSetId: string | null) =>
      (await recordOf(changeSetId, planner))?.fields.some(
        ({ field }) => field === "memberFrom",
      ) === true;
    // Given
    const member = await person();
    const id = await liveTeam();
    await moveTeamDates("general");
    let changeSetId: string | null;
    try {
      changeSetId = await changed(id, { add: [member], from: "2025-02-03" });
      expect(await holdsDays(changeSetId)).toBe(true);
    } finally {
      // When
      await moveTeamDates("personal");
    }
    // Then
    expect(await holdsDays(changeSetId)).toBe(false);
  });

  it("shows nothing of a draft adding someone who has not started to readers who do not see Personal details", async () => {
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

  it("drops only the lead field when members are also changed, to readers who do not see Personal details", async () => {
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

  it("hides a resubmission of a draft that only adds someone who has not started, whose rejection was recorded as Personal, and a change clearing it", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const id = await liveTeam();
    await changed(id, { add: [starting] });
    await ok(await reject(id));

    const resent = (await ok<{ changeSetId: string }>(await resubmit(id)))
      .changeSetId;

    expect(await recordOf(resent, planner)).toBeUndefined();
  });

  it("shows nothing of a change adding only someone not started, with the rejection it clears, to readers who do not see Personal details", async () => {
    // Given a rejected draft of someone everyone sees
    const member = await person();
    const starting = await person({ startDate: "2099-01-01" });
    const id = await liveTeam();
    await changed(id, { add: [member] });
    await ok(await reject(id));

    // When someone not started is added too, clearing the rejection
    const adding = await changed(id, { add: [starting] });

    // Then those who do not see Personal details see nothing of that change
    expect(await recordOf(adding, planner)).toBeUndefined();
    expect(await recordOf(adding, editor)).toBeDefined();
  });

  it("shows a reader who does not see people only approved changes", async () => {
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
  });

  it("names nobody who has not started to a reader who sees feature teams but not People", async () => {
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
    const reader = await test.signedIn(["plan:view"]);
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

  it("cannot be removed from People while planned to lead a team later", async () => {
    const member = await person();
    const planned = await person();
    const id = await liveTeam({ members: [member, planned] });
    await changed(id, { leadId: planned, from: "2099-03-01" });
    await approved(id);

    const response = await send(editor, "DELETE", `/api/people/${planned}`);

    expect(response.statusCode).toBe(409);
  });

  it("can be removed having led a team only in the past", async () => {
    const past = await person();
    const next = await person();
    const id = await liveTeam({
      leadId: past,
      members: [next],
      from: "2025-01-01",
    });
    await changed(id, { leadId: next, from: "2025-06-01" });
    await approved(id);

    await ok(await send(editor, "DELETE", `/api/people/${past}`));
    await ok(
      await send(approver, "POST", "/api/drafts/approval", { people: [past] }),
    );

    expect(await leads(id)).toEqual([
      { leadId: null, fromDate: "2025-01-01" },
      { leadId: next, fromDate: "2025-06-01" },
    ]);
  });
});

describe("teams on a chosen day", () => {
  const teamsOn = async (day: string, who = editor) =>
    (
      await ok<FeatureTeams>(
        await send(who, "GET", `/api/feature-teams?on=${day}`),
      )
    ).teams;

  const teamOn = async (id: string, day: string, who = editor) =>
    (await teamsOn(day, who)).find((team) => team.id === id);

  it("is refused, saying why, to readers who do not see Personal details", async () => {
    const response = await send(
      planner,
      "GET",
      "/api/feature-teams?on=2025-03-01",
    );
    expect(response.statusCode).toBe(403);
    expect(refusal(response)).toBe("Other dates need Personal access.");
  });

  it("is given to readers who see Personal details without seeing people", async () => {
    const reader = await test.signedIn(["feature-teams:view", "personal:view"]);
    const response = await send(
      reader,
      "GET",
      "/api/feature-teams?on=2025-03-01",
    );
    expect(response.statusCode).toBe(200);
  });

  it("shows the members and lead of that day, as approved", async () => {
    const lead = await person();
    const joinsLater = await person();
    const id = await liveTeam({ leadId: lead, from: "2025-01-15" });
    await changed(id, { add: [joinsLater], from: "2099-02-01" });
    await approved(id);

    const before = await teamOn(id, "2099-01-31");
    const after = await teamOn(id, "2099-02-01");

    expect(before).toMatchObject({ leadId: lead, members: [lead] });
    expect(after?.members).toEqual(sorted(lead, joinsLater));
  });

  it("lays a draft's changes over the team of that day, with that day's team as live", async () => {
    // Given a team with someone approved to join later, and a draft renaming it and adding someone
    const lead = await person();
    const joinsLater = await person();
    const newcomer = await person();
    const id = await liveTeam({ leadId: lead, from: "2025-01-15" });
    await changed(id, { add: [joinsLater], from: "2099-02-01" });
    await approved(id);
    const name = unique("Fictional Renamed Team");
    await changed(id, { name, add: [newcomer], from: "2099-03-01" });

    // When the team is read on a day after the approved change
    const team = await teamOn(id, "2099-02-01");

    // Then the draft's changes are laid over that day's team
    expect(team).toMatchObject({
      name,
      leadId: lead,
      members: sorted(lead, joinsLater, newcomer),
    });
    expect(team?.draft).toMatchObject({
      live: { members: sorted(lead, joinsLater) },
      days: { [newcomer]: "2099-03-01" },
    });
  });

  it("lays a draft's change of lead and removal of a member over the team of that day", async () => {
    const lead = await person();
    const member = await person();
    const leaving = await person();
    const id = await liveTeam({
      leadId: lead,
      members: [member, leaving],
      from: "2025-01-15",
    });
    await changed(id, {
      leadId: member,
      remove: [leaving],
      from: "2099-02-01",
    });

    expect(await teamOn(id, "2099-01-01")).toMatchObject({
      leadId: member,
      members: sorted(lead, member),
    });
  });

  it("lists a team with no members that day while it has a draft", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2099-02-01" });
    await changed(id, { name: unique("Fictional Renamed Team") });

    expect(await teamOn(id, "2099-01-31")).toMatchObject({ members: [] });
  });

  it("shows people as they are today on a later day to readers who do not see Confidential data", async () => {
    const current = await person();
    const starter = await person({ startDate: "2098-06-01" });
    const id = await liveTeam({ members: [current, starter] });
    const manager = await test.signedIn(personalReader);

    expect((await teamOn(id, "2099-01-01"))?.members).toEqual(
      [current, starter].sort(),
    );
    expect((await teamOn(id, "2099-01-01", manager))?.members).toEqual([
      current,
    ]);
  });

  it("keeps a draft dated from a later day from readers who do not see Personal details", async () => {
    const member = await person();
    const id = await liveTeam();
    await changed(id, { add: [member], from: "2099-03-01" });

    expect((await teamSeen(id))?.draft).toBeDefined();
    const seen = await teamSeen(id, planner);
    expect(seen?.draft).toBeUndefined();
    expect(seen?.members).not.toContain(member);
  });

  it("hides why a draft was rejected from readers who do not see Personal details, when it holds someone who has not started", async () => {
    const starter = await person({ startDate: "2098-01-01" });
    const id = await liveTeam({
      members: [await person()],
      from: "2025-01-15",
    });
    await changed(id, { add: [starter], name: unique("Fictional Renamed") });
    await ok(await reject(id));

    const seen = (await teamSeen(id, planner))?.draft;

    expect(seen?.state).toBe("rejected");
    expect(seen).not.toHaveProperty("reason");
  });

  it("shows no lead on a day when the draft takes that day's lead off the team", async () => {
    // Given a team approved to change its lead later, and a draft removing that later lead
    const first = await person();
    const later = await person();
    const id = await liveTeam({
      leadId: first,
      members: [later],
      from: "2025-01-15",
    });
    await changed(id, { leadId: later, from: "2099-03-01" });
    await approved(id);
    await changed(id, { remove: [later] });

    // Then the team has no lead on a day the later lead would have led it
    expect(await teamOn(id, "2099-04-01")).toMatchObject({
      leadId: null,
      members: [first],
    });
  });

  it("leaves out a change drafted for a team that is not live", async () => {
    const id = randomUUID();
    await test.connection.insert(drafts).values({
      recordType: "feature-team",
      recordId: id,
      action: "changed",
      fields: { name: unique("Fictional Lost Team") },
    });

    expect(await teamOn(id, "2099-01-31")).toBeUndefined();
    await test.connection.delete(drafts).where(eq(drafts.recordId, id));
  });

  it("lists a team only drafted to be added", async () => {
    const { id } = await drafted();

    expect((await teamOn(id, "2099-01-31"))?.draft?.action).toBe("created");
  });

  it("names the members of that day", async () => {
    const preferredName = unique("Fictional Named Member");
    const member = await person({ preferredName });
    const id = await liveTeam({ members: [member], from: "2025-01-15" });

    expect((await teamOn(id, "2025-02-01"))?.names).toEqual({
      [member]: preferredName,
    });
  });

  it("shows who led the team that day", async () => {
    const first = await person();
    const second = await person();
    const id = await liveTeam({
      leadId: first,
      members: [second],
      from: "2025-01-15",
    });
    await changed(id, { leadId: second, from: "2099-03-01" });
    await approved(id);

    expect((await teamOn(id, "2099-02-28"))?.leadId).toBe(first);
    expect((await teamOn(id, "2099-03-01"))?.leadId).toBe(second);
  });

  it("shows no lead on a day the lead is not a member", async () => {
    // Given someone planned to lead a team, then planned to leave it before that day
    const first = await person();
    const second = await person();
    const id = await liveTeam({
      leadId: first,
      members: [second],
      from: "2025-01-15",
    });
    await changed(id, { leadId: second, from: "2099-03-01" });
    await approved(id);
    await changed(id, { remove: [second], from: "2099-02-01" });
    await approved(id);

    // Then the team has no lead that day
    expect(await teamOn(id, "2099-03-01")).toMatchObject({
      leadId: null,
      members: [first],
    });
  });

  it("leaves out a team with no members that day", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2099-02-01" });

    expect(await teamOn(id, "2099-01-31")).toBeUndefined();
  });

  it("lists teams by name, ignoring letter case", async () => {
    const member = await person();
    const prefix = unique("Fictional Ordered");
    const later = await liveTeam({
      name: `${prefix} b`,
      members: [member],
      from: "2025-01-15",
    });
    const earlier = await liveTeam({
      name: `${prefix} A`,
      members: [member],
      from: "2025-01-15",
    });

    const ids = (await teamsOn("2025-02-01")).map(({ id }) => id);

    expect(ids.indexOf(earlier)).toBeLessThan(ids.indexOf(later));
  });

  it("is refused to those who do not see feature teams", async () => {
    const noChart = await test.signedIn(["plan:view"]);

    expect(
      (await send(noChart, "GET", "/api/feature-teams?on=2025-02-01"))
        .statusCode,
    ).toBe(403);
  });

  it("is refused a day that does not exist", async () => {
    expect(
      (await send(editor, "GET", "/api/feature-teams?on=2025-02-30"))
        .statusCode,
    ).toBe(400);
  });

  it("records a view of Personal details by a reader who sees them", async () => {
    const reader = await test.signedIn("engineering-director");

    await teamsOn("2025-02-11", reader);

    expect(await accessRecords("personal-viewed", reader.id)).toHaveLength(1);
  });
});

describe("feature teams month by month", () => {
  const monthsOf = async (from: string, to: string, who = editor) =>
    ok<TeamMonths>(
      await send(who, "GET", `/api/feature-teams/months?from=${from}&to=${to}`),
    );

  const rowOf = async (id: string, from: string, to: string, who = editor) =>
    (await monthsOf(from, to, who)).people.find((one) => one.id === id);

  it("sends each month's managers only to those who see Confidential data, since later lines are future reorganizations", async () => {
    const manager = await test.signedIn(personalReader);
    const read = await monthsOf("2026-05", "2026-07", manager);
    expect(read.people.length).toBeGreaterThan(0);
    expect(read.people.every((one) => one.managers === undefined)).toBe(true);
    expect(
      (await monthsOf("2026-05", "2026-07")).people.every(
        (one) => one.managers !== undefined,
      ),
    ).toBe(true);
  });

  it("is refused, saying why, to readers who do not see Personal details", async () => {
    const response = await send(
      planner,
      "GET",
      "/api/feature-teams/months?from=2025-01&to=2025-03",
    );
    expect(response.statusCode).toBe(403);
    expect(refusal(response)).toBe(
      "Feature assignments needs Personal access.",
    );
  });

  it("is given to readers who see Personal details without seeing people", async () => {
    const reader = await test.signedIn(["feature-teams:view", "personal:view"]);
    const response = await send(
      reader,
      "GET",
      "/api/feature-teams/months?from=2025-01&to=2025-03",
    );
    expect(response.statusCode).toBe(200);
  });

  it("lists the months asked for and the live teams, with their colours", async () => {
    const id = await liveTeam();
    const coloured = await send(
      editor,
      "PUT",
      `/api/feature-teams/${id}/colour`,
      { colour: "teal" },
    );
    expect(coloured.statusCode).toBe(204);

    const read = await monthsOf("2025-01", "2025-03");

    expect(read.months).toEqual(["2025-01", "2025-02", "2025-03"]);
    expect(read.teams.find((team) => team.id === id)).toEqual({
      id,
      name: (await liveRow(id))?.name,
      colour: "teal",
    });
  });

  it("reads each month as of its first day", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2025-01-15" });

    expect((await rowOf(member, "2025-01", "2025-03"))?.teams).toEqual({
      "2025-02": [id],
      "2025-03": [id],
    });
  });

  it("reads the current month as of today", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: today });
    const month = monthOf(today);
    const previous = monthOf(addMonths(`${month}-01`, -1));

    expect((await rowOf(member, previous, month))?.teams).toEqual({
      [month]: [id],
    });
  });

  it("shows planned changes in the months they reach", async () => {
    const member = await person();
    const id = await liveTeam();
    await changed(id, { add: [member], from: "2099-02-01" });
    await approved(id);

    expect((await rowOf(member, "2099-01", "2099-02"))?.teams).toEqual({
      "2099-02": [id],
    });
  });

  it("stops showing a team from the month after someone leaves it", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2025-01-15" });
    await changed(id, { remove: [member], from: "2025-02-20" });
    await approved(id);

    expect((await rowOf(member, "2025-02", "2025-03"))?.teams).toEqual({
      "2025-02": [id],
    });
  });

  it("gives every team someone is on in a month", async () => {
    const member = await person();
    const first = await liveTeam({ members: [member], from: "2025-01-15" });
    const second = await liveTeam({ members: [member], from: "2025-01-15" });

    const teams = (await rowOf(member, "2025-02", "2025-02"))?.teams;

    expect(teams?.["2025-02"]?.sort()).toEqual(sorted(first, second));
  });

  it("leaves out what a draft would change", async () => {
    const member = await person();
    const id = await liveTeam({ from: "2025-01-15" });
    await changed(id, { add: [member], from: "2025-01-15" });

    expect((await rowOf(member, "2025-02", "2025-02"))?.teams).toEqual({});
  });

  it("names each person's manager today, and none for someone without one", async () => {
    const preferredName = unique("Fictional Manager");
    const manager = await person({ preferredName, isManager: true });
    const report = await person({ managerId: manager });
    const top = await person();

    const read = await monthsOf("2025-01", "2025-01");
    const find = (id: string) => read.people.find((one) => one.id === id);

    expect(find(report)?.manager).toEqual({
      id: manager,
      name: preferredName,
    });
    expect(find(top)?.manager).toBeNull();
  });

  it("names the manager of someone who has not started", async () => {
    const manager = await person({ isManager: true });
    const newcomer = await person({
      startDate: "2099-01-15",
      managerId: manager,
    });

    expect((await rowOf(newcomer, "2099-01", "2099-01"))?.manager?.id).toBe(
      manager,
    );
  });

  describe("for readers who see Personal details", () => {
    it("lists the months outside someone's employment, and no teams then", async () => {
      const member = await person({ startDate: "2025-02-10" });
      const id = await liveTeam({ members: [member], from: "2025-02-15" });
      await endDated(member, "2025-03-20");

      const row = await rowOf(member, "2025-01", "2025-04");

      expect(row?.outside).toEqual(["2025-01", "2025-04"]);
      expect(row?.teams).toEqual({ "2025-03": [id] });
    });

    it("leaves out a month read before someone starts or after they leave", async () => {
      const member = await person();
      const id = await liveTeam({ members: [member], from: "2025-01-15" });
      await endDated(member, "2025-02-15");

      const row = await rowOf(member, "2025-02", "2025-03");

      expect(row?.teams).toEqual({ "2025-02": [id] });
    });

    it("has no months outside employment for someone with no start date", async () => {
      const undated = await person({ startDate: null });

      expect(
        (await rowOf(undated, "2025-01", "2025-02"))?.outside,
      ).toBeUndefined();
    });

    it("lists no one employed in none of the months", async () => {
      const gone = await person({ endDate: "2021-06-30" });

      expect(await rowOf(gone, "2025-01", "2025-02")).toBeUndefined();
    });

    it("names whom someone reported to each month", async () => {
      const first = await person({ isManager: true });
      const second = await person({ isManager: true });
      const report = await person({
        managerId: first,
        managerFrom: "2024-03-01",
      });
      await personChanged(report, {
        managerId: second,
        managerFrom: "2025-02-10",
      });

      const managers = (await rowOf(report, "2025-02", "2025-03"))?.managers;

      expect(managers?.["2025-02"]?.id).toBe(first);
      expect(managers?.["2025-03"]?.id).toBe(second);
    });

    it("records viewing them in the access history", async () => {
      const reader = await test.signedIn("workforce-administrator");

      await monthsOf("2025-01", "2025-01", reader);

      expect(await accessRecords("personal-viewed", reader.id)).toHaveLength(1);
    });
  });

  describe("as drafts would make them", () => {
    it("shows a draft's change from the month it reaches, naming its team and draft", async () => {
      const member = await person();
      const id = await liveTeam({ from: "2025-01-15" });
      await changed(id, { add: [member], from: "2025-02-15" });

      const read = await monthsOf("2025-02", "2025-03");
      const row = read.people.find((one) => one.id === member);

      expect(row?.teams).toEqual({});
      expect(row?.drafted).toEqual({ teams: { "2025-03": [id] }, by: [id] });
      expect(read.drafts).toContainEqual({
        teamId: id,
        action: "changed",
        state: "waiting",
      });
    });

    it("leaves drafts out for readers who do not see people", async () => {
      const member = await person();
      const id = await liveTeam({ from: "2025-01-15" });
      await changed(id, { add: [member], from: "2025-02-15" });

      const read = await monthsOf("2025-02", "2025-03", chartOnly);

      expect(
        read.people.find((one) => one.id === member)?.drafted,
      ).toBeUndefined();
      expect(read.drafts).toEqual([]);
    });

    it("shows someone leaving only in the months they would be gone", async () => {
      const member = await person();
      const id = await liveTeam({ members: [member], from: "2025-01-15" });
      await changed(id, { remove: [member], from: "2025-03-01" });

      const row = await rowOf(member, "2025-02", "2025-03");

      expect(row?.teams).toEqual({ "2025-02": [id], "2025-03": [id] });
      expect(row?.drafted?.teams).toEqual({ "2025-03": [] });
    });

    it("takes effect from today when the draft gives no day", async () => {
      const member = await person();
      const id = await liveTeam();
      await changed(id, { add: [member] });
      const month = monthOf(today);

      expect((await rowOf(member, month, month))?.drafted?.teams).toEqual({
        [month]: [id],
      });
    });

    it("lists a team drafted to be added by its name, with no colour", async () => {
      const member = await person();
      const name = unique("Fictional Drafted Team");
      const { id } = await drafted({
        name,
        members: [member],
        from: "2025-01-15",
      });

      const read = await monthsOf("2025-02", "2025-02");

      expect(read.teams).toContainEqual({ id, name, colour: null });
      expect(
        read.people.find((one) => one.id === member)?.drafted?.teams,
      ).toEqual({ "2025-02": [id] });
      expect(read.drafts).toContainEqual({
        teamId: id,
        action: "created",
        state: "waiting",
      });
    });

    it("takes a team drafted to be removed out of every month", async () => {
      const member = await person();
      const id = await liveTeam({ members: [member], from: "2025-01-15" });
      await ok(await remove(id));

      const read = await monthsOf("2025-02", "2025-03");

      expect(
        read.people.find((one) => one.id === member)?.drafted?.teams,
      ).toEqual({ "2025-02": [], "2025-03": [] });
      expect(read.drafts).toContainEqual({
        teamId: id,
        action: "deleted",
        state: "waiting",
      });
    });

    it("gives a rejected draft's state", async () => {
      const member = await person();
      const id = await liveTeam({ from: "2025-01-15" });
      await changed(id, { add: [member], from: "2025-02-15" });
      await ok(await reject(id));

      expect(
        (await monthsOf("2025-03", "2025-03")).drafts.find(
          ({ teamId }) => teamId === id,
        )?.state,
      ).toBe("rejected");
    });

    it("shows unpublished changes only to their maker, marked as theirs", async () => {
      const maker = await test.signedIn("workforce-administrator");
      const member = await person();
      const id = await liveTeam({ from: "2025-01-15" });
      await ok(
        await change(id, { add: [member], from: "2025-02-15" }, maker, {
          publish: false,
        }),
      );

      expect(
        (await monthsOf("2025-03", "2025-03", maker)).drafts.find(
          ({ teamId }) => teamId === id,
        ),
      ).toEqual({
        teamId: id,
        action: "changed",
        state: "waiting",
        unpublished: true,
      });
      expect(
        (await rowOf(member, "2025-03", "2025-03"))?.drafted,
      ).toBeUndefined();
      await ok(await send(maker, "POST", "/api/unpublished/discard"));
    });

    it("lets a draft's record win over an approved one on the same day", async () => {
      const member = await person();
      const id = await liveTeam({ members: [member], from: today });
      await changed(id, { remove: [member] });
      const month = monthOf(today);

      expect((await rowOf(member, month, month))?.drafted?.teams).toEqual({
        [month]: [],
      });
    });

    it("leaves out someone in a draft who has since left, as approving does", async () => {
      const member = await person();
      const id = await liveTeam({ from: "2025-01-10" });
      await changed(id, { add: [member], from: "2025-01-15" });
      await endDated(member, "2025-06-30");

      expect(
        (await rowOf(member, "2025-02", "2025-03"))?.drafted,
      ).toBeUndefined();
    });
  });

  it.each([
    ["the first month after the last", "from=2025-03&to=2025-01"],
    ["more months than a grid shows", "from=2020-01&to=2025-01"],
    ["a month that does not exist", "from=2025-13&to=2026-01"],
    ["a year too early for dates to work", "from=0050-01&to=0050-02"],
    ["a year too late for dates to work", "from=9999-11&to=9999-12"],
    ["no months", ""],
  ])("refuses %s", async (_, query) => {
    expect(
      (await send(editor, "GET", `/api/feature-teams/months?${query}`))
        .statusCode,
    ).toBe(400);
  });
});

describe("a team disbanding", () => {
  async function disbandedFrom(id: string, who = editor) {
    return (await teamSeen(id, who))?.disbandedFrom;
  }

  async function teamWhoseMemberLeaves(from: string) {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2025-01-15" });
    await changed(id, { remove: [member], from });
    await approved(id);
    return id;
  }

  it("has not happened to a team that has never had a member", async () => {
    expect(await disbandedFrom(await liveTeam())).toBeUndefined();
  });

  it("has not happened while someone stays on the team", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2025-01-15" });

    expect(await disbandedFrom(id)).toBeUndefined();
  });

  it("is from the next month when the last member leaves during a month", async () => {
    expect(await disbandedFrom(await teamWhoseMemberLeaves("2025-03-15"))).toBe(
      "2025-04",
    );
  });

  it("is from that month when the last member leaves on its first day", async () => {
    expect(await disbandedFrom(await teamWhoseMemberLeaves("2025-04-01"))).toBe(
      "2025-04",
    );
  });

  it("is shown ahead of time when the last member is planned to leave", async () => {
    expect(await disbandedFrom(await teamWhoseMemberLeaves("2099-03-15"))).toBe(
      "2099-04",
    );
  });

  it("is not shown once the days members leave move out of the reader's sight", async () => {
    // Given
    const id = await teamWhoseMemberLeaves("2025-03-15");
    const reader = await test.signedIn([
      "people:view",
      "feature-teams:view",
      "personal:view",
    ]);
    expect(await disbandedFrom(id, reader)).toBe("2025-04");
    // When
    await moveTeamDates("confidential");
    // Then
    try {
      expect(await disbandedFrom(id, reader)).toBeUndefined();
      expect(await disbandedFrom(id, approver)).toBe("2025-04");
    } finally {
      await moveTeamDates("personal");
    }
  });

  it("is on the teams of a chosen day too", async () => {
    const id = await teamWhoseMemberLeaves("2099-03-15");

    const team = (
      await ok<FeatureTeams>(
        await send(editor, "GET", "/api/feature-teams?on=2099-02-01"),
      )
    ).teams.find((one) => one.id === id);

    expect(team?.disbandedFrom).toBe("2099-04");
  });

  it("does not happen when another member stays on past the one who leaves", async () => {
    const leaving = await person();
    const staying = await person();
    const id = await liveTeam({
      members: [leaving, staying],
      from: "2025-01-15",
    });
    await changed(id, { remove: [leaving], from: "2025-03-15" });
    await approved(id);

    expect(await disbandedFrom(id)).toBeUndefined();
  });

  it("counts a member's end date, the day after being the first without them", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2025-01-15" });
    await endDated(member, "2025-03-31");

    expect(await disbandedFrom(id)).toBe("2025-04");
  });

  it("tells a reader who does not see Personal details nothing from a past end date", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2025-01-15" });
    await endDated(member, "2025-03-31");

    expect(await disbandedFrom(id, planner)).toBeUndefined();
  });

  it("is told only to readers who see Personal details", async () => {
    const id = await teamWhoseMemberLeaves("2025-03-15");

    expect(await disbandedFrom(id)).toBe("2025-04");
    expect(await disbandedFrom(id, planner)).toBeUndefined();
  });

  it("records a view of Personal details by a reader who sees when a team disbands", async () => {
    await teamWhoseMemberLeaves("2099-03-15");
    const reader = await test.signedIn("engineering-director");

    await teamsSeen(reader);

    expect(await accessRecords("personal-viewed", reader.id)).not.toEqual([]);
  });

  it("counts an end date still to come", async () => {
    const member = await person({ endDate: "2098-06-15" });
    const id = await liveTeam({ members: [member], from: "2025-01-15" });

    expect(await disbandedFrom(id)).toBe("2098-07");
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
