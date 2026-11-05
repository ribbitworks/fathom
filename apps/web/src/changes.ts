// SPDX-License-Identifier: Apache-2.0

// The change history, through the server's API, a page of change sets at a time, and how each is put
// in words: a sentence for each record it changed, such as "changed the list Sites" or "drafted
// changes to Fictional Person", and what changed in it, such as "Name from Sites to Locations".

import {
  builtInColumnNames,
  type ChangedField,
  type ChangedRecord,
  type ChangeEntry,
  changeHistorySchema,
  type ChangeKind,
  type ChangeValue,
  recordSearchText,
  tierSchema,
} from "@fathom/shared";
import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";
import { getJson } from "./api.ts";
import { visibilityName } from "./lists.ts";
import type { Phrase } from "./phrase.tsx";
import { formatDay, isDay } from "./table-view.ts";
import { count } from "./numbers.ts";

// The change history holding every word of a search, if any, a page at a time.
export const changesQuery = (search: string) =>
  infiniteQueryOptions({
    queryKey: ["changes", search],
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      const query = new URLSearchParams({
        ...(pageParam === null ? {} : { before: pageParam }),
        ...(search.trim() === "" ? {} : { search }),
      }).toString();
      return getJson(
        query === "" ? "/api/changes" : `/api/changes?${query}`,
        changeHistorySchema,
      );
    },
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next,
    // The entries already shown stay while a changed search is read.
    placeholderData: keepPreviousData,
  });

// Who saved a change set: a user, or Fathom itself, as for the seed data.
export function madeByName({ madeBy }: ChangeEntry): string {
  return madeBy ?? "Fathom";
}

const fieldNames = new Map([
  ["name", "Name"],
  ["label", "Name"],
  ["description", "Description"],
  ["visibility", "Visibility"],
  ["retired", "Retired"],
  ["listId", "List"],
  ["multiple", "Several choices"],
  ["required", "Required"],
  ["order", "Place"],
  ["definition", "Filters and sort"],
  ["rejected", "Reason"],
  ["managerId", "Manager"],
  ["managerFrom", "Manager since"],
  ["teamName", "Team name"],
]);

function fieldName({ field, column }: ChangedField): string {
  if (field === "value") return column ?? "A deleted column";
  return builtInColumnNames.get(field) ?? fieldNames.get(field) ?? field;
}

// A value in words, or null when there is none.
function valueText(field: string, value: ChangeValue): string | null {
  if (
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return null;
  }
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (isDay(value)) return formatDay(value);
  if (field === "visibility") {
    const tier = tierSchema.safeParse(value);
    if (tier.success) return visibilityName(tier.data);
  }
  return value;
}

// What changed in one field, such as "Name from Sites to Locations", with the field and its values
// marked.
export function describeField(change: ChangedField): Phrase {
  const name = { strong: fieldName(change) };
  const before = valueText(change.field, change.oldValue);
  const after = valueText(change.field, change.newValue);
  // A view's filters and sort are not shown, and nor is a value whose names are gone.
  if (before === null && after === null) return [name, " changed"];
  if (before === null) return [name, " set to ", { value: String(after) }];
  if (after === null) return [name, " cleared, from ", { value: before }];
  return [name, " from ", { value: before }, " to ", { value: after }];
}

// The record, as a sentence names it, such as "the choice North in Sites".
function thing({ kind, name, list }: ChangedRecord): string {
  const called = name ?? "without a name";
  switch (kind) {
    case "person":
      return name ?? "a person";
    case "list":
      return `the list ${called}`;
    case "list-item":
      return list === null
        ? `the choice ${called}`
        : `the choice ${called} in ${list}`;
    case "field":
      return `the column ${called}`;
    case "column-order":
      return "People's columns";
    case "choice-order":
      return `the order of ${called}`;
    case "saved-view":
      return `the view ${called}`;
    default:
      return "a record";
  }
}

// The column that moved between two orders of columns, and the one it now follows, if it is the
// only one that moved.
function movedColumn(
  before: ChangeValue,
  after: ChangeValue,
): { column: string; follows: string | null } | null {
  if (!Array.isArray(before) || !Array.isArray(after)) return null;
  for (const column of after) {
    const without = (order: string[]) =>
      order.filter((other) => other !== column).join("\u0000");
    if (without(before) === without(after) && before.join() !== after.join()) {
      const at = after.indexOf(column);
      return { column, follows: at === 0 ? null : (after[at - 1] as string) };
    }
  }
  return null;
}

export interface RecordWords {
  // What was done, after the name of who did it, such as "changed the list Sites".
  sentence: string;
  // What changed in the record, if more than the sentence says, such as "Name from A to B".
  details: Phrase[];
  // For several records added or deleted together, their names, such as each person pasted.
  names?: string[];
  // What a search looks in for the line, beyond its words: the records' names and values as the
  // server searches them.
  searched: string;
}

// How several records of a kind are counted, such as "3 people".
const plurals = new Map([
  ["person", "people"],
  ["list", "lists"],
  ["list-item", "choices"],
  ["field", "columns"],
  ["saved-view", "views"],
]);

