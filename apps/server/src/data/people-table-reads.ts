// SPDX-License-Identifier: Apache-2.0

// Reading the People table as each reader may see it, today or on another day, with drafts and
// planned hires. Part of the data access layer.

import { type Database, fieldOfValue, type Reader } from "@fathom/db";
import {
  changesLinesOn,
  draftKey,
  seesBuiltInColumn,
  seesEmployment,
  type Person,
  type PersonDraft,
  seesField,
} from "@fathom/shared";
import { firstOffered, listChoices } from "./built-in-lists.ts";
import {
  type Actor,
  mostSensitive,
  requireView,
  seesSensitivity,
} from "../access.ts";
import type { Transaction } from "./changes.ts";
import {
  type Draft,
  drafted,
  draftFields,
  type Recorded,
} from "./draft-records.ts";
import { draftMakers, otherApprover } from "./draft-makers.ts";
import { fillsBeyondSight } from "./fills.ts";
import { heldByOf, readHeld, readPersonDrafts } from "./drafts.ts";
import { columnsWithAdded } from "./added-columns.ts";
import { type LiveValues, noLiveValues, typeOf } from "./column-types.ts";
import { readToday } from "./settings.ts";
import { readTeamsOfMembers } from "./feature-team-reads.ts";
import { hireRow, readHiresIn } from "./hire-reads.ts";
import { keyNumberOf, readKeyNumbers } from "./record-keys.ts";
import { draftedLineOn, readLines, shownReporting, text } from "./reporting.ts";
import { type ColumnInfo, valueField } from "./values.ts";
import {
  personFields,
  personalDetailFields,
  personTier,
  meaningOn,
  seesPersonField,
  shownValuesOf,
} from "./person-fields.ts";
import { currentOn, readLive } from "./people-reads.ts";

export interface PeopleRead {
  people: Person[];
  columns: ColumnInfo[];
  // Whether what was read included anyone's Personal details, which the access history records.
  includedPersonal: boolean;
  // Whether the actor cannot see the Positions list's tier, so the people read have no positions.
  positionHidden: boolean;
  // Whether what was read included planned hires' details beyond their placeholders, which the
  // access history records apart.
  hiringPlanViewed: boolean;
}

const byName = new Intl.Collator("en", { sensitivity: "base" });

// Everyone the actor may see, by preferred name, as their drafts make them, with the columns whose
// values they may see, and each draft as they may see it, followed by the planned hires they see,
// as readHires sets out, by ID. A person a draft removes is shown as they are, with the draft.
// Users who cannot see Personal details see only those current today, so the list reveals no start
// or end date, and receive no dates. Each person's state means Hired, or Left once their end date
// has passed.
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

