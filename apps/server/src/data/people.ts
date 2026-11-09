// SPDX-License-Identifier: Apache-2.0

// People and their details: reading everyone a user may see, with their drafts, and drafting people
// added, one or several pasted at once, changed, and removed, and discarding drafts. Part of the
// data access layer, the only server code that queries the database. Every change is a draft, as
// drafts.ts sets out, which reaches the live people only once approved, as approvals.ts sets out.
// Every change is recorded in the change history, field by field, with each field's tier: a
// person's name and Employee ID are General, their start and end dates Restricted, and their state
// and each column's values as sensitive as their list. Users see and change only the tiers their
// role allows, and changes to Restricted or Confidential details are also recorded in the access
// history.

import {
  type Database,
  drafts,
  fieldOfValue,
  inChunks,
  people,
} from "@fathom/db";
import {
  isLink,
  type Link,
  type Links,
  type Notes,
  type Person,
  type PersonChange,
  type PersonDraft,
  type PersonRequest,
  type Tier,
} from "@fathom/shared";
import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  type Actor,
  mostSensitive,
  requirePermission,
  requireSensitivityEdit,
  seesSensitivity,
} from "../access.ts";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../errors.ts";
import {
  type Change,
  changesBetween,
  recordChanges,
  type Transaction,
} from "./changes.ts";
import {
  addPersonDrafts,
  asDraft,
  clearedRejection,
  type Draft,
  drafted,
  draftFields,
  draftMakers,
  fitsColumns,
  lockDrafts,
  otherApprover,
  readHeld,
  readPersonDrafts,
  type Recorded,
  refuseHeld,
  takenEmployeeIds,
  tidy,
  writePersonDraft,
} from "./drafts.ts";
import {
  choicesWithAdded,
  columnsWithAdded,
  refuseHeldColumns,
} from "./added-columns.ts";
import {
  checkBuiltInChoice,
  firstOffered,
  listChoices,
} from "./built-in-lists.ts";
import { isNote, type LiveValues, typeOf } from "./column-types.ts";
import { recordEvents } from "./history.ts";
import { readToday } from "./settings.ts";
import { refuseRemovingPeopleOnTeams } from "./feature-teams.ts";
import {
  hireDraftsNaming,
  hireRow,
  partOfFill,
  readHiresIn,
  refuseRemovingHiresPeople,
  refuseUnmarkingHireManagers,
} from "./hires.ts";
import { keptNote, refuseRemovingNamedPeople } from "./records.ts";
import {
  changedReporting,
  checkLine,
  defaultFrom,
  readLines,
  readManagers,
  readTeams,
  refuseLoop,
  refuseRemovingManagers,
  refuseReportsOutside,
  refuseTakenTeamNames,
  refuseUnmarkingManagers,
  reportingFields,
  reportingOf,
  shownReporting,
} from "./reporting.ts";
import {
  type ColumnInfo,
  type PeopleColumns,
  type FieldValue,
  inListOrder,
  readColumns,
  readValues,
  valueField,
} from "./values.ts";

type PersonRow = typeof people.$inferSelect;

export type { Recorded } from "./drafts.ts";

const noPerson = "There is no such person";
const duplicateEmployeeId = "Someone already has that ID";
const toBeRemoved =
  "This person's draft removes them; discard the draft to change them";
const detailFields = [
  "preferredName",
  "employeeId",
  "positionId",
  "startDate",
  "endDate",
  "isManager",
  "stateId",
] as const;
const personFields = [...detailFields, ...reportingFields];

// The tier of each field of a person: dates are Restricted, and so are changes to their manager,
// which name past managers, the position, state, and each column's values are as sensitive as their
// list, and the rest is General. Every value field recorded is for one of the columns given.
export const restrictedPersonFields = [
  "startDate",
  "endDate",
  "managerId",
  "managerFrom",
] as const;

export function personTier(columns: PeopleColumns) {
  const tiers = new Map<string, Tier>([
    ["positionId", columns.positionTier],
    ["stateId", columns.stateTier],
    ...restrictedPersonFields.map((field): [string, Tier] => [
      field,
      "restricted",
    ]),
    ...columns.map((column): [string, Tier] => [
      valueField(column.id),
      column.tier,
    ]),
  ]);
  return (field: string): Tier => tiers.get(field) ?? "general";
}

export function recorded(
  row: PersonRow,
  values: ReadonlyMap<string, FieldValue>,
): Recorded {
  return {
    preferredName: row.preferredName,
    employeeId: row.employeeId,
    positionId: row.positionId,
    startDate: row.startDate,
    endDate: row.endDate,
    // Recorded only when marked, so adding or removing someone who is not records nothing for it.
    ...(row.isManager ? { isManager: true } : {}),
    // Recorded only when chosen; with none, a person has the first state of their meaning.
    ...(row.stateId === null ? {} : { stateId: row.stateId }),
    ...recordedValues(values),
  };
}

// The meaning of a person's state: Left once their end date has passed, and Hired until then.
export const meaningOn = (person: Recorded, today: string): "hired" | "left" =>
  typeof person.endDate === "string" && person.endDate < today
    ? "left"
    : "hired";

