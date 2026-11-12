// SPDX-License-Identifier: Apache-2.0

// Tests for the planning settings through the API, against a migrated PostgreSQL server: those who
// see configuration read them, and everyone who sees the plan the conversions between units of effort
// alone; those who change configuration change some of them straight away, leaving the rest; each
// change is recorded in the change history for those who see configuration, and its maker can undo
// it.

import {
  type ChangeEntry,
  type ChangeHistory,
  type PlanningSettings,
  type PlanningSettingsChange,
  roleSchema,
  type SavedPlanningSettings,
  startingPlanningSettings,
} from "@fathom/shared";
import { planningSettings } from "@fathom/db";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { actorFor, rolesGranting } from "./access.ts";
import { readPlanningSettings } from "./data/planning-settings.ts";
import { startTestApp, type TestApp } from "./test-app.ts";

const path = "/api/planning-settings";
const conversionsPath = "/api/effort-conversions";
const changed: PlanningSettingsChange = {
  hoursPerDay: 7.5,
  focusPercent: 70,
  rampUpPercents: [25, 50, 75],
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
  await test.connection.update(planningSettings).set(startingPlanningSettings);
});

const read = async (cookie: string) =>
  (await test.request(cookie, "GET", path)).json<PlanningSettings>();

const change = (cookie: string, settings: object) =>
  test.request(cookie, "PATCH", path, settings);

const saved = async (cookie: string, settings: object) =>
  (await change(cookie, settings)).json<SavedPlanningSettings>();

// Roles that see the change history and configuration.
const configurationHistoryReaders = rolesGranting("plan:view").filter((role) =>
  rolesGranting("configuration:view").includes(role),
);

const entryFor = async (cookie: string, changeSetId: string | null) =>
  (await test.request(cookie, "GET", "/api/changes"))
    .json<ChangeHistory>()
    .entries.find((entry: ChangeEntry) => entry.id === changeSetId);

const others = (allowed: readonly string[]) =>
  roleSchema.options.filter((role) => !allowed.includes(role));

describe("reading the settings", () => {
  it.each(rolesGranting("configuration:view"))(
    "gives %s the starting settings",
    async (role) => {
      const { cookie } = await test.signedIn(role);
      expect(await read(cookie)).toEqual(startingPlanningSettings);
    },
  );

  it.each(others(rolesGranting("configuration:view")))(
    "refuses %s, who does not see configuration",
    async (role) => {
      const { cookie } = await test.signedIn(role);
      expect((await test.request(cookie, "GET", path)).statusCode).toBe(403);
    },
  );

  it.each(rolesGranting("plan:view"))(
    "gives %s the conversions alone",
    async (role) => {
      const { cookie } = await test.signedIn(role);
      expect(
        (await test.request(cookie, "GET", conversionsPath)).json(),
      ).toEqual({ hoursPerDay: 8, daysPerWeek: 5, daysPerMonth: 20 });
    },
  );

  it.each(others(rolesGranting("plan:view")))(
    "refuses %s the conversions, who does not see the plan",
    async (role) => {
      const { cookie } = await test.signedIn(role);
      expect(
        (await test.request(cookie, "GET", conversionsPath)).statusCode,
      ).toBe(403);
    },
  );
});

