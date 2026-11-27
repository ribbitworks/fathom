// SPDX-License-Identifier: Apache-2.0

// What a private page's table does to its rows.

import { allOf, type PrivatePage, privateRowSchema } from "@fathom/shared";
import { withCellChange } from "./added-columns.ts";
import type { CellChange } from "./cell-kinds.tsx";
import {
  addPrivateRow,
  changePrivateRow,
  removePrivateRow,
} from "./private-pages.ts";
import type { PrivateRecord } from "./private-table.ts";
import { noRecordActions, type RecordActions } from "./record-table.ts";
import type { RecordSaving } from "./saving.ts";

const noValues = { values: {}, links: {} };

// A row as the table shows it with a change applied, before the change is saved.
const changedRow = (
  row: Pick<PrivateRecord, "id" | "key" | "values" | "links">,
  change: CellChange,
): PrivateRecord =>
  privateRowSchema.parse({
    id: row.id,
    key: row.key,
    ...withCellChange(row, change),
  });

const withRows = (
  page: PrivatePage,
  rows: (shown: PrivatePage["rows"]) => PrivatePage["rows"],
): PrivatePage => ({ ...page, rows: rows(page.rows) });

export function privateRowActions({
  pageId,
  changes: { save, undoable, done },
  nameOf,
}: {
  pageId: string;
  changes: RecordSaving<PrivatePage>;
  nameOf: (row: PrivateRecord) => string;
}): RecordActions<PrivateRecord, CellChange, CellChange> {
  return {
    ...noRecordActions<PrivateRecord, CellChange, CellChange>(),
    // Rows are added one after another, each in its order, so the page reads as typed. Several,
    // as pasted, are kept all or none: if one is refused, those already saved are removed again.
    // Undo takes back the last, the change it offers, leaving the others.
    add: (added, onAdded, onFailed, onRefused) => {
      const adding = added.map(({ id, request }) =>
        changedRow({ id, key: null, ...noValues }, request),
      );
      // The page as saved just before the last row was added, which Undo shows at once.
      let beforeLast: PrivatePage | undefined;
      save({
        next: (page) => withRows(page, (rows) => [...rows, ...adding]),
        save: async () => {
          const ids: string[] = [];
          let changeSetId: string | null = null;
          try {
            for (const { request } of added) {
              const saved = await addPrivateRow(pageId, request);
              // Rows are read in the order added, so the row added is the last.
              ids.push(...saved.page.rows.slice(-1).map(({ id }) => id));
              if (ids.length < added.length) beforeLast = saved.page;
              changeSetId = saved.changeSetId;
            }
          } catch (error) {
            // Each is removed whatever becomes of the others, and the failure named is the add's.
            await Promise.allSettled(
              ids.map((id) => removePrivateRow(pageId, id)),
            );
            throw error;
          }
          onAdded(ids);
          return changeSetId;
        },
        failure: `Fathom could not add ${allOf(adding.map(nameOf))}. Try again in a moment.`,
        onFailed,
        onRefused,
        onSaved: (changeSetId, before) => {
          undoable(changeSetId, beforeLast ?? before);
        },
      });
    },
    update: (row, change) => {
      save({
        next: (page) =>
          withRows(page, (rows) =>
            rows.map((other) =>
              other.id === row.id ? changedRow(other, change) : other,
            ),
          ),
        save: async () =>
          (await changePrivateRow(pageId, row.id, change)).changeSetId,
        failure: `Fathom could not change ${nameOf(row)}.`,
        onSaved: undoable,
      });
    },
    // Removing a row takes it out of view, so a notification says so, with Undo.
    remove: (row) => {
      save({
        next: (page) =>
          withRows(page, (rows) => rows.filter(({ id }) => id !== row.id)),
        save: async () => (await removePrivateRow(pageId, row.id)).changeSetId,
        failure: `Fathom could not remove ${nameOf(row)}.`,
        onSaved: (changeSetId, before) => {
          done(`Removed ${nameOf(row)}.`, changeSetId, before);
        },
      });
    },
  };
}
