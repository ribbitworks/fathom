// SPDX-License-Identifier: Apache-2.0

// The date control of a page read as of a day, such as the Org chart and People: a timeline to step
// through by month, and a box for typing any day.

import {
  addToMonth,
  dayReadingMonth,
  monthNumber,
  monthOf,
} from "@fathom/shared";
import { ActionIcon, Button, Group, Slider, Stack, Text } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { useState } from "react";
import { DayInput } from "./day-input.tsx";
import { focusSoon } from "./focus.ts";
import { formatDay, formatMonth } from "./table-view.ts";
import { today } from "./today.ts";

const dateBoxId = "date-shown";
const monthsEachWay = 24;
// Every month has a mark, and every twelfth its name, or fewer where the slider is narrow.
const monthsBetweenLabels = 12;
// The room a month's label needs beside the next, such as Nov 2026, in pixels.
const labelRoom = 80;

// How many months apart the slider's labels are, a whole number of years, so they never overlap
// however narrow it is; a year apart until its width is known.
export function labelEvery(width: number, months: number): number {
  if (width === 0) return monthsBetweenLabels;
  const yearWidth = (width / months) * monthsBetweenLabels;
  return monthsBetweenLabels * Math.max(1, Math.ceil(labelRoom / yearWidth));
}

// How far down the arrows and timeline sit, to line up with the box under its label.
const dayBoxLabelHeight = 24;
const handleOffset = 6;
const noBreakSpace = "\u00a0";

// The day the page shows for the month this far from the current one: the first of that month, or
// today in the current month.
function dayOfMonthFromNow(months: number): string {
  const now = today();
  return dayReadingMonth(addToMonth(monthOf(now), months), now);
}

export function DateControl({
  day,
  laterDays,
  changes,
  onDay,
}: {
  // The day shown, or undefined for today.
  day: string | undefined;
  // Whether days after today can be shown.
  laterDays: boolean;
  // Whether changes can be made on the day shown.
  changes: boolean;
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
  const { ref: sliderRef, width: sliderWidth } = useElementSize();
  const every = labelEvery(sliderWidth, monthsEachWay + latest);
  const marks = Array.from(
    { length: monthsEachWay + latest + 1 },
    (_, index) => {
      const value = index - monthsEachWay;
      return value % every === 0
        ? { value, label: formatMonth(monthOf(dayOfMonthFromNow(value))) }
        : { value };
    },
  );
  return (
    <Stack gap={0} mb="xs">
      <Group gap="sm" align="flex-start" wrap="nowrap">
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
            if (event.key === "Escape") {
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
          styles={{ markLabel: { color: "var(--mantine-color-text)" } }}
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
      {/* The line keeps its place while empty, so what is below does not move as dates change. */}
      <Text size="sm" role="status">
        {day === undefined ? (
          noBreakSpace
        ) : (
          <>
            Showing {formatDay(day)}.{" "}
            {changes
              ? "Changes take effect from this date."
              : "Nothing can be changed on this date."}
          </>
        )}
      </Text>
    </Stack>
  );
}
