// SPDX-License-Identifier: Apache-2.0

// Tests for a person's own pages in the change history and Undo, against a PostgreSQL server of
// their own: only their maker sees a page's changes, removed or not, while their role may make
// pages, and only they undo them.

import {
  type ChangeHistory,
  type Permission,
  permissionSchema,
  type Role,
} from "@fathom/shared";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  errorOf,
  startTestApp,
  type TestApp,
  type TestUser,
  unique,
} from "./test-app.ts";
import { listHelpers } from "./test-lists.ts";
import {
  numberColumn,
  pageUrl,
  privatePageHelpers,
  type SavedPage,
} from "./test-private-pages.ts";

let test: TestApp;

beforeAll(async () => {
  test = await startTestApp();
});

afterAll(async () => {
  await test.close();
});

const lists = listHelpers(() => test);

type Saved = SavedPage;

const makerRole: Role = "workforce-administrator";

const { sent, makePage, addRow, undo, undone, read } = privatePageHelpers(
  () => test,
);

// The change sets the change history shows the reader.
const shownSets = async (as: TestUser) =>
  (await sent<ChangeHistory>(as, "GET", "/api/changes")).entries.map(
    ({ id, records }) => ({
      id,
      kinds: [...new Set(records.map(({ kind }) => kind))],
    }),
  );

describe("a page's changes in the change history", () => {
  it("shows its maker each change to the page, its columns and rows, the page's removal too", async () => {
    // Given a page made, a row added and changed, and the page removed
    const maker = await test.signedIn(makerRole);
    const made = await makePage(maker);
    const added = await addRow(maker, made.page, {
      [String(made.page.firstFieldId)]: 1,
    });
    const row = added.page.rows[0];
    const changed = await sent<Saved>(
      maker,
      "PATCH",
      `${pageUrl(made.page)}/rows/${String(row?.id)}`,
      { numbers: { [String(made.page.firstFieldId)]: 2 } },
    );
    const removed = await sent<{ changeSetId: string }>(
      maker,
      "DELETE",
      pageUrl(made.page),
    );

    // Then its maker sees each, named as recorded
    const shown = await shownSets(maker);
    for (const [changeSetId, kinds] of [
      [made.changeSetId, ["private-page", "private-column"]],
      [added.changeSetId, ["private-row"]],
      [changed.changeSetId, ["private-row"]],
      [removed.changeSetId, ["private-page", "private-column", "private-row"]],
    ] as const) {
      expect(shown.find(({ id }) => id === changeSetId)?.kinds).toEqual([
        ...kinds,
      ]);
    }
    const history = await sent<ChangeHistory>(maker, "GET", "/api/changes");
    expect(
      history.entries.find(({ id }) => id === made.changeSetId)?.records[0],
    ).toMatchObject({ kind: "private-page", name: made.page.name });
  });

  it.each<[string, Role | Permission[]]>([
    ["another maker of pages", "feature-lead"],
    ["an Engineering Director", "engineering-director"],
    ["a role with every permission", [...permissionSchema.options]],
  ])(
    "shows %s none of a page's changes, nor its removal",
    async (_who, role) => {
      // Given a page made, given a row, and removed
      const maker = await test.signedIn(makerRole);
      const made = await makePage(maker);
      const added = await addRow(maker, made.page, {
        [String(made.page.firstFieldId)]: 1,
      });
      const removed = await sent<{ changeSetId: string }>(
        maker,
        "DELETE",
        pageUrl(made.page),
      );
      const other = await test.signedIn(role);

      // Then the other reader sees none of them, nor finds the page by its name
      const shown = (await shownSets(other)).map(({ id }) => id);
      for (const changeSetId of [
        made.changeSetId,
        added.changeSetId,
        removed.changeSetId,
      ]) {
        expect(shown).not.toContain(changeSetId);
      }
      const searched = await sent<ChangeHistory>(
        other,
        "GET",
        `/api/changes?search=${encodeURIComponent(made.page.name)}`,
      );
      expect(searched.entries).toEqual([]);
    },
  );

  it("is closed to an Administrator, whose role reads no change history", async () => {
    const administrator = await test.signedIn("administrator");
    expect(
      (await test.request(administrator.cookie, "GET", "/api/changes"))
        .statusCode,
    ).toBe(403);
  });

  it("hides from its maker a value change, and refuses undoing it, once its column, or its list, is in a class their role no longer sees", async () => {
    // Given a maker's changes to a value in a number column and in a choice column
    const maker = await test.signedIn("engineering-manager");
    const editor = await test.signedIn(makerRole);
    const list = await lists.createList(editor.cookie);
    const [calm, busy] = await lists.addChoices(editor.cookie, list.id, [
      "Calm",
      "Busy",
    ]);
    await test.approveLists();
    const { page } = await makePage(maker, [
      numberColumn("Number"),
      numberColumn("Salary"),
      { name: "Mood", listId: list.id },
    ]);
    const [, salary, mood] = page.columns.map(({ id }) => id);
    const row = (
      await sent<Saved>(
        maker,
        "POST",
        `${pageUrl(page)}/rows`,
        {
          numbers: { [String(page.firstFieldId)]: 1, [String(salary)]: 100 },
          values: { [String(mood)]: [String(calm?.id)] },
        },
        201,
      )
    ).page.rows[0];
    const rowUrl = `${pageUrl(page)}/rows/${String(row?.id)}`;
    const salaryChange = await sent<Saved>(maker, "PATCH", rowUrl, {
      numbers: { [String(salary)]: 200 },
    });
    const moodChange = await sent<Saved>(maker, "PATCH", rowUrl, {
      values: { [String(mood)]: [String(busy?.id)] },
    });

    // When the number column moves to Confidential, and so does the choice column's list
    await sent(
      maker,
      "PUT",
      `${pageUrl(page)}/columns/${String(salary)}`,
      numberColumn("Salary", "confidential"),
    );
    await sent(
      await test.signedIn("engineering-director"),
      "PUT",
      `/api/lists/${list.id}/class`,
      { dataClass: "confidential" },
    );
    // And the maker's role no longer sees Confidential data
    await test.holdOnly(maker.id, [
      "private-pages:make",
      "plan:view",
      "people:view",
      "personal:view",
    ]);

    // Then neither change shows; undoing the one in the changed column is refused as changed since,
    // and the one whose list is now Confidential as unseen
    const shown = (await shownSets(maker)).map(({ id }) => id);
    expect(shown).not.toContain(salaryChange.changeSetId);
    expect(shown).not.toContain(moodChange.changeSetId);
    expect((await undo(maker, salaryChange.changeSetId)).statusCode).toBe(409);
    const unseen = await undo(maker, moodChange.changeSetId);
    expect([unseen.statusCode, unseen.json()]).toEqual([
      403,
      { error: "Forbidden" },
    ]);
  });

  it("shows its maker none once their role may no longer make pages", async () => {
    const maker = await test.signedIn(makerRole);
    const { changeSetId } = await makePage(maker);
    await test.holdOnly(
      maker.id,
      permissionSchema.options.filter(
        (permission) => permission !== "private-pages:make",
      ),
    );
    expect((await shownSets(maker)).map(({ id }) => id)).not.toContain(
      changeSetId,
    );
  });
});