// Refuses a state that is not a hiring state with the meaning the person's end date gives them.
// A state they already have stays valid when retired.
async function checkState(
  reader: Pick<Database, "select">,
  person: Recorded,
  today: string,
  had: unknown,
): Promise<void> {
  if (typeof person.stateId !== "string") return;
  const meaning = await checkBuiltInChoice(
    reader,
    "hiring-states",
    person.stateId,
    had,
  );
  if (meaning === "proposed" || meaning === "open") {
    throw new BadRequestError("That state is for planned hires");
  }
  if (meaning !== meaningOn(person, today)) {
    throw new BadRequestError(
      meaning === "left"
        ? "A Left state is for someone whose end date has passed"
        : "This person has left, so choose a state meaning Left",
    );
  }
}

// Each hiring state's meaning, and the first state offered for each meaning a person can have, so
// a person shows their own state while it has the meaning their end date gives them, and otherwise
// the first of that meaning.
async function readStates(reader: Pick<Database, "select">) {
  const choices = await listChoices(reader, "hiring-states");
  const meanings = new Map(choices.map(({ id, meaning }) => [id, meaning]));
  const first = {
    hired: await firstOffered(reader, "hiring-states", "hired"),
    left: await firstOffered(reader, "hiring-states", "left"),
  };
  return (person: Recorded, today: string): string => {
    const meaning = meaningOn(person, today);
    const own = typeof person.stateId === "string" ? person.stateId : null;
    // Each meaning keeps a choice offered, as lists with meanings require, and the meaning is one
    // of the two named above.
    // eslint-disable-next-line security/detect-object-injection
    const firstOfMeaning = first[meaning] as string;
    return own !== null && meanings.get(own) === meaning ? own : firstOfMeaning;
  };
}

// A person's or planned hire's values, by column, as recorded: a column with no choices is left
// out.
export function recordedValues(
  values: ReadonlyMap<string, FieldValue>,
): Recorded {
  const record: Recorded = {};
  for (const [fieldId, value] of values) {
    if (isLink(value)) record[valueField(fieldId)] = { ...value };
    else if (isNote(value)) record[valueField(fieldId)] = value;
    else if (value.length > 0) record[valueField(fieldId)] = [...value];
  }
  return record;
}

// A person as recorded, with Manager? left out unless checked, or unchecked from a live check,
// since only a check is recorded: so unchecking what the live person does not have changes nothing.
export function withMark(
  person: Recorded,
  live: Recorded | undefined,
): Recorded {
  if (person.isManager === true || live?.isManager === true) return person;
  return Object.fromEntries(
    Object.entries(person).filter(([field]) => field !== "isManager"),
  );
}

// A person's or planned hire's choices, by column, as recorded.
export function valuesOf(person: Recorded): Map<string, string[]> {
  return new Map(
    Object.entries(person).flatMap(([field, value]) => {
      const fieldId = fieldOfValue(field);
      return fieldId === null || !Array.isArray(value)
        ? []
        : [[fieldId, value.map(String)]];
    }),
  );
}

// A person's or planned hire's links, by column, as recorded.
export function linksOf(person: Recorded): Links {
  return Object.fromEntries(
    Object.entries(person).flatMap(([field, value]) => {
      const fieldId = fieldOfValue(field);
      return fieldId === null || !isLink(value)
        ? []
        : [[fieldId, { address: value.address, text: value.text }]];
    }),
  );
}

// A person's or planned hire's notes, by column, as recorded.
export function notesOf(person: Recorded): Notes {
  return Object.fromEntries(
    Object.entries(person).flatMap(([field, value]) => {
      const fieldId = fieldOfValue(field);
      return fieldId === null || !isNote(value) ? [] : [[fieldId, value]];
    }),
  );
}

// The changes between two versions of a person, with each field's tier.
export function personChanges(
  columns: PeopleColumns,
  id: string,
  action: Change["action"],
  before: Recorded | undefined,
  after: Recorded | undefined,
): Change[] {
  const fieldNames = [
    ...personFields,
    ...new Set(
      [...Object.keys(before ?? {}), ...Object.keys(after ?? {})].filter(
        (field) => fieldOfValue(field) !== null,
      ),
    ),
  ];
  return changesBetween(
    "person",
    id,
    action,
    before,
    after,
    fieldNames,
    personTier(columns),
  );
}

// Refuses changes to tiers the actor may not change.
function requireEdits(actor: Actor, made: readonly Change[]): void {
  for (const tier of new Set(made.map((change) => change.tier))) {
    requireSensitivityEdit(actor, tier);
  }
}

// Records, in the access history, each person whose Restricted or Confidential details changed,
// live or in a draft.
export async function recordSensitiveChanges(
  transaction: Pick<Database, "insert">,
  actorId: string | null,
  made: readonly Change[],
): Promise<void> {
  const changed = new Set(
    made
      .filter(
        (change) => change.recordType === "person" && change.tier !== "general",
      )
      .map((change) => change.recordId),
  );
  await recordEvents(
    transaction,
    [...changed].map((subjectId) => ({
      actorId,
      action: "restricted-changed" as const,
      subjectId,
    })),
  );
}

