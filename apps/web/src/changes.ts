// SPDX-License-Identifier: Apache-2.0

// The change history, through the server's API, a page of change sets at a time, and how each is
// put in words: a sentence for each record it changed, such as "changed the list Sites" or "drafted
// changes to Fictional Person", and what changed in it, such as "Name from Sites to Locations".

import {
  builtInColumnNames,
  type ChangedField,
  classNames,
  type ChangedRecord,
  type ChangeEntry,
  changeHistorySchema,
  type ChangeKind,
  type ChangeValue,
  isDay,
  isMonth,
  meaningName,
  meaningSchema,
  percentSettingFields,
  planColumnKinds,
  planColumnNames,
  planIdNames,
  planningSettingNames,
  projectSubjects,
  recordSearchText,
  tierSchema,
  type ViewScope,
  viewScopeSchema,
  type Weekday,
  weekdayNames,
  weekdaySchema,
  weekdayShortNames,
} from "@fathom/shared";
import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";
import { getJson } from "./api.ts";
import type { Phrase } from "./phrase.tsx";
import { effortColumnUnits } from "./effort.ts";
import { unitAmountWords } from "./table-view.ts";
import { formatDay, formatMonth } from "./day-formats.ts";
import { count, decimal, percentage } from "./numbers.ts";
import { nameAs } from "./names.ts";
import { colourName } from "./releases.ts";

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

// Who saved a change set, with the role they acted as: a user, or Fathom itself, as for the seed
// data.
export function madeByName({ madeBy, madeAs }: ChangeEntry): string {
  return madeBy === null ? "Fathom" : nameAs(madeBy, madeAs);
}

const scopeNames: Record<ViewScope, string> = {
  personal: "Private",
  shared: "Shared",
};

const fieldNames = new Map([
  ["name", "Name"],
  ["label", "Name"],
  ["description", "Description"],
  ["visibility", "Class"],
  ["retired", "Retired"],
  ["listId", "List"],
  ["multiple", "Several choices"],
  ["multiline", "Several lines"],
  ["required", "Required"],
  ["onPlannedHires", "Offered on planned hires"],
  ["order", "Place"],
  ["definition", "View settings"],
  ["scope", "Who sees it"],
  ["rejected", "Reason"],
  ["startsOn", "From"],
  ["length", "Length"],
  ["unit", "Unit"],
  ["naming", "Names"],
  ["firstCycle", "First cycle"],
  ["lastCycle", "Last cycle"],
  ["colour", "Colour"],
  ["note", "Note"],
  ["meaning", "Meaning"],
  ["weight", "Weight"],
  // A planned hire's ID, start date, and the person who filled it.
  ["requisition", "ID"],
  ["temporaryNumber", "ID"],
  ["targetDate", "Start"],
  ["filledBy", "Filled by"],
  // A feature team's lead and members, and the days people and planned hires join or leave.
  ["leadId", "Feature lead"],
  ["members", "Members"],
  ["memberFrom", "Joining and leaving dates"],
  ["hireFrom", "Joining and leaving dates"],
  ["leadFrom", "Date the feature lead changes"],
  ["hireLeadFrom", "Date the feature lead changes"],
  ...Object.entries(planningSettingNames),
  ["removalReasons", "Reasons for removing features"],
  ["externalId", "ID"],
  ["targetStreamId", "Target schedule"],
  ["streamId", "Schedule"],
  ["shipsOn", "Ships on"],
  ["cyclesUntil", "Cycles until"],
  ["endsOn", "Schedule ends"],
  ["personId", "Person"],
  ["plannedHireId", "Planned hire"],
  ["featureId", "Feature"],
  ["activityId", "Activity"],
  ["months", "Months"],
]);

const planFieldNames: ReadonlyMap<string, string> = new Map(
  Object.entries(planColumnNames),
);

const planIdNameOf: ReadonlyMap<string, string> = new Map(
  Object.entries(planIdNames),
);

// The fields of each of the plan's kinds of record, named as its table's columns are.
const kindFieldNames = new Map(
  planColumnKinds.map((kind): [string, ReadonlyMap<string, string>] => {
    const idName = planIdNameOf.get(kind);
    return [
      kind,
      new Map([
        ...planFieldNames,
        ...(idName === undefined ? [] : [["externalId", idName] as const]),
      ]),
    ];
  }),
);

