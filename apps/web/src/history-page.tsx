// SPDX-License-Identifier: Apache-2.0

// The Access history page, for users who may view it: the most recent changes to accounts, grouped
// by day with the newest first, each written as a sentence, with changes that deserve a second look
// marked.

import {
  Alert,
  Badge,
  Box,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  VisuallyHidden,
} from "@mantine/core";
import type { HistoryEntry } from "@fathom/shared";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";
import {
  actorName,
  describeAction,
  describeDetails,
  historyQuery,
  subjectName,
} from "./history.ts";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";

const day = new Intl.DateTimeFormat(undefined, { dateStyle: "full" });
const time = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

// Entries by day, in the order they arrive, which is newest first.
function byDay(entries: HistoryEntry[]): [string, HistoryEntry[]][] {
  const days = new Map<string, HistoryEntry[]>();
  for (const entry of entries) {
    const label = day.format(new Date(entry.occurredAt));
    days.set(label, [...(days.get(label) ?? []), entry]);
  }
  return [...days];
}

function Entry({ entry }: { entry: HistoryEntry }) {
  const words = describeAction(entry.action);
  const subject = subjectName(entry);
  const details = describeDetails(entry);
  return (
    <Group
      component="li"
      gap="md"
      wrap="nowrap"
      align="flex-start"
      px="md"
      py="sm"
    >
      <Text
        component="time"
        dateTime={entry.occurredAt}
        fz="sm"
        c="dimmed"
        w={64}
        className={classes.entryTime}
      >
        {time.format(new Date(entry.occurredAt))}
      </Text>
      <div>
        <Text fz="sm">
          <Badge
            component="span"
            variant="light"
            color={words.caution ? "yellow" : "sea"}
            radius="sm"
            tt="none"
            fw={500}
            mr={8}
          >
            {words.kind}
            {words.caution && <VisuallyHidden>, worth checking</VisuallyHidden>}
          </Badge>
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
        </Text>
        {details && (
          <Text fz="xs" c="dimmed" mt={2}>
            {details}
          </Text>
        )}
      </div>
    </Group>
  );
}

function Day({ label, entries }: { label: string; entries: HistoryEntry[] }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <Box px="md" py={8} className={classes.dayBand}>
        <Text
          component="h2"
          id={headingId}
          fz="xs"
          fw={600}
          c="dimmed"
          tt="uppercase"
        >
          {label}
        </Text>
      </Box>
      <ul className={classes.entries}>
        {entries.map((entry) => (
          <Entry key={entry.id} entry={entry} />
        ))}
      </ul>
    </section>
  );
}

export function HistoryPage() {
  const history = useQuery(historyQuery);
  return (
    <Stack gap="md">
      <PageHeader title="Access history" />
      {history.isPending && <Loader role="status" aria-label="Loading" />}
      {history.isError && (
        <Alert color="red" role="alert">
          Fathom could not load the access history. Try again in a moment.
        </Alert>
      )}
      {history.isSuccess && (
        <Paper withBorder className={classes.historyPanel}>
          {history.data.length === 0 && (
            <Text p="md" fz="sm" c="dimmed">
              Nothing has been recorded yet.
            </Text>
          )}
          {byDay(history.data).map(([label, entries]) => (
            <Day key={label} label={label} entries={entries} />
          ))}
        </Paper>
      )}
    </Stack>
  );
}