type ChoiceRow = Awaited<ReturnType<typeof inListOrder>>[number];

// Every choice asked for in the requests, live or drafted to be added as the editor sees it, in
// list order, read at once. The drafts lock keeps them from being deleted, or their drafts
// discarded, until the drafts holding them are saved.
export async function choicesAskedFor(
  transaction: Transaction,
  editor: string,
  requests: readonly {
    values?: Readonly<Record<string, readonly string[]>> | undefined;
    links?: Readonly<Record<string, Link | null>> | undefined;
    notes?: Readonly<Record<string, string | null>> | undefined;
  }[],
): Promise<ChoiceRow[]> {
  await refuseHeldColumns(
    transaction,
    editor,
    requests.flatMap((request) => [
      ...Object.keys(request.values ?? {}),
      ...Object.keys(request.links ?? {}),
      ...Object.keys(request.notes ?? {}),
    ]),
  );
  return choicesWithAdded(
    transaction,
    editor,
    requests.flatMap((request) => Object.values(request.values ?? {}).flat()),
  );
}

// Checks the choices asked for each column, and returns them in list order. Choices a person
// already has stay valid when retired; new ones must be offered.
export function checkedValues(
  columns: readonly ColumnInfo[],
  known: readonly ChoiceRow[],
  requested: Readonly<Record<string, readonly string[]>>,
  current: ReadonlyMap<string, readonly string[]> | undefined,
): Map<string, string[]> {
  const checked = new Map<string, string[]>();
  for (const [fieldId, choiceIds] of Object.entries(requested)) {
    const column = columns.find(({ id }) => id === fieldId);
    if (column?.type !== "choice") {
      throw new BadRequestError("There is no such column");
    }
    const choices = known.filter(({ id }) => choiceIds.includes(id));
    if (
      choices.length !== choiceIds.length ||
      choices.some(({ listId }) => listId !== column.listId)
    ) {
      throw new BadRequestError(`Choose ${column.name} from the column's list`);
    }
    const had = current?.get(fieldId) ?? [];
    if (
      choices.some(
        ({ id, retired }) =>
          !had.includes(id) && (retired || column.listRetired),
      )
    ) {
      throw new BadRequestError(`Choose a ${column.name} that is offered`);
    }
    if (!column.multiple && choices.length > 1) {
      throw new BadRequestError(`${column.name} takes one choice`);
    }
    checked.set(
      fieldId,
      choices.map(({ id }) => id),
    );
  }
  return checked;
}

// The links asked for each column, as recorded: a link, or no choices for a link removed. The
// shared schema has already checked and normalized each link.
export function checkedLinks(
  columns: readonly ColumnInfo[],
  requested: Readonly<Record<string, Link | null>>,
): Recorded {
  return Object.fromEntries(
    Object.entries(requested).map(([fieldId, link]) => {
      const column = columns.find(({ id }) => id === fieldId);
      if (column?.type !== "link") {
        throw new BadRequestError("There is no such column");
      }
      return [valueField(fieldId), link === null ? [] : { ...link }];
    }),
  );
}

// The notes asked for each column, as recorded: a note kept exactly as sent, or no choices for a
// note removed, as an empty note also is. A note holding anything notes do not allow is refused
// rather than cleaned, so what is kept is what the editor showed.
export function checkedNotes(
  columns: readonly ColumnInfo[],
  requested: Readonly<Record<string, string | null>>,
): Recorded {
  return Object.fromEntries(
    Object.entries(requested).map(([fieldId, note]): [string, unknown] => {
      const column = columns.find(({ id }) => id === fieldId);
      if (column?.type !== "note") {
        throw new BadRequestError("There is no such column");
      }
      return [valueField(fieldId), keptNote(note) ?? []];
    }),
  );
}

// Whether the live people given, as they are now, fit their columns, as fitsColumns sets out. Used
// after an undo or an approval puts people's values in place, since the columns may have changed
// since.
export async function peopleFitColumns(
  transaction: Transaction,
  personIds: readonly string[],
): Promise<boolean> {
  const present = await transaction
    .select({ id: people.id })
    .from(people)
    .where(inArray(people.id, [...personIds]));
  if (present.length === 0) return true;
  const columns = await readColumns(transaction);
  const values = await readValues(
    transaction,
    present.map(({ id }) => id),
    columns.map(({ id }) => id),
    "person",
  );
  const choices = await inListOrder(
    transaction,
    [...values.values()].flatMap((byColumn) =>
      [...byColumn.values()].flatMap((value) =>
        Array.isArray(value) ? value : [],
      ),
    ),
  );
  const listOf = new Map(choices.map(({ id, listId }) => [id, listId]));
  return present.every(({ id }) =>
    fitsColumns(
      columns,
      listOf,
      Object.fromEntries(
        [...(values.get(id) ?? [])].map(([fieldId, value]) => [
          valueField(fieldId),
          value,
        ]),
      ),
    ),
  );
}

