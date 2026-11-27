// SPDX-License-Identifier: Apache-2.0

// Tests for saving a person's own pages, against a PostgreSQL server of their own: making, renaming,
// moving and removing a page, and adding, changing and removing its columns and rows.

import { accessHistory, columnOrders } from "@fathom/db";
import type { ListedPrivatePage, PrivatePage } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  errorOf,
  ok,
  startTestApp,
  type TestApp,
  type TestUser,
  unique,
} from "./test-app.ts";
import { listHelpers } from "./test-lists.ts";

let test: TestApp;
let maker: TestUser;

beforeAll(async () => {
  test = await startTestApp();
  maker = await test.signedIn("workforce-administrator");
});

afterAll(async () => {
  await test.close();
});

const lists = listHelpers(() => test);

interface SavedPage {
  page: PrivatePage;
  changeSetId: string | null;
}

const send = (
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  payload?: object,
) => test.request(maker.cookie, method, url, payload);

const numberColumn = (name: string) => ({
  name,
  type: "number",
  visibility: "general",
});

const noteColumn = (name: string, visibility = "general") => ({
  name,
  type: "note",
  visibility,
});

async function makePage(
  columns: object[] = [numberColumn("Number"), noteColumn("Note")],
  name = unique("Fictional Page"),
): Promise<SavedPage> {
  return ok<SavedPage>(
    await send("POST", "/api/private-pages", { name, columns }),
    201,
  );
}

const pageUrl = (page: PrivatePage) => `/api/private-pages/${page.id}`;

// The page's columns, by name.
const columnOf = (page: PrivatePage, name: string) =>
  page.columns.find((column) => column.name === name)?.id ?? "";

async function addRow(page: PrivatePage, body: object): Promise<SavedPage> {
  return ok<SavedPage>(await send("POST", `${pageUrl(page)}/rows`, body), 201);
}

// A live list with two choices, made and approved by the maker.
async function liveList() {
  const list = await lists.createList(maker.cookie);
  const choices = await lists.addChoices(maker.cookie, list.id, [
    "Calm",
    "Busy",
  ]);
  await test.approveLists();
  return { list, choices: choices.map(({ id }) => id) };
}

describe("making a page", () => {
  it("makes a page with its columns, the first naming each row, after the maker's others", async () => {
    // Given a page the maker has already made
    const first = (await makePage()).page;

    // When they make another
    const { page, changeSetId } = await makePage([
      numberColumn("Year"),
      noteColumn("Summary"),
      noteColumn("Detail", "personal"),
    ]);

    // Then it follows the first, its columns in the order asked for
    expect(page.position).toBe(first.position + 1);
    expect(page.columns.map(({ name }) => name)).toEqual([
      "Year",
      "Summary",
      "Detail",
    ]);
    expect(page.columns[2]).toMatchObject({
      type: "note",
      visibility: "personal",
      listId: null,
      multiple: false,
    });
    expect(page.firstFieldId).toBe(columnOf(page, "Year"));
    expect(page.rows).toEqual([]);
    expect(changeSetId).not.toBeNull();
    const listed = await ok<ListedPrivatePage[]>(
      await send("GET", "/api/private-pages"),
    );
    expect(listed.slice(-2)).toEqual([
      { id: first.id, name: first.name, position: first.position },
      { id: page.id, name: page.name, position: page.position },
    ]);
    expect(await ok<PrivatePage>(await send("GET", pageUrl(page)))).toEqual(
      page,
    );
    expect(await test.historyOf(page.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "name", newValue: page.name }),
      ]),
    );
    expect(await test.historyOf(columnOf(page, "Detail"))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "name",
          newValue: "Detail",
          tier: "personal",
        }),
      ]),
    );
  });

  it("refuses a name the maker already gave a page, ignoring letter case", async () => {
    const { page } = await makePage();
    const response = await send("POST", "/api/private-pages", {
      name: page.name.toUpperCase(),
      columns: [numberColumn("Number")],
    });
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe("Another page has that name");
  });

  it("refuses a column of a list that is not there, or a class the role does not see", async () => {
    const missing = await send("POST", "/api/private-pages", {
      name: unique("Fictional Page"),
      columns: [
        numberColumn("Number"),
        { name: "Mood", listId: "00000000-0000-4000-8000-000000000000" },
      ],
    });
    expect(missing.statusCode).toBe(400);
    expect(errorOf(missing)).toBe("There is no such list");
    const lead = await test.signedIn("feature-lead");
    const unseen = await test.request(
      lead.cookie,
      "POST",
      "/api/private-pages",
      {
        name: unique("Fictional Page"),
        columns: [numberColumn("Number"), noteColumn("Secret", "confidential")],
      },
    );
    expect(unseen.statusCode).toBe(403);
  });

  it("refuses a choice column on a list of a class the role does not see", async () => {
    const list = await lists.createList(maker.cookie, {
      visibility: "personal",
    });
    await lists.addChoices(maker.cookie, list.id, ["Calm"]);
    await test.approveLists();
    const lead = await test.signedIn("feature-lead");
    const response = await test.request(
      lead.cookie,
      "POST",
      "/api/private-pages",
      {
        name: unique("Fictional Page"),
        columns: [numberColumn("Number"), { name: "Mood", listId: list.id }],
      },
    );
    expect(response.statusCode).toBe(403);
    expect(errorOf(response)).toBe(
      "Choose a list, or a visibility, whose details this role can see",
    );
  });

  it("refuses a column of a retired list", async () => {
    const list = await lists.createList(maker.cookie);
    await lists.addChoices(maker.cookie, list.id, ["Calm"]);
    await test.approveLists();
    await send("PUT", `/api/lists/${list.id}/retired`, { retired: true });
    await test.approveLists();
    const response = await send("POST", "/api/private-pages", {
      name: unique("Fictional Page"),
      columns: [numberColumn("Number"), { name: "Mood", listId: list.id }],
    });
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe("Choose a list that is not retired");
  });
});

