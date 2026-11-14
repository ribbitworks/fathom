// SPDX-License-Identifier: Apache-2.0

// Tests for moving data to another class through the API, against a PostgreSQL server of their own:
// every signed-in user receives the classes of built-in details with their session; only roles with
// Classify data that see both classes move a built-in detail, a list, or a column with a class of its
// own; each move is recorded in the access history; lists' and columns' moves are in the change
// history and their drafts, and are moved back rather than undone; and the views that need a
// detail, and who sees and changes the hiring plan, follow its class.

import { accessHistory, dataClasses, fields, lists } from "@fathom/db";
import {
  type DataClasses,
  defaultClasses,
  type Permission,
  roleSchema,
} from "@fathom/shared";
import { and, desc, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { rolesGranting } from "./access.ts";
import {
  startTestApp,
  type TestApp,
  testPosition,
  unique,
} from "./test-app.ts";

let test: TestApp;
let classifier: { id: string; cookie: string };

const seesBoth: Permission[] = [
  "people:view",
  "personal:view",
  "confidential:view",
];

beforeAll(async () => {
  test = await startTestApp();
  classifier = await test.signedIn("engineering-director");
});

afterAll(async () => {
  await test.close();
});

afterEach(async () => {
  await test.connection.delete(dataClasses);
});

const move = (
  url: string,
  dataClass: string,
  cookie: string = classifier.cookie,
) => test.request(cookie, "PUT", url, { dataClass });

const refusal = (response: Awaited<ReturnType<typeof move>>) =>
  response.json<{ error: string }>().error;

async function sessionClasses(cookie: string): Promise<DataClasses> {
  return (await test.request(cookie, "GET", "/api/session")).json<{
    settings: { dataClasses: DataClasses };
  }>().settings.dataClasses;
}

async function latestMove(actorId: string) {
  const [entry] = await test.connection
    .select()
    .from(accessHistory)
    .where(
      and(
        eq(accessHistory.actorId, actorId),
        eq(accessHistory.action, "data-class-moved"),
      ),
    )
    .orderBy(desc(accessHistory.id))
    .limit(1);
  return entry;
}

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
      expect(refusal(response)).toBe("Changing a class needs Classify data");
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
      expect(refusal(response)).toBe("This role can't see Confidential data");
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
    expect(refusal(response)).toBe("Other dates need Confidential access.");
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

async function liveList(visibility = "general") {
  const created = await test.request(classifier.cookie, "POST", "/api/lists", {
    name: unique("Fictional sites"),
    visibility,
  });
  const id = created.json<{ list: { id: string } }>().list.id;
  await test.approveLists();
  return id;
}

describe("a list's class", () => {
  it("is moved at once, kept when its draft is approved, and recorded in both histories", async () => {
    // Given
    const id = await liveList();
    await test.request(classifier.cookie, "PUT", `/api/lists/${id}`, {
      name: unique("Fictional offices"),
      visibility: "general",
    });
    // When
    const response = await move(`/api/lists/${id}/class`, "personal");
    await test.approveLists();
    // Then
    expect(response.statusCode).toBe(200);
    const [list] = await test.connection
      .select()
      .from(lists)
      .where(eq(lists.id, id));
    expect(list?.visibility).toBe("personal");
    expect((await latestMove(classifier.id))?.details).toMatchObject({
      dataClass: "personal",
      previousDataClass: "general",
    });
    expect(await test.historyOf(id)).toContainEqual(
      expect.objectContaining({
        field: "visibility",
        oldValue: "general",
        newValue: "personal",
        madeBy: classifier.id,
      }),
    );
  });

  it("waits while someone else has unpublished changes to the list", async () => {
    const id = await liveList();
    const other = await test.signedIn("workforce-administrator");
    await test.request(
      other.cookie,
      "PUT",
      `/api/lists/${id}`,
      { name: unique("Fictional held"), visibility: "general" },
      { publish: false },
    );
    const response = await move(`/api/lists/${id}/class`, "personal");
    expect(response.statusCode).toBe(409);
  });

  it("is moved back rather than undone", async () => {
    const id = await liveList();
    const { changeSetId } = (
      await move(`/api/lists/${id}/class`, "personal")
    ).json<{ changeSetId: string }>();
    const response = await test.request(
      classifier.cookie,
      "POST",
      `/api/undo/${changeSetId}`,
    );
    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toBe(
      "A change of class can't be undone; change it back instead",
    );
  });

  it("is not moved by a role that changes configuration without Classify data", async () => {
    const id = await liveList();
    const editor = await test.signedIn([...seesBoth, "configuration:edit"]);
    const response = await move(
      `/api/lists/${id}/class`,
      "personal",
      editor.cookie,
    );
    expect(response.statusCode).toBe(403);
  });

  it("is not moved by a classifier who cannot see the class it enters", async () => {
    const id = await liveList();
    const mover = await test.signedIn([
      ...seesBoth.slice(0, 2),
      "data:classify",
    ]);
    const response = await move(
      `/api/lists/${id}/class`,
      "confidential",
      mover.cookie,
    );
    expect(response.statusCode).toBe(403);
    expect(refusal(response)).toBe("This role can't see Confidential data");
  });

  it("is not changed in a draft once the list is approved", async () => {
    const id = await liveList();
    const response = await test.request(
      classifier.cookie,
      "PUT",
      `/api/lists/${id}`,
      {
        name: unique("Fictional desks"),
        visibility: "personal",
      },
    );
    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toMatch(
      /is already approved, so its class changes at once, not in a draft$/,
    );
  });

  it("starts other than General only with Classify data, recorded as a move", async () => {
    const editor = await test.signedIn([...seesBoth, "configuration:edit"]);
    const name = unique("Fictional badges");
    const refused = await test.request(editor.cookie, "POST", "/api/lists", {
      name,
      visibility: "personal",
    });
    expect(refused.statusCode).toBe(403);
    const created = await test.request(
      classifier.cookie,
      "POST",
      "/api/lists",
      {
        name,
        visibility: "personal",
      },
    );
    expect(created.statusCode).toBe(201);
    expect((await latestMove(classifier.id))?.details).toEqual({
      moved: `the ${name} list`,
      dataClass: "personal",
      previousDataClass: "general",
    });
  });

  it("records nothing when moved to the class it is in", async () => {
    const id = await liveList("personal");
    const response = await move(`/api/lists/${id}/class`, "personal");
    expect(response.json()).toEqual({ changeSetId: null });
  });

  it("stays General while a column on Features draws on it", async () => {
    const id = await liveList();
    await test.request(classifier.cookie, "POST", "/api/features/columns", {
      name: unique("Fictional feature column"),
      listId: id,
    });
    const response = await move(`/api/lists/${id}/class`, "personal");
    expect(response.statusCode).toBe(409);
  });

  it("stays General when a built-in column on Features draws on it", async () => {
    const [risks] = await test.connection
      .select({ id: lists.id })
      .from(lists)
      .where(eq(lists.builtIn, "feature-risks"));
    const response = await move(
      `/api/lists/${String(risks?.id)}/class`,
      "personal",
    );
    expect(response.statusCode).toBe(409);
  });

  it("is not found for a list that does not exist", async () => {
    const response = await move(
      "/api/lists/00000000-0000-4000-8000-000000000000/class",
      "personal",
    );
    expect(response.statusCode).toBe(404);
  });
});

async function liveColumn(type: string, listId?: string) {
  const created = await test.request(
    classifier.cookie,
    "POST",
    "/api/people/columns",
    {
      name: unique("Fictional column"),
      type,
      ...(listId === undefined ? { visibility: "general" } : { listId }),
    },
  );
  const id = created.json<{ field: { id: string } }>().field.id;
  await test.approveLists();
  return id;
}

describe("a column's class", () => {
  it("is moved at once when the column has a class of its own", async () => {
    const id = await liveColumn("link");
    const response = await move(`/api/columns/${id}/class`, "confidential");
    expect(response.statusCode).toBe(200);
    const [column] = await test.connection
      .select()
      .from(fields)
      .where(eq(fields.id, id));
    expect(column?.visibility).toBe("confidential");
    expect(await latestMove(classifier.id)).toMatchObject({
      details: { dataClass: "confidential", previousDataClass: "general" },
    });
  });

  it("waits while someone else has unpublished changes to the column", async () => {
    const id = await liveColumn("link");
    const other = await test.signedIn("workforce-administrator");
    await test.request(
      other.cookie,
      "PUT",
      `/api/people/columns/${id}`,
      {
        name: unique("Fictional held"),
        type: "link",
        visibility: "general",
        multiple: false,
        required: false,
        onPlannedHires: true,
      },
      { publish: false },
    );
    const response = await move(`/api/columns/${id}/class`, "personal");
    expect(response.statusCode).toBe(409);
  });

  it("is not moved for a column drafted to be removed", async () => {
    const id = await liveColumn("link");
    await test.request(
      classifier.cookie,
      "DELETE",
      `/api/people/columns/${id}`,
    );
    const response = await move(`/api/columns/${id}/class`, "personal");
    expect(response.statusCode).toBe(409);
  });

  it("is read with People's columns alone, without anyone's values, by those who see people", async () => {
    const id = await liveColumn("link");
    const response = await test.request(
      classifier.cookie,
      "GET",
      "/api/people/columns",
    );
    expect(response.statusCode).toBe(200);
    const read = response.json<{
      fields: { id: string }[];
      people?: unknown;
    }>();
    expect(read.fields.map((field) => field.id)).toContain(id);
    expect(read.people).toBeUndefined();
    const outsider = await test.signedIn(["plan:view"]);
    expect(
      (await test.request(outsider.cookie, "GET", "/api/people/columns"))
        .statusCode,
    ).toBe(403);
  });

  it("is its list's for a column that draws on one", async () => {
    const id = await liveColumn("choice", await liveList());
    const response = await move(`/api/columns/${id}/class`, "personal");
    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toBe(
      "This column takes its list's class, so change the list's class instead",
    );
  });

  it("is not moved by a classifier who cannot see the class it leaves", async () => {
    const id = await liveColumn("note");
    await move(`/api/columns/${id}/class`, "confidential");
    const mover = await test.signedIn([
      ...seesBoth.slice(0, 2),
      "data:classify",
    ]);
    const response = await move(
      `/api/columns/${id}/class`,
      "personal",
      mover.cookie,
    );
    expect(response.statusCode).toBe(403);
  });

  it("is not moved without Classify data", async () => {
    const id = await liveColumn("note");
    const editor = await test.signedIn([...seesBoth, "configuration:edit"]);
    const response = await move(
      `/api/columns/${id}/class`,
      "personal",
      editor.cookie,
    );
    expect(response.statusCode).toBe(403);
  });

  it("records nothing when moved to the class it is in", async () => {
    const id = await liveColumn("number");
    const response = await move(`/api/columns/${id}/class`, "general");
    expect(response.json()).toEqual({ changeSetId: null });
  });

  it("stays General on Features", async () => {
    const created = await test.request(
      classifier.cookie,
      "POST",
      "/api/features/columns",
      {
        name: unique("Fictional feature link"),
        type: "link",
        visibility: "general",
      },
    );
    const id = created.json<{ field: { id: string } }>().field.id;
    await test.approveLists();
    const response = await move(`/api/columns/${id}/class`, "personal");
    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toBe(
      "Everyone who sees the plan sees columns on Features, so they stay General",
    );
  });

  it("is not changed in a draft once the column is approved, but may be before", async () => {
    const name = unique("Fictional note");
    const created = await test.request(
      classifier.cookie,
      "POST",
      "/api/people/columns",
      { name, type: "note", visibility: "personal" },
    );
    const id = created.json<{ field: { id: string } }>().field.id;
    const change = (visibility: string) =>
      test.request(classifier.cookie, "PUT", `/api/people/columns/${id}`, {
        name,
        type: "note",
        visibility,
      });
    expect((await change("confidential")).statusCode).toBe(200);
    await test.approveLists();
    const refused = await change("general");
    expect(refused.statusCode).toBe(400);
    expect(refusal(refused)).toBe(
      `${name} is already approved, so its class changes at once, not in a draft`,
    );
  });

  it("is not found for a column that does not exist", async () => {
    const response = await move(
      "/api/columns/00000000-0000-4000-8000-000000000000/class",
      "personal",
    );
    expect(response.statusCode).toBe(404);
  });
});