// Refuses a person missing a required column's value, or with dates out of order.
function checkComplete(columns: readonly ColumnInfo[], person: Recorded): void {
  for (const column of columns) {
    if (column.required && person[valueField(column.id)] === undefined) {
      throw new BadRequestError(`${column.name} must be filled in`);
    }
  }
  const { startDate, endDate } = person;
  if (
    typeof startDate === "string" &&
    typeof endDate === "string" &&
    endDate < startDate
  ) {
    throw new BadRequestError("The end date cannot be before the start date");
  }
}

// The live people given, or everyone, as recorded, by person, with their current reporting lines as
// of today, locked for a change when asked.
export async function readLive(
  reader: Pick<Database, "select">,
  columns: readonly ColumnInfo[],
  {
    ids,
    lock = false,
    asOf,
  }: {
    ids?: readonly string[] | undefined;
    lock?: boolean;
    asOf?: string | undefined;
  } = {},
): Promise<Map<string, Recorded>> {
  const today = asOf ?? (await readToday(reader));
  const rows: PersonRow[] = [];
  const read = async (chunk?: readonly string[]) => {
    const query = reader
      .select()
      .from(people)
      .where(chunk === undefined ? undefined : inArray(people.id, [...chunk]))
      .orderBy(people.id);
    rows.push(...(await (lock ? query.for("update") : query)));
  };
  if (ids === undefined) await read();
  else for (const chunk of inChunks([...ids])) await read(chunk);
  const values = await readValues(
    reader,
    rows.map(({ id }) => id),
    columns.map(({ id }) => id),
    "person",
  );
  const lines = await readLines(reader, ids);
  const teams = await readTeams(reader, ids);
  return new Map(
    rows.map((row) => [
      row.id,
      {
        ...recorded(row, values.get(row.id) ?? new Map()),
        ...reportingOf(lines.get(row.id), teams.get(row.id), today),
      },
    ]),
  );
}

export interface PeopleRead {
  people: Person[];
  columns: ColumnInfo[];
  // Whether what was read included anyone's Restricted details, which the access history records.
  includedRestricted: boolean;
  // Whether the actor cannot see the Positions list's tier, so the people read have no positions.
  positionHidden: boolean;
  // Whether what was read included planned hires' details beyond their placeholders, which the
  // access history records apart.
  hiringPlanViewed: boolean;
}

const byName = new Intl.Collator("en", { sensitivity: "base" });

// Whether a person has a start date still to come on a day.
export const notStarted = (person: Recorded, today: string): boolean =>
  typeof person.startDate === "string" && person.startDate > today;

// Whether a person is current on a day: from their start date until their end date passes, or with
// no start date at all.
export function currentOn(person: Recorded, today: string): boolean {
  const { startDate, endDate } = person;
  return (
    (typeof startDate !== "string" || startDate <= today) &&
    (typeof endDate !== "string" || endDate >= today)
  );
}

