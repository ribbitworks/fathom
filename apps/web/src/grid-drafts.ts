// SPDX-License-Identifier: Apache-2.0

// How drafts mark the shared table's cells and columns, which waiting drafts it offers to decide,
// and the records shown before they are saved.

import {
  type Field,
  type FieldDraft,
  type List,
  draftFilterKey,
} from "@fathom/shared";
import { configDraftFields, draftLines } from "./draft-details.tsx";
import { type DraftSelection, decidable } from "./drafts.ts";
import type { Phrase } from "./phrase.tsx";
import type { AnyColumn, GridDraft, GridRecord } from "./record-table.ts";
import { besideLive } from "./status-mark.tsx";
import { type DraftLike, changedValue, partsMark } from "./draft-marks.ts";
import type { CellValue, TableColumn, View } from "./table-view.ts";

// A record added but not saved yet is shown at once under an identifier of the table's own, until
// the server gives its own; until then it cannot be changed. The table goes on naming its row by it,
// so the row keeps its place, and focus, when the server's identifier replaces it.
const pendingPrefix = "pending-";

export const pendingId = () => `${pendingPrefix}${crypto.randomUUID()}`;

export const isPending = (record: GridRecord) =>
  record.id.startsWith(pendingPrefix);

// Whether a record's values cannot change for now, whoever may change it: while it is drafted to be
// removed, until the draft is discarded, while someone else holds it, or while it is being added.
export const heldBack = (record: GridRecord) =>
  record.draft?.action === "deleted" ||
  record.heldBy !== undefined ||
  isPending(record);

// Whether a draft changing a record names a column, or the column its values follow from.
export const changedIn = (
  draft: GridDraft,
  column: { key: string; changesWith?: string | undefined },
) =>
  draft.changed.includes(column.key) ||
  (column.changesWith !== undefined &&
    draft.changed.includes(column.changesWith));

// Whether a draft gives a column a new value: every column of a record added, and those a change
// names. A removal shows the record as it is.
export function draftChanges(
  draft: GridDraft | undefined,
  column: { key: string; changesWith?: string | undefined },
): boolean {
  if (draft === undefined || draft.action === "deleted") return false;
  return draft.action === "created" || changedIn(draft, column);
}

// The draft a value in a column is marked with, when the record's draft changes it.
export const cellDraft = (
  draft: GridDraft | undefined,
  column: { key: string; changesWith?: string | undefined },
) => changedValue(draft, column.key, column.changesWith);

// The draft a cell is marked with as a whole: none where its content marks its own parts.
export const wholeCellDraft = (
  draft: GridDraft | undefined,
  column: {
    key: string;
    changesWith?: string | undefined;
    marksParts?: boolean | undefined;
  },
) => (column.marksParts === true ? undefined : cellDraft(draft, column));

// Who changed a value a draft changes, as the draft names them.
export function changedBy(
  draft: GridDraft | undefined,
  column: { key: string; changesWith?: string | undefined },
): string | undefined {
  const by = new Map(Object.entries(draft?.changedBy ?? {}));
  const key = by.has(column.key) ? column.key : column.changesWith;
  if (key === undefined || !by.has(key)) return undefined;
  return by.get(key) ?? "Fathom";
}

// What a column's draft may change while its cells stay as they are.
export const headingOnly = new Set(["name", "required"]);

// A column's live name, shown under its drafted one, when its draft renames it and changes nothing
// its cells show, and drafts are shown beside live.
export function liveName(
  column: AnyColumn,
  show: View["show"],
): string | undefined {
  const draft = column.field?.draft;
  return besideLive(show) &&
    draft?.action === "changed" &&
    draft.changed.includes("name") &&
    draft.changed.every((key) => headingOnly.has(key))
    ? draft.live.name
    : undefined;
}

// What a table is filtered by besides its columns: whether each record has a draft, waiting or
// rejected.
export const draftColumn: TableColumn<GridRecord> = {
  key: draftFilterKey,
  label: "Draft",
  kind: "choice",
  choices: [
    { id: "waiting", label: "Waiting" },
    { id: "rejected", label: "Rejected" },
  ],
  multiple: false,
  emptyLabel: "No draft",
  value: (record) => (record.draft === undefined ? [] : [record.draft.state]),
};

