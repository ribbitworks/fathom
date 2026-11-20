// SPDX-License-Identifier: Apache-2.0

// Integration tests for the features routes against a PostgreSQL server: who may change features,
// their fields, target cycles and feature teams, their drafts, and the change history.

import {
  cyclePatterns,
  featureTeams,
  listItems,
  lists,
  recordChanges,
  releaseStreams,
} from "@fathom/db";
import { noteLength } from "@fathom/shared";
import type {
  BuiltInList,
  ChangeHistory,
  Feature,
  Meaning,
  PlanChoices,
  ProjectPlan,
  ReleaseStream,
} from "@fathom/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  builtInChoice,
  errorOf,
  missingRecord,
  startTestApp,
  type TestApp,
  unique,
} from "./test-app.ts";

let test: TestApp;
let planner: { id: string; cookie: string };
let approver: { id: string; cookie: string };
let viewer: { id: string; cookie: string };
let featureLead: { id: string; cookie: string };
let configurer: { id: string; cookie: string };

beforeAll(async () => {
  test = await startTestApp();
  planner = await test.signedIn("product-manager");
  approver = await test.signedIn("project-manager");
  viewer = await test.signedIn("team-member");
  featureLead = await test.signedIn("feature-lead");
  configurer = await test.signedIn("workforce-administrator");
});

afterAll(async () => {
  await test.close();
});

type Saved = { plan: ProjectPlan; changeSetId: string | null };

const cycle = {
  first: "2027-01-01",
  second: "2027-04-01",
  third: "2027-07-01",
  fourth: "2027-10-01",
};

// A live schedule of quarters from the start of 2027, ending on the day given, if any.
async function liveStream(endsOn: string | null = null): Promise<string> {
  const id = randomUUID();
  await test.connection.insert(releaseStreams).values({
    id,
    name: unique("Fictional Stream"),
    endsOn,
  });
  await test.connection.insert(cyclePatterns).values({
    streamId: id,
    startsOn: cycle.first,
    length: 3,
    unit: "months",
    naming: "{YY}.{N}",
  });
  return id;
}

async function liveTeam(): Promise<string> {
  const id = randomUUID();
  await test.connection
    .insert(featureTeams)
    .values({ id, name: unique("Fictional Team") });
  return id;
}

async function readPlan(cookie = planner.cookie): Promise<ProjectPlan> {
  const response = await test.request(cookie, "GET", "/api/projects");
  expect(response.statusCode).toBe(200);
  return response.json<ProjectPlan>();
}

const statusMeaning = (meaning: Meaning) =>
  builtInChoice(test.connection, "feature-statuses", meaning);

const post = (body: object, cookie = planner.cookie) =>
  test.request(cookie, "POST", "/api/features", body);

const put = (id: string, body: object, cookie = planner.cookie) =>
  test.request(cookie, "PUT", `/api/features/${id}`, body);

const removal = (id: string) =>
  test.request(planner.cookie, "DELETE", `/api/features/${id}`);

const decide = (asking: "approval" | "rejection", body: object) =>
  test.request(approver.cookie, "POST", `/api/drafts/${asking}`, body);

const featureRecords = (...ids: string[]) =>
  ids.map((id) => ({ type: "feature", id }));

async function approved(...ids: string[]): Promise<void> {
  const response = await decide("approval", {
    records: featureRecords(...ids),
  });
  expect(response.statusCode).toBe(200);
}

const featureNamed = (features: readonly Feature[], name: string): Feature =>
  features.find((feature) => feature.name === name) as Feature;

async function draftFeature(
  body: Record<string, unknown> = {},
): Promise<Feature> {
  const name =
    typeof body.name === "string" ? body.name : unique("Fictional Feature");
  const response = await post({ ...body, name });
  expect(response.statusCode).toBe(201);
  return featureNamed(response.json<Saved>().plan.features, name);
}

async function liveFeature(
  body: Record<string, unknown> = {},
): Promise<Feature> {
  const feature = await draftFeature(body);
  await approved(feature.id);
  return shown(feature.id);
}

