// SPDX-License-Identifier: Apache-2.0

// The drafts a reader sees, as entries naming each one's record, kind, maker and changes, built from
// what the Drafts page reads.

import {
  allOf,
  type ChangeValue,
  type Choice,
  type ColumnTable,
  columnTablePolicies,
  columnTables,
  type Decided,
  type FeatureColumns,
  type DecidedKind,
  type DraftKind,
  type DraftState,
  type FeatureTeam,
  type FeatureTeamDraft,
  type List,
  isNoteField,
  type LinkedRecord,
  notePlainText,
  type OrgChartPerson,
  type Permission,
  type Person,
  type PersonDraft,
  type PlanChoices,
  type PlanningSettingsShown,
  type ProjectPlan,
  type RecordDraft,
  type RecordType,
  type ReleaseStream,
} from "@fathom/shared";
import { addedClass, describeField, describeValue } from "./changes.ts";
import { personDraftFields } from "./draft-details.tsx";
import type { DraftPlace } from "./draft-places.ts";
import { type Columns, type DraftSelection, noDrafts } from "./drafts.ts";
import { teamPersonNamer } from "./feature-teams.ts";
import { liveLists } from "./lists.ts";
import { makerNames } from "./names.ts";
import type { PeopleData } from "./people.ts";
import { isHire, rowName } from "./people-rows.ts";
import type { Phrase } from "./phrase.tsx";
import {
  planningSettingsNode,
  planningSettingsRef,
  settingsDraftWords,
} from "./planning-settings.ts";
import { planDraftFields } from "./project-grids.tsx";
import { listedPlanRecords, planNodes, tableChoices } from "./projects.ts";
import { recordKey } from "./record-drafts.ts";
import { recordNodes, shownColour } from "./releases.ts";
import { formatDay } from "./day-formats.ts";

interface Drafted {
  person: Person;
  draft: PersonDraft;
}

// Every person with a draft, newest draft first, and those with no time recorded last.
function draftedPeople(data: PeopleData): Drafted[] {
  return data.people
    .flatMap((person) =>
      person.draft === undefined ? [] : [{ person, draft: person.draft }],
    )
    .sort((a, b) => (b.draft.madeAt ?? "").localeCompare(a.draft.madeAt ?? ""));
}

// A draft on the page, of any kind: its record, by kind and name, who made it, what it changes, and
// why it was rejected, with the draft it selects.
export interface Entry {
  key: string;
  madeAt: string | null;
  // What the draft does, as its dot's tip says; none for a new order.
  action: PersonDraft["action"] | undefined;
  state: DraftState;
  who: string;
  kind: DraftKind;
  // What deciding it needs: its kind, with the table of its column, or of the column it was made with.
  decided: Decided;
  // The record's name, with what it belongs to where its name alone may not say, such as a choice's
  // list.
  name: string;
  // The record's colour, for a team or release that has one.
  colour?: string | null;
  details: Phrase[];
  // Why a rejected draft was rejected, when it says.
  reason: string | undefined;
  // The user's own changes, which nobody may decide until they publish them.
  unpublished: boolean;
  // Who else has unpublished changes to the record, which hold it.
  heldBy: string | undefined;
  // Changed by this user, whose role does not let them approve their own drafts.
  needsOtherApprover: boolean;
  selects: DraftSelection;
  place: DraftPlace;
}

function entry(
  key: string,
  draft: {
    action?: PersonDraft["action"];
    state: DraftState;
    reason?: string | undefined;
    madeBy: string | null;
    madeAs?: string | null | undefined;
    madeAt: string | null;
    editors?: (string | null)[] | undefined;
    unpublished?: boolean | undefined;
    needsOtherApprover?: boolean | undefined;
    madeWith?: ColumnTable | undefined;
  },
  kind: DraftKind,
  name: string,
  details: Phrase[],
  selects: Partial<DraftSelection>,
  place: DraftPlace,
  heldBy?: string,
): Entry {
  return {
    key,
    madeAt: draft.madeAt,
    action: draft.action,
    state: draft.state,
    // Everyone who changed the draft, since several people's changes to one record make one draft.
    who: allOf(makerNames(draft)),
    kind,
    decided: {
      kind,
      table:
        typeof place === "object" && place.kind === "column"
          ? place.table
          : draft.madeWith,
    },
    name,
    details,
    reason: draft.state === "rejected" ? draft.reason : undefined,
    unpublished: draft.unpublished === true,
    heldBy,
    needsOtherApprover: draft.needsOtherApprover === true,
    selects: { ...noDrafts(), ...selects },
    place,
  };
}

