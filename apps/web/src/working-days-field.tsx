// SPDX-License-Identifier: Apache-2.0

// The working days changed in place, as a box for each day of the week.

import {
  type Weekday,
  weekdayNames,
  weekdayShortNames,
  weekOrder,
  workingDaysSchema,
} from "@fathom/shared";
import { Button } from "@mantine/core";
import { type KeyboardEvent, useState } from "react";
import { focusSoon } from "./focus.ts";
import {
  changeId,
  type Editing,
  editorId,
  problemId,
} from "./record-editing.tsx";
import pages from "./pages.module.css";
import classes from "./working-days-field.module.css";

const sameDays = (first: readonly Weekday[], second: readonly Weekday[]) =>
  first.length === second.length && first.every((day) => second.includes(day));

const moves: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowLeft: -1,
};

function DayBoxes({
  id,
  ticked,
  startsOn,
  describedBy,
  onTick,
  onDone,
  onCancel,
}: {
  id: string;
  ticked: readonly Weekday[];
  startsOn: Weekday;
  // What names why the days are refused, while they are.
  describedBy: string | undefined;
  onTick: (day: Weekday) => void;
  onDone: (how: "enter" | "leave") => void;
  onCancel: () => void;
}) {
  const days = weekOrder(startsOn);
  // The days are one stop for Tab, at the day last moved to.
  const [current, setCurrent] = useState(0);
  const boxId = (index: number) =>
    index === 0 ? id : `${id}-${String(index)}`;
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = moves[event.key];
    if (move !== undefined) {
      event.preventDefault();
      focusSoon(boxId((current + move + days.length) % days.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      onDone("enter");
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  };
  return (
    <div
      role="toolbar"
      aria-label="Working days"
      data-refused={describedBy !== undefined || undefined}
      className={[classes.days, pages.scrollBars].join(" ")}
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onDone("leave");
      }}
    >
      {days.map((day, index) => {
        const on = ticked.includes(day);
        // Each day is one of the week's seven.
        /* eslint-disable security/detect-object-injection */
        const [name, shortName] = [weekdayNames[day], weekdayShortNames[day]];
        /* eslint-enable security/detect-object-injection */
        return (
          <Button
            key={day}
            id={boxId(index)}
            className={classes.day}
            variant={on ? "light" : "default"}
            size="compact-sm"
            aria-pressed={on}
            aria-label={name}
            aria-describedby={describedBy}
            tabIndex={index === current ? 0 : -1}
            onFocus={() => {
              setCurrent(index);
            }}
            // Safari and Firefox on macOS don't focus a button clicked, so the press would leave the
            // days, which saves them; the box clicked takes focus itself.
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={(event) => {
              event.currentTarget.focus();
              onTick(day);
            }}
          >
            {shortName}
          </Button>
        );
      })}
    </div>
  );
}

// Changing the working days of a details panel's row, its boxes open in the row's place.
export function useWorkingDaysEditing(column: { key: string }) {
  const [ticked, setTicked] = useState<readonly Weekday[]>();

  const editingOf = ({
    days,
    startsOn,
    save,
  }: {
    days: readonly Weekday[];
    startsOn: Weekday;
    save: ((days: Weekday[]) => void) | undefined;
  }): Editing | undefined => {
    if (save === undefined) return undefined;
    const checked =
      ticked === undefined ? undefined : workingDaysSchema.safeParse(ticked);
    const problem = checked?.error?.issues.at(0)?.message;
    const close = () => {
      setTicked(undefined);
      focusSoon(changeId(column));
    };
    // Days refused stay to be put right, unless they were left, which puts them back, as in a
    // table's cell.
    const done = (how: "enter" | "leave") => {
      if (checked?.success === true) {
        if (!sameDays(checked.data, days)) save(checked.data);
        close();
      } else if (how === "leave") {
        setTicked(undefined);
      }
    };
    return {
      scope: "record",
      open: ticked !== undefined,
      problem,
      editor: ticked !== undefined && (
        <DayBoxes
          id={editorId(column)}
          ticked={ticked}
          startsOn={startsOn}
          describedBy={problem === undefined ? undefined : problemId(column)}
          onTick={(day) => {
            setTicked(
              ticked.includes(day)
                ? ticked.filter((one) => one !== day)
                : [...ticked, day],
            );
          }}
          onDone={done}
          onCancel={close}
        />
      ),
      onStart: () => {
        setTicked(days);
        focusSoon(editorId(column));
      },
    };
  };

  return { editingOf };
}
