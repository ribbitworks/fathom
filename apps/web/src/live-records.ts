// SPDX-License-Identifier: Apache-2.0

// Records and columns as they are live, or as a choice of the Draft menu shows them.

import type { Field, List, Show } from "@fathom/shared";
import { draftedLists, liveLists } from "./lists.ts";
import type { CountedDrafts } from "./metrics-panel.tsx";
import type { CellRecord, GridRecord } from "./record-table.ts";
import { besideLive } from "./status-mark.tsx";
import type { TableColumn } from "./table-view.ts";

// Records as they are live, without drafts: those only drafted to be added are left out, and each
// built-in detail, by the keys given, and each added column a draft changes has its live value back.
// A record with a draft that can be undone: what it does, and the fields it changes.
interface Undoable {
  draft?:
    | {
        action: "created" | "changed" | "deleted";
        changed: readonly string[];
      }
    | undefined;
}

export function liveRecordsBy<Rec extends Undoable>(
  records: readonly Rec[],
  whenChanged: (
    record: Rec,
    draft: NonNullable<Rec["draft"]>,
    withoutDraft: Rec,
  ) => Rec,
): Rec[] {
  return records.flatMap((record): Rec[] => {
    const { draft, ...rest } = record;
    if (draft === undefined) return [record];
    if (draft.action === "created") return [];
    if (draft.action === "deleted") return [rest as Rec];
    return [whenChanged(record, draft, rest as Rec)];
  });
}

// A record with each field its draft changes put back as the draft keeps it live, by the field's name.
export const withLiveFields = <
  Rec extends Undoable & { draft?: { live: object } | undefined },
>(
  _record: Rec,
  draft: NonNullable<Rec["draft"]>,
  withoutDraft: Rec,
): Rec => ({
  ...withoutDraft,
  ...Object.fromEntries(
    Object.entries(draft.live).filter(([key]) => draft.changed.includes(key)),
  ),
});

// Records with the drafts chosen undone, each as it is live, and those the drafts add left out.
export const undoDrafts = <
  Rec extends Undoable & { id: string; draft?: { live: object } | undefined },
>(
  records: readonly Rec[],
  undone: (draft: NonNullable<Rec["draft"]>) => boolean,
): Rec[] =>
  withDraftsUndone(records, undone, (each) =>
    liveRecordsBy(each, withLiveFields),
  );

// A record's values of one sort, with those a draft changes put back as they are live.
export const withLiveValues = <Held>(
  held: Readonly<Record<string, Held>> | undefined,
  changed: readonly string[],
  live: Readonly<Record<string, Held>> | undefined,
): Record<string, Held> => ({
  ...Object.fromEntries(
    Object.entries(held ?? {}).filter(([key]) => !changed.includes(key)),
  ),
  ...live,
});

export function liveRecordsOf<Rec extends CellRecord>(
  records: readonly Rec[],
  detailKeys: readonly string[],
): Rec[] {
  return liveRecordsBy(records, (record, draft, rest) => {
    const columns = draft.changed.filter((key) => !detailKeys.includes(key));
    const liveValues = new Map(Object.entries(draft.live.values));
    const values = Object.fromEntries([
      ...Object.entries(record.values).filter(
        ([key]) => !columns.includes(key),
      ),
      ...columns.flatMap((key): [string, readonly string[]][] => {
        const live = liveValues.get(key) ?? [];
        return live.length === 0 ? [] : [[key, live]];
      }),
    ]);
    const links = withLiveValues(record.links, columns, draft.live.links);
    const notes = withLiveValues(record.notes, columns, draft.live.notes);
    const numbers = withLiveValues(record.numbers, columns, draft.live.numbers);
    const details = Object.fromEntries(
      draft.changed
        .filter((key) => detailKeys.includes(key))
        // The key is one of the record's own details.
        // eslint-disable-next-line security/detect-object-injection
        .map((key) => [key, draft.live[key] ?? null]),
    );
    return {
      ...rest,
      ...details,
      values,
      links,
      ...(Object.keys(notes).length === 0 ? {} : { notes }),
      ...(Object.keys(numbers).length === 0 ? {} : { numbers }),
    };
  });
}

// The records the metrics count, as the Draft menu shows them, leaving out those drafted to be
// removed. While it shows drafts, they are counted too as published, without the user's own
// unpublished changes; as waiting, without rejected drafts as well; and live, by each column's live
// copy, which `liveOf` gives, so each figure tells what moves it. Live only counts them as the drafts
// will make them too, with and without the user's own unpublished changes. `besides` are the records
// the view would show that `shown` leaves out: with drafts applied, those drafted to be removed, and
// live only, every record as drafted; undefined where nothing is drafted.
export function countedRecords<
  Rec extends GridRecord,
  Col extends TableColumn<Rec>,
