// SPDX-License-Identifier: Apache-2.0

// Shared setup for the feature team integration tests: a test app with the users they act as, a
// fixed clock, and helpers that draft, approve and read teams through the routes.

import {
  accessHistory,
  featureTeamLeads,
  featureTeamMemberships,
  featureTeams,
} from "@fathom/db";
import {
  type FeatureTeam,
  type FeatureTeams,
  startingRoles,
} from "@fathom/shared";
import { and, asc, eq } from "drizzle-orm";
import { vi } from "vitest";
import { readToday } from "./data/settings.ts";
import {
  approvedPerson,
  generalApprover,
  generalReader,
  ok,
  sender,
  startTestApp,
  type TestApp,
  unique,
  type User,
} from "./test-app.ts";

// The server takes today's date from the clock, so the tests fix it, to give the same days on every
// run, however long the run takes.
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));

export let test: TestApp;
// A Workforce Administrator, who edits feature teams and people, and sees Personal details.
export let editor: User;
// An Engineering Director, who approves feature teams and sees Personal details.
export let approver: User;
// A Feature Lead, who edits feature teams but does not see Personal details.
export let proposer: User;
// A Feature Lead given Personal details, which choosing another day needs, but not changing them.
export let datedProposer: User;
// An Approver of feature teams who does not see Personal details.
export let approverWithoutPersonal: User;
// A reader who sees people and feature teams, but not Personal details.
export let planner: User;
// Sees feature teams and has Personal details, but does not see people.
export let chartOnly: User;
export let today: string;

export async function startFeatureTeamTests(): Promise<void> {
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
}

export async function closeFeatureTeamTests(): Promise<void> {
  await test.close();
  vi.useRealTimers();
}

export const send = sender(() => test);

export const approve = (id: string, who = approver) =>
  send(who, "POST", "/api/drafts/approval", { featureTeams: [id] });

export async function approved(id: string, who = approver) {
  await ok(await approve(id, who));
}

export const reject = (
  id: string,
  who = approver,
  reason = "Fictional reason",
) => send(who, "POST", "/api/drafts/rejection", { featureTeams: [id], reason });

// A fictional person, approved so they are live, started in 2020 unless told otherwise.
export const person = (details: object = {}) =>
  approvedPerson(
    test,
    editor.cookie,
    async (id) => {
      await ok(
        await send(approver, "POST", "/api/drafts/approval", { people: [id] }),
      );
    },
    details,
  );

// Changes someone's details, approved, such as giving them an end date so they have left once it
// passes.
export async function personChanged(
  id: string,
  details: object,
): Promise<void> {
  await ok(await send(editor, "PATCH", `/api/people/${id}`, details));
  await ok(
    await send(approver, "POST", "/api/drafts/approval", { people: [id] }),
  );
}

export const endDated = (id: string, endDate: string) =>
  personChanged(id, { endDate });

// Access history records of an action, for one person, by one user.
export const accessRecords = async (
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

export const create = (
  body: object,
  who = editor,
  options?: { publish?: boolean },
) => send(who, "POST", "/api/feature-teams", body, options);

// Drafts a team, named uniquely unless told otherwise, and returns its identifier and change set.
export async function drafted(
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
export async function liveTeam(body: object = {}): Promise<string> {
  const { id } = await drafted(body);
  await approved(id);
  return id;
}

export const change = (
  id: string,
  body: object,
  who = editor,
  options?: { publish?: boolean },
) => send(who, "PATCH", `/api/feature-teams/${id}`, body, options);

export async function changed(id: string, body: object, who = editor) {
  return (await ok<{ changeSetId: string | null }>(await change(id, body, who)))
    .changeSetId;
}

export const remove = (
  id: string,
  who = editor,
  options?: { publish?: boolean },
) => send(who, "DELETE", `/api/feature-teams/${id}`, undefined, options);

export const discard = (id: string, who = editor) =>
  send(who, "DELETE", `/api/feature-teams/${id}/draft`);

export const resubmit = (id: string, who = editor) =>
  send(who, "DELETE", `/api/feature-teams/${id}/draft/rejection`);

export async function teamsSeen(who = editor): Promise<FeatureTeam[]> {
  return (await ok<FeatureTeams>(await send(who, "GET", "/api/feature-teams")))
    .teams;
}

export async function teamSeen(
  id: string,
  who = editor,
): Promise<FeatureTeam | undefined> {
  return (await teamsSeen(who)).find((team) => team.id === id);
}

// Moves the days members join and leave to another class, as the Engineering Director may.
export async function moveTeamDates(dataClass: string): Promise<void> {
  await ok(
    await send(approver, "PUT", "/api/data-classes/featureTeamDates", {
      dataClass,
    }),
  );
}

export async function liveRow(id: string) {
  const [row] = await test.connection
    .select()
    .from(featureTeams)
    .where(eq(featureTeams.id, id));
  return row;
}

export const memberships = (id: string) =>
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

export const leads = (id: string) =>
  test.connection
    .select({
      leadId: featureTeamLeads.leadId,
      fromDate: featureTeamLeads.fromDate,
    })
    .from(featureTeamLeads)
    .where(eq(featureTeamLeads.teamId, id))
    .orderBy(asc(featureTeamLeads.fromDate));

export const sorted = (...ids: string[]) => [...ids].sort();
