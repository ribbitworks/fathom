// SPDX-License-Identifier: Apache-2.0

// Allocations: reading, drafting and approving who works on which feature, from which month, at
// what share of their month. Part of the data access layer.

import {
  allocations,
  type Database,
  drafts,
  featureTeams,
  listItems,
  people,
  plannedHires,
  type Reader,
  unpublishedDrafts,
} from "@fathom/db";
import {
  type AllocationChange,
  type AllocationMonths,
  type Allocations,
  type Asking,
  changedSpans,
  hireCalled,
  knownColour,
  meaningSchema,
  type PaletteColour,
  type MonthSpan,
  withChange,
} from "@fathom/shared";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { type Actor, requirePermission, requireView } from "../access.ts";
import { BadRequestError, ConflictError, NotFoundError } from "../errors.ts";
import { type Change, changesBetween, type Transaction } from "./changes.ts";
import { draftMakers, everything } from "./draft-makers.ts";
import type { Recorded } from "./draft-records.ts";
import { allocationFields, allocationKind } from "./allocation-kinds.ts";
import { expectedMonth, hireIdOf } from "./hire-fields.ts";
import { currentOn, employedMonths, type Employment } from "./people-reads.ts";
import { drafting, saveRecordDraft } from "./record-drafting.ts";
import { readRecordsState, recordDraftOut, recordHeldBy } from "./records.ts";
import {
  addedOnly,
  everyVersion,
  type RecordsState,
  shownIds,
  shownVersion,
  stateOf,
  versionOf,
} from "./record-state.ts";
import { featureCalled } from "./release-kinds.ts";
import { text } from "./reporting.ts";
import { readToday } from "./settings.ts";

const type = "allocation";

const monthsOf = (record: Recorded | undefined): AllocationMonths =>
  (record?.months ?? {}) as AllocationMonths;

// The features some allocation gives a month: as the reader's view of drafts makes the allocations,
// and as they are live.
export function staffedFeatures(state: RecordsState): {
  drafted: ReadonlySet<string>;
  live: ReadonlySet<string>;
} {
  const { live } = stateOf(state, type);
  const staffing = (version: (id: string) => Recorded | undefined) =>
    new Set(
      shownIds(state, type).flatMap((id) => {
        const record = version(id);
        return Object.values(monthsOf(record)).some(
          (percentage) => percentage !== null,
        )
          ? [String(record?.featureId)]
          : [];
      }),
    );
  return {
    drafted: staffing((id) => versionOf(state, type, id)),
    live: staffing((id) => live.get(id)),
  };
}

// The first and last months someone can be allocated: a person's start and end months, which every
// reader of allocations sees, and a planned hire's month it is expected.
interface Bounds {
  first?: string;
  last?: string;
}

// Where a change puts someone on a feature outside the months they can be allocated in, if it does.
type Outside = { before: string } | { after: string };

function outsideOf(
  spans: readonly MonthSpan[],
  { first, last }: Bounds,
): Outside | undefined {
  const allocated = spans.filter(({ percentage }) => percentage !== null);
  if (first !== undefined && allocated.some(({ from }) => from < first)) {
    return { before: first };
  }
  if (
    last !== undefined &&
    allocated.some(({ to }) => to === undefined || to > last)
  ) {
    return { after: last };
  }
  return undefined;
}

const nothingToStop = "There is no allocation to stop on that feature";

function draftingRefusal(outside: Outside, person: boolean): string {
  if ("after" in outside) {
    return `This person's last month is ${outside.after}. Choose a last month by then.`;
  }
  return person
    ? `This person starts in ${outside.before}. Choose a first month from then on.`
    : `This planned hire is expected in ${outside.before}. Choose a first month from then on.`;
}

// An Approver has no month to choose, so is told what does not fit, and what to do about it. The
// draft may never have fitted, since an editor who does not see Personal details drafts without
// knowing a person's start or end.
function approvingRefusal(
  outside: Outside,
  allocation: string,
  person: boolean,
): string {
  return `The draft of ${allocation} ${outsideInWords(outside, person)}. Reject the draft so it can be changed.`;
}

function outsideInWords(outside: Outside, person: boolean): string {
  if ("after" in outside) {
    return `runs past their last month, ${outside.after}`;
  }
  return person
    ? `starts before their first month, ${outside.before}`
    : `starts before ${outside.before}, the month they're expected`;
}

const notAllocatedYet = "This planned hire can't be allocated yet";
const chooseSomeone = "Choose someone from People";

