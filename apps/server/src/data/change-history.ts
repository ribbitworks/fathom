// SPDX-License-Identifier: Apache-2.0

// Reads the change history: the change sets saved, newest first, each holding only the changes the
// reader's roles let them see. Part of the data access layer. A change set holding none is left out
// altogether, so its timing reveals nothing, as is one holding another user's unpublished changes,
// until they publish them. Records are named by the latest name the history the reader sees holds
// for them, so a deleted record keeps its name, and identifiers in values are replaced by names.

import {
  changes,
  changeSets,
  type Database,
  drafts,
  fieldOfValue,
  inChunks,
  listItems,
  lists,
  people,
  plannedHires,
  roles,
  users,
} from "@fathom/db";
import {
  builtInColumnNames,
  type ChangedField,
  type ChangedRecord,
  type ChangeEntry,
  changeKindSchema,
  type ChangeValue,
  isLink,
  linkInWords,
  matchesWords,
  isNoteField,
  notePlainText,
  recordSearchText,
  recordTypeSchema,
  searchWords,
  hireCalled,
  temporaryId,
  type Tier,
  tierSchema,
} from "@fathom/shared";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  inArray,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  type Actor,
  mostSensitive,
  seesRestrictedDetails,
  seesSensitivity,
  type Sensitivity,
  storedTier,
  tierOfSensitivity,
} from "../access.ts";
import type { RecordType } from "./changes.ts";
import { rejectedField } from "./drafts.ts";
import { hireSensitivities, hiringPlanFields, readHireTier } from "./hires.ts";
import { readToday } from "./settings.ts";
import { personTier } from "./people.ts";
import { builtInTier } from "./values.ts";
import { columnsWithAdded } from "./added-columns.ts";
import { recordKinds } from "./records.ts";
import { viewTiersNow } from "./views.ts";

// The most recent change sets shown at once; older ones are read by naming the last one read. When
// change sets read are hidden or, in a search, do not match, reading goes on, up to ten times as
// many for one page.
const shownChangeSets = 200;
const searchedChangeSets = 2000;

// Configuration is seen by those who may open the configuration pages, and people and their saved
// views by those who may see people.
const configurationKinds: readonly RecordType[] = [
  "list",
  "list-item",
  "choice-order",
  "field",
  "column-order",
];
const peopleKinds: readonly RecordType[] = ["person", "saved-view"];
// The hiring plan, by those who see people and the hiring plan.
const hiringKinds: readonly RecordType[] = ["planned-hire"];

// The fields a planned hire is named by: its position and its ID.
const hireNameFields = ["name", "positionId", "requisition", "temporaryNumber"];

// The plan's records, such as release streams.
const planKinds: readonly RecordType[] = recordTypeSchema.options;

// The kinds of the plan's records the actor sees: General plan data, seen with the permissions each
// kind is read with rather than through the tiers of people's data.
const seenPlanKinds = (actor: Actor): RecordType[] =>
  recordKinds
    .filter((kind) =>
      kind.readWith.some((permission) =>
        actor.permissions.includes(permission),
      ),
    )
    .map((kind) => kind.type);