// Everyone the actor may see, by preferred name, as their drafts make them, with the columns whose
// values they may see, and each draft as they may see it, followed by the planned hires they see,
// as readHires sets out, by ID. A person a draft removes is shown as they are, with the draft.
// Users who cannot see Restricted details see only those who have started, current staff and those
// who have left, so the list does not reveal anyone's start date before it arrives, and receive no
// dates. Each person's state means Hired, or Left once their end date has passed.
export async function readPeople(
  database: Database,
  actor: Actor,
  asOf?: string,
): Promise<PeopleRead> {
  const today = asOf ?? (await readToday(database));
  // People and their drafts are read as of one moment, so an approval saved meanwhile is seen
  // whole or not at all.
  return database.transaction(
    (transaction) => readPeopleIn(transaction, actor, today),
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

async function readPeopleIn(
  database: Transaction,
  actor: Actor,
  today: string,
): Promise<PeopleRead> {
  const restricted = seesSensitivity(actor, "restricted");
  const allColumns = await columnsWithAdded(database, actor.user.id);
  const columns = allColumns.filter((column) =>
    seesSensitivity(actor, column.tier),
  );
  const tierOf = personTier(allColumns);
  const shownFields = new Set<string>([
    "preferredName",
    "employeeId",
    ...(seesSensitivity(actor, allColumns.positionTier) ? ["positionId"] : []),
    ...(seesSensitivity(actor, allColumns.stateTier) ? ["stateId"] : []),
    "teamName",
    "isManager",
    ...(restricted ? ["startDate", "endDate", "managerId", "managerFrom"] : []),
    ...columns.map(({ id }) => valueField(id)),
  ]);
  const live = await readLive(database, allColumns, { asOf: today });
  const draftsNow = await readPersonDrafts(database, undefined, actor.user.id);
  const held = await readHeld(database, "person", actor.user.id);
  const makers = await draftMakers(
    database,
    "person",
    [...draftsNow.keys()],
    (field, tier) =>
      shownFields.has(field) &&
      seesSensitivity(actor, mostSensitive([tier, tierOf(field)])),
    actor,
  );
  const ids = [
    ...live.keys(),
    ...[...draftsNow.keys()].filter((id) => !live.has(id)),
  ];
  const everyone = new Map(
    ids.map((id) => [
      id,
      drafted(live.get(id), draftsNow.get(id)) ?? live.get(id),
    ]),
  );
  // Every person's state means Hired or Left, as their end date decides, and as the live dates
  // decide for those who see no dates.
  const statesTier = allColumns.stateTier;
  const seesStates = seesSensitivity(actor, statesTier);
  const stateOf = seesStates ? await readStates(database) : undefined;
  // A person's state as a reader sees it: from the end date they see.
  const shownState = (person: Recorded, before: Recorded | undefined) =>
    stateOf?.(
      {
        ...person,
        endDate: (restricted ? person : (before ?? person)).endDate,
      },
      today,
    );
  const shown = ids.flatMap((id): Person[] => {
    const before = live.get(id);
    const draft = draftsNow.get(id);
    // A draft that removes someone shows them as they are; one that adds nobody is never kept.
    const person = drafted(before, draft) ?? before;
    // Who has started comes from the live dates while a draft waits, so a draft changing only
    // Restricted dates reveals nothing. Those who have left are no longer kept from anyone.
    if (
      person === undefined ||
      (!restricted && notStarted(before ?? person, today))
    ) {
      return [];
    }
    const seen = draft && seenDraft(id, before, draft);
    return [
      {
        id,
        preferredName: String(person.preferredName),
        employeeId: String(person.employeeId),
        ...(shownFields.has("positionId")
          ? { positionId: String(person.positionId) }
          : {}),
        isManager: person.isManager === true,
        ...(restricted
          ? {
              startDate: (person.startDate as string | null) ?? null,
              endDate: (person.endDate as string | null) ?? null,
            }
          : {}),
        ...shownReporting(person, before, {
          everyone,
          live,
          restricted,
          today,
        }),
        values: Object.fromEntries(
          [...valuesOf(person)].filter(([fieldId]) =>
            shownFields.has(valueField(fieldId)),
          ),
        ),
        links: Object.fromEntries(
          Object.entries(linksOf(person)).filter(([fieldId]) =>
            shownFields.has(valueField(fieldId)),
          ),
        ),
        notes: Object.fromEntries(
          Object.entries(notesOf(person)).filter(([fieldId]) =>
            shownFields.has(valueField(fieldId)),
          ),
        ),
        ...(seen ? { draft: seen } : {}),
        ...(held.has(id) ? { heldBy: held.get(id)?.holder } : {}),
      },
    ];
  });

  // The draft as the actor may see it, or undefined when it changes nothing they see.
  function seenDraft(
    id: string,
    before: Recorded | undefined,
    draft: Draft,
  ): PersonDraft | undefined {
    // In a fixed order, since drafts are stored without one: the details, then the columns.
    const rank = (field: string) => {
      const at = personFields.indexOf(field as (typeof personFields)[number]);
      return at === -1 ? personFields.length : at;
    };
    const fields = draftFields(before, draft)
      .filter((field) => shownFields.has(field))
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    if (fields.length === 0) return undefined;
    const liveValues: PersonDraft["live"] & LiveValues = {
      values: {},
      links: {},
      notes: {},
    };
    if (before !== undefined) {
      for (const field of fields) {
        const fieldId = fieldOfValue(field);
        // The fields are the person's own, named just above.
        /* eslint-disable security/detect-object-injection */
        if (field === "isManager") {
          liveValues.isManager = before.isManager === true;
        } else if (field === "stateId") {
          // Shown only to those who see the hiring states, as the state the row showed.
          liveValues.stateId = shownState(before, before);
        } else if (fieldId === null) {
          Object.assign(liveValues, { [field]: before[field] ?? null });
        } else {
          // Only the fields of the columns read above are shown.
          const column = allColumns.find(
            ({ id }) => id === fieldId,
          ) as ColumnInfo;
          typeOf(column).showLive(liveValues, fieldId, before[field]);
        }
        /* eslint-enable security/detect-object-injection */
      }
    }
    const maker = makers.get(id);
    const reason =
      draft.state === "rejected" &&
      draft.reason !== null &&
      draftFields(before, draft).every((field) =>
        seesSensitivity(actor, tierOf(field)),
      )
        ? { reason: draft.reason }
        : {};
    return {
      action: draft.action,
      changed: fields.map((field) => fieldOfValue(field) ?? field),
      live: liveValues,
      state: draft.state,
      ...reason,
      ...(draft.unpublished === true ? { unpublished: true } : {}),
      madeBy: maker?.madeBy ?? null,
      madeAs: maker?.madeAs ?? null,
      madeAt: maker?.madeAt.toISOString() ?? null,
      editors: maker?.editors ?? [],
      ...otherApprover(maker),
      changedBy: Object.fromEntries(
        fields.map((field) => [
          fieldOfValue(field) ?? field,
          maker?.fieldEditors.get(field) ?? null,
        ]),
      ),
    };
  }

  shown.sort(
    (a, b) =>
      byName.compare(a.preferredName, b.preferredName) ||
      a.id.localeCompare(b.id),
  );
  const hiring = await readHiresIn(database, actor, today);
  const teamOf = new Map(
    shown.map(({ id, teamName }) => [id, teamName ?? null]),
  );
  return {
    people: [
      ...(stateOf === undefined
        ? shown
        : shown.map((row) => ({
            ...row,
            stateId: shownState(
              everyone.get(row.id) as Recorded,
              live.get(row.id),
            ) as string,
          }))),
      ...hiring.hires.map((hire) => hireRow(hire, teamOf)),
    ],
    columns,
    positionHidden: !shownFields.has("positionId"),
    includedRestricted:
      (shown.length > 0 &&
        (restricted ||
          columns.some(({ tier }) => tier !== "general") ||
          (shownFields.has("positionId") &&
            allColumns.positionTier !== "general") ||
          (seesStates && statesTier !== "general"))) ||
      hiring.includedRestricted,
    hiringPlanViewed: hiring.wholePlan && hiring.hires.length > 0,
  };
}

// Refuses Employee IDs that someone else has, live or in a draft, or that two of the people asked
// for share.
async function refuseTakenIds(
  transaction: Transaction,
  employeeIds: readonly string[],
  except: readonly string[],
): Promise<void> {
  const lowered = employeeIds.map((id) => id.toLowerCase());
  if (
    new Set(lowered).size !== lowered.length ||
    (await takenEmployeeIds(transaction, employeeIds, except)).length > 0
  ) {
    throw new ConflictError(duplicateEmployeeId);
  }
}

// Drafts adding people, all saved together, and returns them with the change set they were saved
// in.
export async function createPeople(
  database: Database,
  actor: Actor,
  requests: readonly PersonRequest[],
  asOf?: string,
): Promise<{ ids: string[]; changeSetId: string | null }> {
  requirePermission(actor, "people:edit");
  const today = asOf ?? (await readToday(database));
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const { ids, made } = await draftNewPeople(
      transaction,
      actor,
      requests,
      today,
    );
    await recordSensitiveChanges(transaction, actor.user.id, made);
    return {
      ids,
      changeSetId: await recordChanges(transaction, actor, made),
    };
  });
}