// What was done to a record added or deleted, by what the change set did: "added" or "deleted" for
// saved changes, and, for drafts, "drafted adding", "approved removing", and so on.
function addedOrDeleted(record: ChangedRecord, kind: ChangeKind): string {
  const added = record.action === "created";
  if (kind === "approval")
    return added ? "approved adding" : "approved removing";
  if (kind === "discard") return "discarded the draft of";
  if (record.draft) return added ? "drafted adding" : "drafted removing";
  return added ? "added" : "deleted";
}

// Records of one kind added or deleted together, put in one sentence that names them all, such as
// "added 3 choices to Sites: North, South, East".
function describeGroup(
  records: readonly ChangedRecord[],
  kind: ChangeKind,
): RecordWords {
  const [first] = records as [ChangedRecord];
  const verb = addedOrDeleted(first, kind);
  const lists = new Set(records.map(({ list }) => list));
  const [list] = lists;
  const where =
    first.kind === "list-item" && lists.size === 1 && list !== null
      ? ` ${first.action === "created" ? "to" : "from"} ${list as string}`
      : "";
  return {
    sentence: `${verb} ${count(records.length)} ${plurals.get(first.kind) ?? "records"}${where}`,
    details: [],
    names: records.map(({ name }) => name ?? "unnamed"),
    searched: records.map(recordSearchText).join(" "),
  };
}

// A change set's records in words, with records of one kind added or deleted together put in one
// sentence, where the first of them was.
export function describeEntry(entry: ChangeEntry): RecordWords[] {
  const groups = new Map<string, ChangedRecord[]>();
  const words: (RecordWords | string)[] = [];
  for (const record of entry.records) {
    if (record.action !== "created" && record.action !== "deleted") {
      words.push(describeRecord(record, entry.kind));
      continue;
    }
    const key = `${record.kind} ${record.action} ${String(record.draft)}`;
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [record]);
      words.push(key);
    } else {
      group.push(record);
    }
  }
  return words.map((word) => {
    if (typeof word !== "string") return word;
    // Every key pushed names a group made with it.
    const group = groups.get(word) as ChangedRecord[];
    return group.length === 1
      ? describeRecord(group[0] as ChangedRecord, entry.kind)
      : describeGroup(group, entry.kind);
  });
}

// One record's changes in words, and what a search looks in for it.
export function describeRecord(
  record: ChangedRecord,
  kind: ChangeKind = "edit",
): RecordWords {
  return { ...recordWords(record, kind), searched: recordSearchText(record) };
}

function recordWords(
  record: ChangedRecord,
  kind: ChangeKind,
): Omit<RecordWords, "searched"> {
  const named = thing(record);
  if (record.action === "created" || record.action === "deleted") {
    return {
      sentence: `${addedOrDeleted(record, kind)} ${named}`,
      details: [],
    };
  }
  if (kind === "rejection") {
    const [reason] = record.fields;
    return {
      sentence: `rejected the draft of ${named}`,
      details:
        typeof reason?.newValue === "string"
          ? [["Reason: ", { strong: reason.newValue }]]
          : [],
    };
  }
  if (kind === "discard") {
    return { sentence: `discarded the draft of ${named}`, details: [] };
  }
  if (kind === "resubmission") {
    return {
      sentence: `sent the draft of ${named} for approval again`,
      details: [],
    };
  }
  // A list's choice order changes only as a draft, or when one is approved.
  if (record.kind === "choice-order") {
    const [order] = record.fields as [ChangedField];
    const done = kind === "approval" ? "approved" : "drafted";
    const list = record.name ?? "a list";
    const moved = movedColumn(order.oldValue, order.newValue);
    if (moved !== null && kind !== "approval") {
      return {
        sentence:
          moved.follows === null
            ? `drafted moving ${moved.column} in ${list} to the top`
            : `drafted moving ${moved.column} in ${list} after ${moved.follows}`,
        details: [],
      };
    }
    return { sentence: `${done} a new order for ${list}`, details: [] };
  }
  if (kind === "approval" || record.draft) {
    return {
      sentence: `${kind === "approval" ? "approved" : "drafted"} changes to ${named}`,
      details: record.fields.map(describeField),
    };
  }
  const [only] = record.fields;
  if (record.fields.length === 1 && only !== undefined) {
    if (only.field === "retired") {
      return {
        sentence: `${only.newValue === true ? "retired" : "restored"} ${named}`,
        details: [],
      };
    }
    if (only.field === "order" && record.kind === "list-item") {
      return {
        sentence:
          only.newValue === null
            ? `moved ${named} to the top`
            : `moved ${named} after ${String(only.newValue)}`,
        details: [],
      };
    }
    if (only.field === "order" && record.kind === "column-order") {
      const moved = movedColumn(only.oldValue, only.newValue);
      if (moved !== null) {
        return {
          sentence:
            moved.follows === null
              ? `moved the column ${moved.column} to the start`
              : `moved the column ${moved.column} after ${moved.follows}`,
          details: [],
        };
      }
      return { sentence: "changed the order of People's columns", details: [] };
    }
  }
  return {
    sentence: `changed ${named}`,
    details: record.fields.map(describeField),
  };
}