>(
  show: Show,
  shown: readonly Rec[],
  besides: readonly Rec[] | undefined,
  columns: readonly Col[],
  liveOf: (column: Col) => Col | undefined,
  liveRecords: (records: readonly Rec[]) => Rec[],
): CountedDrafts<Rec> {
  if (show === "live") {
    if (besides === undefined) return { rows: [...shown], besideLive: false };
    const toCome = (records: readonly Rec[]) => ({
      rows: recordsAsShown("drafts", records, liveRecords),
      columns: [...columns],
    });
    return {
      rows: [...shown],
      coming: toCome(besides),
      comingPublished: toCome(
        withDraftsUndone(
          besides,
          (draft) => draft.unpublished === true,
          liveRecords,
        ),
      ),
      besideLive: false,
    };
  }
  const kept = (records: readonly Rec[]) =>
    records.filter(({ draft }) => draft?.action !== "deleted");
  const drafted = [...shown, ...(besides ?? [])];
  const published = withDraftsUndone(
    drafted,
    (draft) => draft.unpublished === true,
    liveRecords,
  );
  const waiting = withDraftsUndone(
    published,
    (draft) => draft.state === "rejected",
    liveRecords,
  );
  return {
    rows: kept(shown),
    published: { rows: kept(published), columns: [...columns] },
    waiting: { rows: kept(waiting), columns: [...columns] },
    live: {
      rows: liveRecords(drafted),
      columns: columns.flatMap((column) => liveOf(column) ?? []),
    },
    besideLive: besideLive(show),
  };
}

// The columns as they are live, without drafts: those only drafted to be added are left out, and
// each setting a draft changes has its live value back.
export function liveFields(fields: readonly Field[]): Field[] {
  return fields.flatMap((field): Field[] => {
    const { draft, ...rest } = field;
    if (draft?.action === "created") return [];
    if (draft?.action !== "changed") return [rest];
    return [
      {
        ...rest,
        name: draft.live.name ?? rest.name,
        listId: draft.live.listId ?? rest.listId,
        visibility: draft.live.visibility ?? rest.visibility,
        multiple: draft.live.multiple ?? rest.multiple,
        required: draft.live.required ?? rest.required,
      },
    ];
  });
}

// The columns and their lists as a choice of the Draft menu shows them. Live only shows the live
// columns, with their lists as they are live. Drafts applied shows the columns as they will be once
// approved: a rejected draft, not on its way to approval, is taken back, and a column drafted to be
// removed is left out, as are the choices drafted away from their lists.
export function shownSchema(
  show: Show,
  fields: readonly Field[],
  lists: readonly List[],
): {
  fields: Field[];
  lists: List[];
} {
  const applied = show === "drafts";
  return {
    fields:
      show === "live"
        ? liveFields(fields)
        : applied
          ? fields.flatMap((field) => {
              if (field.draft?.state === "rejected") return liveFields([field]);
              return field.draft?.action === "deleted" ? [] : [field];
            })
          : [...fields],
    lists:
      show === "live"
        ? liveLists(lists)
        : applied
          ? draftedLists(lists)
          : [...lists],
  };
}

// The records as a choice of the Draft menu shows them: as they are live, as drafted, or as they
// will be once approved, where a rejected draft is taken back and those drafted to be removed are
// left out.
export function recordsAsShown<Rec extends GridRecord>(
  show: Show,
  records: readonly Rec[],
  liveRecords: (records: readonly Rec[]) => Rec[],
): Rec[] {
  if (show === "live") return liveRecords(records);
  if (besideLive(show)) return [...records];
  return withDraftsUndone(
    records,
    (draft) => draft.state === "rejected",
    liveRecords,
  ).filter((record) => !removedWhenApplied(record));
}

// Whether Drafts applied leaves a record out: drafted to be removed, unless the removal was rejected.
export const removedWhenApplied = ({ draft }: GridRecord): boolean =>
  draft?.action === "deleted" && draft.state !== "rejected";

// The records with the drafts chosen taken back, each as it is live, and those the drafts add left
// out. Made from every record, since a record's live form can depend on others, such as its live
// manager's end date.
export function withDraftsUndone<
  Rec extends { id: string; draft?: object | undefined },
>(
  records: readonly Rec[],
  undone: (draft: NonNullable<Rec["draft"]>) => boolean,
  liveRecords: (records: readonly Rec[]) => Rec[],
): Rec[] {
  const undoes = ({ draft }: Rec) => draft !== undefined && undone(draft);
  if (!records.some(undoes)) return [...records];
  const live = new Map(
    liveRecords(records).map((record) => [record.id, record]),
  );
  return records.flatMap((record) => {
    if (!undoes(record)) return [record];
    const taken = live.get(record.id);
    return taken === undefined ? [] : [taken];
  });
}

// The records as a view shows them, each keeping its own draft whatever the view, since a draft
// locks its record and marks what it changes, and the view decides how the marks show.
export const withOwnDrafts = <Rec extends { id: string; draft?: unknown }>(
  shown: readonly Rec[],
  records: readonly Rec[],
): Rec[] => {
  const drafts = new Map(records.map(({ id, draft }) => [id, draft]));
  return shown.map((record) => ({ ...record, draft: drafts.get(record.id) }));
};
