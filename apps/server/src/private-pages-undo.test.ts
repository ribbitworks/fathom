// SPDX-License-Identifier: Apache-2.0

// Tests for what undoing a change to a private page refuses or adjusts, against a PostgreSQL server
// of its own: changes saved at the same moment, columns and lists changed since, and places taken.

import { privatePages, recordChanges as recordChangeSet } from "@fathom/db";
import type { PrivatePage, Role } from "@fathom/shared";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
const { sent, makePage, addRow, undo, undone, read } = privatePageHelpers(
  () => test,
);

const makerRole: Role = "workforce-administrator";

type Transaction = Parameters<
  Parameters<TestApp["connection"]["transaction"]>[0]
>[0];
const changedSince =
  "This has been changed since, so it can no longer be undone";

// A live list with choices, made and approved by the maker.
async function liveList(maker: TestUser, labels = ["Calm", "Busy"]) {
  const list = await lists.createList(maker.cookie);
  const choices = await lists.addChoices(maker.cookie, list.id, labels);
  await test.approveLists();
  return { list, choices: choices.map(({ id }) => id) };
}

// Undoes a change set while a write to the page is in flight: the page is held, as a write holds
// it, until the undo waits; then the write saves a change and lets go.
async function undoWhileWriting(
  maker: TestUser,
  page: PrivatePage,
  changeSetId: string | null,
  write: (transaction: Transaction) => Promise<void>,
) {
  let undoing: ReturnType<typeof undo> | undefined;
  await test.connection.transaction(async (transaction) => {
    await transaction
      .select({ id: privatePages.id })
      .from(privatePages)
      .where(eq(privatePages.id, page.id))
      .for("update");
    undoing = undo(maker, changeSetId);
    await vi.waitFor(
      async () => {
        const waiting = await test.connection.execute<{ total: string }>(
          sql`SELECT count(*) AS total FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND datname = current_database()`,
        );
        expect(Number(waiting.rows[0]?.total)).toBeGreaterThan(0);
      },
      { timeout: 10_000 },
    );
    await write(transaction);
  });
  return undoing as ReturnType<typeof undo>;
}

describe("undoing while a change is saved at the same moment", () => {
  it("waits for a rename in flight, then refuses, keeping the new name", async () => {
    // Given a page renamed
    const maker = await test.signedIn(makerRole);
    const { page } = await makePage(maker);
    const renamed = await sent<SavedPage>(maker, "PATCH", pageUrl(page), {
      name: unique("Fictional Renamed Page"),
    });
    const meanwhile = unique("Fictional Page Meanwhile");

    // When the rename is undone while another rename is saved
    const response = await undoWhileWriting(
      maker,
      page,
      renamed.changeSetId,
      async (transaction) => {
        await transaction
          .update(privatePages)
          .set({ name: meanwhile })
          .where(eq(privatePages.id, page.id));
        await recordChangeSet(transaction, { userId: maker.id, roleId: null }, [
          {
            recordType: "private-page",
            recordId: page.id,
            action: "changed",
            field: "name",
            tier: "general",
            oldValue: renamed.page.name,
            newValue: meanwhile,
          },
        ]);
      },
    );

    // Then the undo saw it as a change since, and the other rename stands
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(changedSince);
    expect((await read(maker, page)).name).toBe(meanwhile);
  });

  it("waits for a value given in a column in flight, then refuses removing the column", async () => {
    // Given a column added to a page with a row
    const maker = await test.signedIn(makerRole);
    const { page } = await makePage(maker, [numberColumn("Number")]);
    const row = (await addRow(maker, page, { [String(page.firstFieldId)]: 1 }))
      .page.rows[0];
    const added = await sent<SavedPage>(
      maker,
      "POST",
      `${pageUrl(page)}/columns`,
      numberColumn("Year"),
      201,
    );
    const year = String(added.page.columns[1]?.id);

    // When adding it is undone while the row is given a value in it
    const response = await undoWhileWriting(
      maker,
      page,
      added.changeSetId,
      async (transaction) => {
        await recordChangeSet(transaction, { userId: maker.id, roleId: null }, [
          {
            recordType: "private-row",
            recordId: String(row?.id),
            action: "changed",
            field: `value:${year}`,
            tier: "general",
            oldValue: null,
            newValue: 2026,
          },
        ]);
      },
    );

    // Then the undo saw it as a change since, and the column stays
    expect(response.statusCode).toBe(409);
    expect((await read(maker, page)).columns.map(({ id }) => id)).toContain(
      year,
    );
  });
});

