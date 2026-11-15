// SPDX-License-Identifier: Apache-2.0

// The drafts a reader sees, as entries: every draft of people, planned hires, People's columns,
// lists, choices, the order of lists' choices and of People's columns, the plan's records and its
// columns, feature teams and the planning settings, each in words saying who drafted what and what
// it changes, newest first, with the reads that give them, and those the reader may decide now.

import {
  allOf,
  approvableKinds,
  type ChangeValue,
  type Choice,
  type DraftKind,
  type DraftState,
  type FeatureTeam,
  type FeatureTeamDraft,
  type List,
  isNoteField,
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
import { useQuery } from "@tanstack/react-query";
import { addedClass, describeField, describeValue } from "./changes.ts";
import { personDraftFields } from "./draft-details.tsx";
import {
  type Columns,
  decidable,
  type DraftSelection,
  mayDecide,
  noDrafts,
  waitsForRejected,
} from "./drafts.ts";
import { featureTeamsQuery, teamPersonNamer } from "./feature-teams.ts";
import { listsQuery, liveLists } from "./lists.ts";
import { makerNames } from "./names.ts";
import { orgChartQuery } from "./org-chart.ts";
import { type PeopleData, peopleQuery } from "./people.ts";
import { isHire, rowName } from "./people-rows.ts";
import { type Phrase, phraseText } from "./phrase.tsx";
import {
  planningSettingsNode,
  planningSettingsQuery,
  planningSettingsRef,
  planningSettingsSubject,
  settingsDraftWords,
} from "./planning-settings.ts";
import { planDraftFields } from "./project-grids.tsx";
import {
  listedPlanRecords,
  planChoicesQuery,
  planNodes,
  projectPlanQuery,
  tableChoices,
} from "./projects.ts";
import { recordKey } from "./record-drafts.ts";
import {
  recordNodes,
  recordSubjects,
  releaseStreamsQuery,
} from "./releases.ts";
import { draftWords } from "./status-mark.tsx";
import { formatDay } from "./table-view.ts";

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

// What a draft did, after who made it.
function verb(action: PersonDraft["action"] | undefined): string {
  if (action === "created") return "drafted adding";
  if (action === "deleted") return "drafted removing";
  if (action === undefined) return "drafted a new order for";
  return "drafted changes to";
}

// A draft on the page, of any kind, in words: who made it, what they drafted, what it changes, and
// why it was rejected, as shown and as searched, with the draft it selects.
export interface Entry {
  key: string;
  madeAt: string | null;
  // What the draft does, as its dot's tip says; none for a new order.
  action: PersonDraft["action"] | undefined;
  state: DraftState;
  who: string;
  verb: string;
  subject: string;
  details: Phrase[];
  // Why a rejected draft was rejected, when it says.
  reason: string | undefined;
  // The user's own changes, which nobody may decide until they publish them.
  unpublished: boolean;
  // Who else has unpublished changes to the record, which hold it.
  heldBy: string | undefined;
  // Changed by this user, whose role does not let them approve their own drafts.
  needsOtherApprover: boolean;
  text: string;
  selects: DraftSelection;
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
  },
  subject: string,
  details: Phrase[],
  selects: Partial<DraftSelection>,
  heldBy?: string,
): Entry {
  // Everyone who changed the draft, since several people's changes to one record make one draft.
  const who = allOf(makerNames(draft));
  const reason = draft.state === "rejected" ? draft.reason : undefined;
  const rejected = draft.state === "rejected" ? draftWords(draft) : "";
  const did = verb(draft.action);
  return {
    key,
    madeAt: draft.madeAt,
    action: draft.action,
    state: draft.state,
    who,
    verb: did,
    subject,
    details,
    reason,
    unpublished: draft.unpublished === true,
    heldBy,
    needsOtherApprover: draft.needsOtherApprover === true,
    text: [who, did, subject, ...details.map(phraseText), rejected].join(" "),
    selects: { ...noDrafts(), ...selects },
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
            `the list ${list.name}`,
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
              `the choice ${choice.label} in ${list.name}`,
              configFields(choice.draft, choice),
              { choices: [choice.id] },
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
  columnSubject: (name: string) => string = (name) => `the column ${name}`,
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
              columnSubject(field.name),
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
      isHire(drafted.person)
        ? `the planned hire ${rowName(drafted.person, lists)}`
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
    subject: string,
  ): Entry[] =>
    record.draft === undefined
      ? []
      : [
          entry(
            `${type} ${record.id}`,
            record.draft,
            subject,
            configFields(record.draft, now, type),
            { records: [{ type, id: record.id }] },
            record.heldBy,
          ),
        ];
  return streams.flatMap((stream) => [
    ...of("release-stream", stream, stream, recordSubjects.stream(stream)),
    ...stream.patterns.flatMap((pattern) =>
      of(
        "cycle-pattern",
        pattern,
        { ...pattern, length: String(pattern.length) },
        recordSubjects.pattern(stream, pattern),
      ),
    ),
    ...stream.releases.flatMap((release) =>
      of("release", release, release, recordSubjects.release(stream, release)),
    ),
  ]);
}

