// SPDX-License-Identifier: Apache-2.0

// Integration tests for built-in details' data classes, against a PostgreSQL server of their own:
// receiving them with the session, who may move one, the access history, and the views, people who
// have left and hiring plan that follow a detail's class.

import { dataClasses } from "@fathom/db";
import { defaultClasses, roleSchema } from "@fathom/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { rolesGranting } from "./access.ts";
import { errorOf, testPosition, unique } from "./test-app.ts";
import {
  test,
  classifier,
  seesBoth,
  move,
  sessionClasses,
  latestMove,
  startDataClassTests,
  clearDataClasses,
  closeDataClassTests,
} from "./test-data-classes.ts";

beforeAll(startDataClassTests);

afterAll(closeDataClassTests);

afterEach(clearDataClasses);

describe("a built-in detail's class", () => {
  it("is its default until moved, for everyone signed in", async () => {
    const viewer = await test.signedIn("team-member");
    expect(await sessionClasses(viewer.cookie)).toEqual(defaultClasses);
  });

  const classifies = rolesGranting("data:classify");

  it("is moved only by starting roles with Classify data", () => {
    expect(classifies).toEqual([
      "engineering-director",
      "workforce-administrator",
    ]);
  });

  it.each(classifies)("is moved by %s, and recorded", async (role) => {
    // Given
    const mover = await test.signedIn(role);
    const viewer = await test.signedIn("team-member");
    // When
    const response = await move(
      "/api/data-classes/startDate",
      "general",
      mover.cookie,
    );
    // Then
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ...defaultClasses,
      startDate: "general",
    });
    expect((await sessionClasses(viewer.cookie)).startDate).toBe("general");
    expect((await latestMove(mover.id))?.details).toEqual({
      moved: "Start date",
      dataClass: "general",
      previousDataClass: "personal",
    });
  });

  it.each(roleSchema.options.filter((role) => !classifies.includes(role)))(
    "is not moved by %s, which cannot classify data",
    async (role) => {
      const other = await test.signedIn(role);
      const response = await move(
        "/api/data-classes/startDate",
        "general",
        other.cookie,
      );
      expect(response.statusCode).toBe(403);
      expect(errorOf(response)).toBe("Changing a class needs Classify data");
      expect(await sessionClasses(other.cookie)).toEqual(defaultClasses);
    },
  );

  it("is not moved without a session", async () => {
    expect(
      (await move("/api/data-classes/startDate", "general", "")).statusCode,
    ).toBe(401);
  });

  it.each([
    ["the class it leaves", "futureReorganizations", "general"],
    ["the class it enters", "startDate", "confidential"],
  ])(
    "is not moved by a role that cannot see %s",
    async (_, field, dataClass) => {
      const mover = await test.signedIn([
        "people:view",
        "personal:view",
        "data:classify",
      ]);
      const response = await move(
        `/api/data-classes/${field}`,
        dataClass,
        mover.cookie,
      );
      expect(response.statusCode).toBe(403);
      expect(errorOf(response)).toBe("This role can't see Confidential data");
    },
  );

  it("is shown in the access history with what moved and its classes", async () => {
    await move("/api/data-classes/managerHistory", "confidential");
    const reader = await test.signedIn(["administration:view"]);
    const { entries } = (
      await test.request(reader.cookie, "GET", "/api/access-history")
    ).json<{ entries: { action: string; details: object }[] }>();
    expect(
      entries.find(({ action }) => action === "data-class-moved")?.details,
    ).toEqual({
      moved: "Past managers",
      dataClass: "confidential",
      previousDataClass: "personal",
    });
  });

  it("is read as the most sensitive when stored in a class the server does not know", async () => {
    await test.connection
      .insert(dataClasses)
      .values({ field: "startDate", dataClass: "secret" });
    expect((await sessionClasses(classifier.cookie)).startDate).toBe(
      "confidential",
    );
  });

  it("records nothing when moved to the class it is in", async () => {
    const before = await latestMove(classifier.id);
    const response = await move("/api/data-classes/endDate", "personal");
    expect(response.statusCode).toBe(200);
    expect(await latestMove(classifier.id)).toEqual(before);
  });

  it("refuses a detail or class Fathom does not have", async () => {
    expect((await move("/api/data-classes/gender", "general")).statusCode).toBe(
      400,
    );
    expect((await move("/api/data-classes/endDate", "secret")).statusCode).toBe(
      400,
    );
  });
});

describe("views that need a built-in detail", () => {
  const otherDay = "/api/feature-teams?on=2020-01-01";

  it("open to roles once the organization moves its details to General", async () => {
    // Given
    const reader = await test.signedIn(["people:view", "feature-teams:view"]);
    expect(
      (await test.request(reader.cookie, "GET", otherDay)).statusCode,
    ).toBe(403);
    // When
    for (const field of [
      "startDate",
      "endDate",
      "managerHistory",
      "featureTeamDates",
    ]) {
      await move(`/api/data-classes/${field}`, "general");
    }
    // Then
    expect(
      (await test.request(reader.cookie, "GET", otherDay)).statusCode,
    ).toBe(200);
  });

  it("close to roles that do not see the class a detail moves to", async () => {
    const reader = await test.signedIn(seesBoth.slice(0, 2));
    await test.holdOnly(reader.id, [
      ...seesBoth.slice(0, 2),
      "feature-teams:view",
    ]);
    expect(
      (await test.request(reader.cookie, "GET", otherDay)).statusCode,
    ).toBe(200);
    await move("/api/data-classes/endDate", "confidential");
    const response = await test.request(reader.cookie, "GET", otherDay);
    expect(response.statusCode).toBe(403);
    expect(errorOf(response)).toBe("Other dates need Confidential access.");
  });

  it("hide people's dates once moved out of the reader's sight", async () => {
    const reader = await test.signedIn(seesBoth.slice(0, 2));
    await move("/api/data-classes/startDate", "confidential");
    const people = (
      await test.request(reader.cookie, "GET", "/api/people")
    ).json<{
      people: Record<string, unknown>[];
    }>().people;
    expect(people.every((person) => !("startDate" in person))).toBe(true);
  });
});

