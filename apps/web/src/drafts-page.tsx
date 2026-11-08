// SPDX-License-Identifier: Apache-2.0

// The Drafts page: every draft the user may see, of people, planned hires, People's columns, lists,
// choices, the order of lists' choices and of People's columns, and the plan's records, such as
// release streams, newest first, each a sentence saying who drafted what, with what it changes from
// its live value, and rejected drafts marked with their reason. A search narrows them. Approvers
// select drafts, one or several at once, and approve or reject them, as they can on the People
// table and the Lists page too. Approving or rejecting names any other drafts it includes.

import { LoadProblem } from "./load-problem.tsx";
import {
  type Asking,
  builtInColumnNames,
  type ChangeValue,
  type Choice,
  type DraftKind,
  type DraftState,
  type FeatureTeam,
  type FeatureTeamDraft,
  type FeatureTeams,
  type Field,
  type List,
  isNoteField,
  matchesWords,
  notePlainText,
  type OrgChart,
  type OrgChartPerson,
  type Person,
  type PersonDraft,
  type PlanChoices,
  type ProjectPlan,
  type RecordDraft,
  type RecordType,
  type ReleaseStream,
  searchWords,
} from "@fathom/shared";
import {
  Button,
  Checkbox,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { featureTeamsQuery, teamPersonNamer } from "./feature-teams.ts";
import { orgChartQuery } from "./org-chart.ts";
import { type ReactNode, useState } from "react";
import { describeField, describeValue } from "./changes.ts";
import { DecisionModal, drafts } from "./decision-dialog.tsx";
import {
  type Decision,
  decisionFor,
  type DraftSelection,
  waitsForRejected,
  joined,
  mayDecide,
  noDrafts,
} from "./drafts.ts";
import { personDraftFields } from "./draft-details.tsx";
import { EntryDetails, EntryList, EntryRow } from "./history-entries.tsx";
import { HistorySearch } from "./history-search.tsx";
import { listsQuery, liveLists } from "./lists.ts";
import {
  recordNodes,
  recordSubjects,
  releaseStreamsQuery,
} from "./releases.ts";
import { makerNames } from "./names.ts";
import { planDraftFields } from "./project-grids.tsx";
import { recordKey } from "./record-drafts.ts";
import {
  listedPlanRecords,
  planChoicesQuery,
  planNodes,
  projectPlanQuery,
  tableChoices,
} from "./projects.ts";
import { PageHeader } from "./page-header.tsx";
import { type PeopleData, peopleQuery } from "./people.ts";
import { isHire, rowName } from "./people-rows.ts";
import classes from "./pages.module.css";
import { type Phrase, PhraseList, phraseText } from "./phrase.tsx";
import { formatDay } from "./table-view.ts";
import { draftWords, HoldMarks, StatusMark } from "./status-mark.tsx";

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

// Names in a sentence: "A", "A and B", or "A, B and C".
export function joinedNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${String(names.at(-1))}`;
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
interface Entry {
  key: string;
  madeAt: string | null;
  state: DraftState;
  who: string;
  verb: string;
  subject: string;
  details: Phrase[];
  rejected: string;
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
  const who = joinedNames(makerNames(draft));
  const rejected = draft.state === "rejected" ? draftWords(draft) : "";
  const did = verb(draft.action);
  return {
    key,
    madeAt: draft.madeAt,
    state: draft.state,
    who,
    verb: did,
    subject,
    details,
    rejected,
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

// A new order, from the live one, with each order marked.
const orderPhrase = (live: string[], drafted: string[]): Phrase => [
  "From ",
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
            configFields(
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

// Every draft of a People column, or of the column order, as entries.
function columnEntries(data: PeopleData, lists: readonly List[]): Entry[] {
  // A choice column's list is always among the lists, and every key in an order names a column
  // shown. A web link column has no list.
  const listName = (id: unknown) =>
    id === null ? null : (lists.find((list) => list.id === id) as List).name;
  const fieldOf = (key: string) =>
    data.fields.find(({ id }) => id === key) as Field;
  const columnName = (key: string) =>
    builtInColumnNames.get(key) ?? fieldOf(key).name;
  // A column's name as it is live, on the live side of a new order, as a list's choices are named.
  const liveColumnName = (key: string) => {
    const name = builtInColumnNames.get(key);
    if (name !== undefined) return name;
    const { draft, name: drafted } = fieldOf(key);
    return draft?.action === "changed" ? (draft.live.name ?? drafted) : drafted;
  };
  return [
    ...data.fields.flatMap((field) =>
      field.draft
        ? [
            entry(
              `column ${field.id}`,
              field.draft,
              `the column ${field.name}`,
              // Lists are named, not identified, on both sides of a change.
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
    ...(data.orderDraft
      ? [
          entry(
            "column order",
            data.orderDraft,
            "People's columns",
            [
              orderPhrase(
                data.orderDraft.live.map(liveColumnName),
                data.order.map(columnName),
              ),
            ],
            { columnOrder: true },
            data.orderHeldBy,
          ),
        ]
      : []),
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

// Every draft of a customer, proposal, project, or milestone, as entries.
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

function DraftEntry({
  shown,
  waits,
  selection,
}: {
  shown: Entry;
  waits: boolean;
  // Absent for users who may not approve.
  selection?: { selected: boolean; onSelect: (selected: boolean) => void };
}) {
  return (
    <EntryRow
      at={shown.madeAt}
      lead={
        selection && (
          <Checkbox
            mt={2}
            aria-label={`Select the draft of ${shown.subject}`}
            // A rejected draft is back with its makers until they resubmit it, and a draft that
            // depends on it waits too.
            disabled={
              shown.state === "rejected" ||
              waits ||
              shown.unpublished ||
              shown.heldBy !== undefined
            }
            checked={selection.selected}
            onChange={(event) => {
              selection.onSelect(event.currentTarget.checked);
            }}
          />
        )
      }
    >
      <Text fz="sm">
        <Text span inherit fw={600}>
          {shown.who}
        </Text>{" "}
        {shown.verb}{" "}
        <Text span inherit fw={600}>
          {shown.subject}
        </Text>
        {shown.details.length > 0 && (
          <EntryDetails>
            <PhraseList phrases={shown.details} />
          </EntryDetails>
        )}
      </Text>
      {shown.rejected !== "" && (
        <Text className={classes.markGap}>
          <StatusMark tone="rejected">{shown.rejected}</StatusMark>
        </Text>
      )}
      {waits && (
        <Text fz="xs" c="dimmed">
          Waiting for a rejected draft to be resubmitted
        </Text>
      )}
      {(shown.unpublished || shown.heldBy !== undefined) && (
        <Text className={classes.markGap}>
          <HoldMarks unpublished={shown.unpublished} heldBy={shown.heldBy} />
        </Text>
      )}
    </EntryRow>
  );
}

export function DraftsPage({
  approves,
  seesPeople = true,
  seesLists = true,
  seesPlan = true,
  seesTeams = false,
  seesProjects = seesPlan,
  search,
  onSearch,
}: {
  // The kinds of draft the user's role approves and rejects.
  approves: readonly DraftKind[];
  // Whether the user sees people, so their drafts; those who see only lists see only theirs.
  seesPeople?: boolean;
  // Whether the user sees lists, through people or planning configuration.
  seesLists?: boolean;
  // Whether the user sees the plan's records, such as release streams.
  seesPlan?: boolean;
  // Whether the user sees feature teams, on the org chart.
  seesTeams?: boolean;
  // Whether the user sees the plan itself, so its customers, proposals, projects, and milestones.
  seesProjects?: boolean;
  search: string;
  onSearch: (search: string, replace: boolean) => void;
}) {
  const people = useQuery({ ...peopleQuery, enabled: seesPeople });
  const listsRead = useQuery({ ...listsQuery, enabled: seesLists });
  const lists = seesLists
    ? listsRead
    : { ...listsRead, isPending: false, isError: false, data: [] };
  const releases = useQuery({ ...releaseStreamsQuery, enabled: seesPlan });
  const featureTeams = useQuery({ ...featureTeamsQuery, enabled: seesTeams });
  const chart = useQuery({ ...orgChartQuery, enabled: seesTeams });
  const plan = useQuery({ ...projectPlanQuery, enabled: seesProjects });
  const choices = useQuery({ ...planChoicesQuery, enabled: seesProjects });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [decision, setDecision] = useState<Decision>();
  const [opened, setOpened] = useState(false);

  let content: ReactNode;
  const peopleData: PeopleData | undefined = seesPeople
    ? people.data
    : { people: [], fields: [], order: [], views: [] };
  const streams = seesPlan ? releases.data?.streams : [];
  if (
    (seesPeople && people.isPending) ||
    lists.isPending ||
    (seesPlan && releases.isPending) ||
    (seesTeams && (featureTeams.isPending || chart.isPending)) ||
    (seesProjects && (plan.isPending || choices.isPending))
  ) {
    content = <Loader role="status" aria-label="Loading" />;
  } else if (
    people.isError ||
    lists.isError ||
    releases.isError ||
    featureTeams.isError ||
    chart.isError ||
    plan.isError ||
    choices.isError
  ) {
    content = (
      <LoadProblem
        what="the drafts"
        onRetry={() => {
          void people.refetch();
          void lists.refetch();
          void releases.refetch();
          if (seesTeams) {
            void featureTeams.refetch();
            void chart.refetch();
          }
          if (seesProjects) {
            void plan.refetch();
            void choices.refetch();
          }
        }}
      />
    );
  } else {
    const words = searchWords(search);
    const all = [
      ...personEntries(peopleData as PeopleData, lists.data),
      ...columnEntries(peopleData as PeopleData, lists.data),
      ...listEntries(lists.data as List[]),
      ...recordEntries(streams as ReleaseStream[]),
      ...(seesTeams
        ? teamEntries(
            (featureTeams.data as FeatureTeams).teams,
            (chart.data as OrgChart).people,
          )
        : []),
      ...(seesProjects && plan.data !== undefined
        ? // The page shows its entries once both have loaded.
          planEntries(
            plan.data,
            choices.data as PlanChoices,
            streams as ReleaseStream[],
          )
        : []),
    ].sort((a, b) => (b.madeAt ?? "").localeCompare(a.madeAt ?? ""));
    const shown = all.filter(({ text }) => matchesWords(text, words));
    // Loaded, or empty for those who see only lists.
    const { fields, orderDraft, people } = peopleData as PeopleData;
    const records = [
      ...recordNodes(streams as ReleaseStream[]),
      ...(seesProjects && plan.data !== undefined ? planNodes(plan.data) : []),
    ];
    // A draft that depends on a rejected draft cannot be approved until that one is resubmitted.
    const waits = ({ state, selects }: Entry) =>
      state === "waiting" &&
      waitsForRejected(selects, lists.data as List[], {
        fields,
        orderDraft,
        people,
        records,
      });
    // Drafts of the areas the user's role approves are chosen to decide.
    const choosable = (one: Entry) => mayDecide(approves, one.selects);
    // A draft only its maker sees, or one someone is changing, is not decided until published.
    const waiting = shown.filter(
      (one) =>
        choosable(one) &&
        one.state === "waiting" &&
        !waits(one) &&
        !one.unpublished &&
        one.heldBy === undefined,
    );
    // Only drafts still shown, and still waiting, stay selected.
    const chosen = waiting.filter(({ key }) => selected.has(key));
    const othersApprove = chosen.filter(
      ({ needsOtherApprover }) => needsOtherApprover,
    ).length;
    const ask = (asking: Asking) => {
      const selection = chosen.reduce(
        (all, { selects }) => joined(all, selects),
        noDrafts(),
      );
      setDecision(
        decisionFor(asking, selection, approves, lists.data as List[], {
          fields,
          orderDraft,
          people,
          records,
        }),
      );
      setOpened(true);
    };
    content = (
      <>
        {shown.some(choosable) && (
          <Group justify="space-between">
            <Checkbox
              label="Select all waiting"
              checked={waiting.length > 0 && chosen.length === waiting.length}
              indeterminate={
                chosen.length > 0 && chosen.length < waiting.length
              }
              disabled={waiting.length === 0}
              onChange={(event) => {
                setSelected(
                  new Set(
                    event.currentTarget.checked
                      ? waiting.map(({ key }) => key)
                      : [],
                  ),
                );
              }}
            />
            <Group gap="xs">
              <Button
                variant="default"
                disabled={chosen.length === 0}
                onClick={() => {
                  ask("reject");
                }}
              >
                Reject…
              </Button>
              <Button
                disabled={chosen.length === 0 || othersApprove > 0}
                onClick={() => {
                  ask("approve");
                }}
              >
                {chosen.length === 0
                  ? "Approve"
                  : `Approve ${drafts(chosen.length)}`}
              </Button>
            </Group>
          </Group>
        )}
        {othersApprove > 0 && (
          <Text fz="sm" c="dimmed" role="status">
            {othersApprove === 1
              ? "1 chosen draft was changed by this account, so another approver must approve it."
              : `${String(othersApprove)} chosen drafts were changed by this account, so another approver must approve them.`}
          </Text>
        )}
        <Paper withBorder className={classes.tablePanel}>
          {shown.length === 0 && (
            <Text p="md" fz="sm" c="dimmed">
              {all.length === 0
                ? "No drafts waiting for approval."
                : "No drafts match the search."}
            </Text>
          )}
          <EntryList>
            {shown.map((one) => (
              <DraftEntry
                key={one.key}
                shown={one}
                waits={waits(one)}
                {...(choosable(one)
                  ? {
                      selection: {
                        selected: selected.has(one.key),
                        onSelect: (on: boolean) => {
                          setSelected((current) => {
                            const next = new Set(current);
                            if (on) next.add(one.key);
                            else next.delete(one.key);
                            return next;
                          });
                        },
                      },
                    }
                  : {})}
              />
            ))}
          </EntryList>
        </Paper>
        <DecisionModal
          decision={decision}
          opened={opened}
          onClose={() => {
            setOpened(false);
          }}
          onDone={() => {
            setOpened(false);
            setSelected(new Set());
          }}
        />
      </>
    );
  }

  return (
    <Stack gap="md">
      <PageHeader title="Drafts" />
      <HistorySearch
        label="Search drafts"
        search={search}
        onSearch={onSearch}
      />
      {content}
    </Stack>
  );
}
