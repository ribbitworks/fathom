// SPDX-License-Identifier: Apache-2.0

// Tests for the shared timeline: its strip of quarters following the view and scrolling it, the
// release layer in each of its forms, and the rows a view gives it beside the release layer, with
// Ended on a stream past its last day.

import type { ReleaseStream } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fictionalCycle,
  fictionalRelease,
  fictionalStream,
} from "./test-releases.ts";
import { recordDraft, testTheme } from "./test-support.tsx";
import type { ReleaseLayerForm } from "./release-layer.tsx";
import type { DayRange, TimelineRow } from "./timeline.ts";
import { TimelineView } from "./timeline-view.tsx";

// The view leaves 540 pixels for the tracks beside the rows' labels, and Month shows 180 days
// across them: three pixels a day.
const room = 540;
// The rows' labels' column beside the tracks.
const names = 180;
const zoomKey = "fathom-test-timeline-zoom";

beforeEach(() => {
  localStorage.setItem(zoomKey, '"month"');
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    () => names + room,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.removeItem(zoomKey);
});

function showTimeline({
  streams = [fictionalStream()],
  rows,
  today = "2027-06-15",
  layerForm = "releases",
}: {
  streams?: ReleaseStream[];
  rows?: { name: string; range: DayRange; rows: TimelineRow[] };
  today?: string;
  layerForm?: ReleaseLayerForm;
} = {}) {
  render(
    <MantineProvider theme={testTheme}>
      <TimelineView
        title="Fictional Timeline"
        zoomKey={zoomKey}
        releaseStreams={streams}
        layerForm={layerForm}
        rows={rows}
        today={today}
      />
    </MantineProvider>,
  );
  return screen.getByRole("region", { name: "Fictional Timeline" });
}

const view = (timeline: HTMLElement) =>
  within(timeline).getByRole("group", { name: "Fictional Timeline" });

