// SPDX-License-Identifier: Apache-2.0

// Integration tests for deciding allocations, removing the features, people and planned hires they
// name, and the change history, against a PostgreSQL server of their own.

import { features, people, plannedHires } from "@fathom/db";
import { type ChangeHistory, monthInWords } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generalApprover, generalReader, errorOf } from "./test-app.ts";
import {
  test,
  type Account,
  allocator,
  manager,
  director,
  projectManager,
  month,
  dayIn,
  nameOfFeature,
  addPerson,
  hireNumber,
  addHire,
  addFeature,
  addActivity,
  activityAllocation,
  change,
  changed,
  read,
  allocationOf,
  decide,
  approved,
  liveAllocation,
  startAllocationTests,
  closeAllocationTests,
} from "./test-allocations.ts";

beforeAll(startAllocationTests);

afterAll(closeAllocationTests);

describe("approving", () => {
  it("needs Approve allocations, not Approve plan", async () => {
    const personId = await addPerson();
    const featureId = await addFeature();
    await changed({ personId, featureId, percentage: 50, from: month(0) });
    const id = String((await allocationOf({ personId }, featureId))?.id);
    const planApprover = await test.signedIn("product-manager");
    const response = await decide(planApprover, "approval", [id]);
    expect(response.statusCode).toBe(403);
    expect((await decide(projectManager, "approval", [id])).statusCode).toBe(
      200,
    );
  });

  it("refuses, to an Approver who sees Personal details, a draft past someone's end", async () => {
    const personId = await addPerson();
    const featureId = await addFeature();
    await changed({ personId, featureId, percentage: 50, from: month(0) });
    const id = String((await allocationOf({ personId }, featureId))?.id);
    await test.connection
      .update(people)
      .set({ endDate: dayIn(2) })
      .where(eq(people.id, personId));
    const name = (
      await test.connection
        .select({ name: people.preferredName })
        .from(people)
        .where(eq(people.id, personId))
    )[0]?.name;
    const refused = await decide(director, "approval", [id]);
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe(
      `The draft of ${String(name)} on ${await nameOfFeature(featureId)} runs past their last month, ${month(2)}. Reject the draft so it can be changed.`,
    );
  });

  it("names the activity in a refusal", async () => {
    // Given a draft of someone on an activity from this month, who starts in two months
    const personId = await addPerson();
    const { activityId } = await addActivity();
    await changed({ personId, activityId, percentage: 50, from: month(0) });
    const id = String((await allocationOf({ personId }, activityId))?.id);
    const [person] = await test.connection
      .update(people)
      .set({ startDate: dayIn(2) })
      .where(eq(people.id, personId))
      .returning({ name: people.preferredName });

    // When it is approved
    const refused = await decide(director, "approval", [id]);

    // Then the refusal names the activity as its subject does, its project as a project
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe(
      `The draft of ${String(person?.name)} on the activity Fictional Activity of a project starts before their first month, ${month(2)}. Reject the draft so it can be changed.`,
    );
  });

  it("refuses a person's draft starting before their first month", async () => {
    const personId = await addPerson();
    const featureId = await addFeature();
    await changed({ personId, featureId, percentage: 50, from: month(0) });
    const id = String((await allocationOf({ personId }, featureId))?.id);
    const [person] = await test.connection
      .update(people)
      .set({ startDate: dayIn(2) })
      .where(eq(people.id, personId))
      .returning({ name: people.preferredName });
    const refused = await decide(director, "approval", [id]);
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe(
      `The draft of ${String(person?.name)} on ${await nameOfFeature(featureId)} starts before their first month, ${month(2)}. Reject the draft so it can be changed.`,
    );
  });

  it("refuses a planned hire's draft starting before the month it is expected", async () => {
    const plannedHireId = await addHire({ targetDate: dayIn(1) });
    const featureId = await addFeature();
    await changed({ plannedHireId, featureId, percentage: 50, from: month(1) });
    const id = String((await allocationOf({ plannedHireId }, featureId))?.id);
    await test.connection
      .update(plannedHires)
      .set({ targetDate: dayIn(3) })
      .where(eq(plannedHires.id, plannedHireId));
    const refused = await decide(projectManager, "approval", [id]);
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe(
      `The draft of TBD-${String(hireNumber)} on ${await nameOfFeature(featureId)} starts before ${monthInWords(month(3))}, the month they're expected. Reject the draft so it can be changed.`,
    );
  });

  it("refuses a planned hire's draft once the hire is filled", async () => {
    const plannedHireId = await addHire();
    const featureId = await addFeature();
    await changed({ plannedHireId, featureId, percentage: 50, from: month(0) });
    const id = String((await allocationOf({ plannedHireId }, featureId))?.id);
    await test.connection
      .update(plannedHires)
      .set({ filledBy: await addPerson() })
      .where(eq(plannedHires.id, plannedHireId));
    const refused = await decide(projectManager, "approval", [id]);
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe("This planned hire can't be allocated yet");
  });

  it("refuses a draft that no longer exists", async () => {
    expect(
      (await decide(director, "approval", [randomUUID()])).statusCode,
    ).toBe(404);
  });

  it("refuses reading, changing and deciding allocations, saying why, to roles that do not see Personal details", async () => {
    const personId = await addPerson();
    const featureId = await addFeature();
    await changed({ personId, featureId, percentage: 50, from: month(0) });
    const id = String((await allocationOf({ personId }, featureId))?.id);
    const why = "Allocations needs Personal access.";
    const reader = await test.signedIn("team-member");
    const read = await test.request(reader.cookie, "GET", "/api/allocations");
    expect(read.statusCode).toBe(403);
    expect(errorOf(read)).toBe(why);
    const editor = await test.signedIn(generalReader);
    const edited = await change(
      { personId, featureId, percentage: 25, from: month(0) },
      editor,
    );
    expect(edited.statusCode).toBe(403);
    expect(errorOf(edited)).toBe(why);
    const approver = await test.signedIn(generalApprover);
    const decided = await decide(approver, "approval", [id]);
    expect(decided.statusCode).toBe(403);
    expect(errorOf(decided)).toBe(why);
  });

  it("rejects a draft, which keeps its months and says why", async () => {
    const personId = await addPerson();
    const featureId = await addFeature();
    await changed({ personId, featureId, percentage: 50, from: month(0) });
    const id = String((await allocationOf({ personId }, featureId))?.id);
    expect((await decide(director, "rejection", [id])).statusCode).toBe(200);
    expect((await allocationOf({ personId }, featureId))?.draft).toMatchObject({
      state: "rejected",
      reason: "Fictional reason",
    });
  });

  it("can be discarded by its editor", async () => {
    const personId = await addPerson();
    const featureId = await addFeature();
    await changed({ personId, featureId, percentage: 50, from: month(0) });
    const id = String((await allocationOf({ personId }, featureId))?.id);
    const response = await test.request(
      allocator.cookie,
      "DELETE",
      `/api/records/allocation/${id}/draft`,
    );
    expect(response.statusCode).toBe(200);
    expect(await allocationOf({ personId }, featureId)).toBeUndefined();
  });
});

