// SPDX-License-Identifier: Apache-2.0

// Tests for a record's timeline: its days newest first, planned ones above Today's line and the past
// below, six on each side before the rest fold; the day shown marked, or a line where it falls; and a
// day moving the page there where the page can.

import { MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecordTimeline, type TimelineDayShown } from "./record-timeline.tsx";
import { testTheme } from "./test-support.tsx";

const today = "2026-11-24";

const dayOf = (day: string, words = "Start"): TimelineDayShown => ({
  day,
  changes: [[{ strong: words }]],
});

// Eight past days, a month apart, and two planned.
const days: TimelineDayShown[] = [
  ...["01", "02", "03", "04", "05", "06", "07", "08"].map((month) =>
    dayOf(`2026-${month}-01`),
  ),
  dayOf("2027-01-04", "Leads"),
  dayOf("2027-03-01", "Manager"),
];

function renderTimeline(
  shown: string,
  onDay?: (day: string) => void,
  given: readonly TimelineDayShown[] = days,
) {
  render(
    <MantineProvider theme={testTheme}>
      <RecordTimeline
        days={given}
        today={today}
        shown={shown}
        dayLink={
          onDay &&
          ((day) => () => {
            onDay(day);
          })
        }
      />
    </MantineProvider>,
  );
}

const dates = () =>
  screen.getAllByRole("term").map(({ textContent }) => textContent);

describe("a record's timeline", () => {
  it("lists planned days above Today's line and the past below, newest first, six past days before Earlier dates", () => {
    renderTimeline(today);

    expect(dates()).toEqual([
      "Mar 1, 2027",
      "Jan 4, 2027",
      "Aug 1, 2026",
      "Jul 1, 2026",
      "Jun 1, 2026",
      "May 1, 2026",
      "Apr 1, 2026",
      "Mar 1, 2026",
    ]);
    expect(screen.getByRole("separator", { name: "Today" }).textContent).toBe(
      "",
    );
    expect(
      screen.getByRole("button", { name: "Earlier dates (2)" }),
    ).toBeDefined();
  });

  it("folds planned days past six under Later dates, at the top", () => {
    const planned = Array.from({ length: 8 }, (_, at) =>
      dayOf(`2027-0${String(at + 1)}-15`),
    );
    renderTimeline(today, undefined, planned);

    expect(
      screen.getByRole("button", { name: "Later dates (2)" }),
    ).toBeDefined();
  });

  it("marks the day shown's row, opening the fold that holds it", () => {
    renderTimeline("2026-01-01");

    expect(dates()).toContain("Jan 1, 2026");
    expect(screen.getAllByRole("separator")).toHaveLength(1);
  });

  it("draws a line where a past day shown with no row falls", () => {
    renderTimeline("2026-06-15");

    const line = screen.getByRole("separator", { name: "Jun 15, 2026" });
    expect(line.nextElementSibling?.textContent).toContain("Jun 1, 2026");
  });

  it("draws the line after the last row when the day shown is earlier than every day", () => {
    renderTimeline("2025-01-01", undefined, [dayOf("2026-01-01")]);

    expect(
      screen.getByRole("separator", { name: "Jan 1, 2025" }),
    ).toBeDefined();
  });

  it("draws a line among the planned days for a later day shown with no row", () => {
    renderTimeline("2027-02-01");

    const line = screen.getByRole("separator", { name: "Feb 1, 2027" });
    expect(line.nextElementSibling?.textContent).toContain("Jan 4, 2027");
  });

  it("moves the page to a day when one is chosen, and shows plain dates where the page can't", async () => {
    const onDay = vi.fn();
    renderTimeline(today, onDay);

    await userEvent.click(screen.getByRole("button", { name: "Jan 4, 2027" }));

    expect(onDay).toHaveBeenCalledWith("2027-01-04");
  });

  it("shows plain dates where the page can't move to another day", () => {
    renderTimeline(today);

    expect(
      within(screen.getAllByRole("term")[0] as HTMLElement).queryByRole(
        "button",
      ),
    ).toBeNull();
  });

  it("draws the day shown's line alone on a side with no days", () => {
    renderTimeline("2026-06-15", undefined, [dayOf("2027-01-04")]);

    expect(
      screen.getByRole("separator", { name: "Jun 15, 2026" }),
    ).toBeDefined();
  });
});
