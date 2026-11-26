// SPDX-License-Identifier: Apache-2.0

// Tests for a new list drafted with a column on Features, against a PostgreSQL server of their own:
// who drafts one, approving the list with the column, undoing and discarding them together, and
// People's columns, whose lists are made on Lists.

import {
  changeSets,
  drafts,
  fields,
  listItems,
  lists,
  privateChanges,
} from "@fathom/db";
import type { Field, Role } from "@fathom/shared";
import { startingRoles } from "@fathom/shared";
import { desc, eq } from "drizzle-orm";
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

const tiers = ["Fictional Gold", "Fictional Silver"];
const tierChoices = [
  { label: "Fictional Gold", description: "The top fictional tier" },
  { label: "Fictional Silver" },
];

const addColumn = (
  cookie: string,
  more: object = {},
  options?: { publish: boolean },
) =>
  test.request(
    cookie,
    "POST",
    "/api/features/columns",
    {
      name: unique("Fictional Tier"),
      type: "choice",
      newList: { name: unique("Fictional Tiers"), choices: tierChoices },
      ...more,
    },
    options,
  );

// The column added, with the change set that added it.
async function addedColumn(options?: { publish: boolean }) {
  const response = await addColumn(planner.cookie, {}, options);
  expect(response.statusCode, response.body).toBe(201);
  return response.json<{ field: Field; changeSetId: string }>();
}

// The drafts, published or the maker's own, of one kind.
const draftsOf = async (
  recordType: string,
  table: typeof drafts | typeof privateChanges = drafts,
) =>
  test.connection
    .select({ recordId: table.recordId, fields: table.fields })
    .from(table)
    .where(eq(table.recordType, recordType));

const listDraftOf = async (
  listId: string,
  table: typeof drafts | typeof privateChanges = drafts,
) =>
  (await draftsOf("list", table)).find(({ recordId }) => recordId === listId);

const choiceDraftsOf = async (
  listId: string,
  table: typeof drafts | typeof privateChanges = drafts,
) =>
  (await draftsOf("list-item", table)).filter(
    ({ fields: choice }) => (choice as { listId?: string }).listId === listId,
  );