const shown = async (id: string): Promise<Feature> =>
  (await readPlan()).features.find((feature) => feature.id === id) as Feature;

const target = (streamId: string, day = cycle.third) => ({
  target: { streamId, cycle: day },
});

describe("reading", () => {
  it("tells those who see the plan they may not change features", async () => {
    const plan = await readPlan(viewer.cookie);
    expect(plan.canEditFeatures).toBe(false);
    expect(plan.canEdit).toBe(false);
  });

  it("tells a role that edits features but not the plan which it may change", async () => {
    const plan = await readPlan(featureLead.cookie);
    expect(plan.canEditFeatures).toBe(true);
    expect(plan.canEdit).toBe(false);
  });

  it("answers a change with what the editor may change", async () => {
    const response = await post(
      { name: unique("Fictional Feature") },
      featureLead.cookie,
    );
    const { plan } = response.json<Saved>();
    expect(plan.canEditFeatures).toBe(true);
    expect(plan.canEdit).toBe(false);
  });

  it("lists live features by name, then those drafted to be added", async () => {
    const later = await liveFeature({ name: "Fictional Zebra" });
    const earlier = await liveFeature({ name: "Fictional Aardvark" });
    const drafted = await draftFeature({ name: "Fictional Middle" });
    const ids = (await readPlan()).features.map(({ id }) => id);
    expect(ids.indexOf(earlier.id)).toBeLessThan(ids.indexOf(later.id));
    expect(ids.indexOf(later.id)).toBeLessThan(ids.indexOf(drafted.id));
  });
});