const listFieldNames = ["name", "description", "visibility", "retired"];

interface Credited {
  editors?: (string | null)[] | undefined;
  changedBy?: Record<string, string | null> | undefined;
}

// What changed in a field, naming who changed it when several people changed the draft, since
// their changes make one draft.
function credited(text: Phrase, key: string, draft: Credited): Phrase {
  if ((draft.editors?.length ?? 0) < 2) return text;
  const by = new Map(Object.entries(draft.changedBy ?? {}));
  return by.has(key) ? [...text, ` (${by.get(key) ?? "Fathom"})`] : text;
}

// A plan record's value in a draft, with a note as its words without their formatting, as the change
// history shows it.
const draftValue = (
  kind: RecordType | undefined,
  field: string,
  value: unknown,
): ChangeValue =>
  kind !== undefined && isNoteField(kind, field) && typeof value === "string"
    ? notePlainText(value)
    : ((value ?? null) as ChangeValue);

// What a list's, choice's, or plan record's draft changes, field by field, from its live value.
function configFields(
  draft: { action: string; changed: string[]; live: object } & Credited,
  now: Record<string, unknown>,
  kind?: RecordType,
): Phrase[] {
  if (draft.action !== "changed") return [];
  return draft.changed.map((field) =>
    credited(
      describeField(
        {
          field,
          // The fields are the record's own, as its draft names them.
          /* eslint-disable security/detect-object-injection */
          oldValue: draftValue(
            kind,
            field,
            (draft.live as Record<string, unknown>)[field],
          ),
          newValue: draftValue(kind, field, now[field]),
          /* eslint-enable security/detect-object-injection */
        },
        kind,
      ),
      field,
      draft,
    ),
  );
}

// A new order, from the live one, named as a field is, with each order marked.
const orderPhrase = (live: string[], drafted: string[]): Phrase => [
  { strong: "Order" },
  " from ",
  { value: live.join(", ") },
  " to ",
  { value: drafted.join(", ") },
];

// Every draft of a list, a choice, or a list's order, as entries.
function listEntries(lists: readonly List[]): Entry[] {
  const liveLabels = new Map(
    liveLists(lists).flatMap(({ choices }) =>
      choices.map(({ id, label }) => [id, label]),
    ),
  );
  return lists.flatMap((list) => [
    ...(list.draft
      ? [
          entry(
            `list ${list.id}`,
            list.draft,
            "list",
            list.name,
            list.draft.action === "created"
              ? addedClass(list.visibility)
              : configFields(
                  {
                    ...list.draft,
                    changed: list.draft.changed.filter((field) =>
                      listFieldNames.includes(field),
                    ),
                  },
                  list,
                ),
            { lists: [list.id] },
            { kind: "list", keyNumber: list.keyNumber },
            list.heldBy,
          ),
        ]
      : []),
    ...list.choices.flatMap((choice: Choice) =>
      choice.draft
        ? [
            entry(
              `choice ${choice.id}`,
              choice.draft,
              "list-item",
              `${choice.label} in ${list.name}`,
              configFields(choice.draft, choice),
              { choices: [choice.id] },
              { kind: "list", keyNumber: list.keyNumber },
              choice.heldBy,
            ),
          ]
        : [],
    ),
    ...(list.orderDraft
      ? [
          entry(
            `order ${list.id}`,
            list.orderDraft,
            "choice-order",
            list.name,
            [
              orderPhrase(
                list.orderDraft.live.map(
                  (id) => liveLabels.get(id) ?? "a removed choice",
                ),
                list.choices.map(({ label }) => label),
              ),
            ],
            { orders: [list.id] },
            { kind: "list", keyNumber: list.keyNumber },
            list.orderHeldBy,
          ),
        ]
      : []),
  ]);
}

