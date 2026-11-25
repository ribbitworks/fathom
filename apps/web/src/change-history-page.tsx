// SPDX-License-Identifier: Apache-2.0

// The Change history page: who changed what, and when, newest first, holding only
// changes to data the user's roles let them see. Each change set saved is one entry, with a sentence
// for each record it changed and what changed in it. Show more reads older entries.

import {
  Alert,
  Anchor,
  Button,
  Group,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import { type ChangeEntry, folded, searchWords } from "@fathom/shared";
import { QueryState } from "./load-problem.tsx";
import { useDebouncedValue } from "@mantine/hooks";
import { useInfiniteQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import {
  changesQuery,
  describeEntry,
  madeByName,
  type RecordWords,
} from "./changes.ts";
import { EntryDetails, EntryList, EntryRow } from "./history-entries.tsx";
import { HistorySearch } from "./history-search.tsx";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import { PhraseList, phraseText } from "./phrase.tsx";
import { count } from "./numbers.ts";

// The lines an entry shows before Show more, and the names a line shows before Show all, so a
// large paste stays out of the way.
const shownLines = 5;
const shownNames = 10;

// Items with their places, those holding more of the words searched for first, so what a search
// found is seldom only behind Show all or Show more; when its words are spread over many lines that
// hold as many each, some may still be. Each keeps its place to be known by.
function matchingFirst<Item>(
  items: readonly Item[],
  text: (item: Item) => string,
  search: readonly string[],
): { item: Item; at: number }[] {
  const placed = items.map((item, at) => {
    const haystack = folded(text(item));
    return {
      item,
      at,
      held: search.filter((word) => haystack.includes(word)).length,
    };
  });
  return placed.toSorted(
    (first, second) => second.held - first.held || first.at - second.at,
  );
}

const lineText = (words: RecordWords) =>
  [
    words.sentence,
    ...words.details.map(phraseText),
    ...(words.names ?? []),
    words.searched,
  ].join(" ");

// One line of an entry: what was done, then, dimmed, what changed or the records' names.
function Line({
  words,
  lead,
  search,
}: {
  words: RecordWords;
  lead: ReactNode;
  search: readonly string[];
}) {
  const [all, setAll] = useState(false);
  const names = matchingFirst(words.names ?? [], (name) => name, search).map(
    ({ item }) => item,
  );
  const hidden = names.length - shownNames;
  return (
    <Text fz="sm">
      {lead}
      {words.sentence}
      {words.details.length > 0 && (
        <EntryDetails>
          <PhraseList phrases={words.details} />
        </EntryDetails>
      )}
      {names.length > 0 && (
        <EntryDetails>
          {(all ? names : names.slice(0, shownNames)).join(", ")}
          {hidden > 0 && (
            <>
              {all ? " " : ` and ${count(hidden)} more `}
              <Anchor
                component="button"
                type="button"
                inherit
                aria-expanded={all}
                onClick={() => {
                  setAll((was) => !was);
                }}
              >
                {all ? "Show fewer" : "Show all"}
              </Anchor>
            </>
          )}
        </EntryDetails>
      )}
    </Text>
  );
}

// What an entry changing several records did, after who did it, such as "approved 3 drafts".
function groupSentence({ kind, records }: ChangeEntry): string {
  const total = count(records.length);
  if (kind === "approval") return `approved ${total} drafts`;
  if (kind === "rejection") return `rejected ${total} drafts`;
  if (kind === "discard") return `discarded ${total} drafts`;
  if (kind === "resubmission") {
    return `sent ${total} drafts for approval again`;
  }
  return `saved changes to ${total} records`;
}

const capitalized = (words: RecordWords): RecordWords => ({
  ...words,
  sentence: words.sentence.charAt(0).toUpperCase() + words.sentence.slice(1),
});

function Entry({
  entry,
  search,
}: {
  entry: ChangeEntry;
  search: readonly string[];
}) {
  const [all, setAll] = useState(false);
  const who = (
    <Text span inherit fw={600}>
      {madeByName(entry)}
    </Text>
  );
  const lines = matchingFirst(describeEntry(entry), lineText, search);
  const [only] = lines;
  const shown = all ? lines : lines.slice(0, shownLines);
  return (
    <EntryRow at={entry.madeAt}>
      {lines.length === 1 && only !== undefined ? (
        <Line words={only.item} lead={<>{who} </>} search={search} />
      ) : (
        <div>
          <Text fz="sm">
            {who} {groupSentence(entry)}
          </Text>
          <ul className={classes.entries}>
            {shown.map(({ item, at }) => (
              // Each line is known by its place in the change set, whatever order a search puts it in.
              <li key={at}>
                <Line words={capitalized(item)} lead={null} search={search} />
              </li>
            ))}
          </ul>
          {lines.length > shownLines && (
            <Button
              variant="default"
              size="compact-xs"
              mt={4}
              aria-expanded={all}
              onClick={() => {
                setAll((was) => !was);
              }}
            >
              {all
                ? "Show fewer"
                : `Show ${count(lines.length - shownLines)} more`}
            </Button>
          )}
        </div>
      )}
    </EntryRow>
  );
}

export function ChangeHistoryPage({
  search,
  onSearch,
}: {
  search: string;
  onSearch: (search: string, replace: boolean) => void;
}) {
  // The server searches once typing pauses, not at every key.
  const [searched] = useDebouncedValue(search, 300);
  const changes = useInfiniteQuery(changesQuery(searched));
  const entries = changes.data?.pages.flatMap((page) => page.entries) ?? [];
  const words = searchWords(searched);
  return (
    <Stack gap="md">
      <PageHeader title="Change history" />
      <HistorySearch
        label="Search change history"
        search={search}
        onSearch={onSearch}
        busy={search !== searched || changes.isPlaceholderData}
      />
      <QueryState
        pending={changes.isPending}
        failed={changes.isError && !changes.isFetchNextPageError}
        what="the change history"
        onRetry={() => void changes.refetch()}
      />
      {changes.isSuccess && (
        <Paper withBorder className={classes.tablePanel}>
          {entries.length === 0 && (
            <Text p="md" fz="sm" c="dimmed">
              {changes.hasNextPage
                ? "None found in the changes read so far."
                : words.length > 0
                  ? "No changes match the search."
                  : "No changes yet to data this account can see."}
            </Text>
          )}
          <EntryList>
            {entries.map((entry) => (
              <Entry key={entry.id} entry={entry} search={words} />
            ))}
          </EntryList>
        </Paper>
      )}
      {changes.isFetchNextPageError && (
        <Alert color="red" role="alert">
          Fathom could not load older changes. Try again in a moment.
        </Alert>
      )}
      {changes.hasNextPage && (
        <Group justify="center">
          <Button
            variant="default"
            loading={changes.isFetchingNextPage}
            onClick={() => void changes.fetchNextPage()}
          >
            Show more
          </Button>
        </Group>
      )}
    </Stack>
  );
}
