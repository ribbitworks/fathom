// SPDX-License-Identifier: Apache-2.0

// Naming what the change history refers to: each record by the latest name the reader may see, and
// each value as it shows. Part of the data access layer.

import {
  changes,
  changeSets,
  type Database,
  fieldOfValue,
  inChunks,
  listItems,
  plannedHires,
} from "@fathom/db";
import {
  builtInColumnNames,
  capitalized,
  type ChangeValue,
  durationText,
  hireCalled,
  isLink,
  isNoteField,
  linkInWords,
  notePlainText,
  type ClassAccess,
  temporaryId,
} from "@fathom/shared";
import { and, asc, desc, eq, inArray, notInArray, or, sql } from "drizzle-orm";
import { type Actor, seesSensitivity } from "../access.ts";
import { builtInTier } from "./values.ts";
import { type RecordKind, readsKind } from "./record-state.ts";
import { recordKinds } from "./records.ts";
import type { StoredChange } from "./changes.ts";
import { isDate, isDuration, isFlag, isText } from "./column-types.ts";

// The kinds of record that belong to another, which the history names them by, as a choice is by
// its list.
export const belonging = new Map<string, string>([
  ["list-item", "listId"],
  ...recordKinds.flatMap((kind): [string, string][] =>
    kind.belongsTo === undefined ? [] : [[kind.type, kind.belongsTo]],
  ),
]);

// The fields that name a record.
const nameFields = ["name", "label", "preferredName"];

// Drafts of these are details of people, so names labelling what readers who do not see people
// are shown come only from approved changes.
const recordTypesOfPeople = ["person", "feature-team"];

// Fields whose value is one record's identifier: a choice's list, a list's order, a manager, or a
// choice in a built-in list, such as a position or a hiring state.
const referencesOne = (field: string) =>
  ["listId", "order", "managerId", "positionId", "stateId", "leadId"].includes(
    field,
  );

// The plan's kinds of record, by type.
const planKindOf = new Map<string, RecordKind>(
  recordKinds.map((kind) => [kind.type, kind]),
);

// A field of a record named by the records its addition named, which names one of them.
const namesPart = (row: { recordType: string; field: string }) =>
  planKindOf.get(row.recordType)?.historyName?.fields.includes(row.field) ===
  true;

// A feature team's members are named, person by person.
export const namesMembers = (row: { recordType: string; field: string }) =>
  row.recordType === "feature-team" && row.field === "members";

// The fields of each kind of the plan's records that hold one record's identifier or a list of
// them: its links, and the people, choices, and feature teams it names.
const planReferences = new Map(
  recordKinds.map((kind) => [
    kind.type as string,
    new Set([...Object.keys(kind.links), ...Object.keys(kind.refers ?? {})]),
  ]),
);

const referencesPlan = (row: StoredChange) =>
  planReferences.get(row.recordType)?.has(row.field) === true;

// The text in a value as stored that holds a list, or none.
export const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];

// The identifiers a change's values refer to, which are named in its place.
export function referencedIds(row: StoredChange): string[] {
  const values = [row.oldValue, row.newValue];
  const named = new Map(
    Object.entries(planKindOf.get(row.recordType)?.idsInValue ?? {}),
  ).get(row.field);
  const inValue = values.flatMap((value) => named?.ids(value) ?? []);
  if (inValue.length > 0) return inValue;
  if (fieldOfValue(row.field) !== null) {
    return [fieldOfValue(row.field) as string, ...values.flatMap(strings)];
  }
  if (row.recordType === "choice-order" || namesMembers(row)) {
    return values.flatMap(strings);
  }
  if (referencesPlan(row)) {
    return values.flatMap((value) =>
      typeof value === "string" ? [value] : strings(value),
    );
  }
  if (
    referencesOne(row.field) ||
    namesPart(row) ||
    (row.recordType === "planned-hire" && row.field === "filledBy")
  ) {
    return values.filter((value) => typeof value === "string");
  }
  return [];
}

export interface Facts {
  // The latest name of each record.
  names: Map<string, string>;
  // The list each choice and column belongs to, latest first.
  lists: Map<string, string>;
  // The latest visibility recorded for each list, for lists deleted since.
  visibilities: Map<string, unknown>;
}

// The change sets the actor may see: all but those holding other users' unpublished changes.
export const seenSets = (actor: Actor) =>
  or(eq(changeSets.private, false), eq(changeSets.madeBy, actor.user.id));

