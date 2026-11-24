// SPDX-License-Identifier: Apache-2.0

// Tests for the grid of months, as Capacity's Feature teams tab shows it: the strip of quarters
// moving it, the month it counts people in, and that month's heading.

import { MantineProvider } from "@mantine/core";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MonthGrid, peopleCounting } from "./month-grid.tsx";
import { emptyView } from "./table-view.ts";
import {
  readOnlyMonthActions,
  teamMonthRecords,
  teamMonthsTable,
} from "./team-months.tsx";
import { openPage } from "./test-feature-teams.tsx";
import {
  fictionalTeamMonths,
  gridNow,
  noop,
  testTheme,
} from "./test-support.tsx";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${gridNow}T12:00:00Z`));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the strip of quarters", () => {
  // Every column 100 pixels wide, the Person column frozen, in a table showing 400 pixels.
  const columnWidth = 100;
  const room = 400;
  const months = 27;

  beforeEach(() => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      width: columnWidth,
      left: 0,
    } as DOMRect);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(room);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(
      (months + 1) * columnWidth,
    );
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(
      columnWidth,
    );
    vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(
      function (this: HTMLElement) {
        const siblings = [...(this.parentElement?.children ?? [])];
        return siblings.indexOf(this) * columnWidth;
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const scroller = (grid: HTMLElement) => grid.parentElement as HTMLElement;
  // The grid opens with the month before the current one, the fourteenth, just after the Person
  // column, so the current month, the fifteenth, is second; another month is just after the Person
  // column when scrolled by its columns from there.
  const openedAt = 13;
  let opened = 0;
  const atMonth = (index: number) => opened + (index - openedAt) * columnWidth;
  const openStrip = async () => {
    const grid = await openPage();
    opened = scroller(grid).scrollLeft;
    return grid;
  };
  const quarter = (name: string) =>
    within(screen.getByRole("toolbar", { name: "Quarters" })).getByRole(
      "button",
      { name: (label) => label.startsWith(name) },
    );
  // The grid tells the strip it has scrolled, as a browser does.
  const scrolled = (grid: HTMLElement) => {
    fireEvent.scroll(scroller(grid));
  };

  it("opens with the month before the current one in view, the current quarter chosen, tinting the quarters on screen", async () => {
    const grid = await openStrip();

    expect(opened).toBeGreaterThan(0);
    await waitFor(() => {
      expect(quarter("Q1 2027").getAttribute("aria-label")).toBe(
        "Q1 2027, in view, selected",
      );
    });
    expect(quarter("Q2 2027").getAttribute("aria-label")).toBe(
      "Q2 2027, in view",
    );
    expect(quarter("Q3 2027").getAttribute("aria-label")).toBe("Q3 2027");

    // Told it scrolled without moving, it keeps what it shows.
    scrolled(grid);
    await waitFor(() => {
      expect(quarter("Q1 2027").getAttribute("aria-label")).toBe(
        "Q1 2027, in view, selected",
      );
    });
  });

  it("counts the people in the current month, second in view, and fills its heading", async () => {
    const grid = await openStrip();

    await waitFor(() => {
      expect(
        grid
          .querySelector('th[data-column="2027-03"]')
          ?.hasAttribute("data-counted"),
      ).toBe(true);
    });
    expect(screen.getByRole("status").textContent).toMatch(
      /^\d+ (person|people) in Mar 2027$/u,
    );
    expect(grid.querySelectorAll("th[data-counted]")).toHaveLength(1);
  });

  it("moves the count and the filled heading as the grid scrolls", async () => {
    const grid = await openStrip();

    scroller(grid).scrollLeft = atMonth(9);
    scrolled(grid);

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toMatch(/in Nov 2026$/u);
    });
    expect(
      grid.querySelector("th[data-counted]")?.getAttribute("data-column"),
    ).toBe("2026-11");
  });

  it("scrolls a quarter chosen to just after the Person column, selected until the grid moves", async () => {
    const grid = await openStrip();

    await userEvent.click(quarter("Q4 2026"));
    scrolled(grid);

    expect(scroller(grid).scrollLeft).toBe(atMonth(8));
    await waitFor(() => {
      expect(quarter("Q4 2026").getAttribute("aria-label")).toBe(
        "Q4 2026, in view, selected",
      );
    });

    scroller(grid).scrollLeft = atMonth(10);
    scrolled(grid);

    await waitFor(() => {
      expect(quarter("Q4 2026").getAttribute("aria-label")).toBe(
        "Q4 2026, in view",
      );
    });
  });

  it("steps a quarter at a time from the month counted, and goes back to the current month with Today", async () => {
    const grid = await openStrip();
    await waitFor(() => {
      expect(quarter("Q1 2027").getAttribute("aria-label")).toContain(
        "in view",
      );
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Previous quarter" }),
    );
    expect(scroller(grid).scrollLeft).toBe(atMonth(11));
    scrolled(grid);
    await waitFor(() => {
      expect(quarter("Q1 2027").getAttribute("aria-label")).toContain(
        "selected",
      );
    });

    await userEvent.click(screen.getByRole("button", { name: "Next quarter" }));
    expect(scroller(grid).scrollLeft).toBe(atMonth(14));
    scrolled(grid);

    await userEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(scroller(grid).scrollLeft).toBe(atMonth(13));
    scrolled(grid);
    await waitFor(() => {
      expect(quarter("Q1 2027").getAttribute("aria-label")).toContain(
        "selected",
      );
    });
  });

  it("turns ‹ off at the first quarter, keeping focus on it, and › off at the last", async () => {
    // Given the grid at the current month, in Q1 2027
    const grid = await openStrip();
    const previous = () =>
      screen.getByRole("button", { name: "Previous quarter" });
    const next = () => screen.getByRole("button", { name: "Next quarter" });

    // When ‹ is pressed back to Q1 2026, the first quarter
    for (const step of [
      "Q1 2027",
      "Q4 2026",
      "Q3 2026",
      "Q2 2026",
      "Q1 2026",
    ]) {
      await userEvent.click(previous());
      scrolled(grid);
      await waitFor(() => {
        expect(quarter(step).getAttribute("aria-label")).toContain("selected");
      });
    }
    await userEvent.click(previous());

    // Then ‹ is turned off, still focused, and › only once the last quarter is chosen
    await waitFor(() => {
      expect(previous().getAttribute("aria-disabled")).toBe("true");
    });
    expect([
      previous().hasAttribute("disabled"),
      document.activeElement,
      next().getAttribute("aria-disabled"),
    ]).toEqual([false, previous(), null]);
    await userEvent.click(quarter("Q1 2028"));
    scrolled(grid);
    await waitFor(() => {
      expect(next().getAttribute("aria-disabled")).toBe("true");
    });
  });

  it("leaves the grid where it is when a turned off arrow is pressed", async () => {
    const grid = await openStrip();
    await userEvent.click(quarter("Q1 2028"));
    scrolled(grid);
    await waitFor(() => {
      expect(
        screen
          .getByRole("button", { name: "Next quarter" })
          .getAttribute("aria-disabled"),
      ).toBe("true");
    });
    const left = scroller(grid).scrollLeft;

    await userEvent.click(screen.getByRole("button", { name: "Next quarter" }));

    expect(scroller(grid).scrollLeft).toBe(left);
  });

  it("keeps the count and the filled heading on the last quarter's first month, though the grid can't show it second", async () => {
    // Given a view wide enough for ten months
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
      11 * columnWidth,
    );
    const grid = await openStrip();

    // When the last quarter is chosen, which the grid's end shows further along
    await userEvent.click(quarter("Q1 2028"));
    scrolled(grid);

    // Then its first month is the one counted, and its heading the one filled
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toMatch(/in Jan 2028$/u);
    });
    expect(
      grid.querySelector("th[data-counted]")?.getAttribute("data-column"),
    ).toBe("2028-01");
    expect(quarter("Q1 2028").getAttribute("aria-label")).toContain("selected");
  });

  it("keeps the month counted when no month is wholly in view", async () => {
    const grid = await openStrip();

    scroller(grid).scrollLeft = 100_000;
    scrolled(grid);

    await waitFor(() => {
      expect(quarter("Q1 2027").getAttribute("aria-label")).not.toContain(
        "selected",
      );
    });
    expect(screen.getByRole("status").textContent).toMatch(/in Mar 2027$/u);
    expect(grid.querySelector("th[data-counted]")).toBeNull();
  });
});

describe("a grid of months that doesn't hold today", () => {
  const savedViews = {
    views: [],
    unusable: [],
    applied: undefined,
    onApply: noop,
    onSave: noop,
    onRename: noop,
    onUpdate: noop,
    onDelete: noop,
    onDeleteUnusable: noop,
    onScope: noop,
  };

  it("chooses no quarter, and counts the current month, before and after Today", async () => {
    // Given a grid of months years from today
    render(
      <MantineProvider theme={testTheme}>
        <MonthGrid
          counting={peopleCounting}
          what="the months"
          reads={[]}
          table={teamMonthsTable(
            fictionalTeamMonths,
            "both",
            { today: gridNow, changesDates: false },
            undefined,
          )}
          records={teamMonthRecords(fictionalTeamMonths, undefined, "both")}
          actions={readOnlyMonthActions}
          canEdit={false}
          now={gridNow}
          range={{ from: "2030-01", to: "2030-12" }}
          view={emptyView}
          onView={noop}
          views={{ saved: savedViews, dialogs: null }}
        />
      </MantineProvider>,
    );
    const strip = await screen.findByRole("toolbar", { name: "Quarters" });

    // When Today is chosen
    await userEvent.click(screen.getByRole("button", { name: "Today" }));

    // Then no quarter is chosen, and the count is still the current month's
    expect(
      within(strip)
        .getAllByRole("button")
        .filter((quarter) =>
          quarter.getAttribute("aria-label")?.includes("selected"),
        ),
    ).toEqual([]);
    expect(screen.getByRole("status").textContent).toMatch(/in Mar 2027$/u);
  });
});