function fieldName({ field, column }: ChangedField, kind?: string): string {
  if (field === "value") return column ?? "A removed column";
  return (
    kindFieldNames.get(kind ?? "")?.get(field) ??
    builtInColumnNames.get(field) ??
    fieldNames.get(field) ??
    planFieldNames.get(field) ??
    field
  );
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
  if (Array.isArray(value)) {
    return value.map((one) => valueWords.get(field)?.(one) ?? one).join(", ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return valueWords.get(field)?.(value) ?? value;
}

// A day or a month as people read it, for the fields that hold one; anything else they hold is shown
// as recorded.
const dayWords = (value: string) =>
  isDay(value) ? formatDay(value) : undefined;
const monthWords = (value: string) =>
  isMonth(value) ? formatMonth(value) : undefined;

// The fields that hold a day or a month. Others, such as a name or an ID, show as typed even when
// they look like one, such as a release named 2027-02.
const dayFields = [
  "startDate",
  "endDate",
  "managerFrom",
  "targetDate",
  "startsOn",
  "endsOn",
  "firstCycle",
  "lastCycle",
  "shipsOn",
  "cyclesUntil",
  "date",
  // A feature's target cycle, kept as the cycle's first day.
  "targetCycle",
];
const monthFields = ["neededBy", "expected", "disbandedFrom"];

const weekdayWords =
  (names: Readonly<Record<Weekday, string>>) => (value: string) => {
    const day = weekdaySchema.safeParse(Number(value));
    return day.success ? names[day.data] : undefined;
  };

// How the fields whose values need words of their own put them, or nothing for a value they do not
// know, which shows as recorded.
const valueWords = new Map<string, (value: string) => string | undefined>([
  [
    "scope",
    (value) => {
      const scope = viewScopeSchema.safeParse(value);
      return scope.success ? scopeNames[scope.data] : undefined;
    },
  ],
  [
    "visibility",
    (value) => {
      const tier = tierSchema.safeParse(value);
      return tier.success ? classNames[tier.data] : undefined;
    },
  ],
  [
    "meaning",
    (value) => {
      const meaning = meaningSchema.safeParse(value);
      return meaning.success ? meaningName(meaning.data) : undefined;
    },
  ],
  ["weight", (value) => decimal(Number(value))],
  ...dayFields.map((field) => [field, dayWords] as const),
  ...monthFields.map((field) => [field, monthWords] as const),
  ["workingDays", weekdayWords(weekdayShortNames)],
  ["weekStartsOn", weekdayWords(weekdayNames)],
  [
    "estimateHours",
    (value) => unitAmountWords(value, Number(value), effortColumnUnits[0]),
  ],
  ...percentSettingFields.map(
    (field) => [field, (value: string) => percentage(Number(value))] as const,
  ),
]);

// What changed in one field of a record of the kind given, such as "Name from Sites to Locations"
// or "Description filled in: Offices", with the field and its values marked. A value emptied says
// what it was the same way, as in "Description emptied, was Offices".
export function describeField(change: ChangedField, kind?: string): Phrase {
  const name = { strong: fieldName(change, kind) };
  if (
    kind === "release" &&
    change.field === "colour" &&
    (change.oldValue !== null || change.newValue !== null)
  ) {
    // A release always shows a colour, so going to or from the default is a change between two.
    return [
      name,
      " from ",
      { value: colourName(change.oldValue) },
      " to ",
      { value: colourName(change.newValue) },
    ];
  }
  const before = valueText(change.field, change.oldValue);
  const after = valueText(change.field, change.newValue);
  // A view's filters and sort are not shown, and nor is a value whose names are gone.
  if (before === null && after === null) return [name, " changed"];
  if (before === null) return [name, " filled in: ", { value: String(after) }];
  if (after === null) return [name, " emptied, was ", { value: before }];
  return [name, " from ", { value: before }, " to ", { value: after }];
}

// A field's value in a record being added or removed, such as "Members Avery, Blake", or nothing
// when it has none.
export function describeValue(
  field: string,
  value: ChangeValue,
): Phrase | undefined {
  const text = valueText(field, value);
  return text === null
    ? undefined
    : [
        { strong: fieldName({ field, oldValue: null, newValue: null }) },
        " ",
        { value: text },
      ];
}

// The class of a list or column being added, such as "Class Personal", or nothing for General,
// which has no mark.
export function addedClass(visibility: ChangeValue | undefined): Phrase[] {
  if (visibility === undefined || visibility === "general") return [];
  const line = describeValue("visibility", visibility);
  return line === undefined ? [] : [line];
}

const classedKinds = new Set(["list", "field"]);

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
    case "choice-order":
      return `the order of ${called}`;
    case "saved-view":
      return `the view ${called}`;
    case "release-stream":
      return `the schedule ${called}`;
    case "cycle-pattern":
      return list === null ? "a schedule's cycles" : `the cycles of ${list}`;
    case "release":
      return list === null
        ? `the release ${called}`
        : `the release ${called} in ${list}`;
    case "feature":
      return projectSubjects.feature(called);
    case "planned-hire":
      return name === null ? "a planned hire" : `the planned hire ${name}`;
    case "feature-team":
      return `the feature team ${called}`;
    case "planning-settings":
      return "the planning settings";
    case "customer":
      return projectSubjects.customer(called);
    case "project":
      return projectSubjects.project(called);
    case "proposal":
      return projectSubjects.proposal(called);
    case "milestone":
      return list === null
        ? `the milestone ${called}`
        : projectSubjects.milestone(called, list);
    case "allocation":
      return name === null ? "an allocation" : `the allocation of ${name}`;
    default:
      return "a record";
  }
}