describe("adding and changing", () => {
  it("starts a feature in the first status meaning Possible, in Later, with nothing else filled in", async () => {
    expect(await draftFeature()).toMatchObject({
      statusId: await statusMeaning("possible"),
      priorityId: null,
      sizeId: null,
      riskId: null,
      neededBy: null,
      customerIds: [],
      targetStreamId: null,
      targetCycle: null,
      estimateHours: null,
      featureTeamId: null,
      description: null,
      note: null,
    });
  });

  it("keeps the month a feature is needed by", async () => {
    expect((await draftFeature({ neededBy: "2027-03" })).neededBy).toBe(
      "2027-03",
    );
  });

  it("refuses a month that does not exist", async () => {
    const response = await post({
      name: unique("Fictional Feature"),
      neededBy: "2027-13",
    });
    expect(response.statusCode).toBe(400);
  });

  it("keeps a feature's customers, approved with it", async () => {
    const created = await test.request(
      planner.cookie,
      "POST",
      "/api/customers",
      { name: unique("Fictional Customer") },
    );
    const customer = created.json<Saved>().plan.customers.at(-1);
    const { id: customerId } = customer as { id: string };
    const response = await test.request(
      approver.cookie,
      "POST",
      "/api/drafts/approval",
      {
        records: [{ type: "customer", id: customerId }],
      },
    );
    expect(response.statusCode).toBe(200);
    const feature = await liveFeature({ customerIds: [customerId] });
    expect(feature.customerIds).toEqual([customerId]);
  });

  it("refuses a customer that does not exist", async () => {
    const response = await post({
      name: unique("Fictional Feature"),
      customerIds: [missingRecord],
    });
    expect(response.statusCode).toBe(404);
  });

  it("keeps a feature's note as Markdown", async () => {
    expect((await draftFeature({ note: "**Fictional** note" })).note).toBe(
      "**Fictional** note",
    );
  });

  it("keeps an empty note as none", async () => {
    expect((await draftFeature({ note: "  " })).note).toBeNull();
  });

  it("refuses a note a note may not hold", async () => {
    const response = await post({
      name: unique("Fictional Feature"),
      note: "a".repeat(noteLength + 1),
    });
    expect(response.statusCode).toBe(400);
  });

  it("offers the feature statuses in their list's order, with their meanings", async () => {
    const response = await test.request(
      planner.cookie,
      "GET",
      "/api/projects/choices",
    );
    const { featureStatuses } = response.json<PlanChoices>();
    expect(
      featureStatuses
        .filter(({ retired }) => !retired)
        .map(({ meaning }) => meaning),
    ).toEqual(["possible", "planned", "in-progress", "done", "cancelled"]);
  });

  it("keeps a feature's status when a change does not name one", async () => {
    const planned = await statusMeaning("planned");
    const feature = await liveFeature({ statusId: planned });
    await put(feature.id, { name: feature.name });
    expect((await shown(feature.id)).statusId).toBe(planned);
  });

  it("moves a feature to any status", async () => {
    const possible = await statusMeaning("possible");
    const feature = await liveFeature({
      statusId: await statusMeaning("done"),
    });
    await put(feature.id, { name: feature.name, statusId: possible });
    expect((await shown(feature.id)).statusId).toBe(possible);
  });

  // A choice of its own in a built-in list, so retiring or removing it leaves the list's others be.
  async function addedChoice(
    key: BuiltInList,
    meaning: Meaning | null = null,
  ): Promise<{ id: string; listId: string }> {
    const [list] = await test.connection
      .select({ id: lists.id })
      .from(lists)
      .where(eq(lists.builtIn, key));
    const listId = String(list?.id);
    const [added] = await test.connection
      .insert(listItems)
      .values({
        listId,
        label: unique("Fictional Choice"),
        position: 100,
        meaning,
        retired: false,
      })
      .returning({ id: listItems.id });
    return { id: String(added?.id), listId };
  }

  const retiredStatus = async () =>
    (await addedChoice("feature-statuses", "possible")).id;

  const retire = (statusId: string) =>
    test.connection
      .update(listItems)
      .set({ retired: true })
      .where(eq(listItems.id, statusId));

  it("keeps a retired status a feature already has", async () => {
    const statusId = await retiredStatus();
    const feature = await liveFeature({ statusId });
    await retire(statusId);
    const response = await put(feature.id, { name: feature.name, statusId });
    expect(response.statusCode).toBe(200);
  });

  it("refuses a retired status a feature does not have", async () => {
    const statusId = await retiredStatus();
    await retire(statusId);
    const response = await post({
      name: unique("Fictional Feature"),
      statusId,
    });
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe("Choose a status that is offered");
  });

  it("refuses a status from another list", async () => {
    const response = await post({
      name: unique("Fictional Feature"),
      statusId: await builtInChoice(test.connection, "proposal-statuses"),
    });
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe("Choose a status from its list");
  });

  const offeredNames = (
    choices: readonly { name: string; retired: boolean }[],
  ) => choices.filter(({ retired }) => !retired).map(({ name }) => name);

  it("offers features' priorities, sizes and risks in their lists' order", async () => {
    const response = await test.request(
      planner.cookie,
      "GET",
      "/api/projects/choices",
    );
    const { priorities, sizes, risks } = response.json<PlanChoices>();
    expect(offeredNames(priorities)).toEqual([
      "Critical",
      "High",
      "Medium",
      "Low",
    ]);
    expect(offeredNames(sizes)).toEqual(["XS", "S", "M", "L", "XL"]);
    expect(offeredNames(risks)).toEqual(["Low", "Medium", "High"]);
  });

  it("offers each size with its weight", async () => {
    const response = await test.request(
      planner.cookie,
      "GET",
      "/api/projects/choices",
    );
    const { sizes } = response.json<PlanChoices>();
    expect(
      sizes
        .filter(({ retired }) => !retired)
        .map(({ name, weight }) => [name, weight]),
    ).toEqual([
      ["XS", 0.5],
      ["S", 1],
      ["M", 2],
      ["L", 3],
      ["XL", 4],
    ]);
  });

  it("keeps a feature's priority, size and risk, and clears them", async () => {
    const priorityId = await builtInChoice(
      test.connection,
      "feature-priorities",
    );
    const sizeId = await builtInChoice(test.connection, "feature-sizes");
    const riskId = await builtInChoice(test.connection, "feature-risks");
    const feature = await liveFeature({ priorityId, sizeId, riskId });
    expect(feature).toMatchObject({ priorityId, sizeId, riskId });
    await put(feature.id, {
      name: feature.name,
      priorityId: null,
      sizeId: null,
      riskId: null,
    });
    expect(await shown(feature.id)).toMatchObject({
      priorityId: null,
      sizeId: null,
      riskId: null,
    });
  });

  it("refuses a size from another list", async () => {
    const response = await post({
      name: unique("Fictional Feature"),
      sizeId: await builtInChoice(test.connection, "feature-risks"),
    });
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe("Choose a size from its list");
  });

  it("keeps a retired priority a feature already has", async () => {
    const { id: priorityId } = await addedChoice("feature-priorities");
    const feature = await liveFeature({ priorityId });
    await retire(priorityId);
    const response = await put(feature.id, { name: feature.name, priorityId });
    expect(response.statusCode).toBe(200);
  });

  it("refuses a retired priority a feature does not have", async () => {
    const { id: priorityId } = await addedChoice("feature-priorities");
    await retire(priorityId);
    const response = await post({
      name: unique("Fictional Feature"),
      priorityId,
    });
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe("Choose a priority that is offered");
  });

  it("keeps a size a feature's draft has from being removed", async () => {
    const size = await addedChoice("feature-sizes");
    await draftFeature({ sizeId: size.id });
    const editor = await test.signedIn("workforce-administrator");
    const response = await test.request(
      editor.cookie,
      "DELETE",
      `/api/lists/${size.listId}/choices/${size.id}`,
    );
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "This choice cannot be removed while it is in use; retire it instead",
    );
  });

  it("refuses a name another feature has, ignoring letter case", async () => {
    const feature = await liveFeature();
    const response = await post({ name: feature.name.toUpperCase() });
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe("There is already a feature with that name");
  });

  it("rounds an estimate to two decimal places", async () => {
    expect((await draftFeature({ estimateHours: 12.345 })).estimateHours).toBe(
      12.35,
    );
  });

  it.each([-1, 10_000_000_000])("refuses the estimate %d", async (hours) => {
    const response = await post({
      name: unique("Fictional Feature"),
      estimateHours: hours,
    });
    expect(response.statusCode).toBe(400);
  });

  it("makes no draft when saving a live estimate unchanged", async () => {
    const feature = await liveFeature({ estimateHours: 40.5 });
    const response = await put(feature.id, {
      name: feature.name,
      estimateHours: 40.5,
    });
    expect(response.json<Saved>().changeSetId).toBeNull();
    expect((await shown(feature.id)).draft).toBeUndefined();
  });

  it("keeps a description without the spaces around it", async () => {
    expect(
      (await draftFeature({ description: "  Fictional words " })).description,
    ).toBe("Fictional words");
  });

  it("holds no empty description", async () => {
    expect((await draftFeature({ description: "   " })).description).toBeNull();
  });

  it("refuses changing a feature that does not exist", async () => {
    const response = await put(missingRecord, { name: "Fictional" });
    expect(response.statusCode).toBe(404);
  });
});

