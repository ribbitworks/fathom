// SPDX-License-Identifier: Apache-2.0

// Integration tests for the data classes of lists and columns with a class of their own, against a
// PostgreSQL server of their own: who may move them, the access history, and their moves in the
// change history and their drafts.

import { accessHistory, fields, lists, users } from "@fathom/db";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { errorOf, unique } from "./test-app.ts";
import {
  test,
  classifier,
  seesBoth,
  move,
  latestMove,
  clearDataClasses,
  startDataClassTests,
  closeDataClassTests,
} from "./test-data-classes.ts";

beforeAll(startDataClassTests);

afterAll(closeDataClassTests);

afterEach(clearDataClasses);

// The moves recorded of one list or column, by whoever made them, as the access history names it.
async function movesOf(moved: string) {
  const entries = await test.connection
    .select({ actorId: accessHistory.actorId, details: accessHistory.details })
    .from(accessHistory)
    .where(eq(accessHistory.action, "data-class-moved"));
  return entries.filter(
    ({ details }) => (details as { moved?: unknown }).moved === moved,
  );
}

// The account test.approveLists approves as.
async function listApproverId() {
  const [approver] = await test.connection
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "list.approver@example.test"));
  return approver?.id;
}

// A list only drafted to be added, by the classifier, in the class given.
async function addedList(visibility = "general") {
  const name = unique("Fictional lockers");
  const created = await test.request(classifier.cookie, "POST", "/api/lists", {
    name,
    visibility,
  });
  return { id: created.json<{ list: { id: string } }>().list.id, name };
}

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
    expect(errorOf(response)).toBe(
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
    expect(errorOf(response)).toBe("This role can't see Confidential data");
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
    expect(errorOf(response)).toMatch(
      /is already approved, so its class changes at once, not in a draft$/,
    );
  });

  it("starts other than General only with Classify data, recorded as a move once approved", async () => {
    // Given
    const editor = await test.signedIn([...seesBoth, "configuration:edit"]);
    const name = unique("Fictional badges");
    const refused = await test.request(editor.cookie, "POST", "/api/lists", {
      name,
      visibility: "personal",
    });
    expect(refused.statusCode).toBe(403);
    // When
    const created = await test.request(
      classifier.cookie,
      "POST",
      "/api/lists",
      { name, visibility: "personal" },
    );
    // Then
    expect(created.statusCode).toBe(201);
    expect(await movesOf(`the ${name} list`)).toEqual([]);
    await test.approveLists();
    expect(await movesOf(`the ${name} list`)).toEqual([
      {
        actorId: await listApproverId(),
        details: {
          moved: `the ${name} list`,
          dataClass: "personal",
          previousDataClass: "general",
        },
      },
    ]);
  });

  it("is changed in the draft of a list only drafted to be added", async () => {
    // Given
    const name = unique("Fictional lockers");
    const created = await test.request(
      classifier.cookie,
      "POST",
      "/api/lists",
      { name, visibility: "general" },
    );
    const id = created.json<{ list: { id: string } }>().list.id;
    // When
    const response = await move(`/api/lists/${id}/class`, "confidential");
    // Then
    expect(response.statusCode).toBe(200);
    expect(
      response.json<{ changeSetId: string | null }>().changeSetId,
    ).not.toBe(null);
    const live = await test.connection
      .select()
      .from(lists)
      .where(eq(lists.id, id));
    expect(live).toEqual([]);
    const read = await test.request(classifier.cookie, "GET", "/api/lists");
    expect(
      read
        .json<{ lists: { id: string; visibility: string }[] }>()
        .lists.find((list) => list.id === id)?.visibility,
    ).toBe("confidential");
    expect(await movesOf(`the ${name} list`)).toEqual([]);
    await test.approveLists();
    const [approved] = await test.connection
      .select()
      .from(lists)
      .where(eq(lists.id, id));
    expect(approved?.visibility).toBe("confidential");
    expect(await movesOf(`the ${name} list`)).toHaveLength(1);
  });

  it("records no move for a draft discarded before approval", async () => {
    const { id, name } = await addedList("personal");
    await test.request(classifier.cookie, "DELETE", `/api/lists/${id}/draft`);
    expect(await movesOf(`the ${name} list`)).toEqual([]);
  });

  it("is not changed in a draft by a classifier who doesn't change configuration", async () => {
    const { id } = await addedList();
    const classifierOnly = await test.signedIn([
      ...seesBoth,
      "configuration:view",
      "data:classify",
    ]);
    const response = await move(
      `/api/lists/${id}/class`,
      "personal",
      classifierOnly.cookie,
    );
    expect(response.statusCode).toBe(403);
  });

  it("is not changed in a draft to a class the classifier can't see", async () => {
    const { id } = await addedList();
    const personalOnly = await test.signedIn([
      "people:view",
      "personal:view",
      "configuration:view",
      "configuration:edit",
      "data:classify",
    ]);
    const response = await move(
      `/api/lists/${id}/class`,
      "confidential",
      personalOnly.cookie,
    );
    expect(response.statusCode).toBe(403);
  });

  it("is not changed in a draft someone else is changing", async () => {
    const { id } = await addedList();
    const other = await test.signedIn("workforce-administrator");
    await test.request(
      other.cookie,
      "PUT",
      `/api/lists/${id}`,
      { name: unique("Fictional held"), visibility: "general" },
      { publish: false },
    );
    const response = await move(`/api/lists/${id}/class`, "personal");
    await test.request(other.cookie, "POST", "/api/unpublished/discard");
    expect(response.statusCode).toBe(409);
  });

  it("is not put back above General by undoing once a column on Features draws on it", async () => {
    // Given
    const { id } = await addedList();
    await move(`/api/lists/${id}/class`, "personal");
    const { changeSetId } = (
      await move(`/api/lists/${id}/class`, "general")
    ).json<{ changeSetId: string }>();
    await test.request(classifier.cookie, "POST", "/api/features/columns", {
      name: unique("Fictional feature column"),
      listId: id,
    });
    // When
    const response = await test.request(
      classifier.cookie,
      "POST",
      `/api/undo/${changeSetId}`,
    );
    // Then
    expect(response.statusCode).toBe(409);
  });

  it("records no move for a list approved as General", async () => {
    const name = unique("Fictional benches");
    await test.request(classifier.cookie, "POST", "/api/lists", {
      name,
      visibility: "general",
    });
    await test.approveLists();
    expect(await movesOf(`the ${name} list`)).toEqual([]);
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
    expect(errorOf(response)).toBe(
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
    expect(errorOf(response)).toBe(
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
    expect(errorOf(refused)).toBe(
      `${name} is already approved, so its class changes at once, not in a draft`,
    );
  });

  it("is changed in the draft of a column only drafted to be added, and recorded once approved", async () => {
    // Given
    const name = unique("Fictional portfolio");
    const created = await test.request(
      classifier.cookie,
      "POST",
      "/api/people/columns",
      { name, type: "link", visibility: "general" },
    );
    const id = created.json<{ field: { id: string } }>().field.id;
    // When
    const response = await move(`/api/columns/${id}/class`, "confidential");
    // Then
    expect(response.statusCode).toBe(200);
    const live = await test.connection
      .select()
      .from(fields)
      .where(eq(fields.id, id));
    expect(live).toEqual([]);
    expect(await movesOf(`the ${name} column`)).toEqual([]);
    expect(await test.historyOf(id)).toContainEqual(
      expect.objectContaining({
        field: "visibility",
        oldValue: "general",
        newValue: "confidential",
      }),
    );
    await test.approveLists();
    const [approved] = await test.connection
      .select()
      .from(fields)
      .where(eq(fields.id, id));
    expect(approved?.visibility).toBe("confidential");
    expect(await movesOf(`the ${name} column`)).toEqual([
      {
        actorId: await listApproverId(),
        details: {
          moved: `the ${name} column`,
          dataClass: "confidential",
          previousDataClass: "general",
        },
      },
    ]);
  });

  it("is undone in the draft of a column only drafted to be added", async () => {
    const created = await test.request(
      classifier.cookie,
      "POST",
      "/api/people/columns",
      {
        name: unique("Fictional portfolio"),
        type: "link",
        visibility: "general",
      },
    );
    const id = created.json<{ field: { id: string } }>().field.id;
    const { changeSetId } = (
      await move(`/api/columns/${id}/class`, "personal")
    ).json<{ changeSetId: string }>();
    const response = await test.request(
      classifier.cookie,
      "POST",
      `/api/undo/${changeSetId}`,
    );
    expect(response.statusCode).toBe(200);
    expect(await test.historyOf(id)).toContainEqual(
      expect.objectContaining({
        field: "visibility",
        oldValue: "personal",
        newValue: "general",
      }),
    );
  });

  it("is not changed in a draft by a classifier who doesn't change configuration", async () => {
    const created = await test.request(
      classifier.cookie,
      "POST",
      "/api/people/columns",
      {
        name: unique("Fictional portfolio"),
        type: "link",
        visibility: "general",
      },
    );
    const id = created.json<{ field: { id: string } }>().field.id;
    const classifierOnly = await test.signedIn([
      ...seesBoth,
      "configuration:view",
      "data:classify",
    ]);
    const response = await move(
      `/api/columns/${id}/class`,
      "personal",
      classifierOnly.cookie,
    );
    expect(response.statusCode).toBe(403);
  });

  it("stays General in the draft of a column on Features", async () => {
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
    const response = await move(`/api/columns/${id}/class`, "personal");
    expect(response.statusCode).toBe(400);
  });

  it("is its list's for a column only drafted to be added that draws on one", async () => {
    const listId = await liveList();
    const created = await test.request(
      classifier.cookie,
      "POST",
      "/api/people/columns",
      { name: unique("Fictional choice column"), listId },
    );
    const id = created.json<{ field: { id: string } }>().field.id;
    const response = await move(`/api/columns/${id}/class`, "personal");
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe(
      "This column takes its list's class, so change the list's class instead",
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
