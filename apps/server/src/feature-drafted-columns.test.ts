// SPDX-License-Identifier: Apache-2.0

// Tests for features given values in columns only drafted to be added to Features, against a
// PostgreSQL server of their own: drafting them, approving the column with the feature for a role
// that approves features, rejecting them together, and refusing a column someone else holds.

import {
  drafts,
  features,
  fields,
  fieldValues,
  listItems,
  lists,
} from "@fathom/db";
import type { Choice, Feature, Field, ProjectPlan, Role } from "@fathom/shared";
import { startingRoles } from "@fathom/shared";
import { and, eq } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorOf, startTestApp, type TestApp, unique } from "./test-app.ts";

let test: TestApp;
let planner: { id: string; cookie: string };
let approver: { id: string; cookie: string };

beforeAll(async () => {
  test = await startTestApp();
  planner = await test.signedIn("product-manager");
  approver = await test.signedIn("project-manager");
});

afterAll(async () => {
  await test.close();
});

const fictionalScore = 12;

// A number column drafted to be added to Features by the Product Manager.
async function draftedColumn(): Promise<Field> {
  const response = await test.request(
    planner.cookie,
    "POST",
    "/api/features/columns",
    {
      name: unique("Fictional Score"),
      type: "number",
      visibility: "general",
    },
  );
  expect(response.statusCode, response.body).toBe(201);
  return response.json<{ field: Field }>().field;
}

const draftFeature = (body: object) =>
  test.request(planner.cookie, "POST", "/api/features", {
    records: [
      {
        name: unique("Fictional Feature"),
        ...body,
      },
    ],
  });

// A feature the Product Manager drafted, scored in the column given.
async function scoredFeature(column: Field): Promise<Feature> {
  const response = await draftFeature({
    numbers: { [column.id]: fictionalScore },
  });
  expect(response.statusCode, response.body).toBe(201);
  const { plan } = response.json<{ plan: ProjectPlan }>();
  return plan.features.find(
    (feature) => feature.numbers?.[column.id] === fictionalScore,
  ) as Feature;
}

async function scoredDrafts() {
  const column = await draftedColumn();
  const feature = await scoredFeature(column);
  return { column, feature };
}

const decide = (
  asking: "approval" | "rejection",
  body: object,
  cookie = approver.cookie,
) => test.request(cookie, "POST", `/api/drafts/${asking}`, body);

const featureRecords = (feature: Feature) => [
  { type: "feature", id: feature.id },
];

const isLive = async (table: PgTable & { id: PgColumn }, id: string) =>
  (await test.connection.select().from(table).where(eq(table.id, id))).length >
  0;

const draftState = async (recordType: string, recordId: string) =>
  (
    await test.connection
      .select({ state: drafts.state })
      .from(drafts)
      .where(
        and(eq(drafts.recordType, recordType), eq(drafts.recordId, recordId)),
      )
  ).at(0)?.state;

const choiceLabel = "Fictional Gold";

// A live column on Features whose live list has a live choice and a choice drafted to be added.
async function columnWithNewChoice(body: object = {}) {
  const listId = randomUUID();
  await test.connection.insert(lists).values({
    id: listId,
    name: unique("Fictional List"),
    visibility: "general",
  });
  const liveChoiceId = randomUUID();
  await test.connection.insert(listItems).values({
    id: liveChoiceId,
    listId,
    label: unique("Fictional Silver"),
    position: 0,
  });
  const columnResponse = await test.request(
    planner.cookie,
    "POST",
    "/api/features/columns",
    { name: unique("Fictional Tier"), listId, ...body },
  );
  const { field: column } = columnResponse.json<{ field: Field }>();
  expect((await decide("approval", { columns: [column.id] })).statusCode).toBe(
    200,
  );
  const configurer = await test.signedIn("workforce-administrator");
  const choiceResponse = await test.request(
    configurer.cookie,
    "POST",
    `/api/lists/${listId}/choices`,
    { choices: [{ label: choiceLabel }] },
  );
  expect(choiceResponse.statusCode, choiceResponse.body).toBe(201);
  const [choice] = choiceResponse.json<{ choices: Choice[] }>().choices;
  return { column, choiceId: String(choice?.id), liveChoiceId };
}

// A feature drafted with the choices given in a column.
async function featureGiven(column: Field, choiceIds: string[]) {
  const drafted = await draftFeature({ values: { [column.id]: choiceIds } });
  expect(drafted.statusCode, drafted.body).toBe(201);
  return drafted
    .json<{ plan: ProjectPlan }>()
    .plan.features.find(
      ({ values }) => values[column.id]?.at(0) === choiceIds.at(0),
    ) as Feature;
}