describe("a page's rows", () => {
  it("adds rows with their values, in the order added, and changes and removes their values", async () => {
    // Given a page with a number, a note and a choice column
    const { list, choices } = await liveList();
    const { page } = await makePage([
      numberColumn("Number"),
      noteColumn("Note"),
      { name: "Mood", listId: list.id, multiple: true },
    ]);
    const number = columnOf(page, "Number");
    const note = columnOf(page, "Note");
    const mood = columnOf(page, "Mood");

    // When two rows are added
    await addRow(page, { numbers: { [number]: 1 } });
    const added = (
      await addRow(page, {
        numbers: { [number]: 2 },
        notes: { [note]: "Second" },
        values: { [mood]: choices },
      })
    ).page;

    // Then each holds its values, in the order added
    expect(added.rows.map((row) => Object.values(row.numbers))).toEqual([
      [1],
      [2],
    ]);
    const second = added.rows[1];
    expect(second).toMatchObject({
      notes: { [note]: "Second" },
      values: { [mood]: choices },
      links: {},
    });

    // When the second row's note is removed and its number changed
    const { page: changed, changeSetId } = await ok<SavedPage>(
      await send("PATCH", `${pageUrl(page)}/rows/${String(second?.id)}`, {
        notes: { [note]: null },
        numbers: { [number]: 3 },
      }),
    );

    // Then only those change, and the change history holds both
    expect(changed.rows[1]).toMatchObject({
      numbers: { [number]: 3 },
      notes: {},
      values: { [mood]: choices },
    });
    expect(changeSetId).not.toBeNull();
    expect(
      (await test.historyOf(String(second?.id))).filter(
        ({ action }) => action === "changed",
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ oldValue: 2, newValue: 3 }),
        expect.objectContaining({ oldValue: "Second", newValue: null }),
      ]),
    );
  });

  it("refuses a row without its first column's value, and removing that value", async () => {
    const { page } = await makePage();
    const note = columnOf(page, "Note");
    const missing = await send("POST", `${pageUrl(page)}/rows`, {
      notes: { [note]: "No number" },
    });
    expect(missing.statusCode).toBe(400);
    expect(errorOf(missing)).toBe("Number must be filled in");
    const row = (
      await addRow(page, { numbers: { [columnOf(page, "Number")]: 7 } })
    ).page.rows[0];
    const cleared = await send(
      "PATCH",
      `${pageUrl(page)}/rows/${String(row?.id)}`,
      { numbers: { [columnOf(page, "Number")]: null } },
    );
    expect(cleared.statusCode).toBe(400);
    expect(errorOf(cleared)).toBe("Number must be filled in");
  });

  it("refuses a value in a column of another page", async () => {
    const { page } = await makePage();
    const other = (await makePage()).page;
    const response = await send("POST", `${pageUrl(page)}/rows`, {
      numbers: { [columnOf(other, "Number")]: 1 },
    });
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe("There is no such column");
  });

  it("removes a row with its values, and answers a row of another page as not there", async () => {
    const { page } = await makePage();
    const other = (await makePage()).page;
    const row = (
      await addRow(page, { numbers: { [columnOf(page, "Number")]: 4 } })
    ).page.rows[0];
    const elsewhere = await send(
      "DELETE",
      `${pageUrl(other)}/rows/${String(row?.id)}`,
    );
    expect(elsewhere.statusCode).toBe(404);
    expect(errorOf(elsewhere)).toBe("There is no such row");
    const { page: after } = await ok<SavedPage>(
      await send("DELETE", `${pageUrl(page)}/rows/${String(row?.id)}`),
    );
    expect(after.rows).toEqual([]);
    expect(await test.historyOf(String(row?.id))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "position", newValue: null }),
        expect.objectContaining({ oldValue: 4, newValue: null }),
      ]),
    );
  });
});