describe("people who have left", () => {
  async function personWhoLeft(): Promise<string> {
    const added = await test.request(classifier.cookie, "POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Leaver"),
          employeeId: unique("E-left"),
          positionId: testPosition,
          startDate: "2020-01-06",
          endDate: "2021-01-29",
        },
      ],
    });
    const [id = ""] = added.json<{ ids: string[] }>().ids;
    await test.request(classifier.cookie, "POST", "/api/drafts/approval", {
      people: [id],
    });
    return id;
  }

  const listedFor = async (cookie: string, id: string) =>
    (await test.request(cookie, "GET", "/api/people"))
      .json<{ people: { id: string; endDate?: string | null }[] }>()
      .people.find((person) => person.id === id);

  it("are hidden once End date moves out of the reader's sight", async () => {
    const id = await personWhoLeft();
    const reader = await test.signedIn(seesBoth.slice(0, 2));
    expect(await listedFor(reader.cookie, id)).toBeDefined();
    await move("/api/data-classes/endDate", "confidential");
    expect(await listedFor(reader.cookie, id)).toBeUndefined();
  });

  it("are shown with their dates once both dates move to General", async () => {
    const id = await personWhoLeft();
    const reader = await test.signedIn(["people:view"]);
    expect(await listedFor(reader.cookie, id)).toBeUndefined();
    await move("/api/data-classes/startDate", "general");
    await move("/api/data-classes/endDate", "general");
    expect((await listedFor(reader.cookie, id))?.endDate).toBe("2021-01-29");
  });
});

describe("the hiring plan", () => {
  const wholePlanFor = async (cookie: string) =>
    (await test.request(cookie, "GET", "/api/planned-hires")).json<{
      wholePlan: boolean;
    }>().wholePlan;

  const added = async (cookie: string) =>
    (
      await test.request(cookie, "POST", "/api/planned-hires", {
        hires: [{ positionId: testPosition }],
      })
    ).statusCode;

  it("is seen only by roles that see its class", async () => {
    const reader = await test.signedIn([
      "people:view",
      "hiring-plan:view",
      "personal:view",
    ]);
    expect(await wholePlanFor(reader.cookie)).toBe(false);
    await move("/api/data-classes/hiringPlan", "personal");
    expect(await wholePlanFor(reader.cookie)).toBe(true);
  });

  it("keeps hires' drafts, their history and deciding them from roles that don't see its class", async () => {
    // Given a hire drafted with a requisition, and a reader who sees and approves the hiring plan
    // but not Confidential data
    const requisition = unique("REQ-Class");
    const drafted = await test.request(
      classifier.cookie,
      "POST",
      "/api/planned-hires",
      { hires: [{ positionId: testPosition, requisition }] },
    );
    expect(drafted.statusCode, drafted.body).toBe(201);
    const [id = ""] = drafted.json<{ ids: string[] }>().ids;
    const reader = await test.signedIn([
      "people:view",
      "feature-teams:view",
      "personal:view",
      "hiring-plan:view",
      "hiring-plan:approve",
    ]);
    const onChart = async () =>
      (await test.request(reader.cookie, "GET", "/api/org-chart"))
        .json<{ drafted: { id: string }[] }>()
        .drafted.some((hire) => hire.id === id);
    const inHistory = async () =>
      (await test.request(reader.cookie, "GET", "/api/changes")).body.includes(
        requisition,
      );
    const approve = async () =>
      (
        await test.request(reader.cookie, "POST", "/api/drafts/approval", {
          plannedHires: [id],
        })
      ).statusCode;
    // Then
    expect(await onChart()).toBe(false);
    expect(await inHistory()).toBe(false);
    expect(await approve()).toBe(404);
    // When the hiring plan moves to a class the reader sees
    await move("/api/data-classes/hiringPlan", "personal");
    // Then
    expect(await onChart()).toBe(true);
    expect(await inHistory()).toBe(true);
    expect(await approve()).toBe(200);
  });

  it("is undone only by roles that still change its class", async () => {
    await move("/api/data-classes/hiringPlan", "general");
    const editor = await test.signedIn(["people:edit", "hiring-plan:edit"]);
    const made = await test.request(
      editor.cookie,
      "POST",
      "/api/planned-hires",
      { hires: [{ positionId: testPosition }] },
    );
    expect(made.statusCode, made.body).toBe(201);
    const { changeSetId } = made.json<{ changeSetId: string }>();
    await move("/api/data-classes/hiringPlan", "confidential");
    expect(
      (
        await test.request(
          editor.cookie,
          "POST",
          `/api/undo/${changeSetId}`,
          {},
        )
      ).statusCode,
    ).toBe(403);
  });

  it("is changed only by roles that change its class", async () => {
    const editor = await test.signedIn(["people:edit", "hiring-plan:edit"]);
    expect(await added(editor.cookie)).toBe(403);
    await move("/api/data-classes/hiringPlan", "general");
    expect(await added(editor.cookie)).toBe(201);
  });
});