// Drafts adding people, within a change already under way with drafts locked, and returns them with
// the changes made, for the caller to record.
export async function draftNewPeople(
  transaction: Transaction,
  actor: Actor,
  requests: readonly PersonRequest[],
  today: string,
): Promise<{ ids: string[]; made: Change[] }> {
  requirePermission(actor, "people:edit");
  const columns = await columnsWithAdded(transaction, actor.user.id, true);
  if (!seesSensitivity(actor, columns.positionTier)) {
    throw new ForbiddenError(
      "Every person needs a position, and your role doesn't let you see positions",
    );
  }
  const known = await choicesAskedFor(transaction, actor.user.id, requests);
  for (const positionId of new Set(requests.map((one) => one.positionId))) {
    await checkBuiltInChoice(transaction, "positions", positionId);
  }
  const made: Change[] = [];
  const added: { id: string; fields: Recorded }[] = [];
  for (const request of requests) {
    const id = randomUUID();
    const values = checkedValues(columns, known, request.values, undefined);
    const links = checkedLinks(columns, request.links);
    const notes = checkedNotes(columns, request.notes ?? {});
    const row: PersonRow = {
      id,
      preferredName: request.preferredName,
      employeeId: request.employeeId,
      positionId: request.positionId,
      startDate: request.startDate ?? null,
      endDate: request.endDate ?? null,
      isManager: request.isManager ?? false,
      stateId: request.stateId ?? null,
    };
    // Notes left empty are left out.
    const after = tidy({
      ...recorded(row, values),
      ...links,
      ...notes,
      ...(request.managerId == null
        ? {}
        : {
            managerId: request.managerId,
            managerFrom:
              request.managerFrom ??
              defaultFrom({ startDate: row.startDate }, today),
          }),
      ...(request.teamName == null ? {} : { teamName: request.teamName }),
    });
    checkComplete(columns, after);
    await checkState(transaction, after, today, undefined);
    made.push(...personChanges(columns, id, "created", undefined, after));
    added.push({ id, fields: after });
  }
  requireEdits(actor, made);
  const managers = await readManagers(
    transaction,
    requests.map(({ managerId }) => managerId ?? null),
  );
  for (const { id, fields } of added) {
    await checkLine(transaction, id, fields, [], today, managers);
  }
  await refuseTakenIds(
    transaction,
    requests.map(({ employeeId }) => employeeId),
    [],
  );
  await refuseTakenTeamNames(
    transaction,
    added.flatMap(({ id, fields }) =>
      typeof fields.teamName === "string"
        ? [{ id, name: fields.teamName }]
        : [],
    ),
  );
  await addPersonDrafts(transaction, actor.user.id, added);
  return { ids: added.map(({ id }) => id), made: asDraft(made) };
}

