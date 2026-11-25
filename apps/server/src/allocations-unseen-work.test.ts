// SPDX-License-Identifier: Apache-2.0

// Tests that allocations name the feature they put someone on only to a role that reads features,
// against a PostgreSQL server of their own: in the allocations read, the user's unpublished changes,
// the change history and an approval's refusal. Any other role is told only that it is a feature.

import { featureTeams, features, people } from "@fathom/db";
import type { ChangeHistory } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorOf, unique } from "./test-app.ts";
import {
  type Account,
  addFeature,
  addPerson,
  change,
  changed,
  closeAllocationTests,
  dayIn,
  decide,
  month,
  read,
  startAllocationTests,
  test,
} from "./test-allocations.ts";

beforeAll(startAllocationTests);
afterAll(closeAllocationTests);

const allocationReader = ["allocations:view", "personal:view"] as const;
const allocationEditor = [...allocationReader, "allocations:edit"] as const;

const featureName = async (featureId: string) => {
  const [feature] = await test.connection
    .select({ name: features.name })
    .from(features)
    .where(eq(features.id, featureId));
  return String(feature?.name);
};

const personName = async (personId: string) => {
  const [person] = await test.connection
    .select({ name: people.preferredName })
    .from(people)
    .where(eq(people.id, personId));
  return String(person?.name);
};

async function allocated(): Promise<{ personId: string; featureId: string }> {
  const personId = await addPerson();
  const featureId = await addFeature();
  await changed({ personId, featureId, percentage: 50, from: month(1) });
  return { personId, featureId };
}

const namedIn = async (who: Account, featureId: string) =>
  (await read(who)).features.find(({ id }) => id === featureId)?.name;

// The names the change history gives allocations, as a role reads it.
async function historyNames(who: Account): Promise<string[]> {
  const response = await test.request(who.cookie, "GET", "/api/changes");
  expect(response.statusCode).toBe(200);
  return response
    .json<ChangeHistory>()
    .entries.flatMap(({ records }) => records)
    .filter(({ kind }) => kind === "allocation")
    .flatMap(({ name }) => name ?? []);
}

describe("allocations to a feature a role can't read", () => {
  it("name the feature only to a role that reads features", async () => {
    const { featureId } = await allocated();
    const withFeatures = await test.signedIn([
      ...allocationReader,
      "features:view",
    ]);
    const withoutFeatures = await test.signedIn([...allocationReader]);

    expect(await namedIn(withFeatures, featureId)).toBe(
      await featureName(featureId),
    );
    expect(await namedIn(withoutFeatures, featureId)).toBe("A feature");
    const marked = async (who: Account) =>
      (await read(who)).features.find(({ id }) => id === featureId)?.unseen;
    expect(await marked(withFeatures)).toBeUndefined();
    expect(await marked(withoutFeatures)).toBe(true);
  });

  it("give a feature the role can't read no feature team's colour", async () => {
    const [team] = await test.connection
      .insert(featureTeams)
      .values({ name: unique("Fictional Team"), colour: "teal" })
      .returning({ id: featureTeams.id });
    const { featureId } = await allocated();
    await test.connection
      .update(features)
      .set({ featureTeamId: team?.id })
      .where(eq(features.id, featureId));
    const teamsWithoutFeatures = await test.signedIn([
      ...allocationReader,
      "feature-teams:view",
    ]);
    const feature = (await read(teamsWithoutFeatures)).features.find(
      ({ id }) => id === featureId,
    );
    expect(feature?.colour).toBeNull();
  });

  it("name the feature in the user's unpublished changes only to a role that reads features", async () => {
    const editor = await test.signedIn([...allocationEditor]);
    const personId = await addPerson();
    const featureId = await addFeature();
    const response = await change(
      { personId, featureId, percentage: 50, from: month(1) },
      editor,
      false,
    );
    expect(response.statusCode, response.body).toBe(200);

    const listed = await test.request(editor.cookie, "GET", "/api/unpublished");
    expect(
      listed
        .json<{ changes: { subject: string }[] }>()
        .changes.map(({ subject }) => subject),
    ).toEqual(["an allocation to a feature"]);
    await test.request(editor.cookie, "POST", "/api/unpublished/discard");
  });

  it("name the feature in the change history only to a role that reads features", async () => {
    const { personId, featureId } = await allocated();
    const withoutFeatures = await test.signedIn([...allocationReader]);
    const names = await historyNames(withoutFeatures);

    const person = await personName(personId);
    expect(names).toContain(`${person} on a feature`);
    expect(names).not.toContain(`${person} on ${await featureName(featureId)}`);
  });

  it("name the feature in a refused approval only to a role that reads features", async () => {
    const { personId, featureId } = await allocated();
    const id = String(
      (await read()).allocations.find(
        (one) => one.personId === personId && one.featureId === featureId,
      )?.id,
    );
    await test.connection
      .update(people)
      .set({ endDate: dayIn(0) })
      .where(eq(people.id, personId));
    const approver = await test.signedIn([
      ...allocationReader,
      "allocations:approve",
    ]);

    const refused = await decide(approver, "approval", [id]);
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toContain(
      `The draft of ${await personName(personId)} on a feature runs past`,
    );
  });
});