describe("the strip", () => {
  // The timeline covers 2027: Q1 is days 0 to 90, Q2 90 to 181, Q3 181 to 273, Q4 273 to 365.
  // It opens with today, day 165, a sixth of the way across: scrolled 405 pixels, showing days
  // 135 to 315.
  const opened = 165 * 3 - room / 6;
  const furthest = 365 * 3 - room;
  // Where the view is scrolled to with a day a sixth of the way across.
  const sixthAcross = (day: number) => day * 3 - room / 6;

  const quarters = (timeline: HTMLElement) =>
    within(within(timeline).getByRole("toolbar", { name: "Quarters" }))
      .getAllByRole("button")
      .map((quarter) => ({
        name: quarter.getAttribute("aria-label")?.split(", ")[0],
        inView: quarter.hasAttribute("data-in-view"),
        current: quarter.getAttribute("aria-current") === "date",
        selected: quarter.hasAttribute("data-selected"),
      }));

  const inView = (timeline: HTMLElement) =>
    quarters(timeline)
      .filter((quarter) => quarter.inView)
      .map(({ name }) => name);

  const selected = (timeline: HTMLElement) =>
    quarters(timeline)
      .filter((quarter) => quarter.selected)
      .map(({ name }) => name);

  const button = (timeline: HTMLElement, name: string) =>
    within(timeline).getByRole("button", { name });

  // A quarter's button, whether or not it is in view or selected.
  const quarter = (timeline: HTMLElement, name: string) =>
    within(timeline).getByRole("button", {
      name: (shown) => shown.split(", ")[0] === name,
    });

  it("shows every quarter, tinting those in view and marking the current one", () => {
    const timeline = showTimeline();
    expect(view(timeline).scrollLeft).toBe(opened);
    expect(quarters(timeline)).toEqual([
      { name: "Q1 2027", inView: false, current: false, selected: false },
      { name: "Q2 2027", inView: true, current: true, selected: false },
      { name: "Q3 2027", inView: true, current: false, selected: false },
      { name: "Q4 2027", inView: true, current: false, selected: false },
    ]);
  });

  it("names the quarters in view as in view, and the one chosen as selected", async () => {
    const timeline = showTimeline();
    expect(quarter(timeline, "Q1 2027").getAttribute("aria-label")).toBe(
      "Q1 2027",
    );
    expect(quarter(timeline, "Q2 2027").getAttribute("aria-label")).toBe(
      "Q2 2027, in view",
    );
    await userEvent.click(quarter(timeline, "Q3 2027"));
    expect(quarter(timeline, "Q3 2027").getAttribute("aria-label")).toBe(
      "Q3 2027, in view, selected",
    );
  });

  // The quarters reached by Tab, in order.
  const tabStops = (timeline: HTMLElement) =>
    ["Q1 2027", "Q2 2027", "Q3 2027", "Q4 2027"].filter(
      (name) => quarter(timeline, name).tabIndex === 0,
    );

  it("is one stop for Tab, at the first quarter in view", async () => {
    const timeline = showTimeline();
    act(() => {
      button(timeline, "Previous quarter").focus();
    });
    await userEvent.tab();
    expect(document.activeElement).toBe(quarter(timeline, "Q2 2027"));
    await userEvent.tab();
    expect(document.activeElement).toBe(button(timeline, "Next quarter"));
  });

  it("keeps Tab on the quarter focused while focus is in the strip, and goes back to the first in view once it leaves", () => {
    const timeline = showTimeline();
    act(() => {
      quarter(timeline, "Q4 2027").focus();
    });
    expect(tabStops(timeline)).toEqual(["Q4 2027"]);
    act(() => {
      button(timeline, "Today").focus();
    });
    expect(tabStops(timeline)).toEqual(["Q2 2027"]);
    act(() => {
      quarter(timeline, "Q4 2027").focus();
    });
    act(() => {
      (document.activeElement as HTMLElement).blur();
    });
    expect(tabStops(timeline)).toEqual(["Q2 2027"]);
  });

  it("moves between quarters with the arrow keys, Home and End", async () => {
    const timeline = showTimeline();
    act(() => {
      quarter(timeline, "Q1 2027").focus();
    });
    const focusedAfter = async (keys: string) => {
      await userEvent.keyboard(keys);
      return document.activeElement?.getAttribute("aria-label");
    };
    expect(await focusedAfter("{ArrowRight}")).toBe("Q2 2027, in view");
    expect(await focusedAfter("{End}")).toBe("Q4 2027, in view");
    expect(await focusedAfter("{ArrowRight}")).toBe("Q4 2027, in view");
    expect(await focusedAfter("{Home}")).toBe("Q1 2027");
    expect(await focusedAfter("{ArrowLeft}")).toBe("Q1 2027");
    expect(await focusedAfter("a")).toBe("Q1 2027");
    // Alt with an arrow key is the browser's, such as Back.
    expect(await focusedAfter("{Alt>}{ArrowRight}{/Alt}")).toBe("Q1 2027");
  });

  it("scrolls a quarter chosen a sixth of the way across, the end of the one before in sight", async () => {
    const timeline = showTimeline();
    await userEvent.click(quarter(timeline, "Q3 2027"));
    expect(view(timeline).scrollLeft).toBe(sixthAcross(181));
    expect(inView(timeline)).toEqual(["Q2 2027", "Q3 2027", "Q4 2027"]);
    expect(selected(timeline)).toEqual(["Q3 2027"]);
  });

  it("chooses the quarter focused with Enter or Space, the arrow keys only moving focus", async () => {
    const timeline = showTimeline();
    act(() => {
      quarter(timeline, "Q1 2027").focus();
    });
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(view(timeline).scrollLeft).toBe(opened);
    expect(selected(timeline)).toEqual([]);
    await userEvent.keyboard("{Enter}");
    expect(view(timeline).scrollLeft).toBe(sixthAcross(181));
    expect(selected(timeline)).toEqual(["Q3 2027"]);
    await userEvent.keyboard("{ArrowLeft}[Space]");
    expect(view(timeline).scrollLeft).toBe(sixthAcross(90));
    expect(selected(timeline)).toEqual(["Q2 2027"]);
  });

  it("selects a quarter chosen with the view already at the timeline's end, though the view cannot move", async () => {
    const timeline = showTimeline();
    view(timeline).scrollLeft = furthest;
    fireEvent.scroll(view(timeline));
    act(() => {
      quarter(timeline, "Q4 2027").focus();
    });
    await userEvent.keyboard("{Enter}");
    expect(view(timeline).scrollLeft).toBe(furthest);
    expect(selected(timeline)).toEqual(["Q4 2027"]);
  });

  it("selects no quarter once Today is chosen", async () => {
    const timeline = showTimeline();
    await userEvent.click(quarter(timeline, "Q3 2027"));
    await userEvent.click(button(timeline, "Today"));
    expect(selected(timeline)).toEqual([]);
  });

  it("selects no quarter once the zoom changes, though the view stays at the timeline's start", async () => {
    const timeline = showTimeline();
    await userEvent.click(quarter(timeline, "Q1 2027"));
    expect(view(timeline).scrollLeft).toBe(0);
    expect(selected(timeline)).toEqual(["Q1 2027"]);
    // All fits the whole year across, so the view stays at its start.
    await userEvent.click(within(timeline).getByRole("radio", { name: "All" }));
    expect(view(timeline).scrollLeft).toBe(0);
    expect(selected(timeline)).toEqual([]);
  });

  it("selects the quarter an arrow steps to, and none once the view moves elsewhere", async () => {
    const timeline = showTimeline();
    await userEvent.click(button(timeline, "Previous quarter"));
    expect(selected(timeline)).toEqual(["Q2 2027"]);
    view(timeline).scrollLeft = 0;
    fireEvent.scroll(view(timeline));
    expect(selected(timeline)).toEqual([]);
  });

  it("steps a quarter at a time, as far as the timeline goes", async () => {
    const timeline = showTimeline();
    await userEvent.click(quarter(timeline, "Q3 2027"));
    await userEvent.click(button(timeline, "Next quarter"));
    // Q4 a sixth of the way across is past the furthest the view scrolls.
    expect(view(timeline).scrollLeft).toBe(furthest);
    expect(button(timeline, "Next quarter").getAttribute("aria-disabled")).toBe(
      "true",
    );
    await userEvent.click(button(timeline, "Previous quarter"));
    expect(view(timeline).scrollLeft).toBe(sixthAcross(181));
  });

  it("goes back to the start of the quarter a sixth of the way across", async () => {
    const timeline = showTimeline();
    await userEvent.click(button(timeline, "Previous quarter"));
    expect(view(timeline).scrollLeft).toBe(sixthAcross(90));
  });

  it("goes on to the timeline's end when no quarter starts after a sixth of the way across", async () => {
    // Days shows two weeks, 38.57 pixels a day; mid-November is past Q4's start a sixth across.
    localStorage.setItem(zoomKey, '"days"');
    const timeline = showTimeline({ today: "2027-11-15" });
    await userEvent.click(button(timeline, "Next quarter"));
    expect(view(timeline).scrollLeft).toBeCloseTo((365 * room) / 14 - room);
    expect(selected(timeline)).toEqual([]);
  });

  it("follows the reader's scrolling", () => {
    const timeline = showTimeline();
    view(timeline).scrollLeft = 0;
    fireEvent.scroll(view(timeline));
    expect(inView(timeline)).toEqual(["Q1 2027", "Q2 2027"]);
    expect(
      button(timeline, "Previous quarter").getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("goes back to today", async () => {
    const timeline = showTimeline();
    await userEvent.click(quarter(timeline, "Q4 2027"));
    await userEvent.click(button(timeline, "Today"));
    expect(view(timeline).scrollLeft).toBe(opened);
    expect(inView(timeline)).toEqual(["Q2 2027", "Q3 2027", "Q4 2027"]);
  });

  it("offers no Today and marks no quarter once today is off the timeline", () => {
    const timeline = showTimeline({ today: "2028-02-15" });
    expect(
      within(timeline).queryByRole("button", { name: "Today" }),
    ).toBeNull();
    expect(quarters(timeline).some(({ current }) => current)).toBe(false);
  });

  it("holds the day in the middle of the view while zooming after a quarter is chosen", async () => {
    const timeline = showTimeline();
    await userEvent.click(quarter(timeline, "Q3 2027"));
    // The middle was day 181 - 30 + 90 = 241; Week shows 42 days across 540 pixels.
    await userEvent.click(
      within(timeline).getByRole("radio", { name: "Week" }),
    );
    expect(view(timeline).scrollLeft).toBeCloseTo((241 * room) / 42 - room / 2);
    // Six weeks around day 241, late August, are in Q3.
    expect(inView(timeline)).toEqual(["Q3 2027"]);
  });
});

describe("a view's own rows", () => {
  const ownRows = (last: string) => ({
    name: "Fictional rows",
    range: { first: "2027-03-10", last },
    rows: [
      {
        id: "r1",
        label: "Fictional Row",
        lanes: (px: (days: number) => string) => <span>{px(10)} wide</span>,
      },
    ],
  });

  it("names a stream Ended once its last day has passed", () => {
    const labels = (today: string) => {
      const timeline = showTimeline({
        streams: [fictionalStream({ endsOn: "2027-05-15" })],
        today,
      });
      const shown = within(timeline).queryByText("Ended") !== null;
      cleanup();
      return shown;
    };
    expect([labels("2027-05-15"), labels("2027-05-16")]).toEqual([false, true]);
  });

  it("names a release that fits after its draft's dot and its colour's square, and marks none that doesn't", () => {
    // Given two drafted releases on one quarter each: a short name that fits, and a long one
    const drafted = recordDraft({ action: "changed", changed: ["name"] });
    const timeline = showTimeline({
      streams: [
        fictionalStream({
          releases: [
            fictionalRelease({ name: "Fit", colour: "grape", draft: drafted }),
            fictionalRelease({
              id: "30000000-0000-4000-8000-000000000002",
              name: "A release name far too long for one quarter's strip",
              firstCycle: "2027-04-01",
              lastCycle: "2027-04-01",
              colour: "teal",
              draft: drafted,
            }),
          ],
        }),
      ],
    });

    // Then only the release that fits shows its square, and only its name is drawn on its strip
    expect([
      [...timeline.querySelectorAll<HTMLElement>("[data-colour]")].map(
        (square) => square.dataset.colour,
      ),
      within(timeline).queryAllByText("Fit", {
        ignore: ".mantine-VisuallyHidden-root",
      }).length,
    ]).toEqual([["grape"], 1]);
  });

  it("leaves room for a release's square when deciding whether its name fits", () => {
    // Given a release on a quarter of 90 days, 270 pixels, whose name and square fit, and one on a
    // quarter of 91 days, 273 pixels, whose name fits only without its square
    const timeline = showTimeline({
      streams: [
        fictionalStream({
          releases: [
            fictionalRelease({ name: "N".repeat(35), colour: "grape" }),
            fictionalRelease({
              id: "30000000-0000-4000-8000-000000000002",
              name: "W".repeat(37),
              firstCycle: "2027-04-01",
              lastCycle: "2027-04-01",
              colour: "teal",
            }),
          ],
        }),
      ],
    });

    // Then only the first is named on its strip
    expect(
      [...timeline.querySelectorAll<HTMLElement>("[data-colour]")].map(
        (square) => square.dataset.colour,
      ),
    ).toEqual(["grape"]);
  });

  it("draws the view's rows at the timeline's scale, under the release layer", () => {
    const timeline = showTimeline({ rows: ownRows("2027-05-20") });
    expect(
      within(timeline)
        .getAllByRole("list", { name: /^(Schedules|Fictional rows)$/ })
        .map((list) => list.getAttribute("aria-label")),
    ).toEqual(["Schedules", "Fictional rows"]);
    const row = within(
      within(timeline).getByRole("list", { name: "Fictional rows" }),
    ).getByRole("listitem");
    expect(row.textContent).toBe("Fictional Row30px wide");
  });

  it("covers the days the view's rows need beyond the release layer's", () => {
    const timeline = showTimeline({ rows: ownRows("2028-02-20") });
    expect(
      within(within(timeline).getByRole("toolbar", { name: "Quarters" }))
        .getAllByRole("button")
        .at(-1)
        ?.getAttribute("aria-label"),
    ).toBe("Q1 2028");
  });

  it("shows the view's rows alone without a release layer", () => {
    const timeline = showTimeline({ streams: [], rows: ownRows("2027-05-20") });
    expect(
      within(timeline).queryByRole("list", { name: "Schedules" }),
    ).toBeNull();
    expect(
      within(timeline).getByRole("list", { name: "Fictional rows" }),
    ).toBeDefined();
  });
});

describe("the release layer's forms", () => {
  // Fictional Majors ends with 2027, and ships Fictional One with its second quarter.
  const ending = () =>
    fictionalStream({
      endsOn: "2027-12-31",
      releases: [fictionalRelease({ lastCycle: "2027-04-01" })],
    });

  // Each list in the first stream's row, by its name, with each item's classes, unhashed.
  const rowLists = (timeline: HTMLElement) =>
    [
      ...(
        within(timeline).getByRole("list", { name: "Schedules" })
          .firstElementChild as HTMLElement
      ).querySelectorAll("ul"),
    ].map((list) => ({
      name: list.getAttribute("aria-label"),
      items: [...list.children].map((item) =>
        item.className
          .replace(/_([A-Za-z]+)_\w+/g, "$1")
          .replace(/\s+/g, " ")
          .trim(),
      ),
    }));

  it("draws each stream's releases over its cycles, drawn faint in the same row, for releases", () => {
    const timeline = showTimeline({
      streams: [ending()],
      layerForm: "releases",
    });
    expect(rowLists(timeline)).toEqual([
      {
        name: "Releases of Fictional Majors",
        items: [
          "timelineCycleFaint timelineCycleBlock timelineCyclePast",
          "timelineCycleFaint timelineCycleAlternate",
          "timelineCycleFaint timelineCycleBlock",
          "timelineCycleFaint timelineCycleAlternate",
          "timelineStreamEnd",
          "timelineReleaseSlot",
        ],
      },
    ]);
    // The faint cycles are only drawn, so the row's items are its releases.
    expect(
      within(
        within(timeline).getByRole("list", {
          name: "Releases of Fictional Majors",
        }),
      )
        .getAllByRole("listitem")
        .map((item) => item.getAttribute("data-tip")),
    ).toEqual(["Fictional One: 27.1 to 27.2, ships 2027-06-30."]);
  });

  it.each([
    ["releases", "Releases of Fictional Majors"],
    ["schedules", "Cycles of Fictional Majors"],
  ] as const)(
    "fades the cycles that ended before today, and not the current or later ones, for %s",
    (layerForm, lane) => {
      // Given today in the third cycle, on the second's last day plus one
      const timeline = showTimeline({
        streams: [ending()],
        layerForm,
        today: "2027-07-01",
      });

      // Then only the first two cycles are drawn as past
      const cycles = [
        ...within(timeline).getByRole("list", { name: lane }).children,
      ].filter((item) => /timelineCycle(Block|Alternate)/.test(item.className));
      expect(
        cycles.map((cycle) => cycle.matches("[class*='timelineCyclePast']")),
      ).toEqual([true, true, false, false]);
    },
  );

  it("draws each schedule's cycles unnamed, with its end named, and no releases, for schedules", () => {
    const timeline = showTimeline({
      streams: [
        ending(),
        fictionalStream({ id: "s2", name: "Fictional Minors" }),
      ],
      layerForm: "schedules",
    });
    const lanes = rowLists(timeline);
    expect(lanes).toEqual([
      {
        name: "Cycles of Fictional Majors",
        items: [
          "timelineCycle timelineCycleBlock timelineCyclePast",
          "timelineCycle timelineCycleAlternate",
          "timelineCycle timelineCycleBlock",
          "timelineCycle timelineCycleAlternate",
          "timelineStreamEnd",
        ],
      },
    ]);
    const majors = within(timeline).getByRole("list", {
      name: "Cycles of Fictional Majors",
    });
    expect(majors.querySelector("[aria-hidden='true']")).toBeNull();
    expect(majors.lastElementChild?.textContent).toBe("Ends Dec 31, 2027");
    const [first] = within(majors).getAllByRole("listitem");
    expect([first?.getAttribute("data-tip"), first?.textContent]).toEqual([
      "27.1: Jan 1 to Mar 31, 2027",
      "27.1, Jan 1 to Mar 31, 2027",
    ]);
    expect(
      within(timeline)
        .getByRole("list", { name: "Cycles of Fictional Minors" })
        .querySelector("[class*='timelineStreamEnd']"),
    ).toBeNull();
    expect(
      within(timeline).queryByRole("list", { name: /^Releases of/ }),
    ).toBeNull();
  });

  it("names each cycle where its name fits, marks the one holding today, and draws each release's diamond alone, for cycles", () => {
    // Given weeks too short for their names, beside quarters, today in the second quarter
    const weekly = fictionalStream({
      id: "s2",
      name: "Fictional Weeks",
      cycles: [
        fictionalCycle("W23", "2027-06-07", "2027-06-13"),
        fictionalCycle("W24", "2027-06-14", "2027-06-20"),
      ],
    });
    const timeline = showTimeline({
      streams: [ending(), weekly],
      layerForm: "cycles",
    });
    const lanes = rowLists(timeline);
    expect(lanes).toEqual([
      {
        name: "Cycles of Fictional Majors",
        items: [
          "timelineCycle timelineCycleBlock timelineCyclePast",
          "timelineCycle timelineCycleAlternate",
          "timelineCycle timelineCycleBlock",
          "timelineCycle timelineCycleAlternate",
          "timelineStreamEnd",
          "timelineShips",
        ],
      },
    ]);
    // The cycle holding today is marked as today's.
    expect(
      [
        ...within(timeline)
          .getByRole("list", { name: "Cycles of Fictional Majors" })
          .querySelectorAll("li"),
      ].map((item) => item.getAttribute("aria-current")),
    ).toEqual([null, "date", null, null, null, null]);
    const named = (name: string) =>
      within(timeline)
        .getByRole("list", { name })
        .querySelectorAll("[class*='timelineCycleName']").length;
    expect([
      named("Cycles of Fictional Majors"),
      named("Cycles of Fictional Weeks"),
    ]).toEqual([4, 0]);
    expect(
      within(timeline)
        .getByRole("list", { name: "Cycles of Fictional Majors" })
        .lastElementChild?.getAttribute("data-tip"),
    ).toBe("Fictional One ships Jun 30, 2027");
  });
});

describe("today", () => {
  it("is marked by its line alone, named only to screen readers", () => {
    const timeline = showTimeline();
    const named = within(timeline).getByText(
      (_, element) => element?.textContent === "Today, Jun 15, 2027",
      { selector: "span" },
    );
    expect(named.className).toContain("visuallyHidden");
  });
});