describe("a new list drafted with a column on Features", () => {
  it("is drafted General with its choices, in order, with their descriptions, and the column draws on it", async () => {
    const { field } = await addedColumn();

    const listId = String(field.listId);
    expect(await listDraftOf(listId)).toMatchObject({
      fields: { visibility: "general", retired: false },
    });
    expect(
      (await choiceDraftsOf(listId)).map(({ fields: choice }) => {
        const { label, description } = choice as {
          label: string;
          description: string;
        };
        return [label, description];
      }),
    ).toEqual([
      ["Fictional Gold", "The top fictional tier"],
      ["Fictional Silver", ""],
    ]);
  });

  it("is approved with the column, with its choices", async () => {
    // Given a column drafted with a new list
    const { field } = await addedColumn();
    const listId = String(field.listId);

    // When an approver approves the column alone
    const approved = await test.request(
      approver.cookie,
      "POST",
      "/api/drafts/approval",
      { columns: [field.id] },
    );

    // Then the list and its choices are live with it
    expect(approved.statusCode, approved.body).toBe(200);
    expect(
      await test.connection
        .select()
        .from(fields)
        .where(eq(fields.id, field.id)),
    ).toHaveLength(1);
    expect(
      await test.connection.select().from(lists).where(eq(lists.id, listId)),
    ).toHaveLength(1);
    expect(
      (
        await test.connection
          .select({ label: listItems.label })
          .from(listItems)
          .where(eq(listItems.listId, listId))
      ).map(({ label }) => label),
    ).toEqual(tiers);
  });

  it("is taken back with the column by undoing the change that added them", async () => {
    // Given a column with a new list its maker hasn't published
    const { field, changeSetId } = await addedColumn({ publish: false });
    const listId = String(field.listId);

    // When the maker, who doesn't change configuration, undoes adding it
    const undone = await test.request(
      planner.cookie,
      "POST",
      `/api/undo/${changeSetId}`,
    );

    // Then the column, the list and its choices are all gone
    expect(undone.statusCode, undone.body).toBe(200);
    expect(await listDraftOf(listId, privateChanges)).toBeUndefined();
    expect(await choiceDraftsOf(listId, privateChanges)).toEqual([]);
    expect(
      (await draftsOf("field", privateChanges)).map(({ recordId }) => recordId),
    ).not.toContain(field.id);
  });

  it("is discarded with the column's draft", async () => {
    const { field } = await addedColumn();
    const listId = String(field.listId);

    const discarded = await test.request(
      planner.cookie,
      "DELETE",
      `/api/features/columns/${field.id}/draft`,
    );

    expect(discarded.statusCode, discarded.body).toBe(200);
    expect(await listDraftOf(listId)).toBeUndefined();
    expect(await choiceDraftsOf(listId)).toEqual([]);
  });

  it("is taken back with the column by undoing the change that added them, once published", async () => {
    const { field, changeSetId } = await addedColumn();
    const listId = String(field.listId);

    const undone = await test.request(
      planner.cookie,
      "POST",
      `/api/undo/${changeSetId}`,
    );

    expect(undone.statusCode, undone.body).toBe(200);
    expect(await listDraftOf(listId)).toBeUndefined();
    expect(await choiceDraftsOf(listId)).toEqual([]);
  });

  it("comes back with the column when discarding them is undone", async () => {
    // Given a column with a new list, discarded
    const { field } = await addedColumn();
    const listId = String(field.listId);
    const discarded = await test.request(
      planner.cookie,
      "DELETE",
      `/api/features/columns/${field.id}/draft`,
    );
    const { changeSetId } = discarded.json<{ changeSetId: string }>();

    // When the maker, who doesn't change configuration, undoes discarding them
    const undone = await test.request(
      planner.cookie,
      "POST",
      `/api/undo/${changeSetId}`,
    );

    // Then the column, the list and its choices are drafts again, published or the maker's own
    expect(undone.statusCode, undone.body).toBe(200);
    expect(
      [
        ...(await draftsOf("field")),
        ...(await draftsOf("field", privateChanges)),
      ].map(({ recordId }) => recordId),
    ).toContain(field.id);
    expect(
      (await listDraftOf(listId)) ??
        (await listDraftOf(listId, privateChanges)),
    ).toBeDefined();
    expect(
      [
        ...(await choiceDraftsOf(listId)),
        ...(await choiceDraftsOf(listId, privateChanges)),
      ]
        .map(({ fields: choice }) => (choice as { label: string }).label)
        .sort(),
    ).toEqual([...tiers].sort());
  });

  it("isn't brought back, by undoing its discarding, for one who no longer sees its class", async () => {
    // Given a Personal list drafted on Lists and discarded by its maker, who then no longer sees
    // Personal details
    const maker = await test.signedIn("workforce-administrator");
    const list = await test.request(maker.cookie, "POST", "/api/lists", {
      name: unique("Fictional Secrets"),
      visibility: "personal",
    });
    const listId = list.json<{ list: { id: string } }>().list.id;
    const discarded = await test.request(
      maker.cookie,
      "DELETE",
      `/api/lists/${listId}/draft`,
    );
    expect(discarded.statusCode, discarded.body).toBe(200);
    const { changeSetId } = discarded.json<{ changeSetId: string }>();
    await test.holdOnly(maker.id, ["configuration:edit", "people:view"]);

    // When they undo discarding it
    const undone = await test.request(
      maker.cookie,
      "POST",
      `/api/undo/${changeSetId}`,
    );

    // Then it is refused, naming the list, and the list stays discarded
    expect(undone.statusCode).toBe(403);
    expect(errorOf(undone)).toContain("Fictional Secrets");
    expect(await listDraftOf(listId)).toBeUndefined();
  });

  it("lets only a configuration editor undo discarding a list made on Lists with a column on it", async () => {
    // Given a list drafted on Lists and a column drawing on it, both unpublished, discarded
    // together, by a maker who then no longer changes configuration
    const maker = await test.signedIn([
      "plan:view",
      "features:edit",
      "people:view",
      "configuration:edit",
    ]);
    const list = await test.request(
      maker.cookie,
      "POST",
      "/api/lists",
      { name: unique("Fictional Grades"), visibility: "general" },
      { publish: false },
    );
    const listId = list.json<{ list: { id: string } }>().list.id;
    await test.request(
      maker.cookie,
      "POST",
      "/api/features/columns",
      { name: unique("Fictional Grade"), type: "choice", listId },
      { publish: false },
    );
    await test.request(maker.cookie, "POST", "/api/unpublished/discard", {});
    const [discard] = await test.connection
      .select({ id: changeSets.id })
      .from(changeSets)
      .where(eq(changeSets.madeBy, maker.id))
      .orderBy(desc(changeSets.madeAt))
      .limit(1);
    await test.holdOnly(maker.id, [
      "plan:view",
      "features:edit",
      "people:view",
    ]);

    // When they undo discarding them
    const undone = await test.request(
      maker.cookie,
      "POST",
      `/api/undo/${String(discard?.id)}`,
    );

    // Then it is refused, since the list wasn't made with the column
    expect(undone.statusCode).toBe(403);
  });

  it("is discarded with a column only drafted to be added when the column is removed", async () => {
    const { field } = await addedColumn();
    const listId = String(field.listId);

    const removed = await test.request(
      planner.cookie,
      "DELETE",
      `/api/features/columns/${field.id}`,
    );

    expect(removed.statusCode, removed.body).toBe(200);
    expect(await listDraftOf(listId)).toBeUndefined();
  });

  it("stays when someone changed it since, such as by adding a choice", async () => {
    // Given a column with a new list, and a choice added to the list on Lists since
    const { field } = await addedColumn();
    const listId = String(field.listId);
    const configurer = await test.signedIn("workforce-administrator");
    const added = await test.request(
      configurer.cookie,
      "POST",
      `/api/lists/${listId}/choices`,
      { choices: [{ label: "Fictional Bronze" }] },
    );
    expect(added.statusCode, added.body).toBe(201);

    // When the column's draft is discarded
    await test.request(
      planner.cookie,
      "DELETE",
      `/api/features/columns/${field.id}/draft`,
    );

    // Then the list stays, with every choice
    expect(await listDraftOf(listId)).toBeDefined();
    expect(await choiceDraftsOf(listId)).toHaveLength(tiers.length + 1);
  });

  it("is discarded with the column while only someone else is adding a choice to it, unpublished", async () => {
    const { field } = await addedColumn();
    const listId = String(field.listId);
    const configurer = await test.signedIn("workforce-administrator");
    await test.request(
      configurer.cookie,
      "POST",
      `/api/lists/${listId}/choices`,
      { choices: [{ label: "Fictional Bronze" }] },
      { publish: false },
    );

    await test.request(
      planner.cookie,
      "DELETE",
      `/api/features/columns/${field.id}/draft`,
    );

    expect(await listDraftOf(listId)).toBeUndefined();
    await test.request(configurer.cookie, "POST", "/api/unpublished/discard");
  });

  it("stays when the column's draft is discarded while another column draws on it", async () => {
    // Given a column with a new list, and a second column drawing on the same new list
    const { field } = await addedColumn();
    const listId = String(field.listId);
    const second = await test.request(
      planner.cookie,
      "POST",
      "/api/features/columns",
      { name: unique("Fictional Grade"), type: "choice", listId },
    );
    expect(second.statusCode, second.body).toBe(201);

    // When the first column's draft is discarded
    await test.request(
      planner.cookie,
      "DELETE",
      `/api/features/columns/${field.id}/draft`,
    );

    // Then the list stays for the second
    expect(await listDraftOf(listId)).toBeDefined();
  });

  it("is discarded with the last column drawing on it, once the column it was made with is gone", async () => {
    // Given a column with a new list, a second column drawing on it, and the first column removed
    const { field } = await addedColumn();
    const listId = String(field.listId);
    const second = await test.request(
      planner.cookie,
      "POST",
      "/api/features/columns",
      { name: unique("Fictional Grade"), type: "choice", listId },
    );
    const secondId = second.json<{ field: Field }>().field.id;
    await test.request(
      planner.cookie,
      "DELETE",
      `/api/features/columns/${field.id}`,
    );
    expect(await listDraftOf(listId)).toBeDefined();

    // When the second column is removed too
    const removed = await test.request(
      planner.cookie,
      "DELETE",
      `/api/features/columns/${secondId}`,
    );

    // Then the list and its choices go with it, leaving nothing used by no column
    expect(removed.statusCode, removed.body).toBe(200);
    expect(await listDraftOf(listId)).toBeUndefined();
    expect(await choiceDraftsOf(listId)).toHaveLength(0);
  });

  it("isn't discarded with a People column drawing on it, which makes no lists", async () => {
    // Given a Features column with a new list, a People column drawing on the list, and the Features
    // column removed
    const { field } = await addedColumn();
    const listId = String(field.listId);
    const peopleEditor = await test.signedIn("workforce-administrator");
    const onPeople = await test.request(
      peopleEditor.cookie,
      "POST",
      "/api/people/columns",
      { name: unique("Fictional Grade"), type: "choice", listId },
    );
    expect(onPeople.statusCode, onPeople.body).toBe(201);
    await test.request(
      planner.cookie,
      "DELETE",
      `/api/features/columns/${field.id}`,
    );

    // When the People column is removed
    const removed = await test.request(
      peopleEditor.cookie,
      "DELETE",
      `/api/people/columns/${onPeople.json<{ field: Field }>().field.id}`,
    );

    // Then the list stays, for those who change configuration to decide
    expect(removed.statusCode, removed.body).toBe(200);
    expect(await listDraftOf(listId)).toBeDefined();
  });

  it("isn't discarded with a column that only draws on it, drafted apart", async () => {
    // Given a list drafted on Lists, and a column drawing on it
    const configurer = await test.signedIn("workforce-administrator");
    const list = await test.request(configurer.cookie, "POST", "/api/lists", {
      name: unique("Fictional Levels"),
      visibility: "general",
    });
    expect(list.statusCode, list.body).toBe(201);
    const listId = list.json<{ list: { id: string } }>().list.id;
    const column = await test.request(
      planner.cookie,
      "POST",
      "/api/features/columns",
      { name: unique("Fictional Level"), type: "choice", listId },
    );
    const { field } = column.json<{ field: Field }>();

    // When the column's draft is discarded
    await test.request(
      planner.cookie,
      "DELETE",
      `/api/features/columns/${field.id}/draft`,
    );

    // Then the list stays
    expect(await listDraftOf(listId)).toBeDefined();
  });

  it("is refused a name another list has", async () => {
    const name = unique("Fictional Taken");
    const first = await addColumn(planner.cookie, {
      newList: { name, choices: tierChoices },
    });
    expect(first.statusCode, first.body).toBe(201);

    const refused = await addColumn(planner.cookie, {
      newList: { name, choices: tierChoices },
    });

    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe("There is already a list with that name");
  });

  it("isn't offered on People, whose lists are made on Lists", async () => {
    const configurer = await test.signedIn("workforce-administrator");
    const listName = unique("Fictional Tiers");
    const refused = await test.request(
      configurer.cookie,
      "POST",
      "/api/people/columns",
      {
        name: unique("Fictional Tier"),
        type: "choice",
        newList: { name: listName, choices: tierChoices },
      },
    );
    expect(refused.statusCode).toBe(400);
    expect(errorOf(refused)).toBe(
      "A list for this table's columns is made on Lists",
    );
    expect(
      (await draftsOf("list")).some(
        ({ fields: list }) => (list as { name: string }).name === listName,
      ),
    ).toBe(false);
  });
});

// The starting roles that set up Features' columns: those that edit features and see people.
const setsUpFeatures: Readonly<Record<Role, boolean>> = {
  "team-member": false,
  "product-manager": true,
  "feature-lead": true,
  "project-manager": true,
  "engineering-manager": true,
  "engineering-director": true,
  "workforce-administrator": false,
  executive: false,
  administrator: false,
};

describe("each starting role adding a column on Features with a new list", () => {
  it.each(Object.keys(startingRoles) as Role[])("%s", async (role) => {
    const signedIn = await test.signedIn(role);
    const listName = unique("Fictional Tiers");

    const response = await addColumn(signedIn.cookie, {
      newList: { name: listName, choices: tierChoices },
    });

    // eslint-disable-next-line security/detect-object-injection
    const allowed = setsUpFeatures[role];
    expect(response.statusCode, response.body).toBe(allowed ? 201 : 403);
    expect(
      (await draftsOf("list")).some(
        ({ fields: list }) => (list as { name: string }).name === listName,
      ),
    ).toBe(allowed);
  });
});