// Every draft of a table's column, as entries, each named as its table's columns are.
function columnEntries(
  data: Pick<PeopleData, "fields">,
  lists: readonly List[],
  columnName: (name: string) => string = (name) => name,
  table: ColumnTable = "people",
): Entry[] {
  // A web link column has no list, and a list not sent to the reader goes unnamed.
  const listName = (id: unknown) =>
    lists.find((list) => list.id === id)?.name ?? null;
  return [
    ...data.fields.flatMap((field) =>
      field.draft
        ? [
            entry(
              `column ${field.id}`,
              field.draft,
              "field",
              columnName(field.name),
              field.draft.action === "created"
                ? addedClass(field.visibility)
                : // Lists are named, not identified, on both sides of a change.
                  configFields(
                    {
                      ...field.draft,
                      live: {
                        ...field.draft.live,
                        ...(field.draft.live.listId === undefined
                          ? {}
                          : { listId: listName(field.draft.live.listId) }),
                      },
                    },
                    { ...field, listId: listName(field.listId) },
                  ),
              { columns: [field.id] },
              {
                kind: "column",
                keyNumber: field.keyNumber,
                table: field.table ?? table,
              },
              field.heldBy,
            ),
          ]
        : [],
    ),
  ];
}

function personEntries(data: PeopleData, lists: readonly List[]): Entry[] {
  return draftedPeople(data).map((drafted) =>
    entry(
      `person ${drafted.person.id}`,
      drafted.draft,
      isHire(drafted.person) ? "planned-hire" : "person",
      isHire(drafted.person)
        ? rowName(drafted.person, lists)
        : drafted.person.preferredName,
      drafted.draft.action === "deleted"
        ? []
        : personDraftFields(
            drafted.person,
            drafted.draft,
            data.fields,
            lists,
            data.people,
          ).map(({ key, field }) =>
            credited(describeField(field), key, drafted.draft),
          ),
      isHire(drafted.person)
        ? { plannedHires: [drafted.person.id] }
        : { people: [drafted.person.id] },
      {
        kind: isHire(drafted.person) ? "hire" : "person",
        keyNumber: drafted.person.keyNumber,
      },
      drafted.person.heldBy,
    ),
  );
}

// Every draft of a release stream, a change of its cycles, or a release, as entries.
function recordEntries(streams: readonly ReleaseStream[]): Entry[] {
  const of = (
    type: RecordType,
    record: {
      id: string;
      draft?: RecordDraft | undefined;
      heldBy?: string | undefined;
    },
    now: Record<string, unknown>,
    name: string,
    // A stream's changes of cycles open as its schedule does.
    place: LinkedRecord,
  ): Entry[] =>
    record.draft === undefined
      ? []
      : [
          entry(
            `${type} ${record.id}`,
            record.draft,
            type,
            name,
            configFields(record.draft, now, type),
            { records: [{ type, id: record.id }] },
            place,
            record.heldBy,
          ),
        ];
  const onSchedules = (stream: ReleaseStream): LinkedRecord => ({
    kind: "schedule",
    keyNumber: stream.keyNumber,
  });
  return streams.flatMap((stream) => [
    ...of("release-stream", stream, stream, stream.name, onSchedules(stream)),
    ...stream.patterns.flatMap((pattern) =>
      of(
        "cycle-pattern",
        pattern,
        { ...pattern, length: String(pattern.length) },
        `${stream.name} from ${formatDay(pattern.startsOn)}`,
        onSchedules(stream),
      ),
    ),
    ...stream.releases.flatMap((release) =>
      of("release", release, release, `${release.name} in ${stream.name}`, {
        kind: "release",
        keyNumber: release.keyNumber,
      }).map((one) => ({ ...one, colour: shownColour(release.colour) })),
    ),
  ]);
}