// What the history the actor may see last recorded about each record: its name, its list, and a
// list's visibility.
export async function readFacts(
  database: Database,
  actor: Actor,
  ids: readonly string[],
  facts: Facts = {
    names: new Map(),
    lists: new Map(),
    visibilities: new Map(),
  },
): Promise<Facts> {
  for (const chunk of inChunks([...new Set(ids)])) {
    const rows = await database
      .selectDistinctOn([changes.recordId, changes.field], {
        recordId: changes.recordId,
        field: changes.field,
        value: changes.newValue,
      })
      .from(changes)
      .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
      .where(
        and(
          inArray(changes.recordId, chunk),
          inArray(changes.field, [
            ...nameFields,
            ...new Set(belonging.values()),
            "visibility",
          ]),
          sql`${changes.newValue} IS NOT NULL`,
          seenSets(actor),
          actor.permissions.includes("people:view")
            ? undefined
            : or(
                eq(changes.draft, false),
                notInArray(changes.recordType, recordTypesOfPeople),
              ),
        ),
      )
      .orderBy(changes.recordId, changes.field, desc(changes.id));
    // Names, labels, and lists are always recorded as text.
    for (const { recordId, field, value } of rows) {
      if ([...belonging.values()].includes(field)) {
        facts.lists.set(recordId, String(value));
      } else if (field === "visibility")
        facts.visibilities.set(recordId, value);
      else facts.names.set(recordId, String(value));
    }
    // Choices Fathom made itself, such as the hiring states it starts with, have no history, so
    // are named as they are.
    const unnamed = chunk.filter(
      (id) => !facts.names.has(id) && uuidPattern.test(id),
    );
    if (unnamed.length > 0) {
      for (const choice of await database
        .select({
          id: listItems.id,
          label: listItems.label,
          listId: listItems.listId,
        })
        .from(listItems)
        .where(inArray(listItems.id, unnamed))) {
        facts.names.set(choice.id, choice.label);
        facts.lists.set(choice.id, choice.listId);
      }
    }
  }
  return facts;
}

const uuidPattern =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

// The fields a planned hire is named by: its position and its ID.
const hireNameFields = ["name", "positionId", "requisition", "temporaryNumber"];

// Names each planned hire given by its name, or, while it has none, by its position and ID, as the
// history the actor may see last recorded them, such as "Software Engineer, TBD-7", or by its ID
// alone to those who cannot see the Positions list's tier. Removing a hire records no values, so
// the name it had stays.
export async function nameHires(
  database: Database,
  actor: Actor,
  ids: readonly string[],
  facts: Facts,
): Promise<void> {
  const latest = new Map<string, Map<string, unknown>>();
  for (const chunk of inChunks([...new Set(ids)])) {
    const rows = await database
      .select({
        recordId: changes.recordId,
        field: changes.field,
        value: changes.newValue,
      })
      .from(changes)
      .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
      .where(
        and(
          eq(changes.recordType, "planned-hire"),
          inArray(changes.recordId, chunk),
          inArray(changes.field, hireNameFields),
          sql`${changes.action} <> 'deleted'`,
          seenSets(actor),
        ),
      )
      .orderBy(asc(changes.id));
    for (const { recordId, field, value } of rows) {
      const fields = latest.get(recordId) ?? new Map<string, unknown>();
      fields.set(field, value);
      latest.set(recordId, fields);
    }
  }
  // A hire records its position and ID together when added, so every hire read has both.
  const positions = [...latest.values()].map((fields) =>
    String(fields.get("positionId")),
  );
  await readFacts(
    database,
    actor,
    positions.filter((id) => !facts.names.has(id)),
    facts,
  );
  const seesPositions = seesSensitivity(
    actor,
    await builtInTier(database, "positions"),
  );
  const named = (name: unknown, position: string, shownId: string) =>
    hireCalled(
      typeof name === "string" ? name : null,
      shownId,
      seesPositions ? position : undefined,
    );
  for (const [id, fields] of latest) {
    const position = facts.names.get(String(fields.get("positionId")));
    const requisition = fields.get("requisition");
    const shownId =
      typeof requisition === "string"
        ? requisition
        : temporaryId(Number(fields.get("temporaryNumber")));
    facts.names.set(id, named(fields.get("name"), String(position), shownId));
  }
  // Hires carried over from before they had positions and IDs are named as they are now.
  const unnamed = [...new Set(ids)].filter((id) => !latest.has(id));
  for (const chunk of inChunks(unnamed)) {
    for (const hire of await database
      .select({
        id: plannedHires.id,
        name: plannedHires.name,
        requisition: plannedHires.requisition,
        temporaryNumber: plannedHires.temporaryNumber,
        position: listItems.label,
      })
      .from(plannedHires)
      .innerJoin(listItems, eq(listItems.id, plannedHires.positionId))
      .where(inArray(plannedHires.id, chunk))) {
      facts.names.set(
        hire.id,
        named(
          hire.name,
          hire.position,
          hire.requisition ?? temporaryId(Number(hire.temporaryNumber)),
        ),
      );
    }
  }
}

// What a changed value of a kind the reader can't read is named, such as "A feature" in a project's
// features or a proposal's removal reasons, when the field names records of such a kind.
export function unseenValueName(
  row: StoredChange,
  access: ClassAccess,
): string | undefined {
  const kind = planKindOf.get(row.recordType);
  const named = new Map([
    ...Object.entries(kind?.links ?? {}),
    ...Object.entries(kind?.idsInValue ?? {}).map(
      ([field, { kind: linked }]) => [field, linked] as const,
    ),
  ]);
  const linked = planKindOf.get(named.get(row.field) ?? "");
  return linked !== undefined && !readsKind(linked, access)
    ? capitalized(linked.unseenSubject)
    : undefined;
}

