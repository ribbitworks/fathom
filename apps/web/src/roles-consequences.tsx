// SPDX-License-Identifier: Apache-2.0

// What a role allows in plain English, marked against what it allowed first, and what a change to a
// role does to each account holding it.

import {
  classesNamedIn,
  type DataClasses,
  type Permission,
  type RoleEffects,
} from "@fathom/shared";
import { List, Paper, Stack, Text, Title, VisuallyHidden } from "@mantine/core";
import { useEffect, useRef } from "react";
import roleClasses from "./roles-page.module.css";
import { consequences, difference, markedLines } from "./roles.ts";
import { ClassName } from "./status-mark.tsx";

// A line of the summary or the confirmation, which Fathom writes, with each class it names marked
// as a class.
function Line({ text }: { text: string }) {
  return classesNamedIn(text).map((part, index) =>
    "dataClass" in part ? (
      // Parts keep their place, since the line is split the same way each time.
      <ClassName key={index} dataClass={part.dataClass} />
    ) : (
      part.words
    ),
  );
}

function Sentences({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Stack gap={4}>
      <Title order={3} fz="sm">
        {title}
      </Title>
      <List size="sm" spacing={2}>
        {items.map((item) => (
          <List.Item key={item}>
            <Line text={item} />
          </List.Item>
        ))}
      </List>
    </Stack>
  );
}

// Sentences marked against those the dialog opened with: added ones highlighted, and those taken
// away struck through, which screen readers hear from the summary's live region.
function ChangingSentences({
  title,
  first,
  items,
}: {
  title: string;
  first: readonly string[];
  items: readonly string[];
}) {
  const lines = markedLines(first, items);
  if (lines.length === 0) return null;
  return (
    <Stack gap={4}>
      <Title order={3} fz="sm">
        {title}
      </Title>
      <List size="sm" spacing={2}>
        {lines.map(({ text, change }) => (
          <List.Item key={text}>
            {change !== undefined && (
              <VisuallyHidden>
                {change === "removed" ? "No longer: " : "New: "}
              </VisuallyHidden>
            )}
            {/* The mark goes on the text itself, which a list item does not pass it down to. */}
            <span
              className={
                change === "added"
                  ? roleClasses.added
                  : change === "removed"
                    ? roleClasses.removed
                    : undefined
              }
            >
              <Line text={text} />
            </span>
          </List.Item>
        ))}
      </List>
    </Stack>
  );
}

// The pages and views a role's holders see, with a line saying so when there are none.
function seen(sees: string[]): string[] {
  return sees.length === 0 ? ["Nothing."] : sees;
}

// The result of a role's permissions in plain English, which follows the grid as it changes, marked
// against what the role granted first.
export function Summary({
  first,
  granted,
  dataClasses,
}: {
  first: readonly Permission[];
  granted: readonly Permission[];
  dataClasses: DataClasses;
}) {
  const before = consequences(first, dataClasses);
  const now = consequences(granted, dataClasses);
  return (
    <Paper
      withBorder
      p="sm"
      role="region"
      aria-live="polite"
      aria-label="What the role allows"
    >
      <Stack gap="sm">
        <ChangingSentences
          title="Sees"
          first={seen(before.sees)}
          items={seen(now.sees)}
        />
        <ChangingSentences
          title="Doesn't see"
          first={before.doesNotSee}
          items={now.doesNotSee}
        />
        <ChangingSentences title="Can" first={before.can} items={now.can} />
        <ChangingSentences
          title="Cannot"
          first={before.cannot}
          items={now.cannot}
        />
      </Stack>
    </Paper>
  );
}

// What a change to a role would do to each account holding it, to be confirmed before it is saved.
export function Effects({
  effects,
  userId,
  dataClasses,
}: {
  effects: RoleEffects["effects"];
  userId: string;
  dataClasses: DataClasses;
}) {
  // The confirmation replaces the grid, and the Save button with it, so focus moves to what it says.
  const heading = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <Stack gap="md">
      <Text ref={heading} tabIndex={-1}>
        {effects.length === 1
          ? "This change affects 1 account."
          : `This change affects ${String(effects.length)} accounts.`}
      </Text>
      {effects.map(({ account, before, after }) => {
        const { gains, losses } = difference(before, after, dataClasses);
        return (
          <Paper key={account.id} withBorder p="sm">
            <Stack gap="xs">
              <Text fw={600}>
                {account.name} ({account.email})
                {account.id === userId && " (this account)"}
              </Text>
              <Sentences title="Gains" items={gains} />
              <Sentences title="Loses" items={losses} />
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}
