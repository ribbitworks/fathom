// SPDX-License-Identifier: Apache-2.0

// The Drafts page: every draft the user may see, newest first, each a sentence saying who drafted
// what, with what it changes from its live value, and rejected drafts marked with their reason. A
// search narrows them. Approvers select drafts, one or several at once, and approve or reject them,
// as they can on the People table too.

import {
  builtInColumnNames,
  type ChangedField,
  type ChangeValue,
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
import { EntryDetails, EntryList, EntryRow } from "./history-entries.tsx";
import { HistorySearch } from "./history-search.tsx";
import { listsQuery } from "./lists.ts";
import { PageHeader } from "./page-header.tsx";
import { type DetailKey, draftWords } from "./people-grid.tsx";
import { type PeopleData, peopleQuery } from "./people.ts";
import classes from "./pages.module.css";
import { StatusMark } from "./status-mark.tsx";

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

// What a draft changes, field by field, as the change history words it: each built-in detail and
// column, from its live value to the draft's. A draft adding someone does not repeat their name.
export function draftFields(
  { person, draft }: Drafted,
  data: PeopleData,
  lists: readonly List[],
): ChangedField[] {
  const labels = (ids: readonly string[] | undefined): ChangeValue =>
    (ids ?? []).flatMap((id) => {
      const label = lists
        .flatMap(({ choices }) => choices)
        .find((choice) => choice.id === id)?.label;
      return label === undefined ? [] : [label];
    });
  return draft.changed.flatMap((key): ChangedField[] => {
    if (builtInColumnNames.has(key)) {
      if (draft.action === "created" && key === "preferredName") return [];
      const detail = key as DetailKey;
      return [
        {
          field: key,
          // The detail is one of the fixed built-in ones.
          /* eslint-disable security/detect-object-injection */
          oldValue:
            draft.action === "created" ? null : (draft.live[detail] ?? null),
          newValue: person[detail] ?? null,
          /* eslint-enable security/detect-object-injection */
        },
      ];
    }
    const column = data.fields.find(({ id }) => id === key);
    return [
      {
        field: "value",
        ...(column === undefined ? {} : { column: column.name }),
        // The key is a column's own.
        // eslint-disable-next-line security/detect-object-injection
        oldValue: labels(draft.live.values[key]),
        // eslint-disable-next-line security/detect-object-injection
        newValue: labels(person.values[key]),
      },
    ];
  });
}

// What a draft did, after who made it.
function verb({ draft }: Drafted): string {
  if (draft.action === "created") return "drafted adding";
  if (draft.action === "deleted") return "drafted removing";
  return "drafted changes to";
}

// A draft in words: who made it, what they drafted, what it changes, and why it was rejected, as
// shown and as searched.
function wordsOf(drafted: Drafted, data: PeopleData, lists: readonly List[]) {
  const { person, draft } = drafted;
  const details =
    draft.action === "deleted"
      ? []
      : draftFields(drafted, data, lists).map(describeField);
  const who = draft.madeBy ?? "Fathom";
  const rejected = draft.state === "rejected" ? draftWords(draft) : "";
  return {
    who,
    details,
    rejected,
    text: [who, verb(drafted), person.preferredName, ...details, rejected].join(
      " ",
    ),
  };
}

function DraftEntry({
  drafted,
  words,
  selection,
}: {
  drafted: Drafted;
  words: ReturnType<typeof wordsOf>;
  // Absent for users who may not approve.
  selection?: { selected: boolean; onSelect: (selected: boolean) => void };
}) {
  const { person, draft } = drafted;
  return (
    <EntryRow
      at={draft.madeAt}
      lead={
        selection && (
          <Checkbox
            mt={2}
            aria-label={`Select the draft of ${person.preferredName}`}
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
          {words.who}
        </Text>{" "}
        {verb(drafted)}{" "}
        <Text span inherit fw={600}>
          {person.preferredName}
        </Text>
        {words.details.length > 0 && (
          <EntryDetails>{words.details.join("; ")}</EntryDetails>
        )}
      </Text>
      {words.rejected !== "" && (
        <Text className={classes.markGap}>
          <StatusMark tone="rejected">{words.rejected}</StatusMark>
        </Text>
      )}
    </EntryRow>
  );
}

export function DraftsPage({
  canApprove,
  search,
  onSearch,
}: {
  canApprove: boolean;
  search: string;
  onSearch: (search: string, replace: boolean) => void;
}) {
  const people = useQuery(peopleQuery);
  const lists = useQuery(listsQuery);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [decision, setDecision] = useState<Decision>();
  const [opened, setOpened] = useState(false);

  let content: ReactNode;
  if (people.isPending || lists.isPending) {
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
    const all = draftedPeople(people.data);
    const shown = all
      .map((drafted) => ({
        drafted,
        words: wordsOf(drafted, people.data, lists.data),
      }))
      .filter(({ words: { text } }) => matchesWords(text, words));
    const waiting = shown.filter(
      ({ drafted }) => drafted.draft.state === "waiting",
    );
    // Only drafts still shown stay selected. Rejected drafts may be selected too, to approve them
    // after all or reject them for another reason.
    const chosen = shown
      .map(({ drafted }) => drafted.person.id)
      .filter((id) => selected.has(id));
    const chosenWaiting = waiting.filter(({ drafted }) =>
      selected.has(drafted.person.id),
    );
    const ask = (asking: Asking) => {
      setDecision({ asking, ids: chosen });
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
                      ? waiting.map(({ drafted }) => drafted.person.id)
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
            {shown.map(({ drafted, words: entryWords }) => (
              <DraftEntry
                key={drafted.person.id}
                drafted={drafted}
                words={entryWords}
                {...(canApprove
                  ? {
                      selection: {
                        selected: selected.has(drafted.person.id),
                        onSelect: (on: boolean) => {
                          setSelected((current) => {
                            const next = new Set(current);
                            if (on) next.add(drafted.person.id);
                            else next.delete(drafted.person.id);
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
