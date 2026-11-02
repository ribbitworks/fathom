// SPDX-License-Identifier: Apache-2.0

// The Drafts page: every draft the user may see, of people, lists, choices, and the order of lists'
// choices, newest first, each a sentence saying who drafted what, with what it changes from its live
// value, and rejected drafts marked with their reason. A search narrows them. Approvers select
// drafts, one or several at once, and approve or reject them, as they can on the People table and
// the Lists page too. Approving or rejecting names any other drafts it includes.

import {
  type ChangeValue,
  type Choice,
  type DraftState,
  type List,
  matchesWords,
  type Person,
  type PersonDraft,
  searchWords,
} from "@fathom/shared";
import {
  Alert,
  Button,
  Checkbox,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { describeField } from "./changes.ts";
import {
  type Asking,
  type Decision,
  DecisionModal,
  drafts,
} from "./decision-dialog.tsx";
import {
  type DraftSelection,
  draftNames,
  draftTotal,
  joined,
  noDrafts,
  usedDrafts,
  usingDrafts,
} from "./drafts.ts";
import { personDraftFields } from "./draft-details.tsx";
import { EntryDetails, EntryList, EntryRow } from "./history-entries.tsx";
import { HistorySearch } from "./history-search.tsx";
import { listsQuery } from "./lists.ts";
import { PageHeader } from "./page-header.tsx";
import { type PeopleData, peopleQuery } from "./people.ts";
import classes from "./pages.module.css";
import { draftWords, StatusMark } from "./status-mark.tsx";

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
  if (action === undefined) return "drafted a new order of";
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
  details: string[];
  rejected: string;
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
    madeAt: string | null;
    editors?: (string | null)[] | undefined;
  },
  subject: string,
  details: string[],
  selects: Partial<DraftSelection>,
): Entry {
  // Everyone who changed the draft, since several people's changes to one record make one draft.
  const who = joinedNames(
    (draft.editors?.length ? draft.editors : [draft.madeBy]).map(
      (name) => name ?? "Fathom",
    ),
  );
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
    text: [who, did, subject, ...details, rejected].join(" "),
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
function credited(text: string, key: string, draft: Credited): string {
  if ((draft.editors?.length ?? 0) < 2) return text;
  const by = new Map(Object.entries(draft.changedBy ?? {}));
  return by.has(key) ? `${text} (${by.get(key) ?? "Fathom"})` : text;
}

// What a list's or choice's draft changes, field by field, from its live value.
function configFields(
  draft: { action: string; changed: string[]; live: object } & Credited,
  now: Record<string, unknown>,
): string[] {
  if (draft.action !== "changed") return [];
  return draft.changed.map((field) =>
    credited(
      describeField({
        field,
        // The fields are the record's own, as its draft names them.
        /* eslint-disable security/detect-object-injection */
        oldValue: ((draft.live as Record<string, unknown>)[field] ??
          null) as ChangeValue,
        newValue: (now[field] ?? null) as ChangeValue,
        /* eslint-enable security/detect-object-injection */
      }),
      field,
      draft,
    ),
  );
}

// Every draft of a list, a choice, or a list's order, as entries.
function listEntries(lists: readonly List[]): Entry[] {
  const labelOf = (list: List, id: string) =>
    list.choices.find((choice) => choice.id === id)?.label ??
    "a removed choice";
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
              `Order from ${list.orderDraft.live.map((id) => labelOf(list, id)).join(", ")} to ${list.choices.map(({ label }) => label).join(", ")}`,
            ],
            { orders: [list.id] },
          ),
        ]
      : []),
  ]);
}

function personEntries(data: PeopleData, lists: readonly List[]): Entry[] {
  return draftedPeople(data).map((drafted) =>
    entry(
      `person ${drafted.person.id}`,
      drafted.draft,
      drafted.person.preferredName,
      drafted.draft.action === "deleted"
        ? []
        : personDraftFields(
            drafted.person,
            drafted.draft,
            data.fields,
            lists,
          ).map(({ key, field }) =>
            credited(describeField(field), key, drafted.draft),
          ),
      { people: [drafted.person.id] },
    ),
  );
}

function DraftEntry({
  shown,
  selection,
}: {
  shown: Entry;
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
          <EntryDetails>{shown.details.join("; ")}</EntryDetails>
        )}
      </Text>
      {shown.rejected !== "" && (
        <Text className={classes.markGap}>
          <StatusMark tone="rejected">{shown.rejected}</StatusMark>
        </Text>
      )}
    </EntryRow>
  );
}

export function DraftsPage({
  canApprove,
  seesPeople = true,
  search,
  onSearch,
}: {
  canApprove: boolean;
  // Whether the user sees people, so their drafts; those who see only lists see only theirs.
  seesPeople?: boolean;
  search: string;
  onSearch: (search: string, replace: boolean) => void;
}) {
  const people = useQuery({ ...peopleQuery, enabled: seesPeople });
  const lists = useQuery(listsQuery);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [decision, setDecision] = useState<Decision>();
  const [opened, setOpened] = useState(false);

  let content: ReactNode;
  const peopleData: PeopleData | undefined = seesPeople
    ? people.data
    : { people: [], fields: [], order: [], views: [] };
  if ((seesPeople && people.isPending) || lists.isPending) {
    content = <Loader role="status" aria-label="Loading" />;
  } else if (people.isError || lists.isError) {
    content = (
      <Alert color="red" role="alert">
        <Group justify="space-between">
          Fathom could not load the drafts.
          <Button
            variant="light"
            color="red"
            size="xs"
            onClick={() => {
              void people.refetch();
              void lists.refetch();
            }}
          >
            Try again
          </Button>
        </Group>
      </Alert>
    );
  } else {
    const words = searchWords(search);
    const all = [
      ...personEntries(peopleData as PeopleData, lists.data),
      ...listEntries(lists.data),
    ].sort((a, b) => (b.madeAt ?? "").localeCompare(a.madeAt ?? ""));
    const shown = all.filter(({ text }) => matchesWords(text, words));
    const waiting = shown.filter(({ state }) => state === "waiting");
    // Only drafts still shown stay selected. Rejected drafts may be selected too, to approve them
    // after all or reject them for another reason.
    const chosen = shown.filter(({ key }) => selected.has(key));
    const chosenWaiting = waiting.filter(({ key }) => selected.has(key));
    const ask = (asking: Asking) => {
      const selection = chosen.reduce(
        (all, { selects }) => joined(all, selects),
        noDrafts(),
      );
      const others =
        asking === "approve"
          ? usedDrafts(selection, lists.data)
          : usingDrafts(selection, lists.data);
      setDecision({
        asking,
        selection: joined(selection, others),
        ...(draftTotal(others) > 0
          ? { included: draftNames(others, lists.data) }
          : {}),
      });
      setOpened(true);
    };
    content = (
      <>
        {canApprove && shown.length > 0 && (
          <Group justify="space-between">
            <Checkbox
              label="Select all waiting"
              checked={
                waiting.length > 0 && chosenWaiting.length === waiting.length
              }
              indeterminate={
                chosenWaiting.length > 0 &&
                chosenWaiting.length < waiting.length
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
                disabled={chosen.length === 0}
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
                {...(canApprove
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