describe("undoing once a column or list has changed since", () => {
  it("refuses putting back values once their column has changed since", async () => {
    // Given a row holding two choices in a column taking several, cleared
    const maker = await test.signedIn(makerRole);
    const first = await liveList(maker);
    const second = await liveList(maker, ["Quiet"]);
    const { page } = await makePage(maker, [
      numberColumn("Number"),
      { name: "Mood", listId: first.list.id, multiple: true },
    ]);
    const mood = String(page.columns[1]?.id);
    const row = (
      await sent<SavedPage>(
        maker,
        "POST",
        `${pageUrl(page)}/rows`,
        {
          numbers: { [String(page.firstFieldId)]: 1 },
          values: { [mood]: first.choices },
        },
        201,
      )
    ).page.rows[0];
    const cleared = await sent<SavedPage>(
      maker,
      "PATCH",
      `${pageUrl(page)}/rows/${String(row?.id)}`,
      { values: { [mood]: [] } },
    );

    // When the column moves to another list, taking one choice
    await sent(maker, "PUT", `${pageUrl(page)}/columns/${mood}`, {
      name: "Mood",
      listId: second.list.id,
      multiple: false,
    });

    // Then clearing the row can't be undone
    const response = await undo(maker, cleared.changeSetId);
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(changedSince);
  });

  it("refuses putting a column back on a list retired since, whether removed or moved off it", async () => {
    // Given a column moved from one list to another, and a column on the first removed
    const maker = await test.signedIn(makerRole);
    const retiring = await liveList(maker);
    const other = await liveList(maker, ["Quiet"]);
    const { page } = await makePage(maker, [
      numberColumn("Number"),
      { name: "Mood", listId: retiring.list.id },
      { name: "Tone", listId: retiring.list.id },
    ]);
    const [, mood, tone] = page.columns.map(({ id }) => id);
    const moved = await sent<SavedPage>(
      maker,
      "PUT",
      `${pageUrl(page)}/columns/${String(mood)}`,
      { name: "Mood", listId: other.list.id },
    );
    const removed = await sent<SavedPage>(
      maker,
      "DELETE",
      `${pageUrl(page)}/columns/${String(tone)}`,
    );

    // When the first list is retired
    await sent(maker, "PUT", `/api/lists/${retiring.list.id}/retired`, {
      retired: true,
    });
    await test.approveLists();

    // Then neither can be undone
    for (const { changeSetId } of [moved, removed]) {
      const response = await undo(maker, changeSetId);
      expect(response.statusCode).toBe(400);
      expect(errorOf(response)).toBe("Choose a list that is not retired");
    }
  });
});

describe("undoing a removal once its place is taken", () => {
  it("puts a page back last when another has taken its place", async () => {
    const maker = await test.signedIn("feature-lead");
    await makePage(maker);
    const { page } = await makePage(maker);
    const removed = await sent<{ changeSetId: string }>(
      maker,
      "DELETE",
      pageUrl(page),
    );
    const taking = (await makePage(maker)).page;
    expect(taking.position).toBe(page.position);
    await undone(maker, removed.changeSetId);
    expect((await read(maker, page)).position).toBe(taking.position + 1);
  });

  it("puts a row back last when another has taken its place", async () => {
    const maker = await test.signedIn(makerRole);
    const { page } = await makePage(maker, [numberColumn("Number")]);
    const first = String(page.firstFieldId);
    await addRow(maker, page, { [first]: 1 });
    const withRows = await addRow(maker, page, { [first]: 2 });
    const second = withRows.page.rows[1];
    const removed = await sent<SavedPage>(
      maker,
      "DELETE",
      `${pageUrl(page)}/rows/${String(second?.id)}`,
    );
    await addRow(maker, page, { [first]: 3 });
    await undone(maker, removed.changeSetId);
    expect(
      (await read(maker, page)).rows.map(({ numbers }) =>
        Object.values(numbers),
      ),
    ).toEqual([[1], [3], [2]]);
  });
});
