// SPDX-License-Identifier: Apache-2.0

// Tests for the conversions between units of effort through the API, against a migrated PostgreSQL
// server: everyone who sees the plan reads them, those who change configuration change them
// straight away, each change is recorded in the change history for everyone who sees the plan, and
// its maker can undo it.

import {
  type ChangeEntry,
  type ChangeHistory,
  type EffortConversions,
  roleSchema,
  type SavedEffortConversions,
  startingEffortConversions,
} from "@fathom/shared";
import { effortConversions } from "@fathom/db";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { actorFor, rolesGranting } from "./access.ts";
import { readEffortConversions } from "./data/effort.ts";
import { startTestApp, type TestApp } from "./test-app.ts";

const path = "/api/effort-conversions";
const shortDays: EffortConversions = {
  hoursPerDay: 7.5,
  daysPerWeek: 4,
  daysPerMonth: 17,
};

let test: TestApp;
let editor: { id: string; cookie: string };

beforeAll(async () => {
  test = await startTestApp();
  editor = await test.signedIn("workforce-administrator");
});

afterAll(async () => {
  await test.close();
});

afterEach(async () => {
  await test.connection
    .update(effortConversions)
    .set(startingEffortConversions);
});

const read = async (cookie: string) =>
  (await test.request(cookie, "GET", path)).json<EffortConversions>();

const change = (cookie: string, conversions: object) =>
  test.request(cookie, "PUT", path, conversions);

// Roles that see the change history and the plan, but neither people nor configuration, whose own
// changes the history shows by other rules.
const planHistoryReaders = rolesGranting("changes:view").filter(
  (role) =>
    rolesGranting("plan:view").includes(role) &&
    !rolesGranting("people:view").includes(role) &&
    !rolesGranting("configuration:view").includes(role),
);

const entryFor = async (cookie: string, changeSetId: string | null) =>
  (await test.request(cookie, "GET", "/api/changes"))
    .json<ChangeHistory>()
    .entries.find((entry: ChangeEntry) => entry.id === changeSetId);

describe("reading the conversions", () => {
  it.each(rolesGranting("plan:view"))(
    "gives %s the starting conversions",
    async (role) => {
      const { cookie } = await test.signedIn(role);
      expect(await read(cookie)).toEqual(startingEffortConversions);
    },
  );

  it.each(
    roleSchema.options.filter(
      (role) => !rolesGranting("plan:view").includes(role),
    ),
  )("refuses %s, who does not see the plan", async (role) => {
    const { cookie } = await test.signedIn(role);
    expect((await test.request(cookie, "GET", path)).statusCode).toBe(403);
  });
});

describe("changing the conversions", () => {
  it.each(rolesGranting("configuration:edit"))(
    "lets %s change them for everyone",
    async (role) => {
      const { cookie } = await test.signedIn(role);
      const response = await change(cookie, shortDays);
      expect(response.statusCode).toBe(200);
      expect(response.json<SavedEffortConversions>().conversions).toEqual(
        shortDays,
      );
      const reader = await test.signedIn("team-member");
      expect(await read(reader.cookie)).toEqual(shortDays);
    },
  );

  it.each(
    roleSchema.options.filter(
      (role) => !rolesGranting("configuration:edit").includes(role),
    ),
  )("refuses %s, changing nothing", async (role) => {
    const { cookie } = await test.signedIn(role);
    expect((await change(cookie, shortDays)).statusCode).toBe(403);
    expect(await read(editor.cookie)).toEqual(startingEffortConversions);
  });

  it.each([
    ["hours that are not whole or half", { hoursPerDay: 7.25 }],
    ["no hours", { hoursPerDay: 0 }],
    ["part of a day in a week", { daysPerWeek: 4.5 }],
    ["more days in a week than it has", { daysPerWeek: 8 }],
    ["more days in a month than it has", { daysPerMonth: 32 }],
    ["text for a number", { daysPerMonth: "20" }],
  ])("refuses %s, changing nothing", async (_case, wrong) => {
    const response = await change(editor.cookie, {
      ...startingEffortConversions,
      ...wrong,
    });
    expect(response.statusCode).toBe(400);
    expect(await read(editor.cookie)).toEqual(startingEffortConversions);
  });

  it("records nothing when the conversions are already those given", async () => {
    const response = await change(editor.cookie, startingEffortConversions);
    expect(response.json<SavedEffortConversions>().changeSetId).toBeNull();
  });
});