// A person as they are and as the actor's draft makes them, locked for a change, refusing someone
// who is neither live nor in a draft the actor sees, or whom someone else is changing.
async function lockDrafted(
  transaction: Transaction,
  actor: Actor,
  columns: readonly ColumnInfo[],
  id: string,
  today?: string,
): Promise<{
  before: Recorded | undefined;
  draft: Draft | undefined;
  person: Recorded | undefined;
}> {
  const before = (
    await readLive(transaction, columns, { ids: [id], lock: true, asOf: today })
  ).get(id);
  const draft = (await readPersonDrafts(transaction, [id], actor.user.id)).get(
    id,
  );
  if (before === undefined && draft === undefined) {
    throw new NotFoundError(noPerson);
  }
  await refuseHeld(transaction, actor.user.id, "person", [id]);
  return { before, draft, person: drafted(before, draft) };
}

// Drafts a change to some of a person's details; each column named has its choices replaced.
export async function updatePerson(
  database: Database,
  actor: Actor,
  id: string,
  change: PersonChange,
  asOf?: string,
): Promise<string | null> {
  requirePermission(actor, "people:edit");
  const today = asOf ?? (await readToday(database));
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const all = await draftPersonChange(transaction, actor, id, change, today);
    if (all.length === 0) return null;
    await recordSensitiveChanges(transaction, actor.user.id, all);
    return recordChanges(transaction, actor, all);
  });
}

// Drafts a change to some of a person's details, within a change already under way with drafts
// locked, and returns the changes made, for the caller to record: none when it changes nothing.
export async function draftPersonChange(
  transaction: Transaction,
  actor: Actor,
  id: string,
  change: PersonChange,
  today: string,
): Promise<Change[]> {
  requirePermission(actor, "people:edit");
  const columns = await columnsWithAdded(transaction, actor.user.id, true);
  const { before, draft, person } = await lockDrafted(
    transaction,
    actor,
    columns,
    id,
    today,
  );
  if (person === undefined) {
    if (before === undefined) throw new NotFoundError(noPerson);
    throw new ConflictError(toBeRemoved);
  }
  // What a fill waiting for approval sets on its person is kept until the fill is discarded.
  if (
    (change.positionId !== undefined ||
      change.managerId !== undefined ||
      change.managerFrom !== undefined ||
      change.isManager !== undefined) &&
    (await hireDraftsNaming(transaction, "filledBy", [id]))
  ) {
    throw new ConflictError(partOfFill);
  }
  if (change.positionId !== undefined) {
    await checkBuiltInChoice(
      transaction,
      "positions",
      change.positionId,
      person.positionId,
    );
  }
  const current = valuesOf(person);
  const changedValues = checkedValues(
    columns,
    await choicesAskedFor(transaction, actor.user.id, [change]),
    change.values ?? {},
    current,
  );
  const details = Object.fromEntries(
    detailFields.flatMap((field) =>
      // The field is one of the fixed details named above.
      // eslint-disable-next-line security/detect-object-injection
      change[field] === undefined ? [] : [[field, change[field]]],
    ),
  );
  // Columns left with nothing chosen are left out.
  const after = withMark(
    tidy({
      ...person,
      ...details,
      ...Object.fromEntries(
        [...changedValues].map(([fieldId, choiceIds]) => [
          valueField(fieldId),
          choiceIds,
        ]),
      ),
      ...checkedLinks(columns, change.links ?? {}),
      ...checkedNotes(columns, change.notes ?? {}),
      ...changedReporting(person, change, today),
    }),
    before,
  );
  checkComplete(columns, after);
  if (change.stateId !== undefined) {
    // Those who see no dates are offered states from the live end date, so their choice is
    // checked against it, and a draft's end date is never revealed by a refusal; a state that
    // stops fitting once the draft is approved shows the first of the meaning instead.
    const dates = seesSensitivity(actor, "restricted")
      ? after
      : (before ?? after);
    await checkState(
      transaction,
      { ...after, endDate: dates.endDate },
      today,
      person.stateId,
    );
  }
  const made = personChanges(columns, id, "changed", person, after);
  requireEdits(actor, made);
  if (made.length === 0) return [];
  const lines =
    before === undefined ? [] : (await readLines(transaction, [id])).get(id);
  await checkLine(transaction, id, after, lines ?? [], today);
  if (
    typeof after.managerFrom === "string" &&
    (after.managerId !== person.managerId ||
      after.managerFrom !== person.managerFrom)
  ) {
    await refuseLoop(
      transaction,
      actor.user.id,
      id,
      typeof after.managerId === "string" ? after.managerId : null,
      after.managerFrom,
      today,
    );
  }
  if (
    before !== undefined &&
    (after.startDate !== person.startDate || after.endDate !== person.endDate)
  ) {
    await refuseReportsOutside(transaction, [{ id, person: after }], today, {
      editor: actor.user.id,
    });
  }
  if (person.isManager === true && after.isManager === false) {
    await refuseUnmarkingManagers(transaction, [id], today, {
      drafted: true,
    });
    await refuseUnmarkingHireManagers(transaction, [id], {
      drafted: true,
      editor: actor.user.id,
    });
  }
  if (
    typeof after.teamName === "string" &&
    after.teamName !== person.teamName
  ) {
    await refuseTakenTeamNames(transaction, [{ id, name: after.teamName }]);
  }
  if (change.employeeId !== undefined) {
    await refuseTakenIds(transaction, [change.employeeId], [id]);
  }
  const all = [
    ...asDraft(made),
    ...clearedRejection(id, personTier(columns), before, draft),
  ];
  await writePersonDraft(transaction, actor.user.id, id, before, after);
  return all;
}

