// SPDX-License-Identifier: Apache-2.0

// How both history pages show their entries, so they look alike: a list of rows, newest first, each
// with its date and time, then who did what, with details dimmed after a colon, and a yellow dot
// before entries worth checking.

import { Group, Text, VisuallyHidden } from "@mantine/core";
import type { ReactNode } from "react";
import classes from "./pages.module.css";

const when = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function EntryList({ children }: { children: ReactNode }) {
  return <ul className={classes.entries}>{children}</ul>;
}

// One entry: when it happened, with its year, or that the time was not recorded, and its words,
// after anything that leads it, such as a checkbox to select it.
export function EntryRow({
  at,
  lead,
  children,
}: {
  at: string | null;
  lead?: ReactNode;
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
      {lead}
      {at === null ? (
        <Text fz="sm" c="dimmed" w={168} className={classes.entryTime}>
          Time not recorded
        </Text>
      ) : (
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
      )}
      <div>{children}</div>
    </Group>
  );
}

// Marks an entry that deserves a second look: a yellow dot, read aloud as words, since the
// sentence itself says what happened.
export function WorthChecking() {
  return (
    <>
      <Text span c="yellow" mr={8}>
        <span className={classes.statusDot} />
      </Text>
      <VisuallyHidden>Worth checking: </VisuallyHidden>
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
