// SPDX-License-Identifier: Apache-2.0

// Which new lists, and their choices, were made with a column through New list, so go with it, as
// the list's own draft records. Part of the data access layer.

import { changes, inChunks, type Reader } from "@fathom/db";
import { type ColumnTable, columnTableOf } from "@fathom/shared";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Change } from "./changes.ts";
import type { Draft } from "./draft-records.ts";
import type { ListsState } from "./list-state.ts";

const madeWithField = "madeWith";

// The change, recorded with the list's own, that says New list made it with a column on a table,
// so only the list itself ever says what it was made with.
export const madeWithChange = (listId: string, table: ColumnTable): Change => ({
  recordType: "list",
  recordId: listId,
  action: "created",
  field: madeWithField,
  tier: "general",
  oldValue: null,
  newValue: table,
  draft: true,
});

// The records of those given only drafted to be added: drafted, not live.
export const onlyAdded = (
  drafts: ReadonlyMap<string, Draft>,
  live: ReadonlyMap<string, unknown>,
  ids: Iterable<string> = drafts.keys(),
): string[] =>
  [...ids].filter(
    (id) => !live.has(id) && drafts.get(id)?.action === "created",
  );

// The table of the column each list given was made with, as its draft recorded it; lists made on
// Lists are left out.
export async function listsMadeWith(
  reader: Reader,
  ids: readonly string[],
): Promise<Map<string, ColumnTable>> {
  const made = new Map<string, ColumnTable>();
  for (const chunk of inChunks(ids)) {
    const rows = await reader
      .select({ id: changes.recordId, table: changes.newValue })
      .from(changes)
      .where(
        and(
          eq(changes.recordType, "list"),
          inArray(changes.recordId, chunk),
          eq(changes.action, "created"),
          eq(changes.field, madeWithField),
          eq(changes.draft, true),
        ),
      );
    for (const { id, table } of rows) made.set(id, columnTableOf(table));
  }
  return made;
}

// The table of the column each list or choice given goes with, while it is only drafted to be
// added: a list's own, and a choice's list's, however the choice was added, so one list has one
// Approver. The rest are left out.
export async function tablesMadeWith(
  reader: Reader,
  state: ListsState,
  recordType: "list" | "list-item",
  ids: Iterable<string>,
): Promise<Map<string, ColumnTable>> {
  const listOf =
    recordType === "list"
      ? (id: string) => id
      : (id: string) => String(state.choiceDrafts.get(id)?.fields.listId);
  const asked = (
    recordType === "list"
      ? onlyAdded(state.listDrafts, state.lists, ids)
      : onlyAdded(state.choiceDrafts, state.choices, ids)
  ).filter(
    (id) => onlyAdded(state.listDrafts, state.lists, [listOf(id)]).length > 0,
  );
  const tables = await listsMadeWith(reader, [...new Set(asked.map(listOf))]);
  return new Map(
    asked.flatMap((id): [string, ColumnTable][] => {
      const table = tables.get(listOf(id));
      return table === undefined ? [] : [[id, table]];
    }),
  );
}

// The list a choice was last recorded in, from its history, for a choice whose draft may be gone.
export async function recordedListOf(
  reader: Reader,
  choiceId: string,
): Promise<string> {
  const [row] = await reader
    .select({ newValue: changes.newValue, oldValue: changes.oldValue })
    .from(changes)
    .where(
      and(
        eq(changes.recordType, "list-item"),
        eq(changes.recordId, choiceId),
        eq(changes.field, "listId"),
      ),
    )
    .orderBy(desc(changes.id))
    .limit(1);
  return String(row?.newValue ?? row?.oldValue);
}