describe("removing what allocations name", () => {
  it("refuses removing a feature with allocations, and says to cancel it", async () => {
    const { featureId } = await liveAllocation();
    const response = await test.request(
      director.cookie,
      "DELETE",
      `/api/features/${featureId}`,
    );
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toMatch(
      /^The feature Fictional Feature \d+ has allocations, so it can't be removed\. Allocations are time spent, so cancel the feature instead\.$/,
    );
  });

  it("leaves out how many allocations a feature has, since some can be of people not shown", async () => {
    const { featureId } = await liveAllocation();
    await changed(
      {
        personId: await addPerson({ startDate: dayIn(2) }),
        featureId,
        percentage: 25,
        from: month(2),
      },
      manager,
    );
    const response = await test.request(
      director.cookie,
      "DELETE",
      `/api/features/${featureId}`,
    );
    expect(errorOf(response)).toMatch(
      / has allocations, so it can't be removed\./,
    );
  });

  it("removes a person's allocations with them, recording it", async () => {
    const { personId, id } = await liveAllocation();
    await test.request(director.cookie, "DELETE", `/api/people/${personId}`);
    const response = await test.request(
      director.cookie,
      "POST",
      "/api/drafts/approval",
      { people: [personId] },
    );
    expect(response.statusCode, response.body).toBe(200);
    expect((await read()).allocations.some((one) => one.id === id)).toBe(false);
    expect(
      (await test.historyOf(id)).filter(({ action }) => action === "deleted"),
    ).not.toHaveLength(0);
  });

  it("records the activity when removing a person removes an allocation to one", async () => {
    const { personId, id, activityId } = await activityAllocation();
    await test.request(director.cookie, "DELETE", `/api/people/${personId}`);
    const response = await test.request(
      director.cookie,
      "POST",
      "/api/drafts/approval",
      { people: [personId] },
    );
    expect(response.statusCode, response.body).toBe(200);
    expect(
      (await test.historyOf(id)).find(
        ({ action, field }) => action === "deleted" && field === "activityId",
      )?.oldValue,
    ).toBe(activityId);
  });

  it("refuses removing a person while any of their allocations has a draft", async () => {
    const { personId, featureId } = await liveAllocation();
    await changed({ personId, featureId, percentage: 25, from: month(1) });
    await test.request(director.cookie, "DELETE", `/api/people/${personId}`);
    const response = await test.request(
      director.cookie,
      "POST",
      "/api/drafts/approval",
      { people: [personId] },
    );
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "Someone being removed has allocations with drafts. Approve, reject, or discard those drafts first.",
    );
  });

  it("removes a planned hire's allocations with it", async () => {
    const plannedHireId = await addHire();
    const featureId = await addFeature();
    await changed({ plannedHireId, featureId, percentage: 50, from: month(0) });
    const id = String((await allocationOf({ plannedHireId }, featureId))?.id);
    await approved(id);
    await test.request(
      director.cookie,
      "DELETE",
      `/api/planned-hires/${plannedHireId}`,
    );
    const response = await test.request(
      director.cookie,
      "POST",
      "/api/drafts/approval",
      { plannedHires: [plannedHireId] },
    );
    expect(response.statusCode, response.body).toBe(200);
    expect((await read()).allocations.some((one) => one.id === id)).toBe(false);
  });
});

