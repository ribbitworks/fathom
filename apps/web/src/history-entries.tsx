// SPDX-License-Identifier: Apache-2.0

// How both history pages show their entries, so they look alike: a list of rows, newest first, each
// with its date and time, then who did what, with details dimmed after a colon, and a grey Worth
// checking box after entries that deserve a second look.

import { Group, Text, VisuallyHidden } from "@mantine/core";
import type { ReactNode } from "react";
import classes from "./pages.module.css";
import { FactBox } from "./status-mark.tsx";

const when = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function EntryList({ children }: { children: ReactNode }) {
  return <ul className={classes.entries}>{children}</ul>;
}

// One entry: when it happened, with its year, and its words.
export function EntryRow({
  at,
  children,
}: {
  at: string;
  children: ReactNode;
}) {
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
        dateTime={at}
        fz="sm"
        c="dimmed"
        w={168}
        className={classes.entryTime}
      >
        {when.format(new Date(at))}
      </Text>
      <div>{children}</div>
    </Group>
  );
}

// Marks an entry that deserves a second look with a grey box after it, as a fact is, since a dot
// always means a draft.
export function WorthChecking() {
  return (
    <>
      <VisuallyHidden>, </VisuallyHidden>
      <FactBox>Worth checking</FactBox>
    </>
  );
}

// What else an entry says, dimmed after a colon, such as "Name from Sites to Locations".
export function EntryDetails({ children }: { children: ReactNode }) {
  return (
    <Text span inherit c="dimmed">
      : {children}
    </Text>
  );
}
