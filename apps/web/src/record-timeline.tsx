// SPDX-License-Identifier: Apache-2.0

// A record's timeline: one row a day, newest first, with Today drawn across between planned days and
// the past.

import { Anchor } from "@mantine/core";
import type { ReactNode } from "react";
import { formatDay } from "./day-formats.ts";
import { FoldedList } from "./folded-list.tsx";
import pages from "./pages.module.css";
import { type Phrase, PhraseText } from "./phrase.tsx";
import classes from "./record-details.module.css";

// A day of a record's changes, each in words.
export interface TimelineDayShown {
  day: string;
  changes: readonly Phrase[];
}

// Moves the page to a day, where the page can show it.
export type DayLink = (day: string) => (() => void) | undefined;

// How many days show on each side of Today before the rest fold.
const shownEachSide = 6;

// A day's row: its date, linking where the page can show it, then its changes one to a line; a
// planned day in grey, the day shown marked as a selected row is.
export function TimelineDayRow({
  day,
  today,
  marked,
  dayLink,
}: {
  day: TimelineDayShown;
  today: string;
  marked: boolean;
  dayLink?: DayLink | undefined;
}) {
  const date = formatDay(day.day);
  const planned = day.day > today;
  const onShow = dayLink?.(day.day);
  return (
    <div
      className={[
        classes.row,
        planned ? pages.timelinePlanned : "",
        marked ? `${pages.selectedRow} ${pages.timelineMarked}` : "",
      ].join(" ")}
    >
      <dt className={classes.label}>
        {onShow === undefined ? (
          date
        ) : (
          <Anchor
            component="button"
            type="button"
            {...(planned ? { c: "dimmed" } : {})}
            onClick={onShow}
          >
            {date}
          </Anchor>
        )}
      </dt>
      <dd className={classes.value}>
        {day.changes.map((change, at) => (
          <div key={at}>
            <PhraseText phrase={change} />
          </div>
        ))}
      </dd>
    </div>
  );
}

// Today's line across the days, or the day shown's, named by its day.
function Line({ day }: { day?: string }) {
  const word = day === undefined ? "Today" : formatDay(day);
  return (
    <div
      role="separator"
      aria-label={word}
      className={[
        pages.timelineTodayAcross,
        day === undefined ? "" : pages.timelineShownAcross,
      ].join(" ")}
    >
      <span className={pages.timelineTodayLabel} aria-hidden>
        {word}
      </span>
    </div>
  );
}

export function RecordTimeline({
  days,
  today,
  shown,
  dayLink,
}: {
  // The record's days, earliest first.
  days: readonly TimelineDayShown[];
  today: string;
  // The day the page shows.
  shown: string;
  dayLink?: DayLink | undefined;
}) {
  const planned = days.filter(({ day }) => day > today).toReversed();
  const past = days.filter(({ day }) => day <= today).toReversed();
  const shownLine = shown !== today && !days.some(({ day }) => day === shown);
  const rows = (part: readonly TimelineDayShown[]): ReactNode =>
    part.length > 0 && (
      <dl className={classes.list}>
        {part.map((day) => (
          <TimelineDayRow
            key={day.day}
            day={day}
            today={today}
            marked={day.day === shown && shown !== today}
            dayLink={dayLink}
          />
        ))}
      </dl>
    );
  // A side's days, newest first, with the day shown's line where it falls when it falls on that side:
  // before the first day earlier than it, or after them all, its fold opened to show it.
  const side = (list: readonly TimelineDayShown[], later: boolean) => {
    const lined = shownLine && shown > today === later;
    if (list.length === 0) return lined && <Line day={shown} />;
    const earlier = list.findIndex(({ day }) => day < shown);
    const split = lined && earlier !== -1 ? earlier : list.length;
    const kept = lined
      ? Math.min(split, list.length - 1)
      : list.findIndex(({ day }) => day === shown);
    return (
      <FoldedList
        items={list}
        start={later ? Math.max(0, list.length - shownEachSide) : 0}
        first={shownEachSide}
        noun="dates"
        newestFirst
        keepShown={kept === -1 ? undefined : kept}
      >
        {(shownItems) => {
          const before = shownItems.filter((day) => list.indexOf(day) < split);
          const after = shownItems.filter((day) => list.indexOf(day) >= split);
          const lineShown =
            lined && (after.length > 0 || before.at(-1) === list.at(-1));
          return (
            <>
              {rows(before)}
              {lineShown && <Line day={shown} />}
              {rows(after)}
            </>
          );
        }}
      </FoldedList>
    );
  };
  return (
    <>
      {side(planned, true)}
      <Line />
      {side(past, false)}
    </>
  );
}
