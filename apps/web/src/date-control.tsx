// SPDX-License-Identifier: Apache-2.0

// The date control of a page read as of a day, such as the Org chart and People: a timeline to step
// through by month, and a box for typing any day.

import {
  addToMonth,
  dayReadingMonth,
  monthNumber,
  monthOf,
} from "@fathom/shared";
import { ActionIcon, Button, Group, Slider } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { composingWord } from "./composing.ts";
import { DayInput } from "./day-input.tsx";
import { focusSoon } from "./focus.ts";
import { formatMonth } from "./day-formats.ts";
import { today } from "./today.ts";
import classes from "./date-control.module.css";

const dateBoxId = "date-shown";
const monthsEachWay = 24;
// Every month has a mark, and every January its name, or fewer where the slider is narrow.
const monthsBetweenLabels = 12;
// January's number in monthNumber's count, from which named months are counted.
const januaryNumber = 1;
// The room a month's label needs beside the next, such as Nov 2026, in pixels.
const labelRoom = 80;

// How many months apart the slider's labels are, a whole number of years, so they never overlap
// however narrow it is; a year apart until its width is known.
export function labelEvery(width: number, months: number): number {
  if (width === 0) return monthsBetweenLabels;
  const yearWidth = (width / months) * monthsBetweenLabels;
  return monthsBetweenLabels * Math.max(1, Math.ceil(labelRoom / yearWidth));
}

// How many months apart the slider's labels are, followed as its width changes, such as while a
// side panel beside it is resized, drawing the slider again only when that number changes.
function useLabelEvery(months: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [every, setEvery] = useState(() => labelEvery(0, months));
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const { contentRect } of entries) {
        setEvery(labelEvery(contentRect.width, months));
      }
    });
    observer.observe(ref.current as HTMLDivElement);
    return () => {
      observer.disconnect();
    };
  }, [months]);
  return { ref, every };
}

// How far down the arrows and timeline sit, to line up with the box under its label.
const dayBoxLabelHeight = 24;
const handleOffset = 6;

// The day the page shows for the month this far from the current one: the first of that month, or
// today in the current month.
function dayOfMonthFromNow(months: number): string {
  const now = today();
  return dayReadingMonth(addToMonth(monthOf(now), months), now);
}

export function DateControl({
  day,
  laterDays,
  onDay,
}: {
  // The day shown, or undefined for today.
  day: string | undefined;
  // Whether days after today can be shown.
  laterDays: boolean;
  onDay: (day: string | undefined) => void;
}) {
  const shown = day ?? today();
  const fromNow = monthNumber(shown) - monthNumber(today());
  const offset = Math.max(-monthsEachWay, Math.min(monthsEachWay, fromNow));
  // Where the timeline was dragged to, and the month it was dragged from, so the handle stays where
  // it was let go until the page reaches that month, and the page is only redrawn then.
  const [dragged, setDragged] = useState<{
    to: number;
    from: number;
    released: boolean;
  }>();
  if (dragged?.released === true && dragged.to === offset) {
    setDragged(undefined);
  }
  const handleAt = dragged?.from === offset ? dragged.to : offset;
  // Starts the box again from the date shown, when it is left holding no whole date, or by Esc.
  const [incomplete, setIncomplete] = useState(false);
  const [boxCount, setBoxCount] = useState(0);
  const restartBox = () => {
    setIncomplete(false);
    setBoxCount((count) => count + 1);
  };
  const choose = (next: string) => {
    // A later day typed by a role that may not see one puts the box back to the day shown.
    if (!laterDays && next > today()) {
      restartBox();
      return;
    }
    onDay(next === today() ? undefined : next);
  };
  const stepTo = (months: number) => {
    choose(dayOfMonthFromNow(months));
  };
  const latest = laterDays ? monthsEachWay : 0;
  const { ref: sliderRef, every } = useLabelEvery(monthsEachWay + latest);
  const marks = Array.from(
    { length: monthsEachWay + latest + 1 },
    (_, index) => {
      const value = index - monthsEachWay;
      const month = monthOf(dayOfMonthFromNow(value));
      // Each name is a January, so a month shown never sits beside another month's name.
      return (monthNumber(month) - januaryNumber) % every === 0
        ? { value, label: formatMonth(month) }
        : { value };
    },
  );
  return (
    <Group gap="sm" align="flex-start" wrap="nowrap" mb="xs">
      <DayInput
        key={boxCount}
        id={dateBoxId}
        label="Date"
        size="xs"
        required={false}
        value={shown}
        onChange={(typed) => {
          setIncomplete(typed === undefined);
          if (typed !== undefined) choose(typed);
        }}
        onBlur={() => {
          if (incomplete) restartBox();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !composingWord(event)) {
            restartBox();
            focusSoon(dateBoxId);
          }
        }}
      />
      <ActionIcon
        variant="default"
        mt={dayBoxLabelHeight}
        aria-label="Previous month"
        disabled={fromNow <= -monthsEachWay}
        onClick={() => {
          stepTo(fromNow - 1);
        }}
      >
        ‹
      </ActionIcon>
      <Slider
        ref={sliderRef}
        thumbLabel="Month shown"
        thumbValueText={(months) =>
          formatMonth(monthOf(dayOfMonthFromNow(months)))
        }
        classNames={{ markLabel: classes.markLabel }}
        flex={1}
        mt={dayBoxLabelHeight + handleOffset}
        mb="lg"
        mx="lg"
        min={-monthsEachWay}
        max={latest}
        step={1}
        marks={marks}
        value={handleAt}
        label={(months) => formatMonth(monthOf(dayOfMonthFromNow(months)))}
        onChange={(to) => {
          setDragged({ to, from: offset, released: false });
        }}
        onChangeEnd={(to) => {
          setDragged({ to, from: offset, released: true });
          stepTo(to);
        }}
      />
      <ActionIcon
        variant="default"
        mt={dayBoxLabelHeight}
        aria-label="Next month"
        disabled={fromNow >= latest}
        onClick={() => {
          stepTo(fromNow + 1);
        }}
      >
        ›
      </ActionIcon>
      <Button
        variant="default"
        size="xs"
        mt={dayBoxLabelHeight}
        disabled={day === undefined}
        onClick={() => {
          choose(today());
        }}
      >
        Today
      </Button>
    </Group>
  );
}