const planningSettingsName = "Planning settings";

// The draft of the planning settings, as an entry, with each setting it changes.
function settingsEntries(settings: PlanningSettingsShown): Entry[] {
  const { draft } = settings;
  if (draft === undefined) return [];
  return [
    entry(
      `planning-settings ${planningSettingsRef.id}`,
      draft,
      "planning-settings",
      planningSettingsName,
      configFields(...settingsDraftWords(draft, settings), "planning-settings"),
      { records: [planningSettingsRef] },
      "capacity-settings",
      settings.heldBy,
    ),
  ];
}

const settingsNodes = (settings: PlanningSettingsShown | undefined) =>
  settings === undefined ? [] : [planningSettingsNode(settings)];

const nothingLeftInTeamDraft: Phrase = [
  "Nothing is left to change, since the people it named have left",
];

// Every draft of a feature team, as entries, naming members and leads from its names and the org chart.
function teamEntries(
  teams: readonly FeatureTeam[],
  people: readonly OrgChartPerson[],
): Entry[] {
  return teams.flatMap((team): Entry[] => {
    const { draft } = team;
    if (draft === undefined) return [];
    const nameOf = teamPersonNamer(team, people);
    // Who joins or leaves on which day, such as "Avery Fictional, Jan 5, 2026; Blake Fictional, Jan 6, 2026".
    const dayText = (days: FeatureTeamDraft["days"]): string | null => {
      const lines = Object.entries(days ?? {})
        .map(([personId, day]) => `${nameOf(personId)}, ${formatDay(day)}`)
        .sort();
      return lines.length === 0 ? null : lines.join("; ");
    };
    const valueOf = (key: string, from: "live" | "now"): ChangeValue => {
      const source = from === "live" ? draft.live : team;
      if (key === "name") return source.name ?? null;
      if (key === "leadId") {
        return source.leadId == null ? null : nameOf(source.leadId);
      }
      if (key === "members") return (source.members ?? []).map(nameOf);
      if (key === "memberFrom" && from === "now") return dayText(draft.days);
      if (key === "hireFrom" && from === "now") return dayText(draft.hireDays);
      if (key === "leadFrom" && from === "now" && draft.leadDay !== undefined) {
        return formatDay(draft.leadDay);
      }
      if (
        key === "hireLeadFrom" &&
        from === "now" &&
        draft.hireLeadDay !== undefined
      ) {
        return formatDay(draft.hireLeadDay);
      }
      return null;
    };
    const changeLine = (key: string): Phrase =>
      credited(
        describeField({
          field: key,
          oldValue: valueOf(key, "live"),
          newValue: valueOf(key, "now"),
        }),
        key,
        draft,
      );
    const details =
      draft.action === "changed"
        ? [
            ...draft.changed.map(changeLine),
            ...(draft.changed.length === 0 ? [nothingLeftInTeamDraft] : []),
          ]
        : [
            ...["leadId", "members"].flatMap((key) => {
              const line = describeValue(key, valueOf(key, "now"));
              return line === undefined ? [] : [credited(line, key, draft)];
            }),
            ...(dayText(draft.days) === null ? [] : [changeLine("memberFrom")]),
            ...(dayText(draft.hireDays) === null
              ? []
              : [changeLine("hireFrom")]),
            ...(draft.leadDay === undefined ? [] : [changeLine("leadFrom")]),
            ...(draft.hireLeadDay === undefined
              ? []
              : [changeLine("hireLeadFrom")]),
          ];
    return [
      {
        ...entry(
          `feature-team ${team.id}`,
          draft,
          "feature-team",
          team.name,
          details,
          { featureTeams: [team.id] },
          { kind: "team", keyNumber: team.keyNumber },
          team.heldBy,
        ),
        colour: team.colour,
      },
    ];
  });
}