describe("renaming, moving and removing a page", () => {
  // A page of a new maker's, so their pages are only those the test makes.
  const makePageFor = async (as: TestUser) =>
    ok<SavedPage>(
      await test.request(as.cookie, "POST", "/api/private-pages", {
        name: unique("Fictional Page"),
        columns: [numberColumn("Number")],
      }),
      201,
    );

  it("renames a page, refusing a name another of the maker's pages has", async () => {
    const lead = await test.signedIn("feature-lead");
    const first = (await makePageFor(lead)).page;
    const { page } = await makePageFor(lead);
    const url = pageUrl(page);
    const taken = await test.request(lead.cookie, "PATCH", url, {
      name: first.name,
    });
    expect(taken.statusCode).toBe(409);
    const { page: renamed } = await ok<SavedPage>(
      await test.request(lead.cookie, "PATCH", url, { name: "Reading list" }),
    );
    expect(renamed.name).toBe("Reading list");
  });

  it("moves a page among the maker's pages, recording each page whose place changes", async () => {
    // Given three pages
    const lead = await test.signedIn("feature-lead");
    const made: PrivatePage[] = [];
    for (let index = 0; index < 3; index += 1) {
      made.push((await makePageFor(lead)).page);
    }
    const [first, second, third] = made as [
      PrivatePage,
      PrivatePage,
      PrivatePage,
    ];
    const move = async (page: PrivatePage, position: number) =>
      ok<{ changeSetId: string | null }>(
        await test.request(lead.cookie, "PUT", `${pageUrl(page)}/position`, {
          position,
        }),
      );
    const listed = async () =>
      (
        await ok<ListedPrivatePage[]>(
          await test.request(lead.cookie, "GET", "/api/private-pages"),
        )
      ).map(({ id, position }) => [id, position]);
    const placesRecorded = async (page: PrivatePage) =>
      (await test.historyOf(page.id))
        .filter(
          ({ field, action }) => field === "position" && action === "changed",
        )
        .map(({ oldValue, newValue }) => [oldValue, newValue]);

    // When the last moves first
    await move(third, 0);

    // Then every page's place changes, and is recorded
    expect(await listed()).toEqual([
      [third.id, 0],
      [first.id, 1],
      [second.id, 2],
    ]);
    expect(await placesRecorded(third)).toEqual([[2, 0]]);
    expect(await placesRecorded(first)).toEqual([[0, 1]]);
    expect(await placesRecorded(second)).toEqual([[1, 2]]);

    // And a place beyond the last is the last, and moving to where it is changes nothing
    await move(third, 10);
    expect((await move(third, 2)).changeSetId).toBeNull();
    expect(await listed()).toEqual([
      [first.id, 0],
      [second.id, 1],
      [third.id, 2],
    ]);
  });

  it("removes a page with its columns, rows and column order, recording each", async () => {
    const { page } = await makePage();
    const withRow = (
      await addRow(page, { numbers: { [String(page.firstFieldId)]: 9 } })
    ).page;
    const { changeSetId } = await ok<{ changeSetId: string | null }>(
      await send("DELETE", pageUrl(page)),
    );
    expect(changeSetId).not.toBeNull();
    expect((await send("GET", pageUrl(page))).statusCode).toBe(404);
    expect(
      await test.connection
        .select()
        .from(columnOrders)
        .where(eq(columnOrders.tableName, `private:${page.id}`)),
    ).toEqual([]);
    for (const id of [
      page.id,
      String(page.firstFieldId),
      String(withRow.rows[0]?.id),
    ]) {
      expect((await test.historyOf(id)).at(-1)?.action).toBe("deleted");
    }
  });
});