describe("target cycles", () => {
  it("targets one of its stream's cycles", async () => {
    const streamId = await liveStream();
    expect(await draftFeature(target(streamId))).toMatchObject({
      targetStreamId: streamId,
      targetCycle: cycle.third,
    });
  });

  it("refuses a day that starts none of the schedule's cycles", async () => {
    const response = await post({
      name: unique("Fictional Feature"),
      ...target(await liveStream(), "2027-02-01"),
    });
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe("Choose a cycle of the feature's schedule");
  });

  it("refuses a stream that does not exist", async () => {
    const response = await post({
      name: unique("Fictional Feature"),
      ...target(missingRecord),
    });
    expect(response.statusCode).toBe(404);
  });

  it("shows the live stream and cycle together when only the cycle changes", async () => {
    const streamId = await liveStream();
    const feature = await liveFeature(target(streamId));
    await put(feature.id, {
      name: feature.name,
      ...target(streamId, cycle.fourth),
    });
    expect((await shown(feature.id)).draft).toMatchObject({
      changed: ["targetStreamId", "targetCycle"],
      live: { targetStreamId: streamId, targetCycle: cycle.third },
    });
    const { draft } = await shown(feature.id);
    expect(draft?.changedBy?.targetStreamId).toBe(
      draft?.changedBy?.targetCycle,
    );
    expect(draft?.changedBy?.targetStreamId).not.toBeNull();
  });

  it("goes back to Later when its target is cleared", async () => {
    const feature = await liveFeature(target(await liveStream()));
    await put(feature.id, { name: feature.name, target: null });
    expect(await shown(feature.id)).toMatchObject({
      targetStreamId: null,
      targetCycle: null,
    });
  });
});