async function employmentOf(
  reader: Reader,
  ids: readonly string[],
): Promise<Map<string, Employment & { preferredName: string }>> {
  if (ids.length === 0) return new Map();
  const rows = await reader
    .select({
      id: people.id,
      preferredName: people.preferredName,
      startDate: people.startDate,
      endDate: people.endDate,
    })
    .from(people)
    .where(inArray(people.id, [...new Set(ids)]));
  return new Map(rows.map(({ id, ...rest }) => [id, rest]));
}

interface HireFacts {
  expected: string;
  filledBy: string | null;
  called: string;
}

// The planned hires given, with what the rules need: the month each is expected, whether it is
// filled, and what it is called where its position is not shown.
async function hiresOf(
  reader: Reader,
  ids: readonly string[],
  today: string,
): Promise<Map<string, HireFacts>> {
  if (ids.length === 0) return new Map();
  const rows = await reader
    .select({
      id: plannedHires.id,
      name: plannedHires.name,
      requisition: plannedHires.requisition,
      temporaryNumber: plannedHires.temporaryNumber,
      targetDate: plannedHires.targetDate,
      filledBy: plannedHires.filledBy,
      fillerStart: people.startDate,
    })
    .from(plannedHires)
    .leftJoin(people, eq(people.id, plannedHires.filledBy))
    .where(inArray(plannedHires.id, [...new Set(ids)]));
  return new Map(
    rows.map((hire) => {
      const { requisition, temporaryId } = hireIdOf(hire);
      return [
        hire.id,
        {
          expected: expectedMonth(hire, today),
          filledBy: hire.filledBy,
          called: hireCalled(
            hire.name,
            String(requisition ?? temporaryId),
            undefined,
          ),
        },
      ];
    }),
  );
}

