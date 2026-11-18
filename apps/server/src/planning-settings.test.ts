// SPDX-License-Identifier: Apache-2.0

// Tests for the planning settings through the API, against a migrated PostgreSQL server: those who
// see configuration read them with their draft in place, and everyone who sees the plan the
// conversions between units of effort alone, as they are live; those who change configuration
// draft some of them, leaving the rest, live once approved with Approve Configuration; each change
// is recorded in the change history for those who see configuration, and its maker can undo it.

import {
  type ChangeEntry,
  type ChangeHistory,
  type EffortConversions,
  type PlanningSettingsChange,
  type PlanningSettingsShown,
  planningSettingsId,
  roleSchema,
  type SavedPlanningSettings,
  startingPlanningSettings,
} from "@fathom/shared";
import {
  changeSets,
  changes,
  drafts,
  planningSettings,
  planningSettingsId as rowId,
  unpublishedDrafts,
} from "@fathom/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { actorFor, rolesGranting } from "./access.ts";
import {
  readEffortConversions,
  readPlanningSettings,
} from "./data/planning-settings.ts";
import { startTestApp, type TestApp } from "./test-app.ts";

const path = "/api/planning-settings";
const conversionsPath = "/api/effort-conversions";
const draftPath = `/api/records/planning-settings/${planningSettingsId}/draft`;
const asked = {
  records: [{ type: "planning-settings", id: planningSettingsId }],
};
const changed: PlanningSettingsChange = {
  hoursPerDay: 7.5,
  focusPercent: 70,
  rampUpPercents: [25, 50, 75],
};
const drafted = { ...startingPlanningSettings, ...changed };
const startingConversions = {
  hoursPerDay: 8,
  daysPerWeek: 5,
  daysPerMonth: 20,
};

let test: TestApp;
let editor: { id: string; cookie: string };
let approver: { id: string; cookie: string };

beforeAll(async () => {
  test = await startTestApp();
  editor = await test.signedIn("workforce-administrator");
  approver = await test.signedIn([
    "configuration:view",
    "configuration:approve",
  ]);
});

afterAll(async () => {
  await test.close();
});

afterEach(async () => {
  await test.connection
    .delete(unpublishedDrafts)
    .where(eq(unpublishedDrafts.recordType, "planning-settings"));
  await test.connection
    .delete(drafts)
    .where(eq(drafts.recordType, "planning-settings"));
  await test.connection.update(planningSettings).set(startingPlanningSettings);
});

const read = async (cookie: string) =>
  (await test.request(cookie, "GET", path)).json<PlanningSettingsShown>();

const change = (
  cookie: string,
  settings: object,
  options?: { publish?: boolean },
) => test.request(cookie, "PATCH", path, settings, options);

const saved = async (cookie: string, settings: object) =>
  (await change(cookie, settings)).json<SavedPlanningSettings>();

const conversions = async (cookie: string) =>
  (
    await test.request(cookie, "GET", conversionsPath)
  ).json<EffortConversions>();

const approve = (cookie: string) =>
  test.request(cookie, "POST", "/api/drafts/approval", asked);

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
      expect(await conversions(cookie)).toEqual(startingConversions);
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