// What a value shows: text, yes or no, or several names, with identifiers named, a note as its
// words without their formatting, a number as written, a box as ticked or not, a text as it is, and
// a day as written, such as 2026-03-14.
export function shown(
  row: StoredChange,
  value: unknown,
  name: (id: string) => string | undefined,
): ChangeValue {
  const named = (ids: string[]) =>
    ids.flatMap((id) => {
      const found = builtInColumnNames.get(id) ?? name(id);
      return found === undefined ? [] : [found];
    });
  if (fieldOfValue(row.field) !== null && isLink(value)) {
    return linkInWords(value);
  }
  if (fieldOfValue(row.field) !== null && typeof value === "string") {
    return notePlainText(value);
  }
  if (fieldOfValue(row.field) !== null && isText(value)) return value.text;
  if (fieldOfValue(row.field) !== null && isDate(value)) return value.date;
  if (fieldOfValue(row.field) !== null && isDuration(value)) {
    return durationText(value);
  }
  if (fieldOfValue(row.field) !== null && typeof value === "number") {
    return String(value);
  }
  // Only a ticked box is recorded, so beside one, no value is a box unticked.
  if (
    fieldOfValue(row.field) !== null &&
    [row.oldValue, row.newValue].some(isFlag)
  ) {
    return value === true;
  }
  if (
    fieldOfValue(row.field) !== null ||
    row.recordType === "choice-order" ||
    (referencesPlan(row) && Array.isArray(value)) ||
    namesMembers(row)
  ) {
    return value === null ? null : named(strings(value));
  }
  if (row.field === "definition") return null;
  const words = planKindOf
    .get(row.recordType)
    ?.valueInWords?.(row.field, value, name);
  if (words !== undefined) return words;
  if (isNoteField(row.recordType, row.field)) {
    return typeof value === "string" ? notePlainText(value) : null;
  }
  if (
    referencesOne(row.field) ||
    referencesPlan(row) ||
    namesPart(row) ||
    (row.recordType === "planned-hire" && row.field === "filledBy")
  ) {
    return typeof value === "string" ? (name(value) ?? null) : null;
  }
  if (typeof value === "string" || typeof value === "boolean") return value;
  // Such as the length of a release stream's cycles.
  if (typeof value === "number") return String(value);
  // Such as the working days.
  if (Array.isArray(value)) return value.map(String);
  return null;
}

// The records named in the parts of each record changed among the rows whose kind is named by
// them, by field, from the change that added it, since later changes record only what changed.
export async function partsOf(
  database: Database,
  rows: readonly StoredChange[],
): Promise<Map<string, Record<string, string>>> {
  const parts = new Map<string, Record<string, string>>();
  for (const kind of recordKinds) {
    if (kind.historyName === undefined) continue;
    const ids = [
      ...new Set(
        rows
          .filter((row) => row.recordType === kind.type)
          .map((row) => row.recordId),
      ),
    ];
    for (const chunk of inChunks(ids)) {
      for (const { recordId, field, oldValue, newValue } of await database
        .select({
          recordId: changes.recordId,
          field: changes.field,
          oldValue: changes.oldValue,
          newValue: changes.newValue,
        })
        .from(changes)
        .where(
          and(
            eq(changes.recordType, kind.type),
            inArray(changes.field, [...kind.historyName.fields]),
            inArray(changes.recordId, chunk),
          ),
        )) {
        // Each part is recorded once, as an identifier, when the record is added or removed.
        parts.set(recordId, {
          ...parts.get(recordId),
          [field]: String(newValue ?? oldValue),
        });
      }
    }
  }
  return parts;
}

// Names each record named by its parts, as its kind puts their names together, each part named as
// the history names it: a person or feature by its latest name, and a planned hire as nameHires
// does.
export async function nameByParts(
  database: Database,
  actor: Actor,
  rows: readonly StoredChange[],
  parts: ReadonlyMap<string, Record<string, string>>,
  facts: Facts,
): Promise<void> {
  const named = () =>
    [
      ...new Set(
        [...parts.values()].flatMap((recorded) => Object.values(recorded)),
      ),
    ].filter((id) => !facts.names.has(id));
  await readFacts(database, actor, named(), facts);
  await nameHires(database, actor, named(), facts);
  // A part of a kind the actor doesn't read is named by its kind alone.
  const partNamed = (linkedType: string | undefined, partId: string) => {
    const linked = planKindOf.get(linkedType ?? "");
    return linked !== undefined && !readsKind(linked, actor)
      ? linked.unseenSubject
      : facts.names.get(partId);
  };
  for (const row of rows) {
    const kind = planKindOf.get(row.recordType);
    const naming = kind?.historyName;
    const recorded = parts.get(row.recordId);
    if (kind === undefined || naming === undefined || recorded === undefined)
      continue;
    const links = new Map(Object.entries(kind.links));
    const name = naming.name(
      Object.fromEntries(
        Object.entries(recorded).map(([field, partId]) => [
          field,
          partNamed(links.get(field), partId),
        ]),
      ),
    );
    if (name !== undefined) facts.names.set(row.recordId, name);
  }
}