describe("feature teams", () => {
  const removeTeam = (
    id: string,
    options?: { publish?: boolean },
    cookie = configurer.cookie,
  ) =>
    test.request(
      cookie,
      "DELETE",
      `/api/feature-teams/${id}`,
      undefined,
      options,
    );

  it("are offered by name to those who see the plan", async () => {
    const featureTeamId = await liveTeam();
    const response = await test.request(
      viewer.cookie,
      "GET",
      "/api/projects/choices",
    );
    const offered = response
      .json<PlanChoices>()
      .featureTeams.find(({ id }) => id === featureTeamId);
    expect(Object.keys(offered ?? {}).sort()).toEqual([
      "id",
      "name",
      "retired",
    ]);
    expect(offered?.retired).toBe(false);
  });

  it("are not offered once drafted to be removed", async () => {
    const featureTeamId = await liveTeam();
    await removeTeam(featureTeamId);
    const response = await test.request(
      viewer.cookie,
      "GET",
      "/api/projects/choices",
    );
    expect(
      response
        .json<PlanChoices>()
        .featureTeams.find(({ id }) => id === featureTeamId)?.retired,
    ).toBe(true);
  });

  it("offer only live teams, never one only drafted to be added", async () => {
    const name = unique("Fictional Drafted Team");
    await test.request(configurer.cookie, "POST", "/api/feature-teams", {
      name,
      members: [],
    });
    const response = await test.request(
      viewer.cookie,
      "GET",
      "/api/projects/choices",
    );
    expect(
      response.json<PlanChoices>().featureTeams.map((team) => team.name),
    ).not.toContain(name);
  });

  it("are given to a feature", async () => {
    const featureTeamId = await liveTeam();
    expect((await draftFeature({ featureTeamId })).featureTeamId).toBe(
      featureTeamId,
    );
  });

  it("refuse one that is not live", async () => {
    const response = await post({
      name: unique("Fictional Feature"),
      featureTeamId: missingRecord,
    });
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe(
      "Choose a feature team that has been approved",
    );
  });

  it.each([
    ["published", true],
    ["not yet published", false],
  ])("refuse one with a removal %s", async (_kind, publish) => {
    const featureTeamId = await liveTeam();
    expect((await removeTeam(featureTeamId, { publish })).statusCode).toBe(200);
    const response = await post({
      name: unique("Fictional Feature"),
      featureTeamId,
    });
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "This feature team is drafted to be removed; choose another",
    );
  });

  it("cannot be removed while a feature names them", async () => {
    const featureTeamId = await liveTeam();
    const feature = await draftFeature({ featureTeamId });
    const response = await removeTeam(featureTeamId);
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      `This feature team is named by the feature ${feature.name}; change that first`,
    );
  });

  it("are refused removal without naming the feature to a role that can't see features", async () => {
    const featureTeamId = await liveTeam();
    await draftFeature({ featureTeamId });
    const editor = await test.signedIn(["people:view", "feature-teams:edit"]);
    const response = await removeTeam(featureTeamId, undefined, editor.cookie);
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "This feature team is named by a feature; change that first",
    );
  });
});