describe("drafting a change to the settings", () => {
  it.each(rolesGranting("configuration:edit"))(
    "lets %s draft some, leaving the rest",
    async (role) => {
      const { cookie } = await test.signedIn(role);
      const response = await change(cookie, changed);
      expect(response.statusCode).toBe(200);
      expect(response.json<SavedPlanningSettings>().settings).toMatchObject(
        drafted,
      );
    },
  );

  it("shows those who see configuration the draft in place, with the live values it changes", async () => {
    await change(editor.cookie, changed);
    const reader = await test.signedIn("executive");
    expect(await read(reader.cookie)).toMatchObject({
      ...drafted,
      draft: {
        action: "changed",
        changed: ["hoursPerDay", "focusPercent", "rampUpPercents"],
        live: { hoursPerDay: 8, focusPercent: 80, rampUpPercents: [50, 75] },
        state: "waiting",
        madeBy: expect.any(String) as unknown,
      },
    });
  });

  it("leaves the conversions estimates are shown with as they are live", async () => {
    await change(editor.cookie, changed);
    const reader = await test.signedIn("product-manager");
    expect(await conversions(reader.cookie)).toEqual(startingConversions);
  });

  it("keeps a change someone else drafted to another setting", async () => {
    // Given one person drafts a buffer
    await change(editor.cookie, { bufferPercent: 20 });

    // When another drafts a focus
    const other = await test.signedIn("engineering-director");
    await change(other.cookie, { focusPercent: 60 });

    // Then the draft holds both
    expect(await read(editor.cookie)).toMatchObject({
      bufferPercent: 20,
      focusPercent: 60,
      draft: { changed: ["focusPercent", "bufferPercent"] },
    });
  });

  it("holds the settings for their maker until published, refusing anyone else's change", async () => {
    // Given a change not yet published
    await change(editor.cookie, { bufferPercent: 20 }, { publish: false });

    // When someone else reads and changes the settings
    const other = await test.signedIn("engineering-director");
    const seen = await read(other.cookie);
    const refused = await change(other.cookie, { focusPercent: 60 });

    // Then they see them as they were, held, and their change is refused
    expect(seen).toMatchObject({
      bufferPercent: 0,
      heldBy: expect.any(String) as unknown,
    });
    expect(seen.draft).toBeUndefined();
    expect(refused.statusCode).toBe(409);
    expect(await read(editor.cookie)).toMatchObject({
      bufferPercent: 20,
      focusPercent: 80,
      draft: { unpublished: true },
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

  it("takes the draft away once changed back to the live settings", async () => {
    await change(editor.cookie, { bufferPercent: 20 });
    await change(editor.cookie, { bufferPercent: 0 });
    expect(await read(editor.cookie)).toEqual(startingPlanningSettings);
  });
});

describe("deciding a draft of the settings", () => {
  it.each(rolesGranting("configuration:approve"))(
    "lets %s approve it, making the settings and conversions live",
    async (role) => {
      await change(editor.cookie, changed);
      const { cookie } = await test.signedIn(role);
      expect((await approve(cookie)).statusCode).toBe(200);
      expect(await read(editor.cookie)).toEqual(drafted);
      expect(await conversions(editor.cookie)).toEqual({
        ...startingConversions,
        hoursPerDay: 7.5,
      });
    },
  );

  it("refuses a role that approves other areas but not configuration", async () => {
    await change(editor.cookie, changed);
    const other = await test.signedIn([
      "configuration:view",
      "plan:view",
      "plan:approve",
      "features:approve",
    ]);
    expect((await approve(other.cookie)).statusCode).toBe(403);
    expect(await conversions(editor.cookie)).toEqual(startingConversions);
  });

  it("rejects it with a reason, leaving the live settings", async () => {
    await change(editor.cookie, changed);
    const response = await test.request(
      approver.cookie,
      "POST",
      "/api/drafts/rejection",
      { ...asked, reason: "Keep a full day" },
    );
    expect(response.statusCode).toBe(200);
    expect(await read(editor.cookie)).toMatchObject({
      ...drafted,
      draft: { state: "rejected", reason: "Keep a full day" },
    });
    expect(await conversions(editor.cookie)).toEqual(startingConversions);
  });

  it("resubmits a rejected draft", async () => {
    await change(editor.cookie, changed);
    await test.request(approver.cookie, "POST", "/api/drafts/rejection", {
      ...asked,
      reason: "Keep a full day",
    });
    const response = await test.request(
      editor.cookie,
      "DELETE",
      `${draftPath}/rejection`,
    );
    expect(response.statusCode).toBe(200);
    expect((await read(editor.cookie)).draft?.state).toBe("waiting");
  });

  it("discards it, leaving the live settings", async () => {
    await change(editor.cookie, changed);
    const response = await test.request(editor.cookie, "DELETE", draftPath);
    expect(response.statusCode).toBe(200);
    expect(await read(editor.cookie)).toEqual(startingPlanningSettings);
  });

  it("names the settings among the user's unpublished changes", async () => {
    await change(editor.cookie, changed, { publish: false });
    const response = await test.request(
      editor.cookie,
      "GET",
      "/api/unpublished",
    );
    expect(response.json()).toEqual({
      changes: [
        {
          subject: "the planning settings",
          action: "changed",
          key: `planning-settings ${planningSettingsId}`,
          linked: [],
        },
      ],
    });
  });
});

describe("the history of the settings", () => {
  it.each(configurationHistoryReaders)(
    "shows %s each setting drafted",
    async (role) => {
      // Given a draft of three of the settings
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

  it("puts back the draft as it was", async () => {
    // Given a draft of the buffer, then a change to it and the focus
    await change(editor.cookie, { bufferPercent: 20 });
    const { changeSetId } = await saved(editor.cookie, {
      bufferPercent: 30,
      focusPercent: 70,
    });

    // When the second is undone
    expect((await undo(editor.cookie, changeSetId)).statusCode).toBe(200);

    // Then the draft holds the buffer alone, as before
    expect(await read(editor.cookie)).toMatchObject({
      bufferPercent: 20,
      focusPercent: 80,
      draft: { changed: ["bufferPercent"] },
    });
  });

  it("takes the draft away once nothing is left to change", async () => {
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

  it("is refused once the draft has been approved", async () => {
    const { changeSetId } = await saved(editor.cookie, changed);
    await approve(approver.cookie);
    expect((await undo(editor.cookie, changeSetId)).statusCode).toBe(409);
    expect(await read(editor.cookie)).toEqual(drafted);
  });

  it("is refused once someone else has changed the settings", async () => {
    const { changeSetId } = await saved(editor.cookie, changed);
    const other = await test.signedIn("engineering-director");
    await change(other.cookie, { bufferPercent: 20 });
    expect((await undo(editor.cookie, changeSetId)).statusCode).toBe(409);
    expect(await read(editor.cookie)).toMatchObject({
      ...changed,
      bufferPercent: 20,
    });
  });

  it("is refused for a change saved live, before the settings were drafted", async () => {
    const [set] = await test.connection
      .insert(changeSets)
      .values({ madeBy: editor.id })
      .returning({ id: changeSets.id });
    await test.connection.insert(changes).values({
      changeSetId: String(set?.id),
      recordType: "planning-settings",
      recordId: planningSettingsId,
      action: "changed",
      field: "hoursPerDay",
      tier: "internal",
      oldValue: "8",
      newValue: "7.5",
    });
    expect((await undo(editor.cookie, set?.id ?? null)).statusCode).toBe(409);
  });

  it("is refused once its maker may no longer change configuration", async () => {
    const maker = await test.signedIn("workforce-administrator");
    const { changeSetId } = await saved(maker.cookie, changed);
    await test.holdOnly(maker.id, ["plan:view"]);
    expect((await undo(maker.cookie, changeSetId)).statusCode).toBe(403);
    expect(await read(editor.cookie)).toMatchObject(changed);
  });
});

describe("the settings' identifier", () => {
  it("is the one the database names their row by", () => {
    expect(planningSettingsId).toBe(rowId);
  });
});

describe("a database the migrations have not given settings", () => {
  const executive = actorFor({ id: "", name: "", email: "" }, "executive");

  it.each([
    ["the settings", readPlanningSettings],
    ["the conversions", readEffortConversions],
  ])("fails clearly to read %s", async (_case, reading) => {
    await test.connection.delete(planningSettings);
    try {
      await expect(reading(test.connection, executive)).rejects.toThrow(
        "The planning settings are missing; apply the migrations",
      );
    } finally {
      await test.connection
        .insert(planningSettings)
        .values(startingPlanningSettings);
    }
  });
});
