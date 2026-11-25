// SPDX-License-Identifier: Apache-2.0

// Tests for reading the change history a page at a time and searching it: the latest change sets
// first, older ones on request, and searches that read on past what doesn't match, within a limit.

import { accessHistory, recordChanges } from "@fathom/db";
import { type ChangeEntry, type ChangeHistory } from "@fathom/shared";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generalReader, testPosition } from "./test-app.ts";
import {
  admin,
  closeChangeTests,
  history,
  makePersonWithColumn,
  search,
  send,
  startChangeTests,
  test,
} from "./test-changes.ts";

beforeAll(startChangeTests);
afterAll(closeChangeTests);

describe("reading and searching the change history", () => {
  it("shows the latest change sets, then older ones on request", async () => {
    const reader = await test.signedIn(generalReader);
    const personId = randomUUID();
    // More change sets than are shown at once, made directly for speed.
    for (let index = 0; index < 205; index += 1) {
      await test.connection.transaction((transaction) =>
        recordChanges(transaction, null, [
          {
            recordType: "person",
            recordId: personId,
            action: "changed",
            field: "preferredName",
            tier: "general",
            oldValue: index === 0 ? "Zeta origin" : `Zeta ${String(index)}`,
            newValue: `Zeta ${String(index + 1)}`,
          },
        ]),
      );
    }
    const first = await history(reader.cookie);
    expect(first.entries).toHaveLength(200);
    expect(first.entries[0]).toMatchObject({
      madeBy: null,
      records: [{ name: "Zeta 205", fields: [{ newValue: "Zeta 205" }] }],
    });
    const last = first.entries.at(-1) as ChangeEntry;
    expect(first.next).toBe(last.id);
    const next = await history(reader.cookie, String(first.next));
    expect(next.entries[0]?.records[0]?.fields[0]?.newValue).toBe("Zeta 5");
    expect(next.entries.map(({ id }) => id)).not.toContain(last.id);
    expect(await history(reader.cookie, randomUUID())).toEqual({
      entries: [],
      next: null,
    });
    // A search reads on past change sets that do not match, to the oldest that does.
    const oldest = await search(reader.cookie, "ZETA ORIGIN");
    expect(oldest.entries).toHaveLength(1);
    expect(oldest.entries[0]?.records[0]?.fields[0]).toEqual({
      field: "preferredName",
      oldValue: "Zeta origin",
      newValue: "Zeta 1",
    });
    expect(oldest.next).toBeNull();
  });

  it("finds changes holding every word searched for, in who made them, names, and values", async () => {
    const made = await makePersonWithColumn("Lambda");
    const chosen = await send("PATCH", `/api/people/${made.personId}`, {
      values: { [made.field.id]: [made.south.id] },
    });
    const ids = async (text: string) =>
      (await search(admin.cookie, text)).entries.map(({ id }) => id);
    expect(await ids("lambda south")).toContain(chosen.changeSetId);
    expect(await ids("LÁMBDA   person")).toContain(chosen.changeSetId);
    expect(await ids("fictional user 1 lambda site")).toContain(
      chosen.changeSetId,
    );
    expect(await ids("lambda nowhere")).toEqual([]);
    // Names in other scripts, found by part of a name and in any letter case.
    const { ids: added } = (await send("POST", "/api/people", {
      people: [
        {
          preferredName: "편성현",
          employeeId: "E-Lambda-ko",
          positionId: testPosition,
        },
        {
          preferredName: "Вероника Елисеева",
          employeeId: "E-Lambda-ru",
          positionId: testPosition,
        },
      ],
    })) as unknown as { ids: string[] };
    expect(added).toHaveLength(2);
    const [entry] = (await search(admin.cookie, "성현")).entries;
    expect(entry?.records.map(({ name }) => name)).toContain("편성현");
    expect(
      (await search(admin.cookie, "ВЕРОНИКА елисеева")).entries[0]?.records.map(
        ({ name }) => name,
      ),
    ).toContain("Вероника Елисеева");
    expect(await ids("   ")).toContain(chosen.changeSetId);
  });

  it("never matches a search on what the reader may not see, and records only sensitive changes found", async () => {
    const made = await makePersonWithColumn("Omicron");
    await send("PATCH", `/api/people/${made.personId}`, {
      endDate: "2033-03-03",
    });
    await send("PATCH", `/api/people/${made.personId}`, {
      values: { [made.field.id]: [made.south.id] },
    });
    await send("PUT", `/api/lists/${made.list.id}/class`, {
      dataClass: "personal",
    });
    const viewed = (actorId: string) =>
      test.connection
        .select({ id: accessHistory.id })
        .from(accessHistory)
        .where(
          and(
            eq(accessHistory.actorId, actorId),
            eq(accessHistory.action, "personal-viewed"),
          ),
        );
    const generalViewer = await test.signedIn(generalReader);
    // The general viewer's searches work, finding what they may see.
    expect(
      (await search(generalViewer.cookie, "Omicron Person")).entries.length,
    ).toBeGreaterThan(0);
    expect((await search(generalViewer.cookie, "2033-03-03")).entries).toEqual(
      [],
    );
    expect(
      (await search(generalViewer.cookie, "Omicron South")).entries,
    ).toEqual([]);
    expect(await viewed(generalViewer.id)).toHaveLength(0);

    await send("POST", "/api/people", {
      people: [
        {
          preferredName: "Omicron Other",
          employeeId: "E-Omicron-2",
          positionId: testPosition,
        },
      ],
    });
    const manager = await test.signedIn("engineering-manager");
    expect(
      (await search(manager.cookie, "Omicron Other")).entries,
    ).toHaveLength(1);
    // Only General changes found: nothing sensitive was seen.
    expect(await viewed(manager.id)).toHaveLength(0);
    expect((await search(manager.cookie, "2033-03-03")).entries).toHaveLength(
      1,
    );
    expect(await viewed(manager.id)).toHaveLength(1);
  });

  it("reads on past change sets hidden since, to fill a page", async () => {
    const made = await makePersonWithColumn("Pi");
    // More change sets than a page holds, to choices in a column whose list is now Confidential.
    await test.connection.execute(sql`
      WITH made AS (
        INSERT INTO fathom.change_sets (made_by)
        SELECT NULL FROM generate_series(1, 250)
        RETURNING id
      )
      INSERT INTO fathom.changes
        (change_set_id, record_type, record_id, action, field, tier, old_value, new_value)
      SELECT id, 'person', ${made.personId}, 'changed', ${`value:${made.field.id}`}, 'general',
        ${JSON.stringify([made.north.id])}::jsonb, ${JSON.stringify([made.south.id])}::jsonb
      FROM made`);
    await send("PUT", `/api/lists/${made.list.id}/class`, {
      dataClass: "confidential",
    });
    const generalViewer = await test.signedIn(generalReader);
    const { entries } = await history(generalViewer.cookie);
    expect(entries.length).toBeGreaterThan(0);
    // Only adding the person, whose General details the general viewer sees, and none of the hidden changes.
    expect(
      entries.filter(({ records }) =>
        records.some(({ name }) => name === "Pi Person"),
      ),
    ).toEqual([
      expect.objectContaining({
        records: [expect.objectContaining({ action: "created" })],
      }),
    ]);
    // Not seeing configuration, so the change to the list is not the latest entry.
    const leader = await test.signedIn([
      "people:view",
      "personal:view",
      "confidential:view",
    ]);
    expect((await history(leader.cookie)).entries[0]?.records[0]).toMatchObject(
      { name: "Pi Person" },
    );
    // Seeing Confidential changes is recorded in the access history.
    expect(
      await test.connection
        .select({ id: accessHistory.id })
        .from(accessHistory)
        .where(
          and(
            eq(accessHistory.actorId, leader.id),
            eq(accessHistory.action, "personal-viewed"),
          ),
        ),
    ).toHaveLength(1);
  });

  // Kept last but for the refusals, since the change sets it adds fill every page after it.
  it("stops a search after reading as many change sets as one request may, to read on from there", async () => {
    const reader = await test.signedIn(generalReader);
    // Enough change sets, made in one statement for speed, that none of them match.
    await test.connection.execute(sql`
      WITH made AS (
        INSERT INTO fathom.change_sets (made_by)
        SELECT NULL FROM generate_series(1, 2100)
        RETURNING id
      )
      INSERT INTO fathom.changes
        (change_set_id, record_type, record_id, action, field, tier, old_value, new_value)
      SELECT id, 'person', gen_random_uuid()::text, 'changed', 'preferredName', 'general',
        '"Mu"', '"Mu again"'
      FROM made`);
    const first = await search(reader.cookie, "no such words anywhere");
    expect(first.entries).toEqual([]);
    expect(first.next).not.toBeNull();
    const rest = await test.request(
      reader.cookie,
      "GET",
      `/api/changes?search=no+such+words+anywhere&before=${String(first.next)}`,
    );
    expect(rest.json<ChangeHistory>().entries).toEqual([]);
  });

  it("refuses a search longer than a table's", async () => {
    const reader = await test.signedIn(generalReader);
    const response = await test.request(
      reader.cookie,
      "GET",
      `/api/changes?search=${"a".repeat(201)}`,
    );
    expect(response.statusCode).toBe(400);
  });

  it("refuses a page named by something other than a change set", async () => {
    const reader = await test.signedIn(generalReader);
    const response = await test.request(
      reader.cookie,
      "GET",
      "/api/changes?before=not-an-id",
    );
    expect(response.statusCode).toBe(400);
  });
});