// The kinds of record that belong to another, which the history names them by, as a choice is by
// its list.
const belonging = new Map<string, string>([
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

// Fields that only tie a record to where it belongs, which the history does not show.
const unshownFields = new Set(["tableName", "createdBy"]);

type StoredChange = typeof changes.$inferSelect;

export interface ReadChangeHistory {
  entries: ChangeEntry[];
  next: string | null;
  // Whether any change shown is to Restricted or Confidential data, which the access history
  // records.
  includedSensitive: boolean;
}

// Fields whose value is one record's identifier: a choice's list, a list's order, a manager, or a
// choice in a built-in list, such as a position or a hiring state.
const referencesOne = (field: string) =>
  ["listId", "order", "managerId", "positionId", "stateId", "leadId"].includes(
    field,
  );

// A feature team's members are named, person by person.
const namesMembers = (row: { recordType: string; field: string }) =>
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

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];

// The identifiers a change's values refer to, which are named in its place.
function referencedIds(row: StoredChange): string[] {
  const values = [row.oldValue, row.newValue];
  if (fieldOfValue(row.field) !== null) {
    return [fieldOfValue(row.field) as string, ...values.flatMap(strings)];
  }
  if (
    row.recordType === "column-order" ||
    row.recordType === "choice-order" ||
    namesMembers(row)
  ) {
    return values.flatMap(strings);
  }
  if (referencesPlan(row)) {
    return values.flatMap((value) =>
      typeof value === "string" ? [value] : strings(value),
    );
  }
  if (
    referencesOne(row.field) ||
    (row.recordType === "planned-hire" && row.field === "filledBy")
  ) {
    return values.filter((value) => typeof value === "string");
  }
  return [];
}

interface Facts {
  // The latest name of each record.
  names: Map<string, string>;
  // The list each choice and column belongs to, latest first.
  lists: Map<string, string>;
  // The latest visibility recorded for each list, for lists deleted since.
  visibilities: Map<string, unknown>;
}

// The change sets the actor may see: all but those holding other users' unpublished changes.
const seenSets = (actor: Actor) =>
  or(eq(changeSets.unpublished, false), eq(changeSets.madeBy, actor.user.id));

// What the history the actor may see last recorded about each record: its name, its list, and a
// list's visibility.
async function readFacts(
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

// Names each planned hire given by its name, or, while it has none, by its position and ID, as the
// history the actor may see last recorded them, such as "Software Engineer, TBD-7", or by its ID
// alone to those who cannot see the Positions list's tier. Removing a hire records no values, so
// the name it had stays.
async function nameHires(
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

// Each list's visibility now: as it is, or, for a list deleted since, as it was last recorded. A
// tier the server no longer knows is treated as the most sensitive rather than trusted.
async function listTiersNow(
  database: Database,
  facts: Facts,
): Promise<(listId: string | undefined) => Tier> {
  const ids = [...new Set(facts.lists.values())];
  const tiers = new Map<string, Tier>(
    [...facts.visibilities].map(([id, value]) => [id, storedTier(value)]),
  );
  for (const chunk of inChunks(ids)) {
    const rows = await database
      .select({ id: lists.id, visibility: lists.visibility })
      .from(lists)
      .where(inArray(lists.id, chunk));
    for (const { id, visibility } of rows) {
      tiers.set(id, storedTier(visibility));
    }
  }
  return (listId) =>
    listId === undefined ? "general" : (tiers.get(listId) ?? "general");
}

// What a value shows: text, yes or no, or several names, with identifiers named, and a note as its
// words without their formatting.
function shown(
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
  if (
    fieldOfValue(row.field) !== null ||
    row.recordType === "column-order" ||
    row.recordType === "choice-order" ||
    (referencesPlan(row) && Array.isArray(value)) ||
    namesMembers(row)
  ) {
    return value === null ? null : named(strings(value));
  }
  if (row.field === "definition") return null;
  if (isNoteField(row.recordType, row.field)) {
    return typeof value === "string" ? notePlainText(value) : null;
  }
  if (
    referencesOne(row.field) ||
    referencesPlan(row) ||
    (row.recordType === "planned-hire" && row.field === "filledBy")
  ) {
    return typeof value === "string" ? (name(value) ?? null) : null;
  }
  if (typeof value === "string" || typeof value === "boolean") return value;
  // Such as the length of a release stream's cycles.
  if (typeof value === "number") return String(value);
  return null;
}

// Whether the actor sees a change, by the rule of its kind of record. Feature teams' General details
// are seen with the org chart, whether or not the reader sees people, but their drafts and
// Restricted details, being details of people, only with people; a role can be given the rest
// without them.
function seesRowOfKind(
  actor: Actor,
  row: StoredChange,
  tier: Tier,
  sensitivities: readonly Sensitivity[],
  seenPlan: readonly RecordType[],
): boolean {
  if (row.recordType === "feature-team") {
    return (
      (!row.draft || actor.permissions.includes("people:view")) &&
      (tier === "general" || seesRestrictedDetails(actor))
    );
  }
  if (planKinds.includes(row.recordType as RecordType)) {
    return (
      seenPlan.includes(row.recordType as RecordType) && tier === "general"
    );
  }
  return sensitivities.every((each) => seesSensitivity(actor, each));
}

// Leaves out the changes the actor may not see: those to kinds of record their role does not cover,
// and those in tiers they do not see, as sensitive as they were when made or are now, whichever is
// more: a person's choices in a column whose list has since become more sensitive, or a saved view
// on such a column.
async function visibleRows(
  database: Database,
  actor: Actor,
  rows: readonly StoredChange[],
  facts: Facts,
  tierNow: (field: string) => Tier,
): Promise<{ row: StoredChange; tier: Tier }[]> {
  const listTier = await listTiersNow(database, facts);
  const hireTierNow = await readHireTier(database);
  // A person's details are as sensitive as they are now, such as a position as its list, their
  // choices, and a planned hire's, as the lists they come from, and as their column's list, even
  // once the column is deleted or draws on another list, and their links as the web link column's
  // visibility last recorded, even once the column is deleted.
  const valueTiers = (row: StoredChange): Tier[] => {
    const columnId = fieldOfValue(row.field);
    if (columnId === null) return [tierNow(row.field)];
    const visibility = facts.visibilities.get(columnId);
    return [
      tierNow(row.field),
      listTier(facts.lists.get(columnId)),
      ...(visibility === undefined ? [] : [storedTier(visibility)]),
      ...[row.oldValue, row.newValue]
        .flatMap(strings)
        .map((choiceId) => listTier(facts.lists.get(choiceId))),
    ];
  };
  // Every definition each view has had, so a view renamed on a page without its definition still
  // has the tier of the columns it uses.
  const viewIds = [
    ...new Set(
      rows
        .filter((row) => row.recordType === "saved-view")
        .map(({ recordId }) => recordId),
    ),
  ];
  const held = new Map<string, unknown[]>(viewIds.map((id) => [id, []]));
  for (const chunk of inChunks(viewIds)) {
    const definitions = await database
      .select({
        recordId: changes.recordId,
        oldValue: changes.oldValue,
        newValue: changes.newValue,
      })
      .from(changes)
      .where(
        and(
          eq(changes.recordType, "saved-view"),
          eq(changes.field, "definition"),
          inArray(changes.recordId, chunk),
        ),
      );
    for (const { recordId, oldValue, newValue } of definitions) {
      (held.get(recordId) as unknown[]).push(oldValue, newValue);
    }
  }
  const viewTiers =
    held.size === 0
      ? new Map<string, Tier>()
      : await viewTiersNow(database, held);
  const seenPlan = seenPlanKinds(actor);
  return rows.flatMap((row) => {
    // A tier the server no longer knows is treated as the most sensitive rather than trusted.
    const recorded = storedTier(row.tier);
    // Each tier is its own permission, so the reader must see every one of them, not only the most
    // sensitive.
    const tiers = [
      recorded,
      ...(row.recordType === "person" ? valueTiers(row) : []),
      ...(row.recordType === "planned-hire"
        ? [
            hireTierNow(row.field),
            ...(fieldOfValue(row.field) === null ? [] : valueTiers(row)),
          ]
        : []),
      ...(row.recordType === "saved-view"
        ? // Every view in the rows has its tier, found just above.
          [viewTiers.get(row.recordId) as Tier]
        : []),
    ];
    // A hire's own details are seen with the hiring plan, whatever tier they were recorded at.
    const sensitivities =
      row.recordType === "planned-hire"
        ? hireSensitivities(row.field, tiers)
        : tiers;
    const tier = mostSensitive(sensitivities.map(tierOfSensitivity));
    const seen = seesRowOfKind(actor, row, tier, sensitivities, seenPlan);
    return seen ? [{ row, tier }] : [];
  });
}

// Which of the people and planned hires given are people who have not started yet: by their start
// date when live, by the draft adding them when only drafted, and otherwise by the last start date
// recorded for them, such as for someone removed. Planned hires are never among them.
async function notStartedAmong(
  database: Database,
  ids: readonly string[],
  today: string,
): Promise<Set<string>> {
  const starts = new Map<string, unknown>();
  for (const chunk of inChunks([...ids])) {
    for (const { id, startDate } of await database
      .select({ id: people.id, startDate: people.startDate })
      .from(people)
      .where(inArray(people.id, chunk))) {
      starts.set(id, startDate);
    }
  }
  const unknown = () => ids.filter((id) => !starts.has(id));
  for (const chunk of inChunks(unknown())) {
    for (const { recordId, fields } of await database
      .select({ recordId: drafts.recordId, fields: drafts.fields })
      .from(drafts)
      .where(
        and(
          eq(drafts.recordType, "person"),
          eq(drafts.action, "created"),
          inArray(drafts.recordId, chunk),
        ),
      )) {
      starts.set(recordId, fields.startDate ?? null);
    }
  }
  for (const chunk of inChunks(unknown())) {
    for (const { recordId, oldValue, newValue } of await database
      .select({
        recordId: changes.recordId,
        oldValue: changes.oldValue,
        newValue: changes.newValue,
      })
      .from(changes)
      .where(
        and(
          eq(changes.recordType, "person"),
          eq(changes.field, "startDate"),
          inArray(changes.recordId, chunk),
        ),
      )
      .orderBy(asc(changes.id))) {
      starts.set(recordId, newValue ?? oldValue);
    }
  }
  return new Set(
    [...starts].flatMap(([id, start]) =>
      typeof start === "string" && start > today ? [id] : [],
    ),
  );
}

const teamRowKey = (row: StoredChange) =>
  `${row.changeSetId} ${row.recordId} ${String(row.draft)}`;

// Whether a change to a team's members or lead changes no one the reader sees, once those hidden
// from them are taken out of its old and new values.
function teamRowShowsNoOne(
  row: StoredChange,
  hidden: ReadonlySet<string>,
): boolean {
  if (
    hidden.size === 0 ||
    row.recordType !== "feature-team" ||
    row.action !== "changed" ||
    (row.field !== "members" && row.field !== "leadId")
  ) {
    return false;
  }
  const seenOf = (value: unknown) =>
    (typeof value === "string" ? [value] : strings(value))
      .filter((id) => !hidden.has(id))
      .sort()
      .join();
  return seenOf(row.oldValue) === seenOf(row.newValue);
}

// The records a change set changed, in the order first changed, each with the fields it changed.
function recordsOf(
  rows: readonly StoredChange[],
  names: Map<string, string>,
  listOf: Map<string, string>,
  hidden: ReadonlySet<string>,
  restricted: boolean,
): ChangedRecord[] {
  const name = (id: string) => names.get(id);
  // People the reader does not see are named nowhere, such as a hire's manager. Who fills a hire is
  // named only to readers who see Restricted details, since it tells of their reporting line to
  // come.
  const valueName = (row: StoredChange) => (id: string) =>
    hidden.has(id) ||
    (!restricted &&
      row.recordType === "planned-hire" &&
      row.field === "filledBy")
      ? undefined
      : name(id);
  const records = new Map<string, ChangedRecord>();
  for (const row of rows) {
    const key = `${row.recordType} ${row.recordId} ${String(row.draft)}`;
    const listId = listOf.get(row.recordId);
    const record = records.get(key) ?? {
      kind: row.recordType,
      action: row.action,
      draft: row.draft,
      name: name(row.recordId) ?? null,
      list:
        belonging.has(row.recordType) && listId !== undefined
          ? (name(listId) ?? null)
          : null,
      fields: [],
    };
    records.set(key, record);
    // Only a change says what changed; an added or deleted record is named alone.
    if (
      row.action !== "changed" ||
      unshownFields.has(row.field) ||
      (row.field === rejectedField && row.newValue === null) ||
      belonging.get(row.recordType) === row.field
    ) {
      continue;
    }
    const columnId = fieldOfValue(row.field);
    const column = columnId === null ? undefined : name(columnId);
    const field: ChangedField = {
      field: columnId === null ? row.field : "value",
      ...(column === undefined ? {} : { column }),
      oldValue: shown(row, row.oldValue, valueName(row)),
      newValue: shown(row, row.newValue, valueName(row)),
    };
    record.fields.push(field);
  }
  return [...records.values()];
}

interface Batch {
  entries: { entry: ChangeEntry; sensitive: boolean }[];
  // The last change set read, to read on from, or null when there are no more.
  next: string | null;
}

// Up to a number of change sets saved before the one named, or the latest, holding a change the
// actor may see.
async function readBatch(
  database: Database,
  actor: Actor,
  mayShow: SQL | undefined,
  before: string | undefined,
  limit: number,
  tierNow: (field: string) => Tier,
): Promise<Batch> {
  const sets = await database
    .select({
      id: changeSets.id,
      kind: changeSets.kind,
      madeAt: changeSets.madeAt,
      madeBy: users.name,
      madeAs: roles.name,
    })
    .from(changeSets)
    .leftJoin(users, eq(users.id, changeSets.madeBy))
    .leftJoin(roles, eq(roles.id, changeSets.madeAsRoleId))
    .where(
      and(
        seenSets(actor),
        exists(
          database
            .select({ one: sql`1` })
            .from(changes)
            .where(and(eq(changes.changeSetId, changeSets.id), mayShow)),
        ),
        before === undefined
          ? undefined
          : // The inner query's columns name its own change set, the one asked for.
            sql`(${changeSets.madeAt}, ${changeSets.id}) < (${database
              .select({ madeAt: changeSets.madeAt, id: changeSets.id })
              .from(changeSets)
              .where(eq(changeSets.id, before))})`,
      ),
    )
    .orderBy(desc(changeSets.madeAt), desc(changeSets.id))
    .limit(limit + 1);
  const page = sets.slice(0, limit);
  const rows: StoredChange[] = [];
  for (const chunk of inChunks(page.map(({ id }) => id))) {
    rows.push(
      ...(await database
        .select()
        .from(changes)
        .where(and(inArray(changes.changeSetId, chunk), mayShow))
        .orderBy(asc(changes.id))),
    );
  }
  const facts = await readFacts(database, actor, [
    ...rows.map((row) => row.recordId),
    ...rows.flatMap((row) => referencedIds(row)),
  ]);
  // A hire's manager may be a planned hire too, named as any hire is.
  const hireRows = rows.filter((row) => row.recordType === "planned-hire");
  await nameHires(
    database,
    actor,
    [
      ...hireRows.map((row) => row.recordId),
      ...hireRows
        .filter((row) => row.field === "managerId")
        .flatMap((row) => [row.oldValue, row.newValue])
        .filter((value): value is string => typeof value === "string"),
    ],
    facts,
  );
  // Lists named only through their choices and columns.
  await readFacts(
    database,
    actor,
    [...facts.lists.values()].filter((id) => !facts.names.has(id)),
    facts,
  );
  // Readers who do not see Restricted details see nobody who has not started, as People hides them:
  // neither a person's own changes nor a hire's manager or filler naming them.
  const restricted = seesRestrictedDetails(actor);
  const hidden = restricted
    ? new Set<string>()
    : await notStartedAmong(
        database,
        [
          ...new Set(
            rows.flatMap((row) => {
              if (row.recordType === "person") return [row.recordId];
              if (namesMembers(row)) {
                return [row.oldValue, row.newValue].flatMap(strings);
              }
              return (row.recordType === "planned-hire" &&
                (row.field === "managerId" || row.field === "filledBy")) ||
                (row.recordType === "feature-team" && row.field === "leadId")
                ? [row.oldValue, row.newValue].filter(
                    (value): value is string => typeof value === "string",
                  )
                : [];
            }),
          ),
        ],
        await readToday(database),
      );
  const seenRows = (
    await visibleRows(database, actor, rows, facts, tierNow)
  ).filter(
    ({ row }) => !(row.recordType === "person" && hidden.has(row.recordId)),
  );
  // A change to a team's members or lead that only those the reader does not see are part of shows
  // nothing to them, and neither does the rejection cleared with it.
  const nothingSeen = new Set(
    seenRows
      .filter(({ row }) => teamRowShowsNoOne(row, hidden))
      .map(({ row }) => teamRowKey(row)),
  );
  const visible = seenRows.filter(
    ({ row }) =>
      !teamRowShowsNoOne(row, hidden) &&
      !(row.field === rejectedField && nothingSeen.has(teamRowKey(row))),
  );
  const bySet = new Map<string, { rows: StoredChange[]; sensitive: boolean }>();
  for (const { row, tier } of visible) {
    const held = bySet.get(row.changeSetId) ?? { rows: [], sensitive: false };
    held.rows.push(row);
    held.sensitive ||= tier !== "general";
    bySet.set(row.changeSetId, held);
  }
  return {
    entries: page.flatMap((set) => {
      const held = bySet.get(set.id);
      return held === undefined
        ? []
        : [
            {
              entry: {
                id: set.id,
                // Unpublished changes all discarded at once are shown as drafts discarded, and a
                // kind the server no longer knows as saved changes.
                kind: changeKindSchema
                  .catch("edit")
                  .parse(set.kind === "withdrawal" ? "discard" : set.kind),
                madeAt: set.madeAt.toISOString(),
                madeBy: set.madeBy,
                madeAs: set.madeAs,
                records: recordsOf(
                  held.rows,
                  facts.names,
                  facts.lists,
                  hidden,
                  restricted,
                ),
              },
              sensitive: held.sensitive,
            },
          ];
    }),
    // Older entries start after the last change set read, which a full batch always has. A change
    // set read but hidden since, because what it changed has become more sensitive, is skipped.
    next: sets.length > limit ? (page.at(-1) as { id: string }).id : null,
  };
}

// The text a search looks in: who saved the change set, and the names and values of what it
// changed.
function searchedText(entry: ChangeEntry): string {
  return [
    entry.madeBy ?? "Fathom",
    ...entry.records.map(recordSearchText),
  ].join(" ");
}

// The change sets saved before the one named, or the latest, holding a change the actor may see,
// and, when searching, holding every word searched for. Reading goes on until there is a page of
// entries or as many change sets have been read as one request may, and the next page goes on from
// there.
export async function readChangeHistory(
  database: Database,
  actor: Actor,
  before?: string,
  search = "",
): Promise<ReadChangeHistory> {
  const kinds = [
    ...(actor.permissions.includes("configuration:view")
      ? configurationKinds
      : []),
    ...(actor.permissions.includes("people:view") ? peopleKinds : []),
  ];
  // Feature teams are seen on the org chart, whether or not the reader sees people.
  const teams = actor.permissions.includes("org-chart:view");
  const hiring =
    actor.permissions.includes("people:view") &&
    seesSensitivity(actor, "hiring-plan");
  const plan = seenPlanKinds(actor);
  const tiers = tierSchema.options.filter((tier) =>
    seesSensitivity(actor, tier),
  );
  if (kinds.length === 0 && plan.length === 0 && !teams) {
    return { entries: [], next: null, includedSensitive: false };
  }
  const mayShow = or(
    kinds.length === 0
      ? undefined
      : and(
          inArray(changes.recordType, [...kinds]),
          inArray(changes.tier, tiers),
        ),
    // A hire's own details are recorded as Confidential, but seen with the hiring plan.
    hiring
      ? and(
          inArray(changes.recordType, [...hiringKinds]),
          or(
            inArray(changes.tier, tiers),
            inArray(changes.field, [...hiringPlanFields]),
          ),
        )
      : undefined,
    teams
      ? and(
          eq(changes.recordType, "feature-team"),
          or(eq(changes.tier, "general"), inArray(changes.tier, tiers)),
        )
      : undefined,
    plan.length > 0
      ? and(inArray(changes.recordType, plan), eq(changes.tier, "general"))
      : undefined,
  );
  const words = searchWords(search);
  // Each column's tier now, read once for every batch.
  const tierNow = personTier(await columnsWithAdded(database, undefined));
  const found: Batch["entries"] = [];
  let next: string | null = before ?? null;
  let read = 0;
  do {
    const batch = await readBatch(
      database,
      actor,
      mayShow,
      next ?? undefined,
      shownChangeSets,
      tierNow,
    );
    found.push(
      ...batch.entries.filter(({ entry }) =>
        matchesWords(searchedText(entry), words),
      ),
    );
    next = batch.next;
    read += shownChangeSets;
  } while (
    next !== null &&
    found.length < shownChangeSets &&
    read < searchedChangeSets
  );
  return {
    entries: found.map(({ entry }) => entry),
    next,
    includedSensitive: found.some(({ sensitive }) => sensitive),
  };
}