// Every allocation the actor sees, live and as drafts make them, and the features they name, and
// whether any names someone not current today, which tells of their start or end date.
export async function readAllocations(
  database: Database,
  actor: Actor,
): Promise<Allocations & { includedPersonal: boolean }> {
  requirePermission(actor, "allocations:view");
  requireView(actor, "allocations");
  const today = await readToday(database);
  return database.transaction(
    async (transaction) => {
      const state = await readRecordsState(transaction, actor.user.id);
      const records = shownIds(state, type).map((id) => ({
        id,
        // Every record listed is shown, live or as its draft makes it.
        record: shownVersion(state, type, id) as Recorded,
      }));
      const employment = await employmentOf(
        transaction,
        records.flatMap(({ record }) => text(record.personId) ?? []),
      );
      const personOf = (record: Recorded) =>
        employment.get(String(record.personId));
      const makers = new Map([
        [
          type,
          await draftMakers(
            transaction,
            type,
            records
              .map(({ id }) => id)
              .filter((id) => stateOf(state, type).drafts.has(id)),
            everything,
            actor,
          ),
        ],
      ] as const);
      const featureIds = [
        ...new Set(records.map(({ record }) => String(record.featureId))),
      ];
      const statusOf = (featureId: string) =>
        String(shownVersion(state, "feature", featureId)?.statusId);
      const meanings = new Map(
        featureIds.length === 0
          ? []
          : (
              await transaction
                .select({ id: listItems.id, meaning: listItems.meaning })
                .from(listItems)
                .where(
                  inArray(listItems.id, [...new Set(featureIds.map(statusOf))]),
                )
            ).map(({ id, meaning }) => [id, meaning]),
      );
      const teamOf = (featureId: string) =>
        text(shownVersion(state, "feature", featureId)?.featureTeamId);
      // A feature team's colour is shown only to those who see feature teams.
      const teamIds = actor.permissions.includes("feature-teams:view")
        ? [...new Set(featureIds.flatMap((id) => teamOf(id) ?? []))]
        : [];
      const colours = new Map(
        teamIds.length === 0
          ? []
          : (
              await transaction
                .select({ id: featureTeams.id, colour: featureTeams.colour })
                .from(featureTeams)
                .where(inArray(featureTeams.id, teamIds))
            ).map(({ id, colour }) => [id, knownColour(colour)]),
      );
      return {
        allocations: records.map(({ id, record }) => {
          const draft = recordDraftOut(allocationKind, state, makers, id);
          return {
            id,
            personId: text(record.personId),
            plannedHireId: text(record.plannedHireId),
            featureId: String(record.featureId),
            months: monthsOf(stateOf(state, type).live.get(id)),
            ...(draft === undefined
              ? {}
              : {
                  draft: {
                    action: draft.action,
                    months: monthsOf(versionOf(state, type, id)),
                    state: draft.state,
                    ...(draft.reason === undefined
                      ? {}
                      : { reason: draft.reason }),
                    madeBy: draft.madeBy,
                    madeAs: draft.madeAs,
                    madeAt: draft.madeAt,
                    editors: draft.editors,
                    ...(draft.unpublished === true
                      ? { unpublished: true }
                      : {}),
                    ...(draft.needsOtherApprover === true
                      ? { needsOtherApprover: true }
                      : {}),
                  },
                }),
            ...recordHeldBy(state, type, id),
          };
        }),
        // Every feature has a status, a choice of the feature statuses list, read above.
        features: featureIds.map((id) => ({
          id,
          name: featureCalled(state, id),
          meaning: meaningSchema.nullable().parse(meanings.get(statusOf(id))),
          colour: colourOf(colours, teamOf(id)),
        })),
        includedPersonal: records.some(({ record }) => {
          const person = personOf(record);
          return person !== undefined && !currentOn(person, today);
        }),
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

// The allocation a change is to: the one its person or planned hire already has to its feature, as
// anyone's drafts, published or not, make it, or a new one.
function allocationFor(
  state: RecordsState,
  change: AllocationChange,
): string | undefined {
  const assignee = (record: Recorded | undefined) =>
    change.personId === undefined
      ? record?.plannedHireId === change.plannedHireId
      : record?.personId === change.personId;
  return [...stateOf(state, type).live, ...everyVersion(state, type)].find(
    ([, record]) =>
      record !== undefined &&
      assignee(record) &&
      record.featureId === change.featureId,
  )?.[0];
}

// Refuses a feature that cannot be allocated: one that does not exist, or is only drafted to be
// added, which is allocated once it is approved.
function checkFeature(state: RecordsState, featureId: string): void {
  if (addedOnly(state, "feature", featureId)) {
    throw new ConflictError(
      "This feature is waiting for approval. Allocate people to it once it's approved.",
    );
  }
  if (!stateOf(state, "feature").live.has(featureId)) {
    throw new NotFoundError("There is no such feature");
  }
}

// The months someone can be allocated in, refusing someone who cannot be: a person who does not exist,
// or a planned hire that does not exist or is filled.
async function boundsFor(
  reader: Reader,
  change: AllocationChange,
  today: string,
): Promise<Bounds> {
  if (change.personId !== undefined) {
    const person = (await employmentOf(reader, [change.personId])).get(
      change.personId,
    );
    if (person === undefined) throw new NotFoundError(chooseSomeone);
    return employedMonths(person);
  }
  const hireId = String(change.plannedHireId);
  const hire = (await hiresOf(reader, [hireId], today)).get(hireId);
  if (hire === undefined) throw new NotFoundError(chooseSomeone);
  if (hire.filledBy !== null) throw new ConflictError(notAllocatedYet);
  return { first: hire.expected };
}

// Changes one allocation as a draft, from a month, until a month or with no end. A change that
// leaves an allocation only drafted to be added with no months takes it away, and one that leaves
// a live allocation with none drafts its removal.
export async function changeAllocation(
  database: Database,
  editor: Actor,
  change: AllocationChange,
): Promise<string | null> {
  requireView(editor, "allocations");
  const today = await readToday(database);
  return drafting(database, editor.user.id, async (transaction, state) => {
    checkFeature(state, change.featureId);
    const bounds = await boundsFor(transaction, change, today);
    // Someone else's unpublished changes to it, if any, refuse the change as they hold it.
    const made = allocationFor(state, change);
    const id = made ?? randomUUID();
    const before = monthsOf(versionOf(state, type, id));
    const months = withChange(before, change);
    if (made === undefined && Object.keys(months).length === 0) {
      throw new BadRequestError(nothingToStop);
    }
    const outside = outsideOf(changedSpans(before, months), bounds);
    if (outside !== undefined) {
      throw new BadRequestError(
        draftingRefusal(outside, change.personId !== undefined),
      );
    }
    return saveRecordDraft(
      transaction,
      editor,
      state,
      type,
      id,
      Object.keys(months).length === 0
        ? undefined
        : {
            personId: change.personId ?? null,
            plannedHireId: change.plannedHireId ?? null,
            featureId: change.featureId,
            months,
          },
    );
  });
}

// Refuses deciding drafts of allocations naming someone the Approver does not see, and approving
// those of a planned hire filled since, or that put someone on a feature outside their employment,
// as far as the Approver sees it.
export async function checkAllocationsAsked(
  transaction: Transaction,
  approver: Actor,
  ids: readonly string[],
  today: string,
  asking: Asking,
): Promise<void> {
  if (ids.length === 0) return;
  requireView(approver, "allocations");
  const state = await readRecordsState(transaction);
  // A draft asked for that no longer exists is refused when its records are approved or rejected.
  const wanted = ids.flatMap((id) => {
    const record = shownVersion(state, type, id);
    return record === undefined ? [] : [{ id, record }];
  });
  const employment = await employmentOf(
    transaction,
    wanted.flatMap(({ record }) => text(record.personId) ?? []),
  );
  const hires = await hiresOf(
    transaction,
    wanted.flatMap(({ record }) => text(record.plannedHireId) ?? []),
    today,
  );
  for (const { id, record } of wanted) {
    const person = employment.get(String(record.personId));
    if (asking === "reject") continue;
    // An allocation names a person or a planned hire that exists, since removing either removes it.
    const hire =
      person === undefined
        ? (hires.get(String(record.plannedHireId)) as HireFacts)
        : undefined;
    if (hire !== undefined && hire.filledBy !== null) {
      throw new ConflictError(notAllocatedYet);
    }
    const outside = outsideOf(
      changedSpans(
        monthsOf(stateOf(state, type).live.get(id)),
        monthsOf(versionOf(state, type, id)),
      ),
      hire === undefined
        ? employedMonths(person as Employment)
        : { first: hire.expected },
    );
    if (outside !== undefined) {
      const who = hire?.called ?? String(person?.preferredName);
      throw new ConflictError(
        approvingRefusal(
          outside,
          `${who} on ${featureCalled(state, String(record.featureId))}`,
          hire === undefined,
        ),
      );
    }
  }
}

// The allocations of the people or planned hires given, live, and whether any of them, or any only
// drafted to be added, has a draft, published or not.
async function allocationsOf(
  reader: Reader,
  column: "personId" | "plannedHireId",
  ids: readonly string[],
): Promise<{ rows: (typeof allocations.$inferSelect)[]; drafted: boolean }> {
  const ofPerson = column === "personId";
  const rows = await reader
    .select()
    .from(allocations)
    .where(
      inArray(ofPerson ? allocations.personId : allocations.plannedHireId, [
        ...ids,
      ]),
    );
  const liveIds = rows.map(({ id }) => id);
  const naming = (table: typeof drafts | typeof unpublishedDrafts) =>
    and(
      eq(table.recordType, type),
      or(
        liveIds.length === 0 ? undefined : inArray(table.recordId, liveIds),
        inArray(sql`${table.fields}->>${column}`, [...ids]),
      ),
    );
  const [published] = await reader
    .select({ id: drafts.recordId })
    .from(drafts)
    .where(naming(drafts))
    .limit(1);
  const [unpublished] = await reader
    .select({ id: unpublishedDrafts.recordId })
    .from(unpublishedDrafts)
    .where(naming(unpublishedDrafts))
    .limit(1);
  return {
    rows,
    drafted: published !== undefined || unpublished !== undefined,
  };
}

// Removes the allocations of the people or planned hires being removed, and returns the changes,
// refusing while any of them has a draft, published or not, since it would be left with nobody.
export async function removeAllocationsOf(
  transaction: Transaction,
  column: "personId" | "plannedHireId",
  ids: readonly string[],
): Promise<Change[]> {
  if (ids.length === 0) return [];
  const { rows, drafted } = await allocationsOf(transaction, column, ids);
  if (drafted) {
    throw new ConflictError(
      "Someone being removed has allocations with drafts. Approve, reject, or discard those drafts first.",
    );
  }
  if (rows.length === 0) return [];
  await transaction.delete(allocations).where(
    inArray(
      allocations.id,
      rows.map(({ id }) => id),
    ),
  );
  return rows.flatMap((row) =>
    changesBetween(
      type,
      row.id,
      "deleted",
      row as unknown as Recorded,
      undefined,
      allocationFields,
    ),
  );
}

// Refuses filling a planned hire that has allocations, live or drafted, which filling can't move to
// the person who fills it yet.
export async function refuseFillingAllocated(
  reader: Reader,
  hireId: string,
): Promise<void> {
  const { rows, drafted } = await allocationsOf(reader, "plannedHireId", [
    hireId,
  ]);
  if (rows.length > 0 || drafted) {
    throw new ConflictError(
      "This planned hire has allocations, which filling it can't move yet. Remove them first.",
    );
  }
}

// A feature's colour, its team's; none for a feature with no team, or a team not read.
const colourOf = (
  colours: ReadonlyMap<string, PaletteColour | null>,
  teamId: string | null | undefined,
): PaletteColour | null =>
  teamId === null || teamId === undefined
    ? null
    : (colours.get(teamId) ?? null);