describe("changing the settings", () => {
  it.each(rolesGranting("configuration:edit"))(
    "lets %s change some for everyone, leaving the rest",
    async (role) => {
      const { cookie } = await test.signedIn(role);
      const response = await change(cookie, changed);
      expect(response.statusCode).toBe(200);
      const expected = { ...startingPlanningSettings, ...changed };
      expect(response.json<SavedPlanningSettings>().settings).toEqual(expected);
      const reader = await test.signedIn("executive");
      expect(await read(reader.cookie)).toEqual(expected);
    },
  );

  it("keeps a change someone else made to another setting", async () => {
    // Given one person changes the buffer
    await change(editor.cookie, { bufferPercent: 20 });

    // When another changes the focus
    const other = await test.signedIn("engineering-director");
    await change(other.cookie, { focusPercent: 60 });

    // Then both changes are kept
    expect(await read(editor.cookie)).toMatchObject({
      bufferPercent: 20,
      focusPercent: 60,
    });
  });

  it.each(others(rolesGranting("configuration:edit")))(
    "refuses %s, changing nothing",
    async (role) => {
      const { cookie } = await test.signedIn(role);
      expect((await change(cookie, changed)).statusCode).toBe(403);
      expect(await read(editor.cookie)).toEqual(startingPlanningSettings);
    },
  );

  it.each([
    ["hours that are not whole or half", { hoursPerDay: 7.25 }],
    ["more days in a month than it has", { daysPerMonth: 32 }],
    ["no focus", { focusPercent: 0 }],
    ["a buffer below nothing", { bufferPercent: -5 }],
    ["a month of ramp-up beyond full", { rampUpPercents: [50, 120] }],
    [
      "more than a year of ramp-up",
      { rampUpPercents: Array.from({ length: 13 }, () => 50) },
    ],
    ["text for a number", { daysPerMonth: "20" }],
    ["an empty month of ramp-up", { rampUpPercents: [50, null] }],
  ])("refuses %s, changing nothing", async (_case, wrong) => {
    const response = await change(editor.cookie, wrong);
    expect(response.statusCode).toBe(400);
    expect(await read(editor.cookie)).toEqual(startingPlanningSettings);
  });

  it("ignores what is not a setting, changing nothing", async () => {
    const response = await change(editor.cookie, { teamFocus: 50 });
    expect(response.statusCode).toBe(200);
    expect(response.json<SavedPlanningSettings>().changeSetId).toBeNull();
    expect(await read(editor.cookie)).toEqual(startingPlanningSettings);
  });

  it("records nothing when the settings are already those given", async () => {
    expect(
      (await saved(editor.cookie, startingPlanningSettings)).changeSetId,
    ).toBeNull();
  });
});

describe("the history of the settings", () => {
  it.each(configurationHistoryReaders)(
    "shows %s each setting changed",
    async (role) => {
      // Given a change to three of the settings
      const { changeSetId } = await saved(editor.cookie, changed);

      // When someone who sees configuration and the change history reads it
      const reader = await test.signedIn(role);
      const entry = await entryFor(reader.cookie, changeSetId);

      // Then they see each change, and nothing of the settings left alone
      expect(entry?.records.map(({ kind }) => kind)).toEqual([
        "planning-settings",
      ]);
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
        { field: "focusPercent", oldValue: "80", newValue: "70" },
        {
          field: "rampUpPercents",
          oldValue: ["50", "75"],
          newValue: ["25", "50", "75"],
        },
      ]);
    },
  );

  it("is kept from those who see the plan and people but not configuration", async () => {
    const { changeSetId } = await saved(editor.cookie, changed);
    const reader = await test.signedIn(["plan:view", "people:view"]);
    const response = await test.request(reader.cookie, "GET", "/api/changes");
    expect(response.statusCode).toBe(200);
    expect(
      response
        .json<ChangeHistory>()
        .entries.find((entry: ChangeEntry) => entry.id === changeSetId),
    ).toBeUndefined();
  });
});

describe("undoing a change to the settings", () => {
  const undo = (cookie: string, changeSetId: string | null) =>
    test.request(cookie, "POST", `/api/undo/${String(changeSetId)}`, {});

  it("puts back the settings as they were", async () => {
    const { changeSetId } = await saved(editor.cookie, changed);
    expect((await undo(editor.cookie, changeSetId)).statusCode).toBe(200);
    expect(await read(editor.cookie)).toEqual(startingPlanningSettings);
  });

  it("is refused once a setting it changed has changed again", async () => {
    const { changeSetId } = await saved(editor.cookie, changed);
    await change(editor.cookie, { hoursPerDay: 6 });
    expect((await undo(editor.cookie, changeSetId)).statusCode).toBe(409);
    expect((await read(editor.cookie)).hoursPerDay).toBe(6);
  });

  it("is refused once its maker may no longer change configuration", async () => {
    const maker = await test.signedIn("workforce-administrator");
    const { changeSetId } = await saved(maker.cookie, changed);
    await test.holdOnly(maker.id, ["plan:view"]);
    expect((await undo(maker.cookie, changeSetId)).statusCode).toBe(403);
    expect(await read(editor.cookie)).toMatchObject(changed);
  });
});

describe("a database the migrations have not given settings", () => {
  it("fails clearly", async () => {
    await test.connection.delete(planningSettings);
    try {
      await expect(
        readPlanningSettings(
          test.connection,
          actorFor({ id: "", name: "", email: "" }, "executive"),
        ),
      ).rejects.toThrow(
        "The planning settings are missing; apply the migrations",
      );
    } finally {
      await test.connection
        .insert(planningSettings)
        .values(startingPlanningSettings);
    }
  });
});