// The choice that moved between two orders of a list's choices, and the one it now follows, if it
// is the only one that moved.
function movedChoice(
  before: ChangeValue,
  after: ChangeValue,
): { choice: string; follows: string | null } | null {
  if (!Array.isArray(before) || !Array.isArray(after)) return null;
  for (const choice of after) {
    const without = (order: string[]) =>
      order.filter((other) => other !== choice).join("\u0000");
    if (without(before) === without(after) && before.join() !== after.join()) {
      const at = after.indexOf(choice);
      return { choice, follows: at === 0 ? null : (after[at - 1] as string) };
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
  ["release-stream", "schedules"],
  ["cycle-pattern", "changes of cycles"],
  ["feature", "features"],
  ["release", "releases"],
]);

// What was done to a record added or removed, by what the change set did: "added" or "removed" for
// saved changes, and, for drafts, "drafted adding", "approved removing", and so on.
function addedOrRemoved(record: ChangedRecord, kind: ChangeKind): string {
  const added = record.action === "created";
  if (kind === "approval")
    return added ? "approved adding" : "approved removing";
  if (kind === "discard") return "discarded the draft of";
  if (record.draft) return added ? "drafted adding" : "drafted removing";
  return added ? "added" : "removed";
}

// Records of one kind added or deleted together, put in one sentence that names them all, such as
// "added 3 choices to Sites: North, South, East".
function describeGroup(
  records: readonly ChangedRecord[],
  kind: ChangeKind,
): RecordWords {
  const [first] = records as [ChangedRecord];
  const verb = addedOrRemoved(first, kind);
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
      sentence: `${addedOrRemoved(record, kind)} ${named}`,
      details:
        record.action === "created" && classedKinds.has(record.kind)
          ? addedClass(
              record.fields.find(({ field }) => field === "visibility")
                ?.newValue,
            )
          : [],
    };
  }
  if (kind === "rejection") {
    const [reason] = record.fields;
    return {
      sentence: `rejected the draft of ${named}`,
      details:
        typeof reason?.newValue === "string"
          ? [[{ strong: "Reason" }, ": ", { value: reason.newValue }]]
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
    const moved = movedChoice(order.oldValue, order.newValue);
    if (moved !== null && kind !== "approval") {
      return {
        sentence:
          moved.follows === null
            ? `drafted moving ${moved.choice} in ${list} to the top`
            : `drafted moving ${moved.choice} in ${list} after ${moved.follows}`,
        details: [],
      };
    }
    return { sentence: `${done} a new order for ${list}`, details: [] };
  }
  if (kind === "approval" || record.draft) {
    return {
      sentence: `${kind === "approval" ? "approved" : "drafted"} changes to ${named}`,
      details: record.fields.map((field) => describeField(field, record.kind)),
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
  }
  return {
    sentence: `changed ${named}`,
    details: record.fields.map((field) => describeField(field, record.kind)),
  };
}