// Puts the fields named of a person's draft back as they are live, keeping the rest of the draft, as
// taking a fill back out of it does, and returns the changes made, for the caller to record.
export async function draftPersonAsLive(
  transaction: Transaction,
  actor: Actor,
  id: string,
  fields: readonly string[],
): Promise<Change[]> {
  requirePermission(actor, "people:edit");
  const columns = await columnsWithAdded(transaction, actor.user.id, true);
  const { before, draft, person } = await lockDrafted(
    transaction,
    actor,
    columns,
    id,
  );
  // A fill is taken out only of someone live it changes, whom it never removes.
  const live = before as Recorded;
  const now = person as Recorded;
  const after = withMark(
    tidy({
      ...Object.fromEntries(
        Object.entries(now).filter(([field]) => !fields.includes(field)),
      ),
      ...Object.fromEntries(
        Object.entries(live).filter(([field]) => fields.includes(field)),
      ),
    }),
    live,
  );
  const made = [
    ...asDraft(personChanges(columns, id, "changed", now, after)),
    ...clearedRejection(id, personTier(columns), before, draft),
  ];
  requireEdits(actor, made);
  await writePersonDraft(transaction, actor.user.id, id, before, after);
  return made;
}

// Drafts removing a person entered by mistake, recording everything they held; removing someone
// only drafted to be added discards that draft. People who leave are given an end date instead.
// Nobody who is or was anyone's manager can be removed, nor anyone a planned hire names, as its
// manager or as who filled it, nor anyone a plan record names, such as a project's owner.
export async function deletePerson(
  database: Database,
  actor: Actor,
  id: string,
): Promise<string | null> {
  requirePermission(actor, "people:edit");
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const columns = await columnsWithAdded(transaction, actor.user.id, true);
    const { before, draft, person } = await lockDrafted(
      transaction,
      actor,
      columns,
      id,
    );
    // Already drafted to be removed.
    if (person === undefined) return null;
    if (before !== undefined) {
      await refuseRemovingManagers(transaction, [id]);
    }
    await refuseRemovingHiresPeople(transaction, [id]);
    await refuseRemovingNamedPeople(transaction, [id]);
    await refuseRemovingPeopleOnTeams(transaction, [id]);
    const made = [
      ...asDraft(personChanges(columns, id, "deleted", person, undefined)),
      ...clearedRejection(id, personTier(columns), before, draft),
    ];
    requireEdits(actor, made);
    await writePersonDraft(transaction, actor.user.id, id, before, undefined);
    await recordSensitiveChanges(transaction, actor.user.id, made);
    return recordChanges(
      transaction,
      actor,
      made,
      before === undefined ? "discard" : "edit",
    );
  });
}

// Sends a rejected draft for approval again, within a change already under way with drafts locked,
// and returns the changes made, for the caller to record.
export async function resubmitPersonDraftIn(
  transaction: Transaction,
  actor: Actor,
  id: string,
): Promise<Change[]> {
  requirePermission(actor, "people:edit");
  const columns = await columnsWithAdded(transaction, actor.user.id, true);
  const { before, draft } = await lockDrafted(transaction, actor, columns, id);
  if (draft?.state !== "rejected") {
    throw new ConflictError("Only a rejected draft can be resubmitted");
  }
  const tierOf = personTier(columns);
  // Resubmitting sends every change the draft holds, so it needs the right to make each of them.
  for (const field of draftFields(before, draft)) {
    requireSensitivityEdit(actor, tierOf(field));
  }
  const made = clearedRejection(id, tierOf, before, draft);
  await transaction
    .update(drafts)
    .set({ state: "waiting", reason: null })
    .where(and(eq(drafts.recordType, "person"), eq(drafts.recordId, id)));
  return made;
}

// Discards a person's draft, within a change already under way with drafts locked, and returns the
// changes made, for the caller to record.
export async function discardPersonDraftIn(
  transaction: Transaction,
  actor: Actor,
  id: string,
): Promise<Change[]> {
  requirePermission(actor, "people:edit");
  const columns = await columnsWithAdded(transaction, actor.user.id, true);
  const { before, draft, person } = await lockDrafted(
    transaction,
    actor,
    columns,
    id,
  );
  if (draft === undefined) {
    throw new NotFoundError("This person has no draft");
  }
  let action: Change["action"] = "changed";
  if (person === undefined) action = "created";
  else if (before === undefined) action = "deleted";
  const made = [
    ...asDraft(personChanges(columns, id, action, person, before)),
    ...clearedRejection(id, personTier(columns), before, draft),
  ];
  requireEdits(actor, made);
  await writePersonDraft(transaction, actor.user.id, id, before, before);
  return made;
}