describe("the history of the conversions", () => {
  it.each(planHistoryReaders)(
    "shows %s each conversion changed",
    async (role) => {
      // Given a change to two of the conversions
      const { changeSetId } = (
        await change(editor.cookie, {
          ...startingEffortConversions,
          hoursPerDay: 7.5,
          daysPerMonth: 21,
        })
      ).json<SavedEffortConversions>();

      // When someone who sees the plan, without people or configuration, reads the history
      const reader = await test.signedIn(role);
      const entry = await entryFor(reader.cookie, changeSetId);

      // Then they see both changes, and nothing of the conversion left alone
      expect(
        entry?.records.flatMap((record) =>
          record.fields.map(({ field, oldValue, newValue }) => ({
            field,
            oldValue,
            newValue,
          })),
        ),
      ).toEqual([
        { field: "hoursPerDay", oldValue: "8", newValue: "7.5" },
        { field: "daysPerMonth", oldValue: "20", newValue: "21" },
      ]);
    },
  );

  it("is kept from those who see people and configuration but not the plan", async () => {
    const { changeSetId } = (
      await change(editor.cookie, shortDays)
    ).json<SavedEffortConversions>();
    const reader = await test.signedIn([
      "changes:view",
      "configuration:view",
      "people:view",
    ]);
    const response = await test.request(reader.cookie, "GET", "/api/changes");
    expect(response.statusCode).toBe(200);
    expect(
      response
        .json<ChangeHistory>()
        .entries.find((entry: ChangeEntry) => entry.id === changeSetId),
    ).toBeUndefined();
  });
});

describe("undoing a change to the conversions", () => {
  const undo = (cookie: string, changeSetId: string | null) =>
    test.request(cookie, "POST", `/api/undo/${String(changeSetId)}`, {});

  it("puts back the conversions as they were", async () => {
    const { changeSetId } = (
      await change(editor.cookie, shortDays)
    ).json<SavedEffortConversions>();
    expect((await undo(editor.cookie, changeSetId)).statusCode).toBe(200);
    expect(await read(editor.cookie)).toEqual(startingEffortConversions);
  });

  it("is refused once a conversion it changed has changed again", async () => {
    const { changeSetId } = (
      await change(editor.cookie, shortDays)
    ).json<SavedEffortConversions>();
    await change(editor.cookie, { ...shortDays, hoursPerDay: 6 });
    expect((await undo(editor.cookie, changeSetId)).statusCode).toBe(409);
    expect((await read(editor.cookie)).hoursPerDay).toBe(6);
  });

  it("is refused once its maker may no longer change configuration", async () => {
    const maker = await test.signedIn("workforce-administrator");
    const { changeSetId } = (
      await change(maker.cookie, shortDays)
    ).json<SavedEffortConversions>();
    await test.holdOnly(maker.id, ["plan:view", "changes:view"]);
    expect((await undo(maker.cookie, changeSetId)).statusCode).toBe(403);
    expect(await read(editor.cookie)).toEqual(shortDays);
  });
});

describe("a database the migrations have not given conversions", () => {
  it("fails clearly", async () => {
    await test.connection.delete(effortConversions);
    try {
      await expect(
        readEffortConversions(
          test.connection,
          actorFor({ id: "", name: "", email: "" }, "team-member"),
        ),
      ).rejects.toThrow(
        "The effort conversions are missing; apply the migrations",
      );
    } finally {
      await test.connection
        .insert(effortConversions)
        .values(startingEffortConversions);
    }
  });
});
