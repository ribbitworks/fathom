// SPDX-License-Identifier: Apache-2.0

// Tests that a column's draft, and a new list made with one, is decided in its table's own area,
// against a PostgreSQL server of their own, while a list made on Lists stays with Approve
// Configuration.

import { changeSets, fields, lists } from "@fathom/db";
import type { Field } from "@fathom/shared";
import { and, desc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorOf, unique } from "./test-app.ts";
import {
  configurationApprover,
  type DeciderTests,
  featuresApprover,
  peopleApprover,
  startDeciderTests,
} from "./test-column-deciders.ts";

let deciders: DeciderTests;

beforeAll(async () => {
  deciders = await startDeciderTests();
});

afterAll(async () => {
  await deciders.test.close();
});

const draftedColumn: DeciderTests["draftedColumn"] = (table) =>
  deciders.draftedColumn(table);
const columnWithNewList = () => deciders.columnWithNewList();
const listMadeOnLists = () => deciders.listMadeOnLists();
const listOf: DeciderTests["listOf"] = (id) => deciders.listOf(id);
const decide: DeciderTests["decide"] = (permissions, asking, body) =>
  deciders.decide(permissions, asking, body);
const isLive: DeciderTests["isLive"] = (table, id) =>
  deciders.isLive(table, id);

describe("a column's draft", () => {
  it("on Features is approved with Approve Features", async () => {
    const column = await draftedColumn("features");

    const approved = await decide(featuresApprover, "approval", {
      columns: [column.id],
    });

    expect(approved.statusCode, approved.body).toBe(200);
    expect(await isLive(fields, column.id)).toBe(true);
  });

  it.each(["approval", "rejection"] as const)(
    "on Features is refused %s with Approve Configuration alone",
    async (asking) => {
      const column = await draftedColumn("features");

      const refused = await decide(configurationApprover, asking, {
        columns: [column.id],
      });

      expect(refused.statusCode).toBe(403);
      expect(errorOf(refused)).toBe(
        `This role can't ${asking === "approval" ? "approve" : "reject"} drafts of features and releases`,
      );
      expect(await isLive(fields, column.id)).toBe(false);
    },
  );

  it("on Features is refused to Approve Features without View People", async () => {
    const column = await draftedColumn("features");

    const refused = await decide(
      ["features:approve", "features:view"],
      "approval",
      {
        columns: [column.id],
      },
    );

    expect(refused.statusCode).toBe(403);
    expect(await isLive(fields, column.id)).toBe(false);
  });

  it("on Activities is approved with Approve Features", async () => {
    const column = await draftedColumn("activities");

    const approved = await decide(featuresApprover, "approval", {
      columns: [column.id],
    });

    expect(approved.statusCode, approved.body).toBe(200);
    expect(await isLive(fields, column.id)).toBe(true);
  });

  it("on People is approved with Approve People, and refused with Approve Configuration", async () => {
    const column = await draftedColumn("people");

    const refused = await decide(configurationApprover, "approval", {
      columns: [column.id],
    });
    const approved = await decide(peopleApprover, "approval", {
      columns: [column.id],
    });

    expect(refused.statusCode).toBe(403);
    expect(errorOf(refused)).toBe("This role can't approve drafts of people");
    expect(approved.statusCode, approved.body).toBe(200);
    expect(await isLive(fields, column.id)).toBe(true);
  });

  it("names its table, and a list made with it its column's table, to those who read them", async () => {
    const column = await columnWithNewList();

    const list = await listOf(String(column.listId));

    expect(column.table).toBe("features");
    expect(list?.draft?.madeWith).toBe("features");
    expect(list?.choices.map(({ draft }) => draft?.madeWith)).toEqual([
      "features",
    ]);
  });
});

describe("a new list made with a column on Features", () => {
  it("is approved alone with Approve Features", async () => {
    const column = await columnWithNewList();
    const listId = String(column.listId);

    const approved = await decide(featuresApprover, "approval", {
      lists: [listId],
    });

    expect(approved.statusCode, approved.body).toBe(200);
    expect(await isLive(lists, listId)).toBe(true);
  });

  it("is refused with Approve Configuration alone", async () => {
    const column = await columnWithNewList();
    const listId = String(column.listId);

    const refused = await decide(configurationApprover, "approval", {
      lists: [listId],
    });

    expect(refused.statusCode).toBe(403);
    expect(errorOf(refused)).toBe(
      "This role can't approve drafts of features and releases",
    );
    expect(await isLive(lists, listId)).toBe(false);
  });

  it("is approved with its column by Approve Features", async () => {
    const column = await columnWithNewList();

    const approved = await decide(featuresApprover, "approval", {
      columns: [column.id],
    });

    expect(approved.statusCode, approved.body).toBe(200);
    expect(await isLive(lists, String(column.listId))).toBe(true);
  });
});