// People on another day: those employed then, as their manager, team, and state were then, with
// every planned hire not yet filled on a later day and none on an earlier one, since past plans are
// not kept. Other days need the classes the Org chart's do, and show drafts only to those who may
// make changes from the day, as the Org chart does.
export async function readPeopleOn(
  database: Database,
  actor: Actor,
  day: string,
  asOf?: string,
): Promise<PeopleRead> {
  const today = asOf ?? (await readToday(database));
  if (day === today) return readPeople(database, actor, today);
  requireView(
    actor,
    day > today ? "orgChartFutureDates" : "orgChartOtherDates",
  );
  const read = await database.transaction(
    (transaction) => readPeopleIn(transaction, actor, today, day),
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
  // Another day tells who was or will be employed then, which is Personal.
  return { ...read, includedPersonal: true };
}

// Drafts as they stand on another day: a drafted line counts only from its date, as the Org chart
// draws it, so a manager changed from a later day is no draft on the days before.
async function draftsOn(
  reader: Transaction,
  drafts: ReadonlyMap<string, Draft>,
  live: ReadonlyMap<string, Recorded>,
  { today, day }: { today: string; day: string },
): Promise<Map<string, Draft>> {
  const changesLine = (draft: Draft) =>
    draft.action === "changed" &&
    ("managerId" in draft.fields || "managerFrom" in draft.fields);
  const lines = await readLines(
    reader,
    [...drafts].flatMap(([id, draft]) => (changesLine(draft) ? [id] : [])),
  );
  return new Map(
    [...drafts].flatMap(([id, draft]): [string, Draft][] => {
      const before = live.get(id);
      if (before === undefined || !changesLine(draft)) return [[id, draft]];
      const rest = Object.fromEntries(
        Object.entries(draft.fields).filter(
          ([field]) => field !== "managerId" && field !== "managerFrom",
        ),
      );
      const on = draftedLineOn(lines.get(id) ?? [], draft.fields, {
        today,
        day,
      });
      const managerId = on?.inForce?.managerId ?? null;
      const from = on?.inForce?.fromDate ?? on?.drafted.fromDate;
      // Having no manager on the day is unchanged whatever date the drafted line starts from.
      const unchanged =
        from === undefined ||
        (managerId === text(before.managerId) &&
          (managerId === null || from === text(before.managerFrom)));
      const fields = unchanged
        ? rest
        : { ...rest, managerId, managerFrom: from };
      return Object.keys(fields).length === 0
        ? []
        : [[id, { ...draft, fields }]];
    }),
  );
}

// Each hiring state's meaning, and the first state offered for each meaning a person can have, so
// a person shows their own state while it has the meaning their end date gives them, and otherwise
// the first of that meaning.
async function readStates(reader: Reader) {
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

async function readPeopleIn(
  database: Transaction,
  actor: Actor,
  today: string,
  on?: string,
): Promise<PeopleRead> {
  const day = on ?? today;
  const allColumns = await columnsWithAdded(database, actor.user.id);
  // Judged by the classes read with the columns, so rows and their fields follow the same classes.
  const access = {
    permissions: actor.permissions,
    dataClasses: allColumns.dataClasses,
  };
  const seesPersonal = seesEmployment(access);
  const columns = allColumns.filter((column) =>
    seesSensitivity(actor, column.tier),
  );
  const tierOf = personTier(allColumns);
  const seesDraftField = seesPersonField(actor, allColumns);
  const approvesPeople = actor.permissions.includes("people:approve");
  const shownFields = new Set<string>([
    "preferredName",
    "employeeId",
    ...(seesSensitivity(actor, allColumns.positionTier) ? ["positionId"] : []),
    ...(seesSensitivity(actor, allColumns.stateTier) ? ["stateId"] : []),
    "teamName",
    "isManager",
    ...personalDetailFields.filter((field) =>
      seesSensitivity(actor, tierOf(field)),
    ),
    ...columns.map(({ id }) => valueField(id)),
  ]);
  const live = await readLive(database, allColumns, { asOf: day });
  const withDrafts = on === undefined || changesLinesOn(actor, on, today);
  const draftsRead = withDrafts
    ? await readPersonDrafts(database, undefined, actor.user.id)
    : new Map<string, Draft>();
  const draftsNow =
    on === undefined
      ? draftsRead
      : await draftsOn(database, draftsRead, live, { today, day });
  const held = withDrafts
    ? await readHeld(database, "person", actor.user.id)
    : new Map();
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
        endDate: (seesPersonal ? person : (before ?? person)).endDate,
      },
      day,
    );
  const keys = await readKeyNumbers(database, "person", ids);
  const shown = ids.flatMap((id): Person[] => {
    const before = live.get(id);
    const draft = draftsNow.get(id);
    // A draft that removes someone shows them as they are; one that adds nobody is never kept.
    const person = drafted(before, draft) ?? before;
    // Those who do not see start and end dates see only people current today, judged by the live
    // dates while a draft waits, so a draft changing only Personal dates reveals nothing.
    if (
      person === undefined ||
      ((on !== undefined || !seesPersonal) && !currentOn(before ?? person, day))
    ) {
      return [];
    }
    const seen = draft && seenDraft(id, before, draft);
    return [
      {
        id,
        keyNumber: keyNumberOf(keys, id),
        preferredName: String(person.preferredName),
        employeeId: String(person.employeeId),
        ...(shownFields.has("positionId")
          ? { positionId: String(person.positionId) }
          : {}),
        isManager: person.isManager === true,
        ...(seesPersonal
          ? {
              startDate: (person.startDate as string | null) ?? null,
              endDate: (person.endDate as string | null) ?? null,
            }
          : {}),
        ...shownReporting(person, before, {
          everyone,
          live,
          seesPersonal: seesPersonal && seesField(access, "managerHistory"),
          today: day,
        }),
        ...shownValuesOf(person, (columnId) =>
          shownFields.has(valueField(columnId)),
        ),
        ...(seen ? { draft: seen } : {}),
        ...heldByOf(held, id),
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
    const held = draftFields(before, draft);
    const fields = held
      .filter((field) => shownFields.has(field))
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    if (fields.length === 0) return undefined;
    const liveValues: PersonDraft["live"] & LiveValues = noLiveValues();
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
      held.every((field) => seesSensitivity(actor, tierOf(field)))
        ? { reason: draft.reason }
        : {};
    const unseen = approvesPeople && !held.every(seesDraftField);
    return {
      action: draft.action,
      changed: fields.map((field) => fieldOfValue(field) ?? field),
      live: liveValues,
      ...(unseen ? { holdsUnseen: true as const } : {}),
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
  // A later day shows the hires as approved, since nothing is changed then.
  const hiring =
    on === undefined || on > today
      ? await readHiresIn(database, actor, day, {
          approvedOnly: on !== undefined,
        })
      : { hires: [], includedPersonal: false, wholePlan: false };
  const teamOf = new Map(
    shown.map(({ id, teamName }) => [id, teamName ?? null]),
  );
  // Feature teams are General, and sent to those who see feature teams, as their page is.
  const featureTeamsOf = seesBuiltInColumn(actor.permissions, "featureTeams")
    ? await readTeamsOfMembers(database, day)
    : undefined;
  const withFeatureTeams = (row: Person): Person =>
    featureTeamsOf === undefined
      ? row
      : { ...row, featureTeams: featureTeamsOf.get(row.id) ?? [] };
  const beyondSight = withDrafts
    ? await fillsBeyondSight(database, actor, today)
    : new Set<string>();
  // A published draft of a fill the role lacks the sight to decide holds details it can't see.
  const markedBeyondSight = (row: Person): Person =>
    row.draft !== undefined &&
    row.draft.unpublished !== true &&
    beyondSight.has(draftKey(row.kind ?? "person", row.id))
      ? {
          ...row,
          draft: {
            ...row.draft,
            needsOtherApprover: true,
            holdsUnseen: true,
          },
        }
      : row;
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
    ]
      .map(withFeatureTeams)
      .map(markedBeyondSight),
    columns,
    positionHidden: !shownFields.has("positionId"),
    includedPersonal:
      (shown.length > 0 &&
        (seesPersonal ||
          columns.some(({ tier }) => tier !== "general") ||
          (shownFields.has("positionId") &&
            allColumns.positionTier !== "general") ||
          (seesStates && statesTier !== "general"))) ||
      hiring.includedPersonal,
    hiringPlanViewed: hiring.wholePlan && hiring.hires.length > 0,
  };
}