// A feature drafted with a choice drafted to be added to the live list of a live column on Features.
async function featureGivenNewChoice() {
  const { column, choiceId } = await columnWithNewChoice();
  return { choiceId, feature: await featureGiven(column, [choiceId]) };
}

describe("a feature given a value in a column drafted to be added", () => {
  it("is drafted by a Product Manager, holding the value before the column is approved", async () => {
    const { column, feature } = await scoredDrafts();
    expect(feature.numbers?.[column.id]).toBe(fictionalScore);
    expect(await isLive(fields, column.id)).toBe(false);
  });

  it("is approved with the column, holding the feature's value", async () => {
    // Given a feature scored in a column drafted to be added
    const { column, feature } = await scoredDrafts();

    // When a Project Manager approves the feature alone
    const approved = await decide("approval", {
      records: featureRecords(feature),
    });

    // Then the column is approved with it, holding the feature's value
    expect(approved.statusCode, approved.body).toBe(200);
    expect(await isLive(features, feature.id)).toBe(true);
    expect(await isLive(fields, column.id)).toBe(true);
    expect(await draftState("field", column.id)).toBeUndefined();
    expect(
      await test.connection
        .select({ number: fieldValues.number })
        .from(fieldValues)
        .where(eq(fieldValues.featureId, feature.id)),
    ).toEqual([{ number: fictionalScore }]);
  });

  it("approves a choice drafted to be added to a live list with the feature given it", async () => {
    // Given a feature given a choice drafted to be added
    const { choiceId, feature } = await featureGivenNewChoice();

    // When the feature is approved
    const approved = await decide("approval", {
      records: featureRecords(feature),
    });

    // Then the choice is approved with it
    expect(approved.statusCode, approved.body).toBe(200);
    expect(await isLive(listItems, choiceId)).toBe(true);
    expect(
      await test.connection
        .select({ choiceId: fieldValues.choiceId })
        .from(fieldValues)
        .where(eq(fieldValues.featureId, feature.id)),
    ).toEqual([{ choiceId }]);
  });

  it("refuses a column taking one choice approved with a feature given a live and a new choice", async () => {
    // Given a live column drafted to take one choice, and a feature given a live and a new choice
    const { column, choiceId, liveChoiceId } = await columnWithNewChoice({
      multiple: true,
    });
    const changed = await test.request(
      planner.cookie,
      "PUT",
      `/api/features/columns/${column.id}`,
      { name: column.name, listId: column.listId, multiple: false },
    );
    expect(changed.statusCode, changed.body).toBe(200);
    const feature = await featureGiven(column, [liveChoiceId, choiceId]);

    // When the feature and the column are approved together
    const response = await decide("approval", {
      records: featureRecords(feature),
      columns: [column.id],
    });

    // Then the column is refused, and nothing is approved
    expect(response.statusCode, response.body).toBe(409);
    expect(errorOf(response)).toContain("cannot take only one yet");
    expect(await isLive(features, feature.id)).toBe(false);
    expect(await isLive(listItems, choiceId)).toBe(false);
  });

  it("approves the column with the feature for an approver with Approve Features alone", async () => {
    const { column, feature } = await scoredDrafts();
    const featuresApprover = await test.signedIn([
      "features:approve",
      "features:view",
      "people:view",
    ]);

    const approved = await decide(
      "approval",
      { records: featureRecords(feature) },
      featuresApprover.cookie,
    );

    expect(approved.statusCode, approved.body).toBe(200);
    expect(await isLive(features, feature.id)).toBe(true);
    expect(await isLive(fields, column.id)).toBe(true);
  });

  it("refuses an approver with Approve Features alone, naming a new choice, and approves nothing", async () => {
    const { choiceId, feature } = await featureGivenNewChoice();
    const featuresApprover = await test.signedIn([
      "features:approve",
      "features:view",
    ]);

    const refused = await decide(
      "approval",
      { records: featureRecords(feature) },
      featuresApprover.cookie,
    );

    expect(refused.statusCode).toBe(403);
    expect(errorOf(refused)).toBe(
      `Approving this also approves the new choice ${choiceLabel}, which needs Approve Configuration.`,
    );
    expect(await isLive(features, feature.id)).toBe(false);
    expect(await isLive(listItems, choiceId)).toBe(false);
  });

  it("refuses an approver with Approve Configuration alone, and approves nothing", async () => {
    const { column, feature } = await scoredDrafts();
    const configurationApprover = await test.signedIn([
      "configuration:approve",
      "configuration:view",
      "features:view",
    ]);

    const refused = await decide(
      "approval",
      { records: featureRecords(feature), columns: [column.id] },
      configurationApprover.cookie,
    );

    expect(refused.statusCode).toBe(403);
    expect(errorOf(refused)).toBe(
      "This role can't approve drafts of features and releases",
    );
    expect(await isLive(features, feature.id)).toBe(false);
    expect(await isLive(fields, column.id)).toBe(false);
  });

  it("is rejected only together with the column it uses", async () => {
    const { column, feature } = await scoredDrafts();
    const reason = "Fictional reason: not this quarter";

    const alone = await decide("rejection", { columns: [column.id], reason });
    const together = await decide("rejection", {
      records: featureRecords(feature),
      columns: [column.id],
      reason,
    });

    expect(alone.statusCode).toBe(409);
    expect(errorOf(alone)).toContain("Reject them together");
    expect(together.statusCode, together.body).toBe(200);
    expect(await draftState("field", column.id)).toBe("rejected");
    expect(await draftState("feature", feature.id)).toBe("rejected");
  });

  it("keeps the column from being discarded while the feature's draft uses it", async () => {
    const { column } = await scoredDrafts();
    const discarded = await test.request(
      planner.cookie,
      "DELETE",
      `/api/features/columns/${column.id}/draft`,
    );
    expect(discarded.statusCode).toBe(409);
    expect(await draftState("field", column.id)).toBe("waiting");
  });

  it("goes with the column it uses among its maker's unpublished changes", async () => {
    // Given a column and a feature scored in it, both unpublished
    const unpublished = { publish: false };
    const column = (
      await test.request(
        planner.cookie,
        "POST",
        "/api/features/columns",
        {
          name: unique("Fictional Score"),
          type: "number",
          visibility: "general",
        },
        unpublished,
      )
    ).json<{ field: Field }>().field;
    const name = unique("Fictional Feature");
    const drafted = await test.request(
      planner.cookie,
      "POST",
      "/api/features",
      { records: [{ name, numbers: { [column.id]: fictionalScore } }] },
      unpublished,
    );
    expect(drafted.statusCode, drafted.body).toBe(201);
    const feature = drafted
      .json<{ plan: ProjectPlan }>()
      .plan.features.find((one) => one.name === name) as Feature;

    // When its maker reads their unpublished changes
    const { changes } = (
      await test.request(planner.cookie, "GET", "/api/unpublished")
    ).json<{ changes: { key: string; linked: string[] }[] }>();

    // Then the feature names the column as one it goes with
    expect(
      changes.find(({ key }) => key === `feature ${feature.id}`)?.linked,
    ).toContain(`field ${column.id}`);
    await test.request(planner.cookie, "POST", "/api/unpublished/discard");
  });

  it("refuses a value in a column drafted to be added that someone else is changing, unpublished", async () => {
    // Given a column drafted to be added that another editor is discarding, unpublished
    const column = await draftedColumn();
    const other = await test.signedIn("product-manager");
    const held = await test.request(
      other.cookie,
      "DELETE",
      `/api/features/columns/${column.id}/draft`,
      undefined,
      { publish: false },
    );
    expect(held.statusCode, held.body).toBe(200);

    // When the Product Manager scores a feature in it
    const refused = await draftFeature({
      numbers: { [column.id]: fictionalScore },
    });

    // Then the value is refused
    expect(refused.statusCode).toBe(409);
  });
});

// Who may approve a feature with a column drafted to be added that it is given a value in: a role
// that approves features, which approves their columns.
const mayApproveBoth: Readonly<Record<Role, boolean>> = {
  "team-member": false,
  "product-manager": true,
  "feature-lead": false,
  "project-manager": true,
  "engineering-manager": false,
  "engineering-director": true,
  "workforce-administrator": false,
  executive: false,
  administrator: false,
};

describe("each starting role approving a feature with the column it uses", () => {
  it.each(Object.keys(startingRoles) as Role[])("%s", async (role) => {
    const { column, feature } = await scoredDrafts();
    const decider = await test.signedIn(role);

    const response = await decide(
      "approval",
      { records: featureRecords(feature) },
      decider.cookie,
    );

    // eslint-disable-next-line security/detect-object-injection
    const allowed = mayApproveBoth[role];
    expect(response.statusCode, response.body).toBe(allowed ? 200 : 403);
    expect(await isLive(features, feature.id)).toBe(allowed);
    expect(await isLive(fields, column.id)).toBe(allowed);
  });
});
