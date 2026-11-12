// SPDX-License-Identifier: Apache-2.0

// The strip above a view with time across it: its periods across the whole range, each as wide as
// its share of it, those in view tinted and the current one underlined, with back and forward
// arrows and Today. Choosing a period, an arrow or Today is left to the view. The periods are one
// stop for Tab, the arrow keys, Home and End moving between them.

import { ActionIcon, Button, Group, UnstyledButton } from "@mantine/core";
import { type KeyboardEvent, useRef, useState } from "react";
import classes from "./pages.module.css";

// The strip's name and its arrows' names, such as Quarters and Previous quarter.
export interface StripWords {
  group: string;
  previous: string;
  next: string;
}

export interface StripPeriod {
  key: string;
  onChoose: () => void;
  label: string;
  // A shorter label, for when the label does not fit.
  short: string;
  // Its share of the strip's width, such as its days.
  weight: number;
  inView: boolean;
  current: boolean;
}

// Where each key moves focus among the periods, from the one focused and the last one's place.
const keyMoves = new Map<string, (focused: number, last: number) => number>([
  ["ArrowLeft", (focused) => Math.max(0, focused - 1)],
  ["ArrowRight", (focused, last) => Math.min(last, focused + 1)],
  ["Home", () => 0],
  ["End", (_, last) => last],
]);

export function TimelineStrip({
  words,
  periods,
  onPrevious,
  onNext,
  onToday,
}: {
  words: StripWords;
  periods: readonly StripPeriod[];
  // Each arrow is turned off while undefined, and Today left out.
  onPrevious: (() => void) | undefined;
  onNext: (() => void) | undefined;
  onToday: (() => void) | undefined;
}) {
  const strip = useRef<HTMLDivElement>(null);
  // The period Tab reaches: the one focused while focus is in the strip, or else the first in view.
  const [focusedKey, setFocusedKey] = useState<string>();
  const firstInView = Math.max(
    0,
    periods.findIndex(({ inView }) => inView),
  );
  const focusedAt = periods.findIndex(({ key }) => key === focusedKey);
  const tabStop = focusedAt === -1 ? firstInView : focusedAt;
  const move = (event: KeyboardEvent, from: number) => {
    const moved = keyMoves.get(event.key);
    // With Alt, Ctrl or Cmd held, a key is the browser's, such as Alt+Left for Back.
    if (moved === undefined || event.altKey || event.ctrlKey || event.metaKey)
      return;
    event.preventDefault();
    (strip.current as HTMLDivElement)
      .querySelectorAll("button")
      .item(moved(from, periods.length - 1))
      .focus();
  };
  return (
    <Group gap="xs" wrap="nowrap" mb="xs">
      <ActionIcon
        variant="default"
        aria-label={words.previous}
        disabled={onPrevious === undefined}
        onClick={onPrevious}
      >
        ‹
      </ActionIcon>
      <div
        ref={strip}
        className={classes.strip}
        role="toolbar"
        aria-label={words.group}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setFocusedKey(undefined);
          }
        }}
      >
        {periods.map(
          ({ key, onChoose, label, short, weight, inView, current }, index) => (
            <UnstyledButton
              key={key}
              className={classes.stripPeriod}
              style={{ "--strip-weight": weight }}
              tabIndex={index === tabStop ? 0 : -1}
              data-in-view={inView || undefined}
              aria-current={current ? "date" : undefined}
              aria-label={inView ? `${label}, in view` : label}
              onFocus={() => {
                setFocusedKey(key);
              }}
              onKeyDown={(event) => {
                move(event, index);
              }}
              onClick={onChoose}
            >
              <span className={classes.stripLabel} aria-hidden>
                {label}
              </span>
              <span className={classes.stripShort} aria-hidden>
                {short}
              </span>
            </UnstyledButton>
          ),
        )}
      </div>
      <ActionIcon
        variant="default"
        aria-label={words.next}
        disabled={onNext === undefined}
        onClick={onNext}
      >
        ›
      </ActionIcon>
      {onToday !== undefined && (
        <Button variant="default" size="compact-sm" onClick={onToday}>
          Today
        </Button>
      )}
    </Group>
  );
}
