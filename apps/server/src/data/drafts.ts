// SPDX-License-Identifier: Apache-2.0

// Draft rows: the changes waiting for approval, as the Decisions Log sets out. Part of the data
// access layer. Each person, list, and choice has at most one draft, which adds it, changes some of
// its fields, or removes it, and each list's choices have at most one draft of their order;
// everyone who sees the records sees the published drafts in place of the live values. A draft is
// kept as the change history records the record, holding all of an added record's fields, only the
// fields that differ from the live record, or none for a removal, and the live record changes only
// when an Approver approves it. A user's changes to drafts are kept as their unpublished drafts, as
// ADR 0008 sets out, which they see in place of the published ones and which hold the records for
// them until they publish or discard them, as unpublished.ts sets out.

import {
  changes,
  changeSets,
  type Database,
  drafts,
  fieldOfValue,
  inChunks,
  people,
  plannedHires,
  unpublishedDrafts,
  users,
} from "@fathom/db";
import {
  isLink,
  type RecordType as PlanRecordType,
  type Tier,
} from "@fathom/shared";
import {
  type AnyColumn,
  and,
  eq,
  inArray,
  ne,
  notInArray,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { mostSensitive, storedTier } from "../access.ts";
import { ConflictError } from "../errors.ts";
import { type Change, stableJson, type Transaction } from "./changes.ts";
import { isNote, typeOf } from "./column-types.ts";
import type { ColumnInfo } from "./values.ts";

type Reader = Pick<Database, "select">;

// A record as the change history records it, such as a person's details and each column's choices,
// left out when none are chosen.
export type Recorded = Record<string, unknown>;

export type DraftRow = typeof drafts.$inferSelect;
type UnpublishedRow = typeof unpublishedDrafts.$inferSelect;

// The user whose own unpublished drafts are read in place of the published ones, or undefined to
// read the published drafts alone, as Approvers decide them.
export type Viewer = string | undefined;

// The kinds of record that have drafts. A list's choice order is one record, named by its list.
export type DraftType =
  | "person"
  | "planned-hire"
  | "list"
  | "list-item"
  | "choice-order"
  | "field"
  | "column-order"
  | PlanRecordType;

export interface Draft {
  action: Change["action"];
  fields: Recorded;
  state: "waiting" | "rejected";
  reason: string | null;
  // Rises with each draft made, so records drafted to be added keep the order they were drafted in.
  sequence: number;
  // Whether the draft holds the viewer's own changes, not yet published.
  unpublished?: boolean;
}

// A rejected draft is back with its makers until they send it again, so it is approved neither
// itself nor with a draft that uses it.
export function refuseRejected(found: Iterable<Draft | undefined>): void {
  for (const draft of found) {
    if (draft?.state === "rejected") {
      throw new ConflictError(
        "One of these drafts, or one it depends on, was rejected; it can be approved once that draft is resubmitted",
      );
    }
  }
}

// The history field that holds a rejected draft's reason, which waiting drafts do not have.
export const rejectedField = "rejected";

// Values as stored, so lists of choices compare by what they hold.
const same = (first: unknown, second: unknown) =>
  stableJson(first ?? null) === stableJson(second ?? null);

// A person's choices for a column, cleared when there are none.
const isEmpty = (value: unknown) =>
  value === undefined ||
  value === null ||
  (Array.isArray(value) && value.length === 0);

// A person with columns that have nothing chosen left out, as the history records them.
export function tidy(record: Recorded): Recorded {
  return Object.fromEntries(
    Object.entries(record).filter(
      ([field, value]) => fieldOfValue(field) === null || !isEmpty(value),
    ),
  );
}

function toDraft(row: DraftRow): Draft {
  return {
    action: row.action as Change["action"],
    fields: row.fields,
    state: row.state === "rejected" ? "rejected" : "waiting",
    reason: row.reason,
    sequence: row.sequence,
  };
}

// An unpublished draft waits for approval once published, whatever the draft it replaces.
function toUnpublished(row: UnpublishedRow): Draft {
  return {
    action: row.action as Change["action"],
    fields: row.fields,
    state: "waiting",
    reason: null,
    sequence: row.sequence,
    unpublished: true,
  };
}

// The unpublished draft of a record whose user wants no draft of it, so publishing removes the
// published one.
const noDraft = { action: "changed", fields: {} } as const;

export const wantsNoDraft = (row: { action: string; fields: Recorded }) =>
  row.action === "changed" && Object.keys(row.fields).length === 0;

// The person as their draft makes them: undefined once removed, or before they are added.
export function drafted(
  live: Recorded | undefined,
  draft: Draft | undefined,
): Recorded | undefined {
  if (draft === undefined) return live;
  if (draft.action === "created") return draft.fields;
  // A change or removal of someone no longer live, as when seed data is removed, makes no one.
  if (draft.action === "deleted" || live === undefined) return undefined;
  return tidy({ ...live, ...draft.fields });
}

// The draft that makes a live person, or no one, into the person wanted: undefined when nothing
// differs. A column cleared in a draft holds no choices, so it is not taken for unchanged.
export function draftBetween(
  live: Recorded | undefined,
  wanted: Recorded | undefined,
): Pick<Draft, "action" | "fields"> | undefined {
  if (wanted === undefined) {
    return live === undefined ? undefined : { action: "deleted", fields: {} };
  }
  if (live === undefined) return { action: "created", fields: tidy(wanted) };
  const fields: Recorded = {};
  for (const field of new Set([...Object.keys(live), ...Object.keys(wanted)])) {
    // The fields are the person's own, read just above.
    /* eslint-disable security/detect-object-injection */
    if (!same(live[field], wanted[field])) {
      fields[field] =
        wanted[field] ?? (fieldOfValue(field) === null ? null : []);
    }
    /* eslint-enable security/detect-object-injection */
  }
  return Object.keys(fields).length === 0
    ? undefined
    : { action: "changed", fields };
}

// The fields a draft touches: those an added or removed person has a value in, or those a change
// makes differ, as the change history records them.
export function draftFields(
  live: Recorded | undefined,
  draft: Draft,
): string[] {
  if (draft.action === "changed") return Object.keys(draft.fields);
  return Object.entries(draft.action === "created" ? draft.fields : { ...live })
    .filter(([, value]) => value !== null)
    .map(([field]) => field);
}

// How sensitive a draft is: as its most sensitive field, which a rejection's reason takes too.
export function draftTier(
  tierOf: (field: string) => Tier,
  live: Recorded | undefined,
  draft: Draft,
): Tier {
  return mostSensitive(draftFields(live, draft).map(tierOf));
}

// Changes to drafts of every kind wait for one another, as do approvals, rejections, undoing,
// publishing and discarding unpublished changes, and deleting a choice, so two cannot update the
// same draft, take the same Employee ID or name, or remove a choice a draft is being given, at
// once. It is taken before any row is locked.
export async function lockDrafts(transaction: Transaction) {
  await transaction.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended('fathom.drafts', 0))`,
  );
}

// Rows of one table for the records of one kind given, or of every record of that kind, read in
// chunks small enough for one statement each.
async function readRows<Row>(
  ids: readonly string[] | undefined,
  read: (chunk: readonly string[] | undefined) => Promise<Row[]>,
): Promise<Row[]> {
  if (ids === undefined) return read(undefined);
  const rows: Row[] = [];
  for (const chunk of inChunks([...ids])) rows.push(...(await read(chunk)));
  return rows;
}

const bySequence = (
  first: { sequence: number },
  second: { sequence: number },
) => first.sequence - second.sequence;

// The drafts of the records of one kind given, or of every record of that kind, by record, in the
// order they were made: the published drafts, with the viewer's own unpublished drafts in their
// place, and the records only the viewer drafts adding after them. A record the viewer wants no
// draft of has none.
export async function readDrafts(
  reader: Reader,
  recordType: DraftType,
  ids?: readonly string[],
  viewer?: Viewer,
): Promise<Map<string, Draft>> {
  const published = await readRows(ids, (chunk) =>
    reader
      .select()
      .from(drafts)
      .where(
        and(
          eq(drafts.recordType, recordType),
          chunk === undefined
            ? undefined
            : inArray(drafts.recordId, [...chunk]),
        ),
      ),
  );
  const found = new Map(
    published.sort(bySequence).map((row) => [row.recordId, toDraft(row)]),
  );
  if (viewer === undefined) return found;
  const own = await readRows(ids, (chunk) =>
    reader
      .select()
      .from(unpublishedDrafts)
      .where(
        and(
          eq(unpublishedDrafts.recordType, recordType),
          eq(unpublishedDrafts.userId, viewer),
          chunk === undefined
            ? undefined
            : inArray(unpublishedDrafts.recordId, [...chunk]),
        ),
      ),
  );
  for (const row of own.sort(bySequence)) {
    if (wantsNoDraft(row)) found.delete(row.recordId);
    else found.set(row.recordId, toUnpublished(row));
  }
  return found;
}

// The drafts of the people given, or of everyone, by person.
export const readPersonDrafts = (
  reader: Reader,
  ids?: readonly string[],
  viewer?: Viewer,
) => readDrafts(reader, "person", ids, viewer);

// A record someone holds by having unpublished changes to it: who, and the draft they intend, which
// wants no draft at all when it changes nothing.
export interface Held {
  holderId: string;
  holder: string;
  draft: Draft;
}

// The records of one kind given, or of every record of that kind, that users other than the viewer
// hold, or that anyone holds when there is no viewer, by record.
export async function readHeld(
  reader: Reader,
  recordType: DraftType,
  viewer: Viewer,
  ids?: readonly string[],
): Promise<Map<string, Held>> {
  const rows = await readRows(ids, (chunk) =>
    reader
      .select({ row: unpublishedDrafts, holder: users.name })
      .from(unpublishedDrafts)
      .innerJoin(users, eq(users.id, unpublishedDrafts.userId))
      .where(
        and(
          eq(unpublishedDrafts.recordType, recordType),
          viewer === undefined
            ? undefined
            : ne(unpublishedDrafts.userId, viewer),
          chunk === undefined
            ? undefined
            : inArray(unpublishedDrafts.recordId, [...chunk]),
        ),
      ),
  );
  return new Map(
    rows
      .sort((first, second) => bySequence(first.row, second.row))
      .map(({ row, holder }) => [
        row.recordId,
        { holderId: row.userId, holder, draft: toUnpublished(row) },
      ]),
  );
}

export const heldMessage = (holder: string) =>
  `${holder} is changing this; it can be changed once they publish or discard their changes`;

// Refuses a change to records someone other than the editor holds.
export async function refuseHeld(
  reader: Reader,
  editor: string,
  recordType: DraftType,
  ids: readonly string[],
): Promise<void> {
  const [held] = (await readHeld(reader, recordType, editor, ids)).values();
  if (held !== undefined) throw new ConflictError(heldMessage(held.holder));
}

// Refuses approving or rejecting drafts of records anyone holds, the Approver included, since
// Approvers decide only published drafts that nobody is changing.
export async function refuseHeldDecision(
  reader: Reader,
  recordType: DraftType,
  ids: readonly string[],
): Promise<void> {
  const [held] = (await readHeld(reader, recordType, undefined, ids)).values();
  if (held !== undefined) {
    throw new ConflictError(
      `${held.holder} is changing one of these drafts; it can be decided once they publish or discard their changes`,
    );
  }
}

// Whether two drafts make the same change, field for field.
function sameDraft(
  first: Pick<Draft, "action" | "fields"> | undefined,
  second: Pick<Draft, "action" | "fields"> | undefined,
): boolean {
  if (first === undefined || second === undefined) return first === second;
  const keys = Object.keys(first.fields);
  return (
    first.action === second.action &&
    keys.length === Object.keys(second.fields).length &&
    keys.every(
      (key) =>
        Object.hasOwn(second.fields, key) &&
        // The keys are the drafts' own, read just above.
        // eslint-disable-next-line security/detect-object-injection
        same(first.fields[key], second.fields[key]),
    )
  );
}

// Keeps the draft the editor intends for a record as their unpublished draft: none at all when it
// is the published draft, so the record is no longer held, and one that wants no draft when the
// editor wants none but there is a published one.
async function keepUnpublished(
  transaction: Transaction,
  editor: string,
  recordType: DraftType,
  id: string,
  draft: Pick<Draft, "action" | "fields"> | undefined,
): Promise<void> {
  await refuseHeld(transaction, editor, recordType, [id]);
  const published = (await readDrafts(transaction, recordType, [id])).get(id);
  if (sameDraft(draft, published)) {
    await transaction
      .delete(unpublishedDrafts)
      .where(
        and(
          eq(unpublishedDrafts.recordType, recordType),
          eq(unpublishedDrafts.recordId, id),
        ),
      );
    return;
  }
  const row = draft ?? noDraft;
  await transaction
    .insert(unpublishedDrafts)
    .values({ recordType, recordId: id, userId: editor, ...row })
    .onConflictDoUpdate({
      target: [unpublishedDrafts.recordType, unpublishedDrafts.recordId],
      set: { action: row.action, fields: row.fields },
    });
}

export type Rejection = Pick<Draft, "state" | "reason">;

// Keeps the editor's draft of a record as wanted, as their unpublished draft, refusing a record
// someone else holds.
export async function writeDraft(
  transaction: Transaction,
  editor: string,
  recordType: DraftType,
  id: string,
  live: Recorded | undefined,
  wanted: Recorded | undefined,
): Promise<void> {
  await keepUnpublished(
    transaction,
    editor,
    recordType,
    id,
    draftBetween(live, wanted),
  );
}

export const writePersonDraft = (
  transaction: Transaction,
  editor: string,
  id: string,
  live: Recorded | undefined,
  wanted: Recorded | undefined,
) => writeDraft(transaction, editor, "person", id, live, wanted);

// Discards the editor's drafts of the records of one kind given, so that, once they publish, the
// records are as they are live.
export async function discardDrafts(
  transaction: Transaction,
  editor: string,
  recordType: DraftType,
  ids: readonly string[],
): Promise<void> {
  for (const id of ids) {
    await keepUnpublished(transaction, editor, recordType, id, undefined);
  }
}

// Removes the published drafts of the records of one kind given, as approving them does.
export async function deleteDrafts(
  transaction: Transaction,
  recordType: DraftType,
  ids: readonly string[],
): Promise<void> {
  for (const chunk of inChunks([...ids])) {
    await transaction
      .delete(drafts)
      .where(
        and(eq(drafts.recordType, recordType), inArray(drafts.recordId, chunk)),
      );
  }
}

// Marks the published drafts of the records of one kind given as waiting again, or as rejected for
// a reason.
export async function setRejection(
  transaction: Transaction,
  recordType: DraftType,
  ids: readonly string[],
  rejection: Rejection,
): Promise<void> {
  for (const chunk of inChunks([...ids])) {
    await transaction
      .update(drafts)
      .set(rejection)
      .where(
        and(eq(drafts.recordType, recordType), inArray(drafts.recordId, chunk)),
      );
  }
}

export interface Maker {
  madeBy: string | null;
  madeAt: Date;
  // Everyone who changed the draft, by name, first to last, null for Fathom itself.
  editors: (string | null)[];
  // Who last changed each field of the draft, by field as the change history names it.
  fieldEditors: Map<string, string | null>;
}

// For readers who see every field of a draft, such as those of lists and columns, which are
// General.
export const everything = () => true;

// The change sets holding a user's unpublished changes since they last discarded them all, which
// publishing publishes; those before are discarded, so are never published.
export function openChangeSets(userId: string): SQL {
  return and(
    eq(changeSets.unpublished, true),
    eq(changeSets.madeBy, userId),
    sql`${changeSets.madeAt} > coalesce((SELECT max(withdrawn.made_at) FROM fathom.change_sets AS withdrawn WHERE withdrawn.made_by = ${userId} AND withdrawn.kind = 'withdrawal'), '-infinity')`,
  ) as SQL;
}

// Who changed each record's draft, and when, from the changes to it the reader may see, so a hidden
// change reveals nothing: the latest, and everyone since the record's last draft was approved or
// discarded. Rejecting a draft, or sending it for approval again unchanged, does not change it.
// Unpublished changes count only for the viewer's own unpublished drafts, which hold them.
export async function draftMakers(
  reader: Pick<Database, "select">,
  recordType: DraftType,
  ids: readonly string[],
  seen: (field: string, tier: Tier) => boolean,
  viewer: string,
): Promise<Map<string, Maker>> {
  const makers = new Map<string, Maker>();
  for (const chunk of inChunks([...ids])) {
    const ownRows = await reader
      .select({ id: unpublishedDrafts.recordId })
      .from(unpublishedDrafts)
      .where(
        and(
          eq(unpublishedDrafts.recordType, recordType),
          eq(unpublishedDrafts.userId, viewer),
          inArray(unpublishedDrafts.recordId, chunk),
        ),
      );
    const own = new Set(ownRows.map(({ id }) => id));
    const rows = await reader
      .select({
        recordId: changes.recordId,
        field: changes.field,
        tier: changes.tier,
        draft: changes.draft,
        kind: changeSets.kind,
        unpublished: changeSets.unpublished,
        madeBy: users.name,
        madeAt: changeSets.madeAt,
      })
      .from(changes)
      .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
      .leftJoin(users, eq(users.id, changeSets.madeBy))
      .where(
        and(
          eq(changes.recordType, recordType),
          inArray(changes.recordId, chunk),
          or(
            eq(changes.draft, true),
            inArray(changeSets.kind, ["approval", "discard"]),
          ),
          or(eq(changeSets.unpublished, false), openChangeSets(viewer)),
        ),
      )
      .orderBy(changes.id);
    for (const row of rows) {
      if (row.unpublished && !own.has(row.recordId)) continue;
      if (row.kind === "approval" || row.kind === "discard") {
        makers.delete(row.recordId);
        continue;
      }
      const recorded = storedTier(row.tier);
      if (
        row.kind === "rejection" ||
        row.kind === "resubmission" ||
        !seen(row.field, recorded)
      ) {
        continue;
      }
      const maker = makers.get(row.recordId);
      const editors = maker?.editors ?? [];
      makers.set(row.recordId, {
        madeBy: row.madeBy,
        madeAt: row.madeAt,
        editors: [
          ...editors.filter((editor) => editor !== row.madeBy),
          row.madeBy,
        ],
        fieldEditors: new Map(maker?.fieldEditors).set(row.field, row.madeBy),
      });
    }
  }
  return makers;
}

// Adds the editor's unpublished drafts of records of one kind drafted to be added together, such
// as pasted rows, in as few statements as PostgreSQL allows, keeping the order given.
export async function addDrafts(
  transaction: Transaction,
  editor: string,
  recordType: DraftType,
  added: readonly { id: string; fields: Recorded }[],
): Promise<void> {
  for (const chunk of inChunks([...added])) {
    await transaction.insert(unpublishedDrafts).values(
      chunk.map(({ id, fields }) => ({
        recordType,
        recordId: id,
        userId: editor,
        action: "created",
        fields,
      })),
    );
  }
}

export const addPersonDrafts = (
  transaction: Transaction,
  editor: string,
  added: readonly { id: string; fields: Recorded }[],
) =>
  addDrafts(
    transaction,
    editor,
    "person",
    added.map(({ id, fields }) => ({ id, fields: tidy(fields) })),
  );

// The IDs asked for that another row of the ID column already has, ignoring letter case: a person's
// Employee ID or a planned hire's requisition, live or as a draft makes it, published or not. A live
// ID stays taken until a draft that changes it is approved, so approving drafts one at a time never
// finds two rows with the same one, and an unpublished draft's until it is discarded, so publishing
// never finds it taken. The records excepted are people or hires, whose identifiers never clash.
export async function takenEmployeeIds(
  reader: Reader,
  employeeIds: readonly string[],
  except: readonly string[],
): Promise<string[]> {
  const lowered = [...new Set(employeeIds.map((id) => id.toLowerCase()))];
  const taken = new Set<string>();
  for (const chunk of inChunks(lowered)) {
    const live = await reader
      .select({ value: people.employeeId })
      .from(people)
      .where(
        and(
          inArray(sql`lower(${people.employeeId})`, chunk),
          except.length === 0 ? undefined : notInArray(people.id, [...except]),
        ),
      );
    const liveHires = await reader
      .select({ value: sql<string>`${plannedHires.requisition}` })
      .from(plannedHires)
      .where(
        and(
          inArray(sql`lower(${plannedHires.requisition})`, chunk),
          except.length === 0
            ? undefined
            : notInArray(plannedHires.id, [...except]),
        ),
      );
    for (const { value } of [
      ...live,
      ...liveHires,
      ...(await draftedPersonValues(reader, "employeeId", chunk, except)),
      ...(await draftedTexts(
        reader,
        "planned-hire",
        "requisition",
        chunk,
        except,
      )),
    ]) {
      taken.add(value.toLowerCase());
    }
  }
  return employeeIds.filter((id) => taken.has(id.toLowerCase()));
}

// The values of a person's text field, such as an Employee ID, that drafts of people other than
// those excepted hold, published or not, among those given in lower case.
export const draftedPersonValues = (
  reader: Reader,
  field: string,
  lowered: readonly string[],
  except: readonly string[],
) => draftedTexts(reader, "person", field, lowered, except);

// The values of a text field that drafts of records of the type given, other than those excepted,
// hold, published or not, among those given in lower case.
async function draftedTexts(
  reader: Reader,
  recordType: string,
  field: string,
  lowered: readonly string[],
  except: readonly string[],
): Promise<{ value: string }[]> {
  const found = [];
  for (const table of [drafts, unpublishedDrafts]) {
    found.push(
      ...(await reader
        .select({ value: sql<string>`${table.fields}->>${field}::text` })
        .from(table)
        .where(
          and(
            eq(table.recordType, recordType),
            inArray(sql`lower(${table.fields}->>${field}::text)`, [...lowered]),
            except.length === 0
              ? undefined
              : notInArray(table.recordId, [...except]),
          ),
        )),
    );
  }
  return found;
}

// Whether any person's or planned hire's draft, published or not, changes the column, even to clear
// it, or whether a draft of either has the choice given, as a value, or as a position or state. The
// editor's unpublished drafts stand in for the published drafts of the same records, so a draft
// they have changed or discarded but not yet published no longer counts.
export async function draftsUse(
  reader: Reader,
  use: { column: string } | { choice: string },
  editor?: string,
): Promise<boolean> {
  for (const table of [drafts, unpublishedDrafts]) {
    const found = await reader
      .select({ one: sql`1` })
      .from(table)
      .where(
        "column" in use
          ? or(
              ...valueOwners.map((recordType) =>
                and(
                  eq(table.recordType, recordType),
                  sql`${table.fields} ? ${`value:${use.column}`}::text`,
                  table === drafts && editor !== undefined
                    ? notReplacedBy(recordType, table.recordId, editor)
                    : undefined,
                ),
              ),
            )
          : or(
              and(
                eq(table.recordType, "person"),
                or(
                  holdsChoice(table.fields, use.choice),
                  sql`${table.fields}->>'positionId' = ${use.choice}`,
                ),
                table === drafts && editor !== undefined
                  ? notReplacedBy("person", table.recordId, editor)
                  : undefined,
              ),
              and(
                eq(table.recordType, "planned-hire"),
                or(
                  holdsChoice(table.fields, use.choice),
                  sql`${table.fields}->>'positionId' = ${use.choice}`,
                  sql`${table.fields}->>'stateId' = ${use.choice}`,
                ),
                table === drafts && editor !== undefined
                  ? notReplacedBy("planned-hire", table.recordId, editor)
                  : undefined,
              ),
            ),
      )
      .limit(1);
    if (found.length > 0) return true;
  }
  return false;
}

// The kinds of record whose drafts give values in People's columns.
const valueOwners = ["person", "planned-hire"] as const;

// Whether a draft's fields give a column's value holding the choice.
const holdsChoice = (fields: AnyColumn, choiceId: string) =>
  sql`EXISTS (SELECT 1 FROM jsonb_each(${fields}) AS held(field, value) WHERE jsonb_typeof(held.value) = 'array' AND held.value @> ${JSON.stringify([choiceId])}::jsonb)`;

// Whether the editor holds no unpublished draft of the record whose published draft is given.
const notReplacedBy = (
  recordType: string,
  recordId: AnyColumn,
  editor: string,
) =>
  sql`NOT EXISTS (SELECT 1 FROM ${unpublishedDrafts} WHERE ${unpublishedDrafts.recordType} = ${recordType} AND ${unpublishedDrafts.recordId} = ${recordId} AND ${unpublishedDrafts.userId} = ${editor})`;

// The changes recorded for a rejected draft whose reason is cleared, as when it is changed again or
// discarded, so it waits for approval again.
export function clearedRejection(
  id: string,
  tierOf: (field: string) => Tier,
  live: Recorded | undefined,
  draft: Draft | undefined,
  recordType: DraftType = "person",
): Change[] {
  return draft?.state === "rejected"
    ? [
        {
          recordType,
          recordId: id,
          action: "changed",
          field: rejectedField,
          tier: draftTier(tierOf, live, draft),
          oldValue: draft.reason,
          newValue: null,
          draft: true,
        },
      ]
    : [];
}

// Changes marked as changes to drafts.
export const asDraft = (made: readonly Change[]): Change[] =>
  made.map((change) => ({ ...change, draft: true }));

// How many values a recorded value holds: its choices, or one link or note, or undefined when none
// is recorded.
export function valueCount(value: unknown): number | undefined {
  if (Array.isArray(value)) return value.length;
  if (isLink(value) || isNote(value)) return 1;
  return undefined;
}

// A column's values as drafts hold them, for checking that the column's settings fit the drafts
// too: for each draft, published or not, that adds or changes a person or planned hire, whether it
// is a hire's, how many values it gives the column, or undefined when it leaves the column as it
// is.
export async function draftedValues(
  reader: Reader,
  columnId: string,
): Promise<{ hire: boolean; adds: boolean; held: number | undefined }[]> {
  const rows = [];
  for (const table of [drafts, unpublishedDrafts]) {
    rows.push(
      ...(await reader
        .select({
          recordType: table.recordType,
          action: table.action,
          value: sql<unknown>`${table.fields} -> ${`value:${columnId}`}::text`,
        })
        .from(table)
        .where(
          and(
            inArray(table.recordType, ["person", "planned-hire"]),
            inArray(table.action, ["created", "changed"]),
          ),
        )),
    );
  }
  return rows.map(({ recordType, action, value }) => ({
    hire: recordType === "planned-hire",
    adds: action === "created",
    held: valueCount(value),
  }));
}

// Whether the columns hold a person as recorded: each value one its column's type holds, as
// column-types.ts sets out, and a value in every required column.
export function fitsColumns(
  columns: readonly ColumnInfo[],
  listOf: ReadonlyMap<string, string>,
  person: Recorded,
): boolean {
  const known = new Set(columns.map(({ id }) => id));
  const strayValue = Object.keys(person).some((field) => {
    const columnId = fieldOfValue(field);
    return columnId !== null && !known.has(columnId);
  });
  return (
    !strayValue &&
    columns.every((column) => {
      const value = person[`value:${column.id}`];
      const type = typeOf(column);
      return (
        (!column.required || type.count(value) > 0) &&
        type.fits(column, value, listOf)
      );
    })
  );
}
