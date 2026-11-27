// SPDX-License-Identifier: Apache-2.0

// Integration tests for the features routes against a PostgreSQL server: who may change features,
// their fields and feature teams, their drafts, and the change history.

import { listItems, lists, recordChanges } from "@fathom/db";
import {
  type BuiltInList,
  type ChangeHistory,
  type Meaning,
  noteLength,
  type PlanChoices,
} from "@fathom/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  customersNeedPlan,
  featureTeamNeedsTeamEditors,
} from "./data/feature-field-editors.ts";
import { builtInChoice, errorOf, missingRecord, unique } from "./test-app.ts";
import {
  test,
  planner,
  approver,
  viewer,
  featureLead,
  configurer,
  liveTeam,
  readPlan,
  statusMeaning,
  post,
  put,
  removal,
  featureRecords,
  approved,
  draftFeature,
  liveFeature,
  shown,
  type Saved,
  closeFeatureTests,
  startFeatureTests,
} from "./test-features.ts";

beforeAll(startFeatureTests);
afterAll(closeFeatureTests);

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
      { records: [{ name: unique("Fictional Customer") }] },
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
    expect(errorOf(response)).toBe("Another feature has that name");
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

  it("are offered by name, with their colour, to those who see the plan", async () => {
    const featureTeamId = await liveTeam("teal");
    const response = await test.request(
      viewer.cookie,
      "GET",
      "/api/projects/choices",
    );
    const offered = response
      .json<PlanChoices>()
      .featureTeams.find(({ id }) => id === featureTeamId);
    expect(Object.keys(offered ?? {}).sort()).toEqual([
      "colour",
      "id",
      "name",
      "retired",
    ]);
    expect([offered?.colour, offered?.retired]).toEqual(["teal", false]);
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
    expect(
      (await draftFeature({ featureTeamId }, featureLead.cookie)).featureTeamId,
    ).toBe(featureTeamId);
  });

  it("are given only by a role that edits feature teams, so a new feature with one is refused to the Product Manager", async () => {
    const name = unique("Fictional Feature");
    const response = await post({ name, featureTeamId: await liveTeam() });
    expect(response.statusCode).toBe(403);
    expect(errorOf(response)).toBe(featureTeamNeedsTeamEditors);
    expect((await readPlan()).features.map((one) => one.name)).not.toContain(
      name,
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

  it("refuse every row added at once when a later one's is drafted to be removed", async () => {
    const featureTeamId = await liveTeam();
    expect((await removeTeam(featureTeamId)).statusCode).toBe(200);
    const asked = [unique("Fictional Feature"), unique("Fictional Feature")];
    const response = await test.request(
      featureLead.cookie,
      "POST",
      "/api/features",
      {
        records: [
          { name: asked[0], featureTeamId: await liveTeam() },
          { name: asked[1], featureTeamId },
        ],
      },
    );
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "This feature team is drafted to be removed; choose another",
    );
    expect((await readPlan()).features.map(({ name }) => name)).not.toContain(
      asked[0],
    );
  });

  it("cannot be removed while a feature names them", async () => {
    const featureTeamId = await liveTeam();
    const feature = await draftFeature({ featureTeamId }, featureLead.cookie);
    const response = await removeTeam(featureTeamId);
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      `This feature team is named by the feature ${feature.name}; change that first`,
    );
  });

  it("are refused removal without naming the feature to a role that can't see features", async () => {
    const featureTeamId = await liveTeam();
    await draftFeature({ featureTeamId }, featureLead.cookie);
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
    await put(
      feature.id,
      { name: feature.name, featureTeamId },
      featureLead.cookie,
    );
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

describe("a feature's customers", () => {
  // A customer approved and live, to name on features.
  async function liveCustomer(): Promise<string> {
    const created = await test.request(
      planner.cookie,
      "POST",
      "/api/customers",
      { records: [{ name: unique("Fictional Customer") }] },
    );
    const { id } = created.json<Saved>().plan.customers.at(-1) as {
      id: string;
    };
    await test.request(approver.cookie, "POST", "/api/drafts/approval", {
      records: [{ type: "customer", id }],
    });
    return id;
  }

  it("are given only by a role that edits the plan, so a new feature with them is refused to the Feature Lead", async () => {
    const name = unique("Fictional Feature");
    const response = await post(
      { name, customerIds: [await liveCustomer()] },
      featureLead.cookie,
    );
    expect(response.statusCode).toBe(403);
    expect(errorOf(response)).toBe(customersNeedPlan);
    expect((await readPlan()).features.map((one) => one.name)).not.toContain(
      name,
    );
  });

  it("are changed only by a role that edits the plan, leaving the feature as it was", async () => {
    const [first, second] = [await liveCustomer(), await liveCustomer()];
    const feature = await liveFeature({ customerIds: [first, second] });

    const changed = await put(
      feature.id,
      { name: feature.name, customerIds: [first] },
      featureLead.cookie,
    );

    expect(changed.statusCode).toBe(403);
    expect(errorOf(changed)).toBe(customersNeedPlan);
    const after = await shown(feature.id);
    // A feature keeps its customers sorted, as any set of records picked.
    expect(after.customerIds).toEqual([first, second].sort());
    expect(after.draft).toBeUndefined();
  });

  it("are kept when the Feature Lead changes the rest of a feature", async () => {
    const [first, second] = [await liveCustomer(), await liveCustomer()];
    const feature = await liveFeature({ customerIds: [first, second] });

    const renamed = await put(
      feature.id,
      { name: unique("Fictional Renamed"), customerIds: [second, first] },
      featureLead.cookie,
    );

    expect(renamed.statusCode, renamed.body).toBe(200);
    expect((await shown(feature.id)).customerIds).toEqual(
      [first, second].sort(),
    );
  });

  it("are kept as a planner's draft gives them when the Feature Lead renames the feature", async () => {
    const feature = await liveFeature();
    const customer = await liveCustomer();
    await put(feature.id, { name: feature.name, customerIds: [customer] });

    const renamed = await put(
      feature.id,
      { name: unique("Fictional Renamed"), customerIds: [customer] },
      featureLead.cookie,
    );

    expect(renamed.statusCode, renamed.body).toBe(200);
    expect((await shown(feature.id)).customerIds).toEqual([customer]);
  });

  it("drafted by a planner are discarded only by a role that edits the plan", async () => {
    const feature = await liveFeature();
    const customer = await liveCustomer();
    await put(feature.id, { name: feature.name, customerIds: [customer] });
    // The Feature Lead changes the draft too, so may discard it but for its customers
    await put(
      feature.id,
      { name: unique("Fictional Renamed"), customerIds: [customer] },
      featureLead.cookie,
    );
    const discard = (cookie: string) =>
      test.request(
        cookie,
        "DELETE",
        `/api/records/feature/${feature.id}/draft`,
      );

    const refused = await discard(featureLead.cookie);
    expect(refused.statusCode).toBe(403);
    expect(errorOf(refused)).toBe(customersNeedPlan);
    expect((await shown(feature.id)).customerIds).toEqual([customer]);

    expect((await discard(planner.cookie)).statusCode).toBe(200);
    expect((await shown(feature.id)).customerIds).toEqual([]);
  });

  it("rejected are resubmitted only while their maker edits the plan", async () => {
    // Given a planner's change of a feature's customers, rejected
    const maker = await test.signedIn("product-manager");
    const feature = await liveFeature();
    const customer = await liveCustomer();
    await put(
      feature.id,
      { name: feature.name, customerIds: [customer] },
      maker.cookie,
    );
    await test.request(approver.cookie, "POST", "/api/drafts/rejection", {
      records: [{ type: "feature", id: feature.id }],
      reason: "Fictional reason",
    });
    const resubmit = () =>
      test.request(
        maker.cookie,
        "DELETE",
        `/api/records/feature/${feature.id}/draft/rejection`,
      );

    // When its maker edits features but no longer the plan, then once they do again
    await test.holdOnly(maker.id, ["plan:view", "features:edit"]);
    const refused = await resubmit();
    expect(refused.statusCode).toBe(403);
    expect(errorOf(refused)).toBe(customersNeedPlan);
    await test.holdOnly(maker.id, ["plan:edit", "features:edit"]);
    expect((await resubmit()).statusCode).toBe(200);
  });

  it("are changed by the Product Manager", async () => {
    const feature = await liveFeature();
    const customer = await liveCustomer();
    expect(
      (
        await put(feature.id, {
          name: feature.name,
          customerIds: [customer],
        })
      ).statusCode,
    ).toBe(200);
    expect((await shown(feature.id)).customerIds).toEqual([customer]);
  });
});