describe("a change's answers and refusals", () => {
  it("records the maker seeing Personal details, once a day, when a change answers with them", async () => {
    const lead = await test.signedIn("engineering-manager");
    const saved = await ok<SavedPage>(
      await test.request(lead.cookie, "POST", "/api/private-pages", {
        name: unique("Fictional Page"),
        columns: [numberColumn("Number"), noteColumn("Salary", "personal")],
      }),
      201,
    );
    await ok(
      await test.request(lead.cookie, "POST", `${pageUrl(saved.page)}/rows`, {
        numbers: { [String(saved.page.firstFieldId)]: 1 },
      }),
      201,
    );
    const views = await test.connection
      .select({ action: accessHistory.action })
      .from(accessHistory)
      .where(eq(accessHistory.actorId, lead.id));
    expect(
      views.filter(({ action }) => action === "personal-viewed"),
    ).toHaveLength(1);
  });

  it("refuses a new row, naming no column, once the maker's role no longer sees the first column", async () => {
    const lead = await test.signedIn("engineering-manager");
    const { page } = await ok<SavedPage>(
      await test.request(lead.cookie, "POST", "/api/private-pages", {
        name: unique("Fictional Page"),
        columns: [
          { ...numberColumn("Hidden count"), visibility: "personal" },
          numberColumn("Pages"),
        ],
      }),
      201,
    );
    await test.holdOnly(lead.id, ["private-pages:make"]);
    const response = await test.request(
      lead.cookie,
      "POST",
      `${pageUrl(page)}/rows`,
      { numbers: { [columnOf(page, "Pages")]: 1 } },
    );
    expect(response.statusCode).toBe(403);
    expect(errorOf(response)).toBe(
      "This page's first column is of a class your role can't see, so no row can be added",
    );
  });
});