// Every draft of the plan's records, as entries.
function planEntries(
  plan: ProjectPlan,
  picks: PlanChoices,
  streams: readonly ReleaseStream[],
): Entry[] {
  const offered = tableChoices(plan, picks, streams);
  return listedPlanRecords(plan).flatMap(({ kind, record, name }) => {
    const { draft, heldBy } = record;
    if (draft === undefined) return [];
    const ref = { type: kind, id: record.id };
    return [
      entry(
        recordKey(ref),
        draft,
        kind,
        name,
        planDraftFields(kind, record, offered).map(({ key, field }) =>
          credited(describeField(field), key, draft),
        ),
        { records: [ref] },
        { kind, keyNumber: record.keyNumber },
        heldBy,
      ),
    ];
  });
}

// What the drafts page reads, as the role reads it: a read it doesn't make is left out.
export interface DraftReads {
  people: PeopleData | undefined;
  lists: List[] | undefined;
  streams: ReleaseStream[] | undefined;
  plan: ProjectPlan | undefined;
  choices: PlanChoices | undefined;
  settings: PlanningSettingsShown | undefined;
  teams: FeatureTeam[] | undefined;
  chartPeople: OrgChartPerson[] | undefined;
  approves: readonly DecidedKind[];
  permissions: readonly Permission[];
}

// What deciding drafts checks them against: the lists, and the columns, people and plan's records
// they may use.
export interface DraftedData {
  lists: List[];
  columns: Columns;
}

const noPeople: PeopleData = { people: [], fields: [], order: [] };

type PlanTable = Exclude<ColumnTable, "people">;

// The columns of each table the plan holds, as the plan sends them.
const planColumns: Record<PlanTable, (plan: ProjectPlan) => FeatureColumns> = {
  features: (plan) => plan.featureColumns,
  activities: (plan) => plan.activityColumns,
};

const planTables = columnTables.filter(
  (table): table is PlanTable => table !== "people",
);

// Every draft read, newest first.
export function entriesOf(read: DraftReads): Entry[] {
  const peopleData = read.people ?? noPeople;
  const listsData = read.lists ?? [];
  const streams = read.streams ?? [];
  const { plan: planData, settings: settingsData } = read;
  return [
    ...personEntries(peopleData, listsData),
    ...columnEntries(peopleData, listsData),
    ...listEntries(listsData),
    ...recordEntries(streams),
    ...(read.teams === undefined || read.chartPeople === undefined
      ? []
      : teamEntries(read.teams, read.chartPeople)),
    ...(planData === undefined
      ? []
      : planTables.flatMap((table) => {
          // The table is always one of the fixed tables.
          // eslint-disable-next-line security/detect-object-injection
          const columns = planColumns[table](planData);
          return columnEntries(
            columns,
            columns.lists,
            // eslint-disable-next-line security/detect-object-injection
            (name) => `${name} on ${columnTablePolicies[table].name}`,
            table,
          );
        })),
    ...(planData === undefined || read.choices === undefined
      ? []
      : planEntries(planData, read.choices, streams)),
    ...(settingsData === undefined ? [] : settingsEntries(settingsData)),
  ].sort((a, b) => (b.madeAt ?? "").localeCompare(a.madeAt ?? ""));
}

// What deciding the drafts read checks them against.
export function draftedOf(read: DraftReads): DraftedData {
  const peopleData = read.people ?? noPeople;
  const streams = read.streams ?? [];
  const planData = read.plan;
  return {
    lists: read.lists ?? [],
    columns: {
      fields: [
        ...peopleData.fields,
        ...(planData === undefined
          ? []
          : planTables.flatMap(
              // The table is always one of the fixed tables.
              // eslint-disable-next-line security/detect-object-injection
              (table) => planColumns[table](planData).fields,
            )),
      ],
      people: peopleData.people,
      records: [
        ...recordNodes(streams),
        ...(planData === undefined ? [] : planNodes(planData)),
        ...settingsNodes(read.settings),
      ],
      featureTeams: read.teams,
    },
  };
}
