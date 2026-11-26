// SPDX-License-Identifier: Apache-2.0

// Reading planned hires and their drafts as each reader may see them, a hire as a row of the People
// table, and the facts other records read of hires. Part of the data access layer.

import {
  type Database,
  inChunks,
  people,
  plannedHires,
  type Reader,
} from "@fathom/db";
import {
  hireCalled,
  type Hire,
  type HireDraft,
  type Hires,
  type Person,
  seesEmployment,
} from "@fathom/shared";
import { eq, inArray } from "drizzle-orm";
import { type Actor, requirePermission, seesSensitivity } from "../access.ts";
import { columnsWithAdded } from "./added-columns.ts";
import { type LiveValues, noLiveValues, typeOf } from "./column-types.ts";
import {
  choiceLabels,
  type ColumnInfo,
  fieldOfValue,
  readColumns,
  readValues,
} from "./values.ts";
import {
  type Draft,
  drafted,
  draftFields,
  type Recorded,
  type Viewer,
} from "./draft-records.ts";
import { draftMakers, ownMarks } from "./draft-makers.ts";
import { heldByOf, readDrafts, readHeld } from "./drafts.ts";
import { keyNumberOf, readKeyNumbers } from "./record-keys.ts";
import { notStarted } from "./people-reads.ts";
import { shownValuesOf } from "./person-fields.ts";
import { text } from "./reporting.ts";
import { readToday } from "./settings.ts";
import {
  expectedMonth,
  hireIdOf,
  type HireRow,
  nameOfHire,
  offeredOn,
  readHireTier,
  recordedHire,
  recordType,
  seesHireField,
  undatedMark,
} from "./hire-fields.ts";

// The live hires given, or every hire, as recorded, with their values in People's live columns, by
// hire, locked for a change when asked.
export async function readLiveHires(
  reader: Reader,
  ids?: readonly string[],
  lock = false,
): Promise<Map<string, Recorded>> {
  const rows: HireRow[] = [];
  const read = async (chunk?: readonly string[]) => {
    const query = reader
      .select()
      .from(plannedHires)
      .where(
        chunk === undefined ? undefined : inArray(plannedHires.id, [...chunk]),
      )
      .orderBy(plannedHires.id);
    rows.push(...(await (lock ? query.for("update") : query)));
  };
  if (ids === undefined) await read();
  else for (const chunk of inChunks([...ids])) await read(chunk);
  const values = await readValues(
    reader,
    rows.map(({ id }) => id),
    (await readColumns(reader)).map(({ id }) => id),
    "planned-hire",
  );
  return new Map(
    rows.map((row) => [row.id, recordedHire(row, values.get(row.id))]),
  );
}

export const readHireDrafts = (
  reader: Reader,
  ids?: readonly string[],
  viewer?: Viewer,
) => readDrafts(reader, recordType, ids, viewer);

const byId = new Intl.Collator("en", { sensitivity: "base", numeric: true });

interface Named {
  name: string;
  startDate: string | null;
  started: boolean;
}

async function peopleNamed(
  reader: Reader,
  ids: readonly string[],
  today: string,
): Promise<Map<string, Named>> {
  const found = new Map<string, Named>();
  for (const chunk of inChunks([...new Set(ids)])) {
    const rows = await reader
      .select({
        id: people.id,
        name: people.preferredName,
        startDate: people.startDate,
        endDate: people.endDate,
      })
      .from(people)
      .where(inArray(people.id, chunk));
    for (const { id, name, ...dates } of rows) {
      found.set(id, {
        name,
        startDate: dates.startDate,
        started: !notStarted(dates, today),
      });
    }
  }
  return found;
}