// What a column's draft changes, field by field, with lists named rather than identified.
export function fieldDraftLines(
  field: Field,
  lists: readonly List[],
): Phrase[] {
  const draft = field.draft as FieldDraft;
  // A column's list, live or drafted, is always among the lists.
  const named = (value: unknown) =>
    (lists.find(({ id }) => id === value) as List).name;
  return draftLines(
    draft,
    configDraftFields(draft, field).map((one) =>
      one.key === "listId"
        ? {
            ...one,
            field: {
              ...one.field,
              oldValue: named(one.field.oldValue),
              newValue: named(one.field.newValue),
            },
          }
        : one,
    ),
  );
}

// The waiting drafts among the records and columns given that the role may decide now: never one
// held by someone else, not yet published, or of a kind the role doesn't approve.
export function waitingDrafts<Rec extends GridRecord>(
  records: readonly Rec[],
  fields: readonly Field[],
  {
    decidableRow,
    approvesRecord,
    approvesColumn,
    draftsOf,
  }: {
    decidableRow: (record: Rec) => boolean;
    approvesRecord: (record: Rec) => boolean;
    approvesColumn: (field: Field) => boolean;
    draftsOf: (ids: string[]) => DraftSelection;
  },
): DraftSelection {
  return {
    ...draftsOf(
      records
        .filter((record) => decidableRow(record) && approvesRecord(record))
        .map(({ id }) => id),
    ),
    columns: fields
      .filter((field) => decidable(field) && approvesColumn(field))
      .map(({ id }) => id),
  };
}

// The draft that marks a cell in place of its row's, where another record's draft changes its
// value: by the column's key, or the column its values follow from.
export function cellDraftOf<Draft>(
  cellDrafts: ReadonlyMap<string, Draft> | undefined,
  column: { key: string; changesWith?: string | undefined },
): Draft | undefined {
  return (
    cellDrafts?.get(column.key) ??
    (column.changesWith === undefined
      ? undefined
      : cellDrafts?.get(column.changesWith))
  );
}

// The state a row's tint shows: of its own draft and the drafts of other records marking its
// values, waiting while any waits, and rejected only once every one was, as a record's parts' mark
// is.
export const rowState = (
  draft: DraftLike | undefined,
  cellDrafts: ReadonlyMap<string, DraftLike> | undefined,
) => partsMark([draft, ...(cellDrafts?.values() ?? [])])?.state;

// A choice's draft renaming it, as it marks a value holding the choice: its mark, and who renamed it.
export interface Renaming {
  draft: DraftLike;
  by: string | undefined;
}

// The drafts renaming choices, by the choice's identifier, from every list with its drafts.
export function choiceRenamings(
  lists: readonly List[],
): ReadonlyMap<string, Renaming> {
  return new Map(
    lists.flatMap(({ choices }) =>
      choices.flatMap(({ id, draft }) => {
        const mark = changedValue(draft, "label");
        if (draft === undefined || mark === undefined) return [];
        const by = new Map(Object.entries(draft.changedBy ?? {})).get("label");
        return [[id, { draft: mark, by: by === null ? "Fathom" : by }]];
      }),
    ),
  );
}

const chosenIds = (value: CellValue): readonly string[] => {
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? value : [];
};

// The renaming that marks a value: of a choice it holds, where no draft, of its record or another,
// changes the value itself and its cell doesn't mark its own parts; of several, one waiting.
export function renamedValue(
  renamings: ReadonlyMap<string, Renaming>,
  column: {
    key: string;
    changesWith?: string | undefined;
    marksParts?: boolean | undefined;
  },
  value: CellValue,
  marked: GridDraft | undefined,
): Renaming | undefined {
  if (column.marksParts === true || cellDraft(marked, column) !== undefined) {
    return undefined;
  }
  const found = chosenIds(value).flatMap((id) => renamings.get(id) ?? []);
  return found.find(({ draft }) => draft.state === "waiting") ?? found[0];
}