describe("drafts", () => {
  it("reach the live features only once approved", async () => {
    const feature = await liveFeature({ estimateHours: 8 });
    const renamed = unique("Fictional Feature");
    await put(feature.id, { name: renamed, estimateHours: 16 });
    expect(await shown(feature.id)).toMatchObject({
      name: renamed,
      estimateHours: 16,
      draft: { action: "changed", live: { estimateHours: 8 } },
    });
    await approved(feature.id);
    const after = await shown(feature.id);
    expect(after.estimateHours).toBe(16);
    expect(after.draft).toBeUndefined();
  });

  it("need Approve Features and releases", async () => {
    const feature = await draftFeature();
    const response = await test.request(
      featureLead.cookie,
      "POST",
      "/api/drafts/approval",
      { records: featureRecords(feature.id) },
    );
    expect(response.statusCode).toBe(403);
  });

  it("remove a feature once approved", async () => {
    const feature = await liveFeature();
    expect((await removal(feature.id)).statusCode).toBe(200);
    expect((await shown(feature.id)).draft?.action).toBe("deleted");
    await approved(feature.id);
    expect(await shown(feature.id)).toBeUndefined();
  });

  it("removing one only drafted to be added discards its draft", async () => {
    const feature = await draftFeature();
    await removal(feature.id);
    expect(await shown(feature.id)).toBeUndefined();
  });

  it("are named in the change history, with the team they pick", async () => {
    const featureTeamId = await liveTeam();
    const teamName = unique("Fictional Named Team");
    await recordChanges(test.connection, null, [
      {
        recordType: "feature-team",
        recordId: featureTeamId,
        action: "created",
        field: "name",
        tier: "general",
        oldValue: null,
        newValue: teamName,
      },
    ]);
    const feature = await liveFeature();
    await put(feature.id, { name: feature.name, featureTeamId });
    const response = await test.request(planner.cookie, "GET", "/api/changes");
    const fields = response
      .json<ChangeHistory>()
      .entries.flatMap((entry) => entry.records)
      .filter(({ name }) => name === feature.name)
      .flatMap((record) => record.fields);
    expect(fields).toContainEqual({
      field: "featureTeamId",
      oldValue: null,
      newValue: teamName,
    });
  });
});