describe("the change history", () => {
  async function allocationRecords(who: Account) {
    const response = await test.request(who.cookie, "GET", "/api/changes");
    expect(response.statusCode).toBe(200);
    return response
      .json<ChangeHistory>()
      .entries.flatMap(({ records }) => records)
      .filter(({ kind }) => kind === "allocation");
  }

  async function nameOf(personId: string): Promise<string> {
    const [person] = await test.connection
      .select({ name: people.preferredName })
      .from(people)
      .where(eq(people.id, personId));
    return String(person?.name);
  }

  it("names an allocation by who is on which feature, and gives its months in words", async () => {
    const { personId, featureId } = await liveAllocation({ from: 0, to: 1 });
    await changed({ personId, featureId, percentage: 25, from: month(2) });
    const [feature] = await test.connection
      .select({ name: features.name })
      .from(features)
      .where(eq(features.id, featureId));
    const name = `${await nameOf(personId)} on ${String(feature?.name)}`;
    const records = (await allocationRecords(director)).filter(
      (record) => record.name === name,
    );
    expect(records.map(({ action }) => action)).toContain("created");
    expect(
      records.find(({ action }) => action === "changed")?.fields,
    ).toContainEqual({
      field: "months",
      oldValue: [`50% from ${month(0)}`, `0% from ${month(2)}`],
      newValue: [`50% from ${month(0)}`, `25% from ${month(2)}`],
    });
  });

  it("keeps every allocation from readers who do not see Personal details, even of someone employed today", async () => {
    const personId = await addPerson();
    await changed(
      {
        personId,
        featureId: await addFeature(),
        percentage: 50,
        from: month(0),
        to: month(0),
      },
      manager,
    );
    const name = await nameOf(personId);
    const naming = (records: { name: string | null }[]) =>
      records.filter((record) => record.name?.startsWith(`${name} on `));
    expect(naming(await allocationRecords(director))).not.toHaveLength(0);
    const reader = await test.signedIn(generalReader);
    expect(naming(await allocationRecords(reader))).toHaveLength(0);
  });
});