describe("a page's columns", () => {
  it("adds a column after the others, changes it, and removes it with its values", async () => {
    // Given a page with a row
    const { page } = await makePage([numberColumn("Number")]);
    await addRow(page, { numbers: { [columnOf(page, "Number")]: 5 } });

    // When a column is added, renamed and given a value
    const added = (
      await ok<SavedPage>(
        await send("POST", `${pageUrl(page)}/columns`, numberColumn("Pages")),
        201,
      )
    ).page;
    const pages = columnOf(added, "Pages");
    const renamed = (
      await ok<SavedPage>(
        await send(
          "PUT",
          `${pageUrl(page)}/columns/${pages}`,
          numberColumn("Length"),
        ),
      )
    ).page;
    const row = renamed.rows[0];
    await send("PATCH", `${pageUrl(page)}/rows/${String(row?.id)}`, {
      numbers: { [pages]: 300 },
    });

    // Then it is after the first, under its new name
    expect(renamed.columns.map(({ name }) => name)).toEqual([
      "Number",
      "Length",
    ]);

    // When it is removed
    const { page: removed } = await ok<SavedPage>(
      await send("DELETE", `${pageUrl(page)}/columns/${pages}`),
    );

    // Then its values go with it, and the row's history says so
    expect(removed.columns.map(({ name }) => name)).toEqual(["Number"]);
    expect(removed.rows[0]?.numbers).toEqual({
      [columnOf(page, "Number")]: 5,
    });
    expect((await test.historyOf(String(row?.id))).at(-1)).toMatchObject({
      oldValue: 300,
      newValue: null,
    });
  });

  it("refuses a name another column on the page has, but not one on another page", async () => {
    const { page } = await makePage();
    const taken = await send(
      "POST",
      `${pageUrl(page)}/columns`,
      numberColumn("note"),
    );
    expect(taken.statusCode).toBe(409);
    expect(errorOf(taken)).toBe("There is already a column with that name");
    const other = (await makePage()).page;
    expect(
      (await send("POST", `${pageUrl(other)}/columns`, numberColumn("Pages")))
        .statusCode,
    ).toBe(201);
    expect(
      (await send("POST", `${pageUrl(page)}/columns`, numberColumn("Pages")))
        .statusCode,
    ).toBe(201);
  });

  it("refuses removing the first column, changing a type, and a column of another page", async () => {
    const { page } = await makePage();
    const other = (await makePage()).page;
    const first = await send(
      "DELETE",
      `${pageUrl(page)}/columns/${String(page.firstFieldId)}`,
    );
    expect(first.statusCode).toBe(409);
    expect(errorOf(first)).toBe(
      "The first column names each row, so it can't be removed",
    );
    const retyped = await send(
      "PUT",
      `${pageUrl(page)}/columns/${columnOf(page, "Note")}`,
      numberColumn("Note"),
    );
    expect(retyped.statusCode).toBe(400);
    expect(errorOf(retyped)).toBe("A column's type cannot change");
    const elsewhere = await send(
      "DELETE",
      `${pageUrl(page)}/columns/${columnOf(other, "Note")}`,
    );
    expect(elsewhere.statusCode).toBe(404);
    expect(errorOf(elsewhere)).toBe("There is no such column");
  });

  it("changes a choice column's list only while no row holds one, and to one choice only while no row holds several", async () => {
    // Given a choice column taking several, and a row holding two
    const { list, choices } = await liveList();
    const other = await liveList();
    const { page } = await makePage([
      numberColumn("Number"),
      { name: "Mood", listId: list.id, multiple: true },
    ]);
    const mood = columnOf(page, "Mood");
    const row = (
      await addRow(page, {
        numbers: { [columnOf(page, "Number")]: 1 },
        values: { [mood]: choices },
      })
    ).page.rows[0];
    const change = (body: object) =>
      send("PUT", `${pageUrl(page)}/columns/${mood}`, {
        name: "Mood",
        ...body,
      });

    // Then it can take one choice, or another list, only once the row holds one, then none
    const single = await change({ listId: list.id, multiple: false });
    expect(single.statusCode).toBe(409);
    expect(errorOf(single)).toBe(
      "1 row has several choices for Mood, so it cannot take only one yet",
    );
    const moved = await change({ listId: other.list.id, multiple: true });
    expect(moved.statusCode).toBe(409);
    await send("PATCH", `${pageUrl(page)}/rows/${String(row?.id)}`, {
      values: { [mood]: [] },
    });
    const { page: changed } = await ok<SavedPage>(
      await change({ listId: other.list.id, multiple: false }),
    );
    expect(changed.columns[1]).toMatchObject({
      listId: other.list.id,
      multiple: false,
    });
  });

  it("refuses giving a column a class the role does not see", async () => {
    const lead = await test.signedIn("feature-lead");
    const { page } = await ok<SavedPage>(
      await test.request(lead.cookie, "POST", "/api/private-pages", {
        name: unique("Fictional Page"),
        columns: [numberColumn("Number"), noteColumn("Note")],
      }),
      201,
    );
    const response = await test.request(
      lead.cookie,
      "PUT",
      `${pageUrl(page)}/columns/${columnOf(page, "Note")}`,
      noteColumn("Note", "confidential"),
    );
    expect(response.statusCode).toBe(403);
    expect(errorOf(response)).toBe(
      "Choose a list, or a visibility, whose details this role can see",
    );
  });
});
