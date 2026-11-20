// SPDX-License-Identifier: Apache-2.0

// The strip above a view with time across it: its periods across the whole range, each as wide as
// its share of it, those in view tinted, the one chosen filled and the current one underlined,
// with back and forward arrows and Today. Choosing a period, an arrow or Today is left to the view.
// The periods are one stop for Tab, the arrow keys, Home and End moving between them.

import { ActionIcon, Button, Group, UnstyledButton } from "@mantine/core";
import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import classes from "./pages.module.css";

// The strip's name and its arrows' names, such as Quarters and Previous quarter.
export interface StripWords {
  group: string;
  previous: string;
  next: string;
}

// Scrolling lands on whole pixels, so a view this close to where it was is still there.
export const edgeTolerance = 1;

// Whether a period chosen, or stepped to, is still the one the view is at: until the view moves
// elsewhere, even when its end left it where it was.
export const stillChosen = (
  chosen: { key: string; left: number } | undefined,
  key: string,
  left: number,
): boolean =>
  chosen?.key === key && Math.abs(chosen.left - left) <= edgeTolerance;

// An arrow at the strip's end looks turned off but keeps focus, so pressing it until the end leaves
// focus on it rather than dropping it to the page.
const arrowOf = (onStep: (() => void) | undefined) =>
  onStep === undefined
    ? { "data-disabled": true, "aria-disabled": true }
    : { onClick: onStep };

// The words of a strip of quarters, as timelines and month grids show.
export const quarterWords: StripWords = {
  group: "Quarters",
  previous: "Previous quarter",
  next: "Next quarter",
};

export interface StripPeriod {
  key: string;
  onChoose: () => void;
  label: string;
  // A shorter label, for when the label does not fit.
  short: string;
  // Its share of the strip's width, such as its days.
  weight: number;
  inView: boolean;
  // Chosen, by itself or an arrow, while the view stays where choosing it put the view.
  selected: boolean;
  current: boolean;
}

const spokenLabel = ({ label, inView, selected }: StripPeriod) =>
  [
    label,
    ...(inView ? ["in view"] : []),
    ...(selected ? ["selected"] : []),
  ].join(", ");

// Where each key moves focus among the periods, from the one focused and the last one's place.
const keyMoves = new Map<string, (focused: number, last: number) => number>([
  ["ArrowLeft", (focused) => Math.max(0, focused - 1)],
  ["ArrowRight", (focused, last) => Math.min(last, focused + 1)],
  ["Home", () => 0],
  ["End", (_, last) => last],
]);

export function TimelineStrip({
  words,
  before,
  periods,
  onPrevious,
  onNext,
  onToday,
}: {
  words: StripWords;
  // What the view puts at the start of the strip's row, such as its own menus, so it adds no row.
  before?: ReactNode;
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
      {before}
      <ActionIcon
        variant="default"
        aria-label={words.previous}
        {...arrowOf(onPrevious)}
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
        {periods.map((period, index) => {
          const {
            key,
            onChoose,
            label,
            short,
            weight,
            inView,
            selected,
            current,
          } = period;
          return (
            <UnstyledButton
              key={key}
              className={classes.stripPeriod}
              style={{ "--strip-weight": weight }}
              tabIndex={index === tabStop ? 0 : -1}
              data-in-view={inView || undefined}
              data-selected={selected || undefined}
              aria-current={current ? "date" : undefined}
              aria-label={spokenLabel(period)}
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
          );
        })}
      </div>
      <ActionIcon
        variant="default"
        aria-label={words.next}
        {...arrowOf(onNext)}
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
