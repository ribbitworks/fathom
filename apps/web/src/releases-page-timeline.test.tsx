// SPDX-License-Identifier: Apache-2.0

// Tests for the Schedules tab's timeline: the schedules, cycles and releases it draws, today, and
// zooming.

import type { ReleaseStream } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimelineView } from "./timeline-view.tsx";
import {
  fictionalCycle,
  fictionalRelease,
  fictionalStream,
  quarters,
  streamsAnswer,
} from "./test-releases.ts";
import {
  fictionalUser,
  recordDraft,
  renderApp,
  serverAnswers,
  signedIn,
  testTheme,
} from "./test-support.tsx";
import {
  setUpEachTest,
  streamsGrid,
  rowTexts,
  chooseInColumn,
} from "./test-releases-page.tsx";

setUpEachTest();

describe("the timeline", () => {
  // The view leaves 540 pixels for the tracks beside the streams' names, and the tests start at
  // Month, which shows 180 days across them: three pixels a day.
  const room = 540;
  // The streams' names' column beside the tracks.
  const names = 180;
  let viewWidth = names + room;
  beforeEach(() => {
    viewWidth = names + room;
    localStorage.setItem(zoomKey, '"month"');
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
      () => viewWidth,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    localStorage.removeItem(zoomKey);
  });

  const zoomKey = "fathom-releases-timeline-zoom";

  it("draws only the streams the table shows, as the view narrows them", async () => {
    const timeline = await showTimeline(
      [
        fictionalStream({ id: "s1", name: "Fictional Old" }),
        fictionalStream({ id: "s2", name: "Fictional New" }),
      ],
      "2027-02-15",
      "?search=New",
    );
    expect(
      within(timeline).getByRole("list", { name: "Cycles of Fictional New" }),
    ).toBeDefined();
    expect(
      within(timeline).queryByRole("list", { name: "Cycles of Fictional Old" }),
    ).toBeNull();
  });

  // The schedules the timeline draws, in its order.
  const lanes = (timeline: HTMLElement) =>
    within(timeline)
      .getAllByRole("list", { name: /^Cycles of / })
      .map((list) => list.getAttribute("aria-label"));
  const oldAndNew = [
    fictionalStream({
      id: "s1",
      name: "Fictional Old",
      cycles: quarters(2),
      endsOn: "2027-06-30",
    }),
    fictionalStream({ id: "s2", name: "Fictional New" }),
  ];

  it("draws only the schedules a filter on the Schedule column leaves, as the table does", async () => {
    const timeline = await showTimeline(oldAndNew, "2027-02-15");
    await chooseInColumn("Schedule", "Filter…");
    const dialog = await screen.findByRole("dialog", {
      name: "Filter Schedule",
    });
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Fictional Old" }),
    );
    await waitFor(() => {
      expect(rowTexts().map((text) => text.slice(0, 13))).toEqual([
        "Fictional Old",
      ]);
    });
    expect(lanes(timeline)).toEqual(["Cycles of Fictional Old"]);
  });

  it("draws only the schedules a filter on Schedule ends leaves, as the table does", async () => {
    const timeline = await showTimeline(oldAndNew, "2027-02-15");
    await chooseInColumn("Schedule ends", "Filter…");
    const dialog = await screen.findByRole("dialog", {
      name: "Filter Schedule ends",
    });
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "No date" }),
    );
    await waitFor(() => {
      expect(rowTexts().map((text) => text.slice(0, 13))).toEqual([
        "Fictional New",
      ]);
    });
    expect(lanes(timeline)).toEqual(["Cycles of Fictional New"]);
  });

  it("draws retired schedules while the table shows them, in the table's order", async () => {
    const timeline = await showTimeline(
      [
        fictionalStream({ id: "s2", name: "Fictional New" }),
        fictionalStream({ id: "s1", name: "Fictional Old", retired: true }),
      ],
      "2027-02-15",
      '?retired=true&sort=["-name"]',
    );
    await waitFor(() => {
      expect(rowTexts().map((text) => text.slice(0, 13))).toEqual([
        "Fictional Old",
        "Fictional New",
      ]);
    });
    expect(lanes(timeline)).toEqual([
      "Cycles of Fictional Old",
      "Cycles of Fictional New",
    ]);
  });

  async function showTimeline(
    shown: ReleaseStream[],
    today: string,
    view = "",
    tab: "schedules" | "releases" = "schedules",
  ) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${today}T12:00:00Z`));
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": streamsAnswer(shown),
    });
    renderApp(`/releases?tab=${tab}${view.replace("?", "&")}`);
    return screen.findByRole("region", { name: "Timeline" });
  }

  const items = (timeline: HTMLElement, list: string) =>
    within(within(timeline).getByRole("list", { name: list })).getAllByRole(
      "listitem",
    );

  const view = (timeline: HTMLElement) =>
    within(timeline).getByRole("group", { name: "Timeline" });

  const widths = (timeline: HTMLElement) =>
    items(timeline, "Cycles of Fictional Majors").map(
      ({ style }) => style.width,
    );

  it("draws each cycle at its real length, with its dates", async () => {
    const timeline = await showTimeline([fictionalStream()], "2027-02-15");
    const cycles = items(timeline, "Cycles of Fictional Majors");
    expect(cycles.map((cycle) => cycle.getAttribute("data-tip"))).toEqual([
      "27.1: Jan 1 to Mar 31, 2027",
      "27.2: Apr 1 to Jun 30, 2027",
      "27.3: Jul 1 to Sep 30, 2027",
      "27.4: Oct 1 to Dec 31, 2027",
    ]);
    expect(
      within(cycles[0] as HTMLElement).getByText("27.1, Jan 1 to Mar 31, 2027"),
    ).toBeDefined();
    // Three pixels a day: 90 days in the first quarter, 91 in the second.
    expect(cycles.map(({ style }) => [style.left, style.width])).toEqual([
      ["0px", "270px"],
      ["270px", "273px"],
      ["543px", "276px"],
      ["819px", "276px"],
    ]);
  });

  it("draws the Schedules tab's cycles unnamed, with each schedule's end", async () => {
    const timeline = await showTimeline(
      [fictionalStream({ endsOn: "2027-12-31" })],
      "2027-02-15",
    );
    const lane = items(timeline, "Cycles of Fictional Majors");
    // Each cycle's name is only for assistive technology, and its title.
    expect(
      lane.map((item) => item.querySelector("[aria-hidden]")?.textContent),
    ).toEqual([undefined, undefined, undefined, undefined, undefined]);
    expect(lane.map(({ textContent }) => textContent)).toEqual([
      "27.1, Jan 1 to Mar 31, 2027",
      "27.2, Apr 1 to Jun 30, 2027",
      "27.3, Jul 1 to Sep 30, 2027",
      "27.4, Oct 1 to Dec 31, 2027",
      "Ends Dec 31, 2027",
    ]);
    expect(
      within(timeline).queryByRole("list", {
        name: "Releases of Fictional Majors",
      }),
    ).toBeNull();
  });

  it("spans each release across its cycles, marked on the day it ships", async () => {
    const timeline = await showTimeline(
      [
        fictionalStream({
          releases: [
            fictionalRelease({ lastCycle: "2027-04-01" }),
            fictionalRelease({
              id: "30000000-0000-4000-8000-000000000002",
              name: "Fictional Two",
              firstCycle: "2027-07-01",
              lastCycle: "2027-07-01",
              shipsOn: "2027-08-14",
              draft: recordDraft(),
            }),
          ],
        }),
      ],
      "2027-02-15",
      "",
      "releases",
    );
    const releases = items(timeline, "Releases of Fictional Majors");
    // Each release's words are its tip in the timeline's one tooltip, which a draft's dot inside it
    // takes over while pointed at, so only one tip shows.
    expect(releases.map((item) => item.hasAttribute("title"))).toEqual([
      false,
      false,
    ]);
    expect(releases.map((item) => item.getAttribute("data-tip"))).toEqual([
      "Fictional One: 27.1 to 27.2, ships 2027-06-30.",
      "Fictional Two: 27.3, ships 2027-08-14. Draft.",
    ]);
    expect(
      releases[1]
        ?.querySelector("[aria-hidden] [data-tip]")
        ?.getAttribute("data-tip"),
    ).toBe("Draft");
    const [one, two] = releases.map((item) =>
      [...item.querySelectorAll<HTMLElement>(":scope > [aria-hidden]")].map(
        ({ style }) => [style.left, style.width],
      ),
    );
    // The first ships when its last cycle ends; the second's marker is 46 days before 27.3 ends,
    // with a line back to it from that end.
    expect(one).toEqual([
      ["0px", "543px"],
      ["543px", ""],
    ]);
    expect(two).toEqual([
      ["0px", "276px"],
      ["135px", "141px"],
      ["135px", ""],
    ]);
  });

  it("draws each release in its colour, or sea when it has none", async () => {
    const timeline = await showTimeline(
      [
        fictionalStream({
          releases: [
            fictionalRelease(),
            fictionalRelease({
              id: "30000000-0000-4000-8000-000000000002",
              name: "Fictional Two",
              firstCycle: "2027-07-01",
              lastCycle: "2027-07-01",
              colour: "grape",
            }),
          ],
        }),
      ],
      "2027-02-15",
      "",
      "releases",
    );
    expect(
      items(timeline, "Releases of Fictional Majors").map(({ style }) =>
        style.getPropertyValue("--release-filled"),
      ),
    ).toEqual([
      "var(--mantine-color-sea-filled)",
      "var(--mantine-color-grape-filled)",
    ]);
  });

  it("marks today across every stream", async () => {
    const timeline = await showTimeline(
      [
        fictionalStream(),
        fictionalStream({ id: "s2", name: "Fictional Minors" }),
      ],
      "2027-02-15",
    );
    expect(
      within(timeline)
        .getAllByRole("list", { name: /^Cycles of/ })
        .map((list) => list.getAttribute("aria-label")),
    ).toEqual(["Cycles of Fictional Majors", "Cycles of Fictional Minors"]);
    expect(
      within(timeline).getByText(
        (_, element) => element?.textContent === "Today, Feb 15, 2027",
        { selector: "span" },
      ),
    ).toBeDefined();
  });

  it("marks today in Fathom's time zone, not the reader's own", async () => {
    // Late on 15 February for a reader in Los Angeles is already the 16th in Tokyo.
    vi.stubEnv("TZ", "America/Los_Angeles");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2027, 1, 15, 23, 30));
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          settings: { ...fictionalUser.settings, timeZone: "Asia/Tokyo" },
        }),
      "GET /api/release-streams": streamsAnswer([fictionalStream()]),
    });
    renderApp("/releases?tab=schedules");
    const timeline = await screen.findByRole("region", { name: "Timeline" });
    expect(
      within(timeline).getByText(
        (_, element) => element?.textContent === "Today, Feb 16, 2027",
        { selector: "span" },
      ),
    ).toBeDefined();
  });

  it("leaves today out once it is past the last cycle", async () => {
    const timeline = await showTimeline([fictionalStream()], "2028-02-15");
    expect(within(timeline).queryByText(/^Today/)).toBeNull();
  });

  it("opens with today a sixth of the way across, and goes back to it", async () => {
    const timeline = await showTimeline([fictionalStream()], "2027-06-15");
    // Today is 165 days in, at 495 pixels, with a sixth of the view before it.
    const todayAt = 495 - room / 6;
    expect(view(timeline).scrollLeft).toBe(todayAt);
    view(timeline).scrollLeft = 600;
    await userEvent.click(
      within(timeline).getByRole("button", { name: "Today" }),
    );
    expect(view(timeline).scrollLeft).toBe(todayAt);
  });

  it("offers no Today button once today is past the last cycle", async () => {
    const timeline = await showTimeline([fictionalStream()], "2028-02-15");
    expect(
      within(timeline).queryByRole("button", { name: "Today" }),
    ).toBeNull();
    expect(view(timeline).scrollLeft).toBe(0);
  });

  const pixels = (days: number, shown: number) =>
    `${String(Math.round(((days * room) / shown) * 100) / 100)}px`;

  it("keeps today a sixth of the way across while zooming, until the reader scrolls", async () => {
    const timeline = await showTimeline([fictionalStream()], "2027-06-15");
    // Its own scrolling, to today, does not count as the reader's.
    fireEvent.scroll(view(timeline));
    await userEvent.click(
      within(timeline).getByRole("radio", { name: "Week" }),
    );
    // Today is 165 days in; Week shows 42 days across 540 pixels.
    expect(view(timeline).scrollLeft).toBeCloseTo((165 * room) / 42 - room / 6);
  });

  it("keeps the day in the middle of the view when an earlier stream moves the timeline's start", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-06-15T12:00:00Z"));
    const shown = (streams: ReleaseStream[]) => (
      <MantineProvider theme={testTheme}>
        <TimelineView
          title="Timeline"
          zoomKey={zoomKey}
          releaseStreams={streams}
          layerForm="schedules"
          today="2027-06-15"
        />
      </MantineProvider>
    );
    const { rerender } = render(shown([fictionalStream()]));
    const timeline = screen.getByRole("region", { name: "Timeline" });
    view(timeline).scrollLeft = 270;
    fireEvent.scroll(view(timeline));
    // The middle, 540 pixels in at three a day, is day 180 from 2027-01-01. A stream from
    // 2026-07-01 starts the timeline 184 days sooner.
    rerender(
      shown([
        fictionalStream(),
        fictionalStream({
          id: "s2",
          name: "Fictional Minors",
          cycles: [fictionalCycle("M1", "2026-07-01", "2026-09-30")],
        }),
      ]),
    );
    expect(view(timeline).scrollLeft).toBe((names + 184) * 3 - room / 2);
  });

  it("zooms, keeping the zoom for next time and the middle of the view in place", async () => {
    const timeline = await showTimeline([fictionalStream()], "2027-02-15");
    view(timeline).scrollLeft = 270;
    fireEvent.scroll(view(timeline));
    expect(widths(timeline)).toEqual(["270px", "273px", "276px", "276px"]);
    await userEvent.click(
      within(timeline).getByRole("radio", { name: "Week" }),
    );
    // Week shows 42 days. The day in the middle, 180, stays there.
    expect(widths(timeline)[0]).toBe(pixels(90, 42));
    expect(view(timeline).scrollLeft).toBeCloseTo((180 * room) / 42 - room / 2);
    expect(localStorage.getItem(zoomKey)).toBe('"week"');
  });

  it("zooms in and out a step at a time, as far as the whole timeline", async () => {
    const timeline = await showTimeline([fictionalStream()], "2027-02-15");
    const zoomOut = within(timeline).getByRole("button", { name: "Zoom out" });
    await userEvent.click(
      within(timeline).getByRole("button", { name: "Zoom in" }),
    );
    expect(widths(timeline)[0]).toBe(pixels(90, 120));
    expect(localStorage.getItem(zoomKey)).toBe("120");
    expect(
      within(timeline)
        .getAllByRole("radio")
        .filter((radio) => (radio as HTMLInputElement).checked),
    ).toEqual([]);
    await userEvent.click(zoomOut);
    await userEvent.click(zoomOut);
    expect(widths(timeline)[0]).toBe(pixels(90, 270));
    // Half as much again would be more than the timeline's 365 days.
    await userEvent.click(zoomOut);
    expect(widths(timeline)[0]).toBe(pixels(90, 365));
    expect(zoomOut).toHaveProperty("disabled", true);
  });

  it("zooms in no further than two weeks", async () => {
    localStorage.setItem(zoomKey, "5");
    const timeline = await showTimeline([fictionalStream()], "2027-02-15");
    expect(widths(timeline)[0]).toBe(pixels(90, 14));
    expect(
      within(timeline).getByRole("button", { name: "Zoom in" }),
    ).toHaveProperty("disabled", true);
  });

  it("shows the whole timeline at All, and at a zoom showing more than it", async () => {
    const timeline = await showTimeline(
      [fictionalStream({ cycles: quarters(2) })],
      "2027-02-15",
    );
    // Two quarters, 181 days, fill the view at Quarter, which shows a year, as at All.
    for (const zoom of ["All", "Quarter"]) {
      await userEvent.click(
        within(timeline).getByRole("radio", { name: zoom }),
      );
      expect(widths(timeline)[0]).toBe(pixels(90, 181));
    }
  });

  it("widens its days as the view widens", async () => {
    // Mantine's controls watch their own sizes too, so every watcher is told.
    const watchers: (() => unknown)[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => unknown) {
          watchers.push(callback);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const timeline = await showTimeline([fictionalStream()], "2027-02-15");
    viewWidth = names + 2 * room;
    act(() => {
      for (const watcher of watchers) watcher();
    });
    expect(widths(timeline)[0]).toBe("540px");
  });

  // The labels of the axis's tier holding the label given.
  const tierLabels = (timeline: HTMLElement, label: string) =>
    [
      ...((
        within(timeline).getAllByText(label)[0]?.parentElement as HTMLElement
      ).children as HTMLCollectionOf<HTMLElement>),
    ].map(({ textContent }) => textContent);

  it("names each level's own period above the next smaller one", async () => {
    localStorage.setItem(zoomKey, '"year"');
    viewWidth = names + 2 * room;
    const timeline = await showTimeline(
      [
        fictionalStream({ cycles: quarters(12) }),
        fictionalStream({
          id: "s2",
          name: "Fictional Minors",
          cycles: [fictionalCycle("M1", "2026-12-14", "2027-01-10")],
        }),
      ],
      "2027-02-15",
    );
    // Year shows three years across 1,080 pixels: December 2026 is too narrow for its year, and
    // has room only for its half year's first month.
    expect(tierLabels(timeline, "2027")).toEqual(["", "2027", "2028", "2029"]);
    expect(tierLabels(timeline, "Jan to Jun 27").slice(0, 3)).toEqual([
      "Jul",
      "Jan to Jun 27",
      "Jul to Dec 27",
    ]);
    await userEvent.click(
      within(timeline).getByRole("radio", { name: "6 months" }),
    );
    expect(tierLabels(timeline, "Jan to Jun 2027").slice(0, 2)).toEqual([
      "",
      "Jan to Jun 2027",
    ]);
    expect(tierLabels(timeline, "Q1 27").slice(0, 3)).toEqual([
      "Q4 26",
      "Q1 27",
      "Q2 27",
    ]);
  });

  it("names periods by their first months at All, when their names do not fit", async () => {
    localStorage.setItem(zoomKey, '"all"');
    viewWidth = names + 2 * room;
    const timeline = await showTimeline(
      [fictionalStream({ cycles: quarters(40) })],
      "2027-02-15",
    );
    // Ten years across 1,080 pixels: a half year is about 54 pixels, too narrow for
    // "Jan to Jun 27".
    expect(tierLabels(timeline, "Jul").slice(0, 3)).toEqual([
      "Jan",
      "Jul",
      "Jan",
    ]);
  });

  // The axis's lowest tier, the one with the tick whose label is given.
  const tierOf = (timeline: HTMLElement, label: string) =>
    within(timeline).getAllByText(label)[0]?.parentElement as HTMLElement;

  it("marks weeks by their Mondays at Week, with their days as marks", async () => {
    localStorage.setItem(zoomKey, '"week"');
    const timeline = await showTimeline([fictionalStream()], "2027-02-15");
    const weeks = tierOf(timeline, "Feb 15");
    expect(weeks.style.backgroundImage).toContain("repeating-linear-gradient");
    expect(
      [...weeks.children].slice(0, 3).map(({ textContent }) => textContent),
    ).toEqual(["", "Jan 4", "Jan 11"]);
  });

  it("names each day at Days, when the view has room", async () => {
    localStorage.setItem(zoomKey, '"days"');
    viewWidth = names + 2 * room;
    const timeline = await showTimeline([fictionalStream()], "2027-02-15");
    const days = tierOf(timeline, "Mon 15");
    expect(days.style.backgroundImage).toBe("");
    expect(
      [...days.children].slice(0, 4).map(({ textContent }) => textContent),
    ).toEqual(["Fri 1", "Sat 2", "Sun 3", "Mon 4"]);
  });

  it("starts at Year when the zoom kept is not one it knows", async () => {
    localStorage.setItem(zoomKey, '"decade"');
    const timeline = await showTimeline([fictionalStream()], "2027-02-15");
    // Year shows three years, more than the timeline's one.
    expect(widths(timeline)[0]).toBe(pixels(90, 365));
    expect(
      within(timeline).getByRole("radio", { name: "Year" }),
    ).toHaveProperty("checked", true);
  });

  describe("drafts on it, as the Draft view shows them", () => {
    // Fictional One moved a quarter later, Fictional Two drafted to be removed, Fictional Three
    // added, on a stream drafted to be retired.
    const drafted = () =>
      fictionalStream({
        retired: true,
        draft: recordDraft({ changed: ["retired"], live: { retired: false } }),
        releases: [
          fictionalRelease({
            firstCycle: "2027-04-01",
            lastCycle: "2027-04-01",
            draft: recordDraft({
              changed: ["firstCycle", "lastCycle"],
              live: { firstCycle: "2027-01-01", lastCycle: "2027-01-01" },
            }),
          }),
          fictionalRelease({
            id: "30000000-0000-4000-8000-000000000002",
            name: "Fictional Two",
            firstCycle: "2027-07-01",
            lastCycle: "2027-07-01",
            draft: recordDraft({ action: "deleted" }),
          }),
          fictionalRelease({
            id: "30000000-0000-4000-8000-000000000003",
            name: "Fictional Three",
            firstCycle: "2027-10-01",
            lastCycle: "2027-10-01",
            draft: recordDraft({ action: "created" }),
          }),
        ],
      });

    const names = (timeline: HTMLElement, list: string) =>
      items(timeline, list).map((item) => item.getAttribute("data-tip"));

    const liveList = "Releases of Fictional Majors as they are live";

    it("shows beside live each release a draft moves in its old place, and what a draft removes", async () => {
      const timeline = await showTimeline(
        [drafted()],
        "2027-02-15",
        "",
        "releases",
      );
      expect(names(timeline, "Releases of Fictional Majors")).toEqual([
        "Fictional One: 27.2, ships 2027-06-30. Draft: moved.",
        "Fictional Two: 27.3, ships 2027-09-30. Draft: removed.",
        "Fictional Three: 27.4, ships 2027-12-31. Draft: added.",
      ]);
      expect(names(timeline, liveList)).toEqual([
        "Fictional One: 27.1, ships 2027-03-31. Live.",
      ]);
      expect(
        within(items(timeline, "Schedules")[0] as HTMLElement).getByText(
          "Retired",
        ),
      ).toBeDefined();
    });

    it("shows with drafts applied only what the drafts make", async () => {
      const timeline = await showTimeline(
        [drafted()],
        "2027-02-15",
        "?show=drafts",
        "releases",
      );
      expect(names(timeline, "Releases of Fictional Majors")).toEqual([
        "Fictional One: 27.2, ships 2027-06-30. Draft: moved.",
        "Fictional Three: 27.4, ships 2027-12-31. Draft: added.",
      ]);
      expect(
        within(timeline).queryByRole("list", { name: liveList }),
      ).toBeNull();
    });

    it("shows Live only the releases as they are live, saying which a waiting draft would change", async () => {
      const timeline = await showTimeline(
        [drafted()],
        "2027-02-15",
        "?show=live",
        "releases",
      );
      expect(names(timeline, "Releases of Fictional Majors")).toEqual([
        "Fictional One: 27.1, ships 2027-03-31. Live. A move is waiting for approval.",
        "Fictional Two: 27.3, ships 2027-09-30. Live. Its removal is waiting for approval.",
      ]);
    });

    // A rejected removal, a rejected move, and the reader's own unpublished change of colour.
    const judged = () =>
      fictionalStream({
        releases: [
          fictionalRelease({
            firstCycle: "2027-04-01",
            lastCycle: "2027-04-01",
            draft: recordDraft({
              changed: ["firstCycle", "lastCycle"],
              live: { firstCycle: "2027-01-01", lastCycle: "2027-01-01" },
              state: "rejected",
            }),
          }),
          fictionalRelease({
            id: "30000000-0000-4000-8000-000000000002",
            name: "Fictional Two",
            firstCycle: "2027-07-01",
            lastCycle: "2027-07-01",
            draft: recordDraft({ action: "deleted", state: "rejected" }),
          }),
          fictionalRelease({
            id: "30000000-0000-4000-8000-000000000003",
            name: "Fictional Three",
            firstCycle: "2027-10-01",
            lastCycle: "2027-10-01",
            colour: "teal",
            draft: recordDraft({
              changed: ["colour"],
              live: { colour: null },
              unpublished: true,
            }),
          }),
        ],
      });

    it("says beside live which drafts were rejected, striking out none, and which are unpublished", async () => {
      const timeline = await showTimeline(
        [judged()],
        "2027-02-15",
        "",
        "releases",
      );
      const [moved, removed, unpublished] = names(
        timeline,
        "Releases of Fictional Majors",
      );
      expect(moved).toMatch(/^Fictional One: .*\. Rejected/);
      expect(removed).toMatch(/^Fictional Two: .*\. Rejected/);
      expect(unpublished).toMatch(/^Fictional Three: .*unpublished/);
      expect(
        items(timeline, "Releases of Fictional Majors").map(
          (item) =>
            item.querySelector(":scope > [aria-hidden]")?.className ?? "",
        ),
      ).not.toContainEqual(expect.stringMatching(/struck/));
    });

    it("says who is changing a stream or a release", async () => {
      const timeline = await showTimeline(
        [
          fictionalStream({
            heldBy: "Fictional Editor",
            releases: [fictionalRelease({ heldBy: "Fictional Editor" })],
          }),
        ],
        "2027-02-15",
        "",
        "releases",
      );
      expect(names(timeline, "Releases of Fictional Majors")).toEqual([
        "Fictional One: 27.1, ships 2027-03-31. Being changed by Fictional Editor.",
      ]);
      expect(items(timeline, "Schedules")[0]?.textContent).toContain(
        "being changed by Fictional Editor",
      );
    });

    it("takes rejected drafts back with drafts applied", async () => {
      const timeline = await showTimeline(
        [judged()],
        "2027-02-15",
        "?show=drafts",
        "releases",
      );
      expect(
        names(timeline, "Releases of Fictional Majors").slice(0, 2),
      ).toEqual([
        "Fictional One: 27.1, ships 2027-03-31.",
        "Fictional Two: 27.3, ships 2027-09-30.",
      ]);
    });
  });

  it("is left out while no stream has cycles", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": streamsAnswer([
        fictionalStream({ cycles: [], patterns: [] }),
      ]),
    });
    renderApp("/releases?tab=schedules");
    await streamsGrid();
    expect(screen.queryByRole("region", { name: "Timeline" })).toBeNull();
  });
});
