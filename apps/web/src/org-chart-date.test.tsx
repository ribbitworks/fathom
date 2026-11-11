// SPDX-License-Identifier: Apache-2.0

// Tests for the Org chart's date control: which day a chart is drawn as of, stepping by month, typing
// a day for readers who see Personal details, and what it says while the chart shows another day.

import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrgChartDate } from "./org-chart-date.tsx";
import { chartDay } from "./org-chart.ts";
import { testTheme } from "./test-support.tsx";

const now = "2027-03-10";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${now}T12:00:00Z`));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("chartDay", () => {
  it.each([
    ["none asked", undefined, true, true, undefined],
    ["today", now, true, true, undefined],
    [
      "any day for readers who see the days",
      "2025-03-15",
      false,
      true,
      "2025-03-15",
    ],
    [
      "the first of a month on feature teams",
      "2025-03-01",
      true,
      false,
      "2025-03-01",
    ],
    ["no other day on feature teams", "2025-03-15", true, false, undefined],
    ["no day on reporting teams", "2025-03-01", false, false, undefined],
  ])("%s", (_, asked, featureTeams, seesDays, expected) => {
    expect(chartDay(asked, featureTeams, seesDays)).toBe(expected);
  });
});

function control(day: string | undefined, seesDays = true, changes = false) {
  const onDay = vi.fn();
  render(
    <MantineProvider theme={testTheme}>
      <OrgChartDate
        day={day}
        seesDays={seesDays}
        changes={changes}
        onDay={onDay}
      />
    </MantineProvider>,
  );
  return onDay;
}

const button = (name: string) =>
  screen.getByRole<HTMLButtonElement>("button", { name });

describe("the date control", () => {
  it("marks every month on the timeline and names every twelfth", () => {
    control(undefined);

    expect(document.querySelectorAll(".mantine-Slider-mark")).toHaveLength(49);
    expect(
      [...document.querySelectorAll(".mantine-Slider-markLabel")].map(
        (label) => label.textContent,
      ),
    ).toEqual(["Mar 2025", "Mar 2026", "Mar 2027", "Mar 2028", "Mar 2029"]);
  });

  it("shows today with nothing to go back to", () => {
    control(undefined);
    expect(
      screen.getByRole<HTMLInputElement>("textbox", { name: "Date" }).value,
    ).toBe(now);
    expect(button("Today").disabled).toBe(true);
  });

  it("steps to the first day of the month before and after", async () => {
    const onDay = control("2027-02-01");
    await userEvent.click(button("Previous month"));
    await userEvent.click(button("Next month"));
    expect(onDay.mock.calls).toEqual([["2027-01-01"], [undefined]]);
  });

  it("goes back to today", async () => {
    const onDay = control("2025-03-15");
    await userEvent.click(button("Today"));
    expect(onDay.mock.calls).toEqual([[undefined]]);
  });

  it("stops at the ends of the timeline", () => {
    control("2020-01-01");
    expect(button("Previous month").disabled).toBe(true);
  });

  it("stops at the far end too", () => {
    control("2035-01-01");
    expect(button("Next month").disabled).toBe(true);
  });

  it("takes a whole day typed, and waits for one", async () => {
    const onDay = control("2027-02-01");
    const box = screen.getByRole("textbox", { name: "Date" });
    await userEvent.clear(box);
    await userEvent.type(box, "2025");
    expect(onDay).not.toHaveBeenCalled();
    await userEvent.type(box, "0315");
    expect(onDay.mock.calls).toEqual([["2025-03-15"]]);
  });

  it("goes back to today when today is typed", async () => {
    const onDay = control("2027-02-01");
    const box = screen.getByRole("textbox", { name: "Date" });
    await userEvent.clear(box);
    await userEvent.type(box, "20270310");
    expect(onDay.mock.calls).toEqual([[undefined]]);
  });

  it("moves along the timeline by keyboard", () => {
    const onDay = control("2027-02-01");
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowLeft" });
    expect(onDay.mock.calls).toEqual([["2027-01-01"]]);
  });

  it("puts the date back when the box is left part-typed", async () => {
    control("2027-02-01");
    const box = screen.getByRole<HTMLInputElement>("textbox", { name: "Date" });
    await userEvent.clear(box);
    await userEvent.type(box, "2025");
    await userEvent.tab();
    expect(
      screen.getByRole<HTMLInputElement>("textbox", { name: "Date" }).value,
    ).toBe("2027-02-01");
  });

  it("leaves a whole date in the box when it is left", async () => {
    control("2027-02-01");
    await userEvent.click(screen.getByRole("textbox", { name: "Date" }));
    await userEvent.tab();
    expect(
      screen.getByRole<HTMLInputElement>("textbox", { name: "Date" }).value,
    ).toBe("2027-02-01");
  });

  it("puts the date back when Esc is pressed", async () => {
    control("2027-02-01");
    const box = screen.getByRole("textbox", { name: "Date" });
    await userEvent.clear(box);
    await userEvent.type(box, "2025{Escape}");
    expect(
      screen.getByRole<HTMLInputElement>("textbox", { name: "Date" }).value,
    ).toBe("2027-02-01");
  });

  it("steps from a date past the timeline's end, keeping to that date's own month", async () => {
    const onDay = control("2035-01-01");
    await userEvent.click(button("Previous month"));
    expect(onDay.mock.calls).toEqual([["2034-12-01"]]);
  });

  it("moves the handle with the date once it has been dragged and let go", () => {
    const shown = (day: string | undefined) => (
      <MantineProvider theme={testTheme}>
        <OrgChartDate day={day} seesDays changes={false} onDay={vi.fn()} />
      </MantineProvider>
    );
    const { rerender } = render(shown(undefined));
    const handle = () => screen.getByRole("slider");
    fireEvent.keyDown(handle(), { key: "ArrowLeft" });
    rerender(shown("2027-02-01"));
    rerender(shown(undefined));
    expect(handle().getAttribute("aria-valuenow")).toBe("0");
  });

  it("names the month under the handle", () => {
    control("2025-03-01");
    expect(screen.getByRole("slider").getAttribute("aria-valuetext")).toBe(
      "Mar 2025",
    );
  });

  it("says the day shown can't be changed", () => {
    control("2025-03-15");
    expect(screen.getByRole("status").textContent).toBe(
      "Showing Mar 15, 2025. Nothing can be changed on this date.",
    );
  });

  it("says changes take effect from the day shown, where they can be made", () => {
    control("2027-05-01", true, true);
    expect(screen.getByRole("status").textContent).toBe(
      "Showing May 1, 2027. Changes take effect from this date.",
    );
  });

  it("keeps the line's place, empty, while today is shown", () => {
    control(undefined);
    expect(screen.getByRole("status").textContent).toBe("\u00a0");
  });

  it("offers months alone to readers who do not see the days", () => {
    control("2025-03-01", false);
    expect(screen.queryByRole("textbox", { name: "Date" })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(
      "Showing Mar 2025. Nothing can be changed on this date.",
    );
  });
});