describe("undoing a page's changes", () => {
  it("undoes making, renaming, moving and removing a page", async () => {
    const maker = await test.signedIn(makerRole);
    // Making a page is undone by removing it
    const first = await makePage(maker);
    await undone(maker, first.changeSetId);
    expect(
      (await test.request(maker.cookie, "GET", pageUrl(first.page))).statusCode,
    ).toBe(404);

    // Renaming and moving are put back
    const { page } = await makePage(maker);
    const other = (await makePage(maker)).page;
    const renamed = await sent<Saved>(maker, "PATCH", pageUrl(page), {
      name: "Reading list",
    });
    await undone(maker, renamed.changeSetId);
    expect((await read(maker, page)).name).toBe(page.name);
    const moved = await sent<{ changeSetId: string }>(
      maker,
      "PUT",
      `${pageUrl(other)}/position`,
      { position: 0 },
    );
    await undone(maker, moved.changeSetId);
    expect((await read(maker, page)).position).toBe(page.position);
    expect((await read(maker, other)).position).toBe(other.position);

    // Removing a page is undone with its columns, rows and values, in order
    const { list } = await liveList(maker);
    const full = (
      await makePage(maker, [
        numberColumn("Number"),
        { name: "Mood", listId: list.id },
        numberColumn("Pages"),
      ])
    ).page;
    const before = (
      await addRow(maker, full, { [String(full.firstFieldId)]: 3 })
    ).page;
    const removed = await sent<{ changeSetId: string }>(
      maker,
      "DELETE",
      pageUrl(full),
    );
    await undone(maker, removed.changeSetId);
    expect(await read(maker, full)).toEqual(before);
  });

  it("undoes adding, changing and removing a column", async () => {
    const maker = await test.signedIn(makerRole);
    const { page } = await makePage(maker);
    const pages = page.columns[1]?.id ?? "";
    const withRow = (
      await addRow(maker, page, {
        [String(page.firstFieldId)]: 1,
        [pages]: 200,
      })
    ).page;
    const added = await sent<Saved>(
      maker,
      "POST",
      `${pageUrl(page)}/columns`,
      numberColumn("Year"),
      201,
    );
    await undone(maker, added.changeSetId);
    expect(await read(maker, page)).toEqual(withRow);
    const changed = await sent<Saved>(
      maker,
      "PUT",
      `${pageUrl(page)}/columns/${pages}`,
      numberColumn("Length", "personal"),
    );
    await undone(maker, changed.changeSetId);
    expect(await read(maker, page)).toEqual(withRow);
    const removed = await sent<Saved>(
      maker,
      "DELETE",
      `${pageUrl(page)}/columns/${pages}`,
    );
    await undone(maker, removed.changeSetId);
    expect(await read(maker, page)).toEqual(withRow);
  });

  it("undoes adding, changing and removing a row", async () => {
    const maker = await test.signedIn(makerRole);
    const { page } = await makePage(maker);
    const first = (
      await addRow(maker, page, { [String(page.firstFieldId)]: 1 })
    ).page;
    const added = await addRow(maker, page, { [String(page.firstFieldId)]: 2 });
    await undone(maker, added.changeSetId);
    expect(await read(maker, page)).toEqual(first);
    const row = `${pageUrl(page)}/rows/${String(first.rows[0]?.id)}`;
    const changed = await sent<Saved>(maker, "PATCH", row, {
      numbers: { [String(page.firstFieldId)]: 5 },
    });
    await undone(maker, changed.changeSetId);
    expect(await read(maker, page)).toEqual(first);
    const removed = await sent<Saved>(maker, "DELETE", row);
    await undone(maker, removed.changeSetId);
    expect(await read(maker, page)).toEqual(first);
  });

  it("refuses an undo once what it puts back or takes away has changed since", async () => {
    const maker = await test.signedIn(makerRole);
    const made = await makePage(maker);
    const { page } = made;
    const renamed = await sent<Saved>(maker, "PATCH", pageUrl(page), {
      name: unique("Fictional Renamed Page"),
    });
    await sent<Saved>(maker, "PATCH", pageUrl(page), {
      name: unique("Fictional Renamed Page"),
    });
    const column = await sent<Saved>(
      maker,
      "POST",
      `${pageUrl(page)}/columns`,
      numberColumn("Year"),
      201,
    );
    const year = column.page.columns[2]?.id ?? "";
    await addRow(maker, page, { [String(page.firstFieldId)]: 1, [year]: 2026 });
    for (const changeSetId of [
      renamed.changeSetId,
      made.changeSetId,
      column.changeSetId,
    ]) {
      const response = await undo(maker, changeSetId);
      expect(response.statusCode).toBe(409);
      expect(errorOf(response)).toBe(
        "This has been changed since, so it can no longer be undone",
      );
    }
  });

  it("answers anyone but the maker, and the maker once they may no longer make pages, as for a change nobody made", async () => {
    const maker = await test.signedIn(makerRole);
    const { changeSetId } = await makePage(maker);
    const answerOf = async (as: TestUser, id: string | null) => {
      const { statusCode, body } = await undo(as, id);
      return { statusCode, body };
    };
    const nobodys = await answerOf(maker, randomUUID());
    expect(nobodys.statusCode).toBe(404);
    for (const role of ["feature-lead", "administrator"] as const) {
      expect(await answerOf(await test.signedIn(role), changeSetId)).toEqual(
        nobodys,
      );
    }
    await test.holdOnly(maker.id, ["people:view", "configuration:view"]);
    expect(await answerOf(maker, changeSetId)).toEqual(nobodys);
  });

  it("refuses its maker an undo of a change in a class their role no longer sees", async () => {
    const maker = await test.signedIn(makerRole);
    const { page } = await makePage(maker, [
      numberColumn("Number"),
      numberColumn("Salary", "confidential"),
    ]);
    const added = await addRow(maker, page, {
      [String(page.firstFieldId)]: 1,
      [page.columns[1]?.id ?? ""]: 100,
    });
    await test.holdOnly(maker.id, ["private-pages:make", "people:view"]);
    expect((await undo(maker, added.changeSetId)).statusCode).toBe(403);
  });
});

// A live list with a choice, made and approved by the maker.
async function liveList(maker: TestUser) {
  const list = await lists.createList(maker.cookie);
  await lists.addChoices(maker.cookie, list.id, ["Calm"]);
  await test.approveLists();
  return { list };
}