describe("when a stream's cycles change", () => {
  const changeLength = (streamId: string, startsOn: string, length: number) =>
    test.request(
      configurer.cookie,
      "PUT",
      `/api/release-streams/${streamId}/cycles/${startsOn}/length`,
      { length, later: "move" },
    );

  const patternDrafts = async (streamId: string) =>
    (
      (await test.request(configurer.cookie, "GET", "/api/release-streams"))
        .json<{ streams: ReleaseStream[] }>()
        .streams.find(({ id }) => id === streamId) as ReleaseStream
    ).patterns.flatMap(({ id, draft }) =>
      draft === undefined ? [] : [{ type: "cycle-pattern", id }],
    );

  it("moves features on the cycles that move, in the same drafts", async () => {
    const streamId = await liveStream();
    const feature = await liveFeature(target(streamId));
    expect((await changeLength(streamId, cycle.second, 2)).statusCode).toBe(
      200,
    );
    expect((await shown(feature.id)).targetCycle).toBe("2027-06-01");
    expect((await shown(feature.id)).draft?.uses).toEqual(
      await patternDrafts(streamId),
    );
  });

  it("approves the moved features with the cycles' drafts", async () => {
    const streamId = await liveStream();
    const feature = await liveFeature(target(streamId));
    await changeLength(streamId, cycle.second, 2);
    const response = await decide("approval", {
      records: await patternDrafts(streamId),
    });
    expect(response.statusCode).toBe(200);
    const after = await shown(feature.id);
    expect(after.targetCycle).toBe("2027-06-01");
    expect(after.draft).toBeUndefined();
  });

  it("refuses rejecting a moved feature's cycles without the feature", async () => {
    const streamId = await liveStream();
    await liveFeature(target(streamId));
    await changeLength(streamId, cycle.second, 2);
    const response = await decide("rejection", {
      records: await patternDrafts(streamId),
      reason: "Fictional reason",
    });
    expect(response.statusCode).toBe(409);
  });

  it("refuses a change that would push a feature past the day its schedule ends", async () => {
    const streamId = await liveStream("2027-10-15");
    const feature = await liveFeature(target(streamId, cycle.fourth));
    const response = await changeLength(streamId, cycle.second, 6);
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toContain(`${feature.name} would move past`);
  });

  it("names no feature a new pattern would leave off a cycle to one who doesn't see features", async () => {
    const streamId = await liveStream();
    await liveFeature(target(streamId, cycle.third));
    const editor = await test.signedIn([
      "configuration:view",
      "configuration:edit",
    ]);

    const response = await test.request(
      editor.cookie,
      "POST",
      `/api/release-streams/${streamId}/patterns`,
      { startsOn: cycle.second, length: 2, unit: "months", naming: "{YY}.{N}" },
    );

    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "Work planned on these cycles would no longer fit the schedule's cycles",
    );
  });

  it("names no feature it moves among the unpublished changes of one who doesn't see features", async () => {
    const streamId = await liveStream();
    const feature = await liveFeature(target(streamId, cycle.third));
    const editor = await test.signedIn([
      "configuration:view",
      "configuration:edit",
    ]);
    await test.request(
      editor.cookie,
      "PUT",
      `/api/release-streams/${streamId}/cycles/${cycle.second}/length`,
      { length: 2, later: "move" },
      { publish: false },
    );

    const response = await test.request(
      editor.cookie,
      "GET",
      "/api/unpublished",
    );

    const subjects = response
      .json<{ changes: { subject: string }[] }>()
      .changes.map(({ subject }) => subject);
    expect(subjects).toContain("a feature");
    expect(subjects.join(" ")).not.toContain(feature.name);
  });

  const movedFeature = async () => {
    const streamId = await liveStream();
    const feature = await liveFeature(target(streamId));
    await changeLength(streamId, cycle.second, 2);
    return { streamId, feature };
  };

  const discardDraft = (id: string, cookie: string) =>
    test.request(cookie, "DELETE", `/api/records/feature/${id}/draft`);

  it("refuses discarding a moved feature to one who cannot change cycles", async () => {
    const { feature } = await movedFeature();
    const response = await discardDraft(feature.id, featureLead.cookie);
    expect(response.statusCode).toBe(403);
    expect((await shown(feature.id)).draft).toBeDefined();
  });

  it("discards a moved feature together with the cycles' drafts", async () => {
    const { streamId, feature } = await movedFeature();
    const editor = await test.signedIn("engineering-director");
    expect((await discardDraft(feature.id, editor.cookie)).statusCode).toBe(
      200,
    );
    expect((await shown(feature.id)).draft).toBeUndefined();
    expect(await patternDrafts(streamId)).toEqual([]);
  });

  it.each([
    ["Approve Plan", ["plan:approve", "plan:view", "features:view"]],
    [
      "Approve Configuration",
      ["configuration:approve", "configuration:view", "features:view"],
    ],
    ["Approve Features", ["features:approve", "features:view"]],
  ] as const)(
    "refuses approving a moved feature with %s alone, leaving it and the cycles drafts",
    async (_name, permissions) => {
      const { streamId, feature } = await movedFeature();
      const decider = await test.signedIn([...permissions]);
      const response = await test.request(
        decider.cookie,
        "POST",
        "/api/drafts/approval",
        { records: featureRecords(feature.id) },
      );
      expect(response.statusCode).toBe(403);
      expect((await shown(feature.id)).draft).toBeDefined();
      expect(await patternDrafts(streamId)).not.toEqual([]);
    },
  );
});

describe("a retired stream's cycles", () => {
  const retireStream = (streamId: string) =>
    test.connection
      .update(releaseStreams)
      .set({ retired: true })
      .where(eq(releaseStreams.id, streamId));

  it("refuses a feature onto a retired stream's cycle", async () => {
    const streamId = await liveStream();
    await retireStream(streamId);
    const [stream] = await test.connection
      .select()
      .from(releaseStreams)
      .where(eq(releaseStreams.id, streamId));
    const response = await post({
      name: unique("Fictional Feature"),
      ...target(streamId),
    });
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      `${String(stream?.name)} is retired, so its cycles take no new features`,
    );
  });
});
