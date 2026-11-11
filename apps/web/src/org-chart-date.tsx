// SPDX-License-Identifier: Apache-2.0

// The Org chart's date control: a timeline to step through by month, and, for readers who see
// Restricted details, a box for typing any day. Readers who do not see those details move by whole
// months, since the exact days people join and leave are Restricted. While the chart shows another
// date, the control says whether changes made there take effect from it, or nothing can be changed.

import {
  addToMonth,
  dayReadingMonth,
  monthNumber,
  monthOf,
} from "@fathom/shared";
import { ActionIcon, Button, Group, Slider, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { DayInput } from "./day-input.tsx";
import { focusSoon } from "./focus.ts";
import { formatDayOrMonth, formatMonth } from "./table-view.ts";
import { today } from "./today.ts";

const dateBoxId = "org-chart-date";
const monthsEachWay = 24;
// Every month has a mark, and every twelfth its name, which is all there is room for.
const monthsBetweenLabels = 12;
// How far down the arrows and timeline sit, to line up with the box under its label.
const dayBoxLabelHeight = 24;
const handleOffset = 6;
const noBreakSpace = "\u00a0";

// The day the chart draws for the month this far from the current one: the first of that month, or
// today in the current month.
function dayOfMonthFromNow(months: number): string {
  const now = today();
  return dayReadingMonth(addToMonth(monthOf(now), months), now);
}

export function OrgChartDate({
  day,
  seesDays,
  changes,
  onDay,
}: {
  // The day shown, or undefined for today.
  day: string | undefined;
  seesDays: boolean;
  // Whether changes can be made on the day shown.
  changes: boolean;
  onDay: (day: string | undefined) => void;
}) {
  const shown = day ?? today();
  const fromNow = monthNumber(shown) - monthNumber(today());
  const offset = Math.max(-monthsEachWay, Math.min(monthsEachWay, fromNow));
  // Where the timeline was dragged to, and the month it was dragged from, so the handle stays where
  // it was let go until the chart reaches that month, and the chart is only redrawn then.
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
    onDay(next === today() ? undefined : next);
  };
  const stepTo = (months: number) => {
    choose(dayOfMonthFromNow(months));
  };
  const marks = Array.from({ length: 2 * monthsEachWay + 1 }, (_, index) => {
    const value = index - monthsEachWay;
    return value % monthsBetweenLabels === 0
      ? { value, label: formatMonth(monthOf(dayOfMonthFromNow(value))) }
      : { value };
  });
  const belowLabel = seesDays ? dayBoxLabelHeight : 0;
  return (
    <Stack gap={0} mb="xs">
      <Group gap="sm" align="flex-start" wrap="nowrap">
        {seesDays && (
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
        )}
        <ActionIcon
          variant="default"
          mt={belowLabel}
          aria-label="Previous month"
          disabled={fromNow <= -monthsEachWay}
          onClick={() => {
            stepTo(fromNow - 1);
          }}
        >
          ‹
        </ActionIcon>
        <Slider
          thumbLabel="Month shown"
          thumbValueText={(months) =>
            formatMonth(monthOf(dayOfMonthFromNow(months)))
          }
          styles={{ markLabel: { color: "var(--mantine-color-text)" } }}
          style={{ flex: 1 }}
          mt={belowLabel + handleOffset}
          mb="lg"
          mx="lg"
          min={-monthsEachWay}
          max={monthsEachWay}
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
          mt={belowLabel}
          aria-label="Next month"
          disabled={fromNow >= monthsEachWay}
          onClick={() => {
            stepTo(fromNow + 1);
          }}
        >
          ›
        </ActionIcon>
        <Button
          variant="default"
          size="xs"
          mt={belowLabel}
          disabled={day === undefined}
          onClick={() => {
            choose(today());
          }}
        >
          Today
        </Button>
      </Group>
      {/* The line keeps its place while empty, so the chart below does not move as dates change. */}
      <Text size="sm" role="status">
        {day === undefined ? (
          noBreakSpace
        ) : (
          <>
            Showing {formatDayOrMonth(day, seesDays)}.{" "}
            {changes
              ? "Changes take effect from this date."
              : "Nothing can be changed on this date."}
          </>
        )}
      </Text>
    </Stack>
  );
}