describe("a list made with a column, changed or added to on Lists", () => {
  it("is rejected, with its choices and its column, by Approve Features", async () => {
    const column = await columnWithNewList();
    const listId = String(column.listId);
    const list = await listOf(listId);

    const rejected = await decide(featuresApprover, "rejection", {
      columns: [column.id],
      lists: [listId],
      choices: list?.choices.map(({ id }) => id) ?? [],
    });

    expect(rejected.statusCode, rejected.body).toBe(200);
  });

  it("decides a choice added on Lists as its list is decided", async () => {
    const column = await columnWithNewList();
    const added = await deciders.test.request(
      deciders.peopleEditor.cookie,
      "POST",
      `/api/lists/${String(column.listId)}/choices`,
      { choices: [{ label: unique("Fictional Bronze") }] },
    );
    expect(added.statusCode, added.body).toBe(201);
    const [choice] = added.json<{ choices: { id: string }[] }>().choices;

    const refused = await decide(configurationApprover, "approval", {
      choices: [String(choice?.id)],
    });
    const approved = await decide(featuresApprover, "approval", {
      choices: [String(choice?.id)],
    });

    expect(refused.statusCode).toBe(403);
    expect(errorOf(refused)).toBe(
      "This role can't approve drafts of features and releases",
    );
    expect(approved.statusCode, approved.body).toBe(200);
  });

  it("decides a rename on Lists while it is a draft as its column is decided", async () => {
    const column = await columnWithNewList();
    const listId = String(column.listId);
    const renamed = await deciders.test.request(
      deciders.peopleEditor.cookie,
      "PUT",
      `/api/lists/${listId}`,
      {
        name: unique("Fictional Grades"),
        description: "",
        visibility: "general",
      },
    );
    expect(renamed.statusCode, renamed.body).toBe(200);

    const refused = await decide(configurationApprover, "approval", {
      lists: [listId],
    });
    const approved = await decide(featuresApprover, "approval", {
      lists: [listId],
    });

    expect(refused.statusCode).toBe(403);
    expect(approved.statusCode, approved.body).toBe(200);
  });
});

describe("a list made on Lists", () => {
  it("stays with Approve Configuration after it and a Features column are discarded together, and the discard undone", async () => {
    // Given, unpublished, a Features column and, apart from it, a list made on Lists, by one who
    // edits both
    const editor = await deciders.test.signedIn([
      "features:edit",
      "features:view",
      "configuration:edit",
      "configuration:view",
      "people:view",
    ]);
    const later = { publish: false };
    const list = await deciders.test.request(
      editor.cookie,
      "POST",
      "/api/lists",
      { name: unique("Fictional Regions"), visibility: "general" },
      later,
    );
    const listId = list.json<{ list: { id: string } }>().list.id;
    const column = await deciders.test.request(
      editor.cookie,
      "POST",
      "/api/features/columns",
      { name: unique("Fictional Region"), type: "choice", listId },
      later,
    );
    expect(column.statusCode, column.body).toBe(201);

    // When both are discarded at once, the discard undone, and both published
    const discarded = await deciders.test.request(
      editor.cookie,
      "POST",
      "/api/unpublished/discard",
    );
    expect(discarded.statusCode, discarded.body).toBe(200);
    const [discard] = await deciders.test.connection
      .select({ id: changeSets.id })
      .from(changeSets)
      .where(and(eq(changeSets.madeBy, editor.id)))
      .orderBy(desc(changeSets.madeAt))
      .limit(1);
    const undone = await deciders.test.request(
      editor.cookie,
      "POST",
      `/api/undo/${String(discard?.id)}`,
    );
    expect(undone.statusCode, undone.body).toBe(200);
    const published = await deciders.test.request(
      editor.cookie,
      "POST",
      "/api/unpublished/publish",
    );
    expect(published.statusCode, published.body).toBe(200);

    // Then the list is still decided with Approve Configuration
    const refused = await decide(featuresApprover, "approval", {
      lists: [listId],
    });
    expect(refused.statusCode).toBe(403);
    expect(errorOf(refused)).toBe(
      "This role can't approve drafts of configuration",
    );
  });

  it("stays with Approve Configuration once approved with a column, when changed again", async () => {
    // Given a list made on Lists, approved together with a Features column drawing on it
    const listId = await listMadeOnLists();
    const column = (
      await deciders.test.request(
        deciders.featureEditor.cookie,
        "POST",
        "/api/features/columns",
        {
          name: unique("Fictional Site"),
          type: "choice",
          listId,
        },
      )
    ).json<{ field: Field }>().field;
    const both = await decide("project-manager", "approval", {
      columns: [column.id],
      lists: [listId],
    });
    expect(both.statusCode, both.body).toBe(200);

    // When the list is renamed on Lists
    const renamed = await deciders.test.request(
      deciders.peopleEditor.cookie,
      "PUT",
      `/api/lists/${listId}`,
      {
        name: unique("Fictional Places"),
        description: "",
        visibility: "general",
      },
    );
    expect(renamed.statusCode, renamed.body).toBe(200);

    // Then Approve Configuration decides the rename, and Approve Features doesn't
    const refused = await decide(featuresApprover, "approval", {
      lists: [listId],
    });
    const approved = await decide(configurationApprover, "approval", {
      lists: [listId],
    });
    expect(refused.statusCode).toBe(403);
    expect(approved.statusCode, approved.body).toBe(200);
  });

  it("is approved with Approve Configuration, and refused with Approve Features", async () => {
    const listId = await listMadeOnLists();

    const refused = await decide(featuresApprover, "approval", {
      lists: [listId],
    });
    const approved = await decide(configurationApprover, "approval", {
      lists: [listId],
    });

    expect(refused.statusCode).toBe(403);
    expect(errorOf(refused)).toBe(
      "This role can't approve drafts of configuration",
    );
    expect(approved.statusCode, approved.body).toBe(200);
  });

  it("refuses approving a Features column that draws on it with Approve Features alone, naming the list", async () => {
    const listId = await listMadeOnLists();
    const name = (await listOf(listId))?.name;
    const response = await deciders.test.request(
      deciders.featureEditor.cookie,
      "POST",
      "/api/features/columns",
      { name: unique("Fictional Site"), type: "choice", listId },
    );
    const column = response.json<{ field: Field }>().field;

    const refused = await decide(featuresApprover, "approval", {
      columns: [column.id],
    });

    expect(refused.statusCode).toBe(403);
    expect(errorOf(refused)).toBe(
      `Approving this also approves the new list ${String(name)}, which needs Approve Configuration.`,
    );
    expect(await isLive(fields, column.id)).toBe(false);
  });
});
