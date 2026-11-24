// SPDX-License-Identifier: Apache-2.0

// Tests for typing a day: digits laid out as a day as they are typed, and saying what to type once
// a whole day's worth is not one.

import { typedDay } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DayInput, dayNeeded, dayProblem } from "./day-input.tsx";
import { testTheme } from "./test-support.tsx";

describe("a day typed", () => {
  it("is laid out as a day as its digits are typed", () => {
    expect(
      ["2027", "20270", "202701", "2027010", "20270104", "202701045"].map(
        typedDay,
      ),
    ).toEqual([
      "2027",
      "2027-0",
      "2027-01",
      "2027-01-0",
      "2027-01-04",
      "2027-01-04",
    ]);
  });

  it("keeps dashes typed where they belong", () => {
    expect(typedDay("2027-01-04")).toBe("2027-01-04");
  });

  it("is left as typed when it is not digits", () => {
    expect(typedDay("4 Jan 2027")).toBe("4 Jan 2027");
  });
});

const box = (onChange = vi.fn(), shown = false, required = true) => {
  render(
    <MantineProvider theme={testTheme}>
      <DayInput
        label="Starts"
        value={undefined}
        required={required}
        shown={shown}
        onChange={onChange}
      />
    </MantineProvider>,
  );
  return { input: screen.getByRole("textbox", { name: "Starts" }), onChange };
};

describe("the day box", () => {
  it("gives the day once its digits are typed", async () => {
    const { input, onChange } = box();
    await userEvent.type(input, "20270104");
    expect([(input as HTMLInputElement).value, onChange.mock.lastCall]).toEqual(
      ["2027-01-04", ["2027-01-04", true]],
    );
  });

  it("takes only digits and dashes", async () => {
    const { input } = box();
    await userEvent.type(input, "ss2027x01");
    expect((input as HTMLInputElement).value).toBe("2027-01");
  });

  const deleteTheYearsLastDigit = async () => {
    const { input, onChange } = box();
    const day = input as HTMLInputElement;
    await userEvent.type(day, "20261108");
    day.setSelectionRange("2026".length, "2026".length);
    await userEvent.keyboard("{Backspace}");
    return { day, onChange };
  };

  it("leaves the other digits and the cursor in place when a digit in the middle is deleted", async () => {
    const { day } = await deleteTheYearsLastDigit();
    expect([day.value, day.selectionStart]).toEqual(["202-11-08", 3]);
  });

  it("takes a digit typed into the gap, with the cursor after it", async () => {
    const { day, onChange } = await deleteTheYearsLastDigit();
    await userEvent.keyboard("7");
    expect([day.value, day.selectionStart, onChange.mock.lastCall]).toEqual([
      "2027-11-08",
      4,
      ["2027-11-08", true],
    ]);
  });

  it("says nothing while a day is being typed", async () => {
    const { input } = box();
    await userEvent.type(input, "202701");
    expect(screen.queryByText(dayProblem)).toBeNull();
  });

  it("says what to type once a whole day's worth is not one", async () => {
    const { input, onChange } = box();
    await userEvent.type(input, "20270230");
    expect([screen.getByText(dayProblem), onChange.mock.lastCall]).toEqual([
      expect.anything(),
      [undefined, true],
    ]);
  });

  it("says a day is needed once the form asks for one", () => {
    box(vi.fn(), true);
    expect(screen.getByText(dayNeeded)).toBeDefined();
  });

  it("may be left empty when a day is not needed", () => {
    box(vi.fn(), true, false);
    expect(screen.queryByText(dayNeeded)).toBeNull();
  });

  it("tells assistive technology whether a day is needed", () => {
    box(vi.fn(), false, false);
    expect(
      screen
        .getByRole("textbox", { name: "Starts" })
        .getAttribute("aria-required"),
    ).toBe("false");
  });

  it("says an unfinished day is not one once the form asks, even when a day is not needed", () => {
    const onChange = vi.fn();
    render(
      <MantineProvider theme={testTheme}>
        <DayInput
          label="Starts"
          value="2027"
          required={false}
          shown
          onChange={onChange}
        />
      </MantineProvider>,
    );
    expect(screen.getByText(dayProblem)).toBeDefined();
  });

  it("shows a day chosen elsewhere, leaving what is being typed alone", async () => {
    const shown = (value: string | undefined) => (
      <MantineProvider theme={testTheme}>
        <DayInput label="Starts" value={value} onChange={vi.fn()} />
      </MantineProvider>
    );
    const { rerender } = render(shown("2027-01-01"));
    const input = screen.getByRole<HTMLInputElement>("textbox", {
      name: "Starts",
    });
    rerender(shown("2027-02-01"));
    expect(input.value).toBe("2027-02-01");
    await userEvent.clear(input);
    await userEvent.type(input, "2027");
    rerender(shown(undefined));
    expect(input.value).toBe("2027");
  });

  it("does not replace what is being typed with a day chosen elsewhere", async () => {
    const shown = (value: string) => (
      <MantineProvider theme={testTheme}>
        <DayInput label="Starts" value={value} onChange={vi.fn()} />
      </MantineProvider>
    );
    const { rerender } = render(shown("2027-01-01"));
    const input = screen.getByRole<HTMLInputElement>("textbox", {
      name: "Starts",
    });
    await userEvent.click(input);
    await userEvent.keyboard("{Backspace}");
    rerender(shown(""));
    expect(input.value).toBe("2027-01-0");
  });
});