// The hires the actor may see, by ID, for those who see people: the whole hiring plan, as drafts
// make it, for those who also see the hiring plan, which does nothing without seeing people, and
// otherwise the placeholders as they are live, without their drafts. A filled hire is left out once
// its person is seen instead: by readers who see Personal data, or by everyone once the person has
// started.
export async function readHires(
  database: Database,
  actor: Actor,
  asOf?: string,
): Promise<Hires & { includedPersonal: boolean }> {
  requirePermission(actor, "people:view");
  const today = asOf ?? (await readToday(database));
  return database.transaction(
    (transaction) => readHiresIn(transaction, actor, today),
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

// The hires the actor may see, as readHires sets out, read within a transaction of the caller's.
export async function readHiresIn(
  transaction: Reader,
  actor: Actor,
  today: string,
  { approvedOnly = false }: { approvedOnly?: boolean } = {},
): Promise<Hires & { includedPersonal: boolean }> {
  const wholePlan = seesSensitivity(actor, "hiring-plan");
  const withDrafts = wholePlan && !approvedOnly;
  const live = await readLiveHires(transaction);
  const draftsNow = withDrafts
    ? await readHireDrafts(transaction, undefined, actor.user.id)
    : new Map<string, Draft>();
  const held = approvedOnly
    ? new Map()
    : await readHeld(transaction, recordType, actor.user.id);
  // Columns drafted to be added are seen only by those who see the whole plan's drafts.
  const columns = withDrafts
    ? await columnsWithAdded(transaction, actor.user.id)
    : await readColumns(transaction);
  const tierOf = await readHireTier(transaction, columns);
  const seesField = seesHireField(actor, tierOf);
  const seesPositions = seesSensitivity(actor, tierOf("positionId"));
  const seesStates = seesSensitivity(actor, tierOf("stateId"));
  // The columns whose values the reader sees on hires.
  const shownColumns = offeredOn(columns).filter((column) =>
    seesSensitivity(actor, column.tier),
  );
  const shownValue = new Set(shownColumns.map(({ id }) => id));
  // A draft's makers are named only for the changes the reader sees.
  const makers = await draftMakers(
    transaction,
    recordType,
    [...draftsNow.keys()],
    seesField,
    actor,
  );
  const ids = [
    ...live.keys(),
    ...[...draftsNow.keys()].filter((id) => !live.has(id)),
  ];
  // Every hire read is live or drafted, so has a version; one drafted to be removed shows as
  // it is.
  const versions = ids.map((id) => {
    const before = live.get(id);
    const draft = draftsNow.get(id);
    const hire = (drafted(before, draft) ?? before) as Recorded;
    return { id, before, draft, hire };
  });
  // Readers who cannot see start and end dates see only people who have started, so a hire names its
  // manager to them only once the manager has started, as People shows them.
  const seesPersonal = seesEmployment(actor);
  const named = await peopleNamed(
    transaction,
    versions.flatMap(({ hire, before }) =>
      [hire.managerId, hire.filledBy, before?.managerId].filter(
        (personId): personId is string => typeof personId === "string",
      ),
    ),
    today,
  );
  // A planned manager is named as its row is, to everyone who sees its placeholder.
  const managingHires = [
    ...new Set(
      versions.flatMap(({ hire }) =>
        typeof hire.managerId === "string" && live.has(hire.managerId)
          ? [hire.managerId]
          : [],
      ),
    ),
  ];
  const managerPositions = seesPositions
    ? await choiceLabels(
        transaction,
        managingHires.map((managerId) =>
          String(live.get(managerId)?.positionId),
        ),
      )
    : new Map<string, string>();
  const hireManagers = new Map(
    managingHires.map((managerId) => {
      const manager = live.get(managerId) as Recorded;
      return [
        managerId,
        nameOfHire(manager, managerPositions.get(String(manager.positionId))),
      ];
    }),
  );
  const keys = await readKeyNumbers(transaction, "hire");
  const hires = versions.flatMap(({ id, before, draft, hire }): Hire[] => {
    const filledBy = text(before?.filledBy);
    const filler = filledBy === null ? undefined : named.get(filledBy);
    // A filled hire gives way to its person once they have started, or to readers who see them; one
    // only drafted as filled stays until the fill is approved.
    if (
      filledBy !== null &&
      (seesPersonal ||
        filler === undefined ||
        filler.startDate === null ||
        filler.startDate <= today)
    ) {
      return [];
    }
    const managerId = text(hire.managerId);
    const managingHire =
      managerId === null ? undefined : hireManagers.get(managerId);
    const manager = managerId === null ? undefined : named.get(managerId);
    const shownPerson =
      manager !== undefined && (seesPersonal || manager.started);
    const shown = managingHire !== undefined || shownPerson;
    const targetDate = text(hire.targetDate);
    return [
      {
        id,
        keyNumber: keyNumberOf(keys, id),
        name: text(hire.name),
        ...hireIdOf(hire),
        ...(seesPositions ? { positionId: String(hire.positionId) } : {}),
        managerId: shown ? managerId : null,
        managerName: managingHire ?? (shownPerson ? manager.name : null),
        isManager: hire.isManager === true,
        expected: expectedMonth(
          { fillerStart: filler?.startDate ?? null, targetDate },
          today,
        ),
        ...undatedMark({ fillerStart: filler?.startDate ?? null, targetDate }),
        ...(seesStates ? { stateId: String(hire.stateId) } : {}),
        ...shownValuesOf(hire, (columnId) => shownValue.has(columnId)),
        ...(wholePlan
          ? {
              targetDate,
              ...draftedFiller(hire, filledBy),
              ...shownDraft(id, before, draft),
              ...heldByOf(held, id),
            }
          : {}),
      },
    ];
  });

  // Who a hire's draft fills it with, given only to readers who see Personal data, who see the
  // person on People, since they may not have started.
  function draftedFiller(
    hire: Recorded,
    filledBy: string | null,
  ): Pick<Hire, "filler"> {
    const personId = text(hire.filledBy);
    if (personId === null || personId === filledBy) return {};
    return { filler: seesPersonal ? personId : null };
  }

  // A hire's draft as the reader sees it, or none when it changes nothing they may see.
  function shownDraft(
    id: string,
    before: Recorded | undefined,
    draft: Draft | undefined,
  ): { draft?: HireDraft } {
    if (draft === undefined) return {};
    const drafted = draftFields(before, draft);
    const seen = (field: string) => {
      const fieldId = fieldOfValue(field);
      return fieldId === null ? seesField(field) : shownValue.has(fieldId);
    };
    if (!drafted.some(seen)) return {};
    // A hire's ID is one field to the reader, whichever of the two a draft changes.
    const fields = [
      ...new Set(
        drafted
          .filter(seen)
          .map((field) =>
            field === "temporaryNumber" ? "requisition" : field,
          ),
      ),
    ];
    const liveValues: HireDraft["live"] & LiveValues = noLiveValues();
    if (before !== undefined) {
      for (const field of fields) {
        const fieldId = fieldOfValue(field);
        if (fieldId !== null) {
          // Only the fields of the columns shown are kept above.
          const column = shownColumns.find(
            ({ id }) => id === fieldId,
          ) as ColumnInfo;
          // The field is the hire's own, named by its draft.
          // eslint-disable-next-line security/detect-object-injection
          typeOf(column).showLive(liveValues, fieldId, before[field]);
        }
        if (field === "name") liveValues.name = text(before.name);
        if (field === "requisition") {
          Object.assign(liveValues, hireIdOf(before));
        }
        if (field === "positionId") {
          liveValues.positionId = String(before.positionId);
        }
        if (field === "targetDate") {
          liveValues.targetDate = text(before.targetDate);
        }
        if (field === "stateId") liveValues.stateId = String(before.stateId);
        if (field === "managerId") {
          liveValues.managerId = text(before.managerId);
        }
        if (field === "isManager") {
          liveValues.isManager = before.isManager === true;
        }
      }
    }
    const maker = makers.get(id);
    const seenDraft: HireDraft = {
      action: draft.action,
      changed: fields.map((field) => fieldOfValue(field) ?? field),
      live: liveValues,
      state: draft.state,
      // The reason covers the whole draft, so it is shown only to those who see all of it.
      ...(draft.state === "rejected" &&
      draft.reason !== null &&
      drafted.every(seen)
        ? { reason: draft.reason }
        : {}),
      ...(draft.unpublished === true ? { unpublished: true } : {}),
      madeBy: maker?.madeBy ?? null,
      madeAs: maker?.madeAs ?? null,
      madeAt: maker?.madeAt.toISOString() ?? null,
      editors: maker?.editors ?? [],
      ...ownMarks(maker),
      changedBy: Object.fromEntries(
        fields.map((field) => [
          fieldOfValue(field) ?? field,
          maker?.fieldEditors.get(field) ?? null,
        ]),
      ),
    };
    return { draft: seenDraft };
  }

  // No two hires have the same ID, ignoring letter case, so the order is always the same.
  const shownId = (hire: Hire) => String(hire.requisition ?? hire.temporaryId);
  hires.sort((a, b) => byId.compare(shownId(a), shownId(b)));
  // Whether the placeholders shown hold a position, state, or column's values more sensitive than
  // General.
  const includedPersonal =
    hires.length > 0 &&
    ((seesPositions && tierOf("positionId") !== "general") ||
      (seesStates && tierOf("stateId") !== "general") ||
      shownColumns.some(({ tier }) => tier !== "general"));
  return { hires, wholePlan, includedPersonal };
}

// A hire as a row of the People table: its name, if any, as its preferred name, its requisition or
// temporary ID as its ID, and its target date, for those who see it, as its start date. Its team is
// its manager's, named as the people given name it.
export function hireRow(
  hire: Hire,
  teamOf: ReadonlyMap<string, string | null>,
): Person {
  // A hire has a requisition, or else a temporary ID.
  const id = String(hire.requisition ?? hire.temporaryId);
  const asPersonField = (field: string) => {
    if (field === "name") return "preferredName";
    if (field === "requisition") return "employeeId";
    if (field === "targetDate") return "startDate";
    return field;
  };
  const draft = hire.draft;
  const live = draft?.live;
  return {
    id: hire.id,
    keyNumber: hire.keyNumber,
    kind: "planned-hire",
    preferredName: hire.name ?? "",
    employeeId: id,
    ...(hire.positionId === undefined ? {} : { positionId: hire.positionId }),
    ...(hire.stateId === undefined ? {} : { stateId: hire.stateId }),
    expected: hire.expected,
    ...(hire.undated === true ? { undated: true } : {}),
    ...(hire.targetDate === undefined ? {} : { startDate: hire.targetDate }),
    manager:
      hire.managerId === null
        ? null
        : { id: hire.managerId, preferredName: String(hire.managerName) },
    ...(hire.managerId === null
      ? {}
      : { team: teamOf.get(hire.managerId) ?? null }),
    isManager: hire.isManager,
    values: hire.values,
    links: hire.links,
    notes: hire.notes,
    numbers: hire.numbers,
    flags: hire.flags,
    ...(draft === undefined || live === undefined
      ? {}
      : {
          draft: {
            ...draft,
            changed: draft.changed.map(asPersonField),
            live: {
              ...(live.name === undefined
                ? {}
                : { preferredName: live.name ?? "" }),
              ...(live.requisition === undefined
                ? {}
                : { employeeId: live.requisition ?? String(live.temporaryId) }),
              ...(live.positionId === undefined
                ? {}
                : { positionId: live.positionId }),
              ...(live.targetDate === undefined
                ? {}
                : { startDate: live.targetDate }),
              ...(live.stateId === undefined ? {} : { stateId: live.stateId }),
              ...(live.managerId === undefined
                ? {}
                : { managerId: live.managerId }),
              ...(live.isManager === undefined
                ? {}
                : { isManager: live.isManager }),
              values: live.values,
              links: live.links,
              notes: live.notes,
              numbers: live.numbers,
              flags: live.flags,
            },
          },
        }),
    ...(hire.filler === undefined ? {} : { filler: hire.filler }),
    ...(hire.heldBy === undefined ? {} : { heldBy: hire.heldBy }),
  };
}

export interface HireFacts {
  expected: string;
  filledBy: string | null;
  called: string;
}

// The planned hires given, with what the rules need: the month each is expected, whether it is
// filled, and what it is called where its position is not shown.
export async function hiresOf(
  reader: Reader,
  ids: readonly string[],
  today: string,
): Promise<Map<string, HireFacts>> {
  const rows = [];
  for (const chunk of inChunks([...new Set(ids)])) {
    rows.push(
      ...(await reader
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
        .where(inArray(plannedHires.id, chunk))),
    );
  }
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
