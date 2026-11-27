// SPDX-License-Identifier: Apache-2.0

// Tests for the date control the Org chart and People share: stepping by month, typing a day,
// stopping at today for roles that do not see future dates, and how far apart its months' names
// are, so they never overlap.

import { MantineProvider } from "@mantine/core";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DateControl, labelEvery } from "./date-control.tsx";
import { composingKeys, testTheme } from "./test-support.tsx";

const now = "2027-03-10";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${now}T12:00:00Z`));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function control(day: string | undefined, laterDays = true) {
  const onDay = vi.fn();
  render(
    <MantineProvider theme={testTheme}>
      <DateControl day={day} laterDays={laterDays} onDay={onDay} />
    </MantineProvider>,
  );
  return onDay;
}

const button = (name: string) =>
  screen.getByRole<HTMLButtonElement>("button", { name });

describe("the date control", () => {
  it("marks every month on the timeline and names each year's January", () => {
    control(undefined);

    expect(document.querySelectorAll(".mantine-Slider-mark")).toHaveLength(49);
    expect(
      [...document.querySelectorAll(".mantine-Slider-markLabel")].map(
        (label) => label.textContent,
      ),
    ).toEqual(["Jan 2026", "Jan 2027", "Jan 2028", "Jan 2029"]);
  });

  it("names no month beside a later one shown, so the day shown never reads as today's month", () => {
    // Given today in November, and a day in February shown
    vi.setSystemTime(new Date("2026-11-26T12:00:00Z"));
    control("2027-02-01");

    // Then the months named are Januaries, the one before February among them, and not November
    const names = [
      ...document.querySelectorAll(".mantine-Slider-markLabel"),
    ].map((label) => label.textContent);
    expect(names).toEqual(["Jan 2025", "Jan 2026", "Jan 2027", "Jan 2028"]);
  });

  it("names fewer months as the timeline narrows, such as beside a wider side panel", () => {
    // Given the date control, its timeline's width followed as it changes
    let resized:
      ((entries: { contentRect: { width: number } }[]) => void) | undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: typeof resized) {
          resized = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    control(undefined);

    // When the timeline narrows to 240 pixels
    act(() => {
      resized?.([{ contentRect: { width: 240 } }]);
    });

    // Then it names every second year
    expect(
      [...document.querySelectorAll(".mantine-Slider-markLabel")].map(
        (label) => label.textContent,
      ),
    ).toEqual(["Jan 2026", "Jan 2028"]);
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

  it("puts the day shown back when a later day is typed by a role that does not see one", async () => {
    const onDay = control(undefined, false);
    const box = screen.getByRole<HTMLInputElement>("textbox", { name: "Date" });
    await userEvent.clear(box);
    await userEvent.type(box, "20280315");
    expect(onDay).not.toHaveBeenCalled();
    expect(
      screen.getByRole<HTMLInputElement>("textbox", { name: "Date" }).value,
    ).not.toContain("2028");
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

  it.each(composingKeys)(
    "keeps what is typed at an Esc pressed %s a word, putting the date back at the reader's",
    async (_, composing) => {
      control("2027-02-01");
      const box = screen.getByRole<HTMLInputElement>("textbox", {
        name: "Date",
      });
      await userEvent.clear(box);
      await userEvent.type(box, "2025");
      fireEvent.keyDown(box, { key: "Escape", ...composing });
      expect(
        screen.getByRole<HTMLInputElement>("textbox", { name: "Date" }).value,
      ).toBe("2025");
      await userEvent.keyboard("{Escape}");
      expect(
        screen.getByRole<HTMLInputElement>("textbox", { name: "Date" }).value,
      ).toBe("2027-02-01");
    },
  );

  it("steps from a date past the timeline's end, keeping to that date's own month", async () => {
    const onDay = control("2035-01-01");
    await userEvent.click(button("Previous month"));
    expect(onDay.mock.calls).toEqual([["2034-12-01"]]);
  });

  it("moves the handle with the date once it has been dragged and let go", () => {
    const shown = (day: string | undefined) => (
      <MantineProvider theme={testTheme}>
        <DateControl day={day} laterDays onDay={vi.fn()} />
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

  it("stops at today for roles that do not see future dates", () => {
    control(undefined, false);
    expect(document.querySelectorAll(".mantine-Slider-mark")).toHaveLength(25);
    expect(button("Next month").disabled).toBe(true);
  });
});

describe("the months the timeline names", () => {
  it("are a year apart where there is room, and until its width is known", () => {
    expect(labelEvery(960, 48)).toBe(12);
    expect(labelEvery(0, 48)).toBe(12);
  });

  it("are whole years further apart as the timeline narrows", () => {
    expect(labelEvery(240, 48)).toBe(24);
    expect(labelEvery(100, 48)).toBe(48);
  });
});
