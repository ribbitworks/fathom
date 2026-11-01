// SPDX-License-Identifier: Apache-2.0

// The Access history page, for users who may view it: the most recent changes to accounts, newest
// first, each written as a sentence, with changes that deserve a second look marked.

import { Alert, Loader, Paper, Stack, Text } from "@mantine/core";
import { type HistoryEntry, matchesWords, searchWords } from "@fathom/shared";
import { useQuery } from "@tanstack/react-query";
import {
  actorName,
  describeAction,
  describeDetails,
  entryText,
  historyQuery,
  subjectName,
} from "./history.ts";
import {
  EntryDetails,
  EntryList,
  EntryRow,
  WorthChecking,
} from "./history-entries.tsx";
import { HistorySearch } from "./history-search.tsx";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";

function Entry({ entry }: { entry: HistoryEntry }) {
  const words = describeAction(entry.action);
  const subject = subjectName(entry);
  const details = describeDetails(entry);
  return (
    <EntryRow at={entry.occurredAt}>
      <Text fz="sm">
        {words.caution && <WorthChecking />}
        <Text span inherit fw={600}>
          {actorName(entry)}
        </Text>{" "}
        {words.verb}
        {subject !== null && (
          <>
            {" "}
            <Text span inherit fw={600}>
              {subject}
            </Text>
          </>
        )}
        {details && <EntryDetails>{details}</EntryDetails>}
      </Text>
    </EntryRow>
  );
}

export function HistoryPage({
  search,
  onSearch,
}: {
  search: string;
  onSearch: (search: string, replace: boolean) => void;
}) {
  const history = useQuery(historyQuery);
  // The page holds the latest entries only, so searching them happens here.
  const words = searchWords(search);
  const shown = (history.data ?? []).filter((entry) =>
    matchesWords(entryText(entry), words),
  );
  return (
    <Stack gap="md">
      <PageHeader title="Access history" />
      <HistorySearch
        label="Search access history"
        search={search}
        onSearch={onSearch}
      />
      {history.isPending && <Loader role="status" aria-label="Loading" />}
      {history.isError && (
        <Alert color="red" role="alert">
          Fathom could not load the access history. Try again in a moment.
        </Alert>
      )}
      {history.isSuccess && (
        <Paper withBorder className={classes.tablePanel}>
          {shown.length === 0 && (
            <Text p="md" fz="sm" c="dimmed">
              {history.data.length === 0
                ? "Nothing has been recorded yet."
                : "No entries match the search."}
            </Text>
          )}
          <EntryList>
            {shown.map((entry) => (
              <Entry key={entry.id} entry={entry} />
            ))}
          </EntryList>
        </Paper>
      )}
    </Stack>
  );
}