// The draft of the planning settings, as an entry, with each setting it changes.
function settingsEntries(settings: PlanningSettingsShown): Entry[] {
  const { draft } = settings;
  if (draft === undefined) return [];
  return [
    entry(
      `planning-settings ${planningSettingsRef.id}`,
      draft,
      planningSettingsSubject,
      configFields(...settingsDraftWords(draft, settings), "planning-settings"),
      { records: [planningSettingsRef] },
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
      if (key === "leadFrom" && from === "now" && draft.leadDay !== undefined) {
        return formatDay(draft.leadDay);
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
            ...(draft.leadDay === undefined ? [] : [changeLine("leadFrom")]),
          ];
    return [
      entry(
        `feature-team ${team.id}`,
        draft,
        `the feature team ${team.name}`,
        details,
        { featureTeams: [team.id] },
        team.heldBy,
      ),
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
  return listedPlanRecords(plan).flatMap(({ kind, record, subject }) => {
    const { draft, heldBy } = record;
    if (draft === undefined) return [];
    const ref = { type: kind, id: record.id };
    return [
      entry(
        recordKey(ref),
        draft,
        subject,
        planDraftFields(kind, record, offered).map(({ key, field }) =>
          credited(describeField(field), key, draft),
        ),
        { records: [ref] },
        heldBy,
      ),
    ];
  });
}

// What drafts a role sees, by the data it sees, and which kinds it approves.
export interface DraftsSeen {
  approves: readonly DraftKind[];
  // Whether the reader sees people, so their drafts; those who see only lists see only theirs.
  seesPeople: boolean;
  // Whether the reader sees lists, through people or planning configuration.
  seesLists: boolean;
  // Whether the reader sees the plan's records, such as release streams.
  seesPlan: boolean;
  seesTeams: boolean;
  // Whether the reader sees the plan itself, so its customers, proposals, projects, and milestones.
  seesProjects: boolean;
  // Whether the reader sees configuration, so the planning settings.
  seesSettings: boolean;
}

export const draftsSeen = (permissions: readonly Permission[]): DraftsSeen => ({
  approves: approvableKinds(permissions),
  seesPeople: permissions.includes("people:view"),
  seesLists:
    permissions.includes("people:view") ||
    permissions.includes("configuration:view"),
  seesPlan:
    permissions.includes("features:view") ||
    permissions.includes("configuration:view"),
  seesTeams:
    permissions.includes("feature-teams:view") &&
    permissions.includes("people:view"),
  seesProjects: permissions.includes("plan:view"),
  seesSettings: permissions.includes("configuration:view"),
});

// What deciding drafts checks them against: the lists, and the columns, people and plan's records
// they may use.
export interface DraftedData {
  lists: List[];
  columns: Columns;
}

export type DraftEntries =
  | { state: "loading" }
  | { state: "failed"; retry: () => void }
  | {
      state: "loaded";
      // Every draft seen, newest first.
      all: Entry[];
      // Whether a draft waits for a rejected draft it depends on to be resubmitted.
      waits: (one: Entry) => boolean;
      // Whether the reader's role decides a draft of its kind.
      choosable: (one: Entry) => boolean;
      drafted: DraftedData;
    };

// The drafts the reader sees, read with what names them; the reads a role doesn't make are left
// out.
export function useDraftEntries({
  approves,
  seesPeople,
  seesLists,
  seesPlan,
  seesTeams,
  seesProjects,
  seesSettings,
}: DraftsSeen): DraftEntries {
  const people = useQuery({ ...peopleQuery, enabled: seesPeople });
  const lists = useQuery({ ...listsQuery, enabled: seesLists });
  const releases = useQuery({ ...releaseStreamsQuery, enabled: seesPlan });
  const featureTeams = useQuery({ ...featureTeamsQuery, enabled: seesTeams });
  const chart = useQuery({ ...orgChartQuery, enabled: seesTeams });
  const plan = useQuery({ ...projectPlanQuery, enabled: seesProjects });
  const choices = useQuery({ ...planChoicesQuery, enabled: seesProjects });
  const settings = useQuery({
    ...planningSettingsQuery,
    enabled: seesSettings,
  });
  // Only the reads the role makes count: one it doesn't make may still hold an error from before its
  // role changed.
  const reads = [
    ...(seesPeople ? [people] : []),
    ...(seesLists ? [lists] : []),
    ...(seesPlan ? [releases] : []),
    ...(seesTeams ? [featureTeams, chart] : []),
    ...(seesProjects ? [plan, choices] : []),
    ...(seesSettings ? [settings] : []),
  ];
  if (reads.some(({ isPending }) => isPending)) return { state: "loading" };
  if (reads.some(({ isError }) => isError)) {
    return {
      state: "failed",
      retry: () => {
        for (const read of reads) void read.refetch();
      },
    };
  }
  const peopleData: PeopleData = (seesPeople ? people.data : undefined) ?? {
    people: [],
    fields: [],
    order: [],
  };
  const listsData: List[] = (seesLists ? lists.data : undefined) ?? [];
  const streams: ReleaseStream[] =
    (seesPlan ? releases.data?.streams : undefined) ?? [];
  const planData = seesProjects ? plan.data : undefined;
  const settingsData = seesSettings ? settings.data : undefined;
  const teamsData = seesTeams ? featureTeams.data : undefined;
  const chartData = seesTeams ? chart.data : undefined;
  const choicesData = seesProjects ? choices.data : undefined;
  const all = [
    ...personEntries(peopleData, listsData),
    ...columnEntries(peopleData, listsData),
    ...listEntries(listsData),
    ...recordEntries(streams),
    ...(teamsData === undefined || chartData === undefined
      ? []
      : teamEntries(teamsData.teams, chartData.people)),
    ...(planData === undefined
      ? []
      : columnEntries(
          planData.featureColumns,
          planData.featureColumns.lists,
          (name) => `the column ${name} on Features`,
        )),
    ...(planData === undefined || choicesData === undefined
      ? []
      : planEntries(planData, choicesData, streams)),
    ...(settingsData === undefined ? [] : settingsEntries(settingsData)),
  ].sort((a, b) => (b.madeAt ?? "").localeCompare(a.madeAt ?? ""));
  const drafted: DraftedData = {
    lists: listsData,
    columns: {
      fields: [
        ...peopleData.fields,
        ...(planData === undefined ? [] : planData.featureColumns.fields),
      ],
      people: peopleData.people,
      records: [
        ...recordNodes(streams),
        ...(planData === undefined ? [] : planNodes(planData)),
        ...settingsNodes(settingsData),
      ],
    },
  };
  return {
    state: "loaded",
    all,
    waits: ({ state, selects }) =>
      state === "waiting" &&
      waitsForRejected(selects, drafted.lists, drafted.columns),
    choosable: ({ selects }) => mayDecide(approves, selects),
    drafted,
  };
}

// The drafts the reader may choose to decide now: of a kind their role decides, not waiting on a
// rejected draft, and decidable as any record's draft is.
export const toDecide = (
  entries: readonly Entry[],
  loaded: Pick<
    Extract<DraftEntries, { state: "loaded" }>,
    "waits" | "choosable"
  >,
): Entry[] =>
  entries.filter(
    (one) =>
      loaded.choosable(one) &&
      !loaded.waits(one) &&
      decidable({
        draft: { state: one.state, unpublished: one.unpublished },
        heldBy: one.heldBy,
      }),
  );
