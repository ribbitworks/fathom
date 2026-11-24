// SPDX-License-Identifier: Apache-2.0

// Tests for the Features Board's rules: which cycles are its columns and their releases, which
// column a feature is in, whether a draft moves it, the order of its cards, a risk's step, which
// parts its cards show, how Save view names the board's choices, and a stream's current cycle.

import type { Feature } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  boardColumns,
  boardMonths,
  cycleStrip,
  boardParts,
  cardOrder,
  columnOf,
  firstShown,
  periodGoneTo,
  quarterStrip,
  laterKey,
  monthColumnOf,
  monthPeriod,
  wholeColumnWidth,
  monthColumns,
  movesCycle,
  movesMonth,
  noDateKey,
  riskStep,
  shownParts,
  streamNow,
} from "./feature-board.ts";
import { liveStreams } from "./releases.ts";
import {
  fictionalRelease,
  fictionalStream,
  quarters,
  streamId,
} from "./test-releases.ts";
import { featureDraft, recordDraft } from "./test-support.tsx";

const cycles = quarters(6);

describe("the month or cycle gone to", () => {
  it("is the one asked for", () => {
    expect(periodGoneTo(cycles, "2027-05-01", "2027-07-01")).toBe(2);
  });

  it("is the current one when none is asked for", () => {
    expect(periodGoneTo(cycles, "2027-05-01")).toBe(1);
  });

  it("is the next to come between cycles", () => {
    expect(periodGoneTo(quarters(2), "2026-12-01")).toBe(0);
  });

  it("is the last once every one has ended", () => {
    expect(periodGoneTo(cycles, "2030-01-01")).toBe(5);
  });

  it("is the current one when the day asked for starts none", () => {
    expect(periodGoneTo(cycles, "2027-05-01", "2027-05-15")).toBe(1);
  });
});

describe("the cycles shown first", () => {
  it.each([
    ["the one gone to second, the one before it first", 6, 2, 2, 1],
    ["the one gone to first where only one fits", 6, 1, 2, 2],
    ["the first one first, with none before it", 2, 1, 0, 0],
    ["as many as fit, moving back from the end", 6, 3, 5, 3],
    ["from the first when they all fit", 6, 10, 5, 0],
  ])("shows %s", (_, count, fits, goneTo, start) => {
    expect(firstShown(count, fits, goneTo)).toBe(start);
  });
});

describe("the columns", () => {
  const release = fictionalRelease({
    firstCycle: "2027-04-01",
    lastCycle: "2027-07-01",
  });
  const stream = fictionalStream({ cycles, releases: [release] });

  it("shows as many cycles as fit, each with its release, then Later", () => {
    const columns = boardColumns(stream, 0, 3, "2027-05-01");
    expect(
      columns.map(({ key, release: shown, current }) => [
        key,
        shown?.name,
        current,
      ]),
    ).toEqual([
      [`${streamId} 2027-01-01`, undefined, false],
      [`${streamId} 2027-04-01`, "Fictional One", true],
      [`${streamId} 2027-07-01`, "Fictional One", false],
      [laterKey, undefined, false],
    ]);
  });

  it("leaves out a release a draft removes", () => {
    const removed = fictionalStream({
      cycles,
      releases: [{ ...release, draft: recordDraft({ action: "deleted" }) }],
    });
    expect(boardColumns(removed, 1, 1, "2027-05-01").at(0)?.release).toBe(
      undefined,
    );
  });

  it("shows a release as it is live where a draft moves it away", () => {
    const moved = fictionalStream({
      cycles,
      releases: [
        { ...release, firstCycle: "2027-07-01", lastCycle: "2027-10-01" },
      ],
    });
    const columns = boardColumns(moved, 1, 3, "2027-05-01", stream);
    expect(
      columns.map((column) => [column.release?.id, column.liveRelease?.id]),
    ).toEqual([
      [undefined, release.id],
      [release.id, undefined],
      [release.id, undefined],
      [undefined, undefined],
    ]);
  });
});

const feature = (more: Partial<Feature> = {}): Feature => ({
  id: crypto.randomUUID(),
  keyNumber: 1,
  name: "Fictional Feature",
  statusId: "planned",
  priorityId: null,
  sizeId: null,
  riskId: null,
  neededBy: null,
  customerIds: [],
  targetStreamId: null,
  targetCycle: null,
  estimateHours: null,
  featureTeamId: null,
  description: null,
  note: null,
  values: {},
  links: {},
  staffed: false,
  staffedLive: false,
  ...more,
});

describe("a feature's column", () => {
  it("is its target cycle's", () => {
    expect(
      columnOf(
        feature({ targetStreamId: streamId, targetCycle: "2027-04-01" }),
      ),
    ).toBe(`${streamId} 2027-04-01`);
  });

  it("is Later with no target cycle", () => {
    expect(columnOf(feature())).toBe(laterKey);
  });
});

describe("a draft that moves a feature", () => {
  it("changes its target cycle", () => {
    expect(
      movesCycle({ draft: featureDraft({ changed: ["targetCycle"] }) }),
    ).toBe(true);
    expect(
      movesCycle({ draft: featureDraft({ changed: ["targetStreamId"] }) }),
    ).toBe(true);
  });

  it("is not one that changes anything else, or adds it", () => {
    expect(movesCycle({ draft: featureDraft({ changed: ["name"] }) })).toBe(
      false,
    );
    expect(movesCycle({ draft: featureDraft({ action: "created" }) })).toBe(
      false,
    );
    expect(movesCycle({})).toBe(false);
  });
});

describe("the order of the cards", () => {
  const priorities = [{ id: "critical" }, { id: "low" }];
  const statuses = [
    { id: "long-shot", meaning: "possible" as const },
    { id: "likely", meaning: "possible" as const },
    { id: "planned", meaning: "planned" as const },
    { id: "started", meaning: "in-progress" as const },
    { id: "done", meaning: "done" as const },
    { id: "unmeant", meaning: null },
  ];
  const order = (features: Feature[]) =>
    features.sort(cardOrder(priorities, statuses)).map(({ name }) => name);

  it("puts the higher priority first, and no priority last", () => {
    expect(
      order([
        feature({ name: "None" }),
        feature({ name: "Low", priorityId: "low" }),
        feature({ name: "Critical", priorityId: "critical" }),
      ]),
    ).toEqual(["Critical", "Low", "None"]);
  });

  it("then the month needed by soonest, and none last", () => {
    expect(
      order([
        feature({ name: "None" }),
        feature({ name: "Later", neededBy: "2027-09" }),
        feature({ name: "Sooner", neededBy: "2027-03" }),
      ]),
    ).toEqual(["Sooner", "Later", "None"]);
  });

  it("then the most likely status, by its meaning, then later in its list", () => {
    expect(
      order([
        feature({ name: "Unmeant", statusId: "unmeant" }),
        feature({ name: "Long shot", statusId: "long-shot" }),
        feature({ name: "Likely", statusId: "likely" }),
        feature({ name: "Planned", statusId: "planned" }),
        feature({ name: "Started", statusId: "started" }),
        feature({ name: "Done", statusId: "done" }),
        feature({ name: "Unknown", statusId: "gone" }),
      ]),
    ).toEqual([
      "Done",
      "Started",
      "Planned",
      "Likely",
      "Long shot",
      "Unknown",
      "Unmeant",
    ]);
  });

  it("then the most customers, then by name", () => {
    expect(
      order([
        feature({ name: "Beta" }),
        feature({ name: "Alpha" }),
        feature({ name: "Wanted", customerIds: ["c1", "c2"] }),
      ]),
    ).toEqual(["Wanted", "Alpha", "Beta"]);
  });
});

describe("a risk's step", () => {
  const risks = [
    { id: "low", name: "Low", retired: false },
    { id: "old", name: "Old", retired: true },
    { id: "high", name: "High", retired: false },
  ];

  it("is its place among the choices offered, and how many there are", () => {
    expect(riskStep(risks, "high")).toEqual({
      name: "High",
      step: 1,
      steps: 2,
    });
  });

  it("counts a retired choice the feature holds", () => {
    expect(riskStep(risks, "old")).toEqual({ name: "Old", step: 1, steps: 3 });
  });

  it("is nothing for a feature with no risk", () => {
    expect(riskStep(risks, null)).toBe(undefined);
  });
});

describe("the parts a card shows", () => {
  it("are every part offered but those hidden", () => {
    expect([...shownParts(["status", "size", "risk"], ["size"])]).toEqual([
      "status",
      "risk",
    ]);
    expect([...shownParts(["status"], undefined)]).toEqual(["status"]);
  });
});

describe("boardParts", () => {
  const streams = [{ id: streamId, name: "Platform" }];
  const offered = ["status", "priority", "risk"] as const;

  it("names the stream and the parts the cards show, each once chosen", () => {
    expect(
      boardParts(
        { choices: { stream: streamId, hide: ["risk"] } },
        streams,
        offered,
      ),
    ).toEqual([
      {
        name: "Board",
        value: "Columns Platform cycles, Card Status, Priority",
      },
    ]);
    expect(
      boardParts({ choices: { hide: ["status"] } }, streams, offered),
    ).toEqual([{ name: "Board", value: "Card Priority, Risk" }]);
    expect(
      boardParts({ choices: { stream: streamId } }, streams, offered),
    ).toEqual([{ name: "Board", value: "Columns Platform cycles" }]);
  });

  it("names nothing for a board left as it starts, or a stream it doesn't have", () => {
    expect(boardParts({}, streams, offered)).toEqual([]);
    expect(
      boardParts({ choices: { stream: "gone" } }, streams, offered),
    ).toEqual([]);
  });
});

describe("a stream's current cycle", () => {
  const release = fictionalRelease({
    firstCycle: "2027-04-01",
    lastCycle: "2027-07-01",
  });
  const stream = fictionalStream({ releases: [release] });

  it.each(["2027-04-01", "2027-06-30"])(
    "is the cycle holding %s, its first or last day, with its release",
    (today) => {
      expect(streamNow(stream, today)).toEqual({
        cycle: stream.cycles[1],
        release,
      });
    },
  );

  it("has no release when the cycle is in none", () => {
    expect(streamNow(stream, "2027-02-14")?.release).toBeUndefined();
  });

  it("leaves out a release a draft removes", () => {
    const removed = fictionalStream({
      releases: [{ ...release, draft: recordDraft({ action: "deleted" }) }],
    });

    expect(streamNow(removed, "2027-05-01")?.release).toBeUndefined();
  });

  it.each([
    ["not started", "2026-12-31", stream],
    ["past its last cycle", "2028-01-01", stream],
    ["retired", "2027-05-01", fictionalStream({ retired: true })],
  ])("is none for a stream %s", (_case, today, shown) => {
    expect(streamNow(shown, today)).toBeUndefined();
  });

  it("is the live cycle of a stream drafted to be retired", () => {
    const [live] = liveStreams([
      fictionalStream({
        retired: true,
        draft: recordDraft({ changed: ["retired"], live: { retired: false } }),
      }),
    ]);

    expect(live && streamNow(live, "2027-05-01")?.cycle.name).toBe("27.2");
  });

  it("is the live cycle where a draft changes the stream's cycles", () => {
    const [live] = liveStreams([
      fictionalStream({
        cycles: quarters(4).slice(2),
        liveCycles: quarters(4),
      }),
    ]);

    expect(live && streamNow(live, "2027-02-14")?.cycle.name).toBe("27.1");
  });

  it("is none for a stream only drafted to be added, once live", () => {
    expect(
      liveStreams([
        fictionalStream({ draft: recordDraft({ action: "created" }) }),
      ]),
    ).toEqual([]);
  });
});

describe("months as the board's columns", () => {
  it.each([
    ["a year ahead at the least", [], 4, "May 2028", 25],
    [
      "to the latest month needed by",
      [{ neededBy: "2028-08" }],
      4,
      "Aug 2028",
      28,
    ],
    [
      "as many as fit from this month",
      [{ neededBy: null }],
      15,
      "Jul 2028",
      27,
    ],
  ])("runs from a year back %s", (_, features, fits, last, count) => {
    const months = boardMonths(features, "2027-05", fits);
    expect([
      months.at(0)?.name,
      months.at(-1)?.name,
      months.length,
      [months.at(0)?.startsOn, months.at(0)?.endsOn],
    ]).toEqual(["May 2026", last, count, ["2026-05-01", "2026-05-31"]]);
  });

  it("shows as many as fit from the first shown, the current one marked, then No date", () => {
    const months = boardMonths([], "2027-05", 4);
    expect(
      monthColumns(months, 13, 2, "2027-05-10").map(
        ({ key, current, kind }) => [key, current, kind],
      ),
    ).toEqual([
      ["2027-06", false, "month"],
      ["2027-07", false, "month"],
      [noDateKey, false, "noDate"],
    ]);
  });

  it.each([
    ["the month it's needed by", "2027-07", "2027-07"],
    ["the month it's needed by, once that has passed", "2027-02", "2027-02"],
    ["No date, needed by none", null, noDateKey],
  ])("puts a feature in %s", (_, neededBy, column) => {
    expect(monthColumnOf({ neededBy })).toBe(column);
  });

  it.each([
    [
      "a change of the month needed by",
      featureDraft({ changed: ["neededBy"] }),
      true,
    ],
    ["a change of anything else", featureDraft({ changed: ["name"] }), false],
    ["an addition", featureDraft({ action: "created" }), false],
    ["no draft", undefined, false],
  ])("moves a card for %s", (_, draft, moved) => {
    expect(movesMonth({ draft })).toBe(moved);
  });
});

describe("the board's strip", () => {
  const months = boardMonths([], "2027-05", 4);
  const strip = (goneTo: number, fits = 4) =>
    quarterStrip({
      periods: months,
      start: firstShown(months.length, fits, goneTo),
      goneTo,
      fits,
      today: "2027-05-10",
    });

  it("names the quarters the months fall in, those in view tinted, the one gone to chosen and this one current", () => {
    const { periods } = strip(12);
    expect(
      periods
        .slice(0, 6)
        .map(({ label, weight, inView, selected, current, first }) => [
          label,
          weight,
          inView,
          selected,
          current,
          first.name,
        ]),
    ).toEqual([
      ["Q2 2026", 2, false, false, false, "May 2026"],
      ["Q3 2026", 3, false, false, false, "Jul 2026"],
      ["Q4 2026", 3, false, false, false, "Oct 2026"],
      ["Q1 2027", 3, false, false, false, "Jan 2027"],
      ["Q2 2027", 3, true, true, true, "Apr 2027"],
      ["Q3 2027", 3, true, false, false, "Jul 2027"],
    ]);
  });

  it.each([
    ["from a quarter's middle, back to its start", 12, "Apr 2027", "Jul 2027"],
    ["from the first month, with nothing before it", 0, undefined, "Jul 2026"],
    ["to the end, with nothing more to show", 24, "Apr 2028", undefined],
  ])("steps a quarter %s", (_, goneTo, previous, next) => {
    const steps = strip(goneTo);
    expect([steps.previous?.name, steps.next?.name]).toEqual([previous, next]);
  });

  it.each([
    ["while months after those shown are out of view", 23, "May 2028"],
    ["none once the last month is shown", 24, undefined],
  ])("steps › to the last month in the last quarter %s", (_, goneTo, next) => {
    expect(strip(goneTo, 2).next?.name).toBe(next);
  });

  it("names no quarters without months", () => {
    expect(
      quarterStrip({
        periods: [],
        start: 0,
        goneTo: 0,
        fits: 4,
        today: "2027-05-10",
      }),
    ).toEqual({ periods: [], previous: undefined, next: undefined });
  });

  it("names a schedule's cycles, each as wide as its days, the one gone to chosen, stepping a cycle", () => {
    const cycles = [
      monthPeriod("2027-04"),
      monthPeriod("2027-05"),
      monthPeriod("2027-06"),
    ];
    const { periods, previous, next } = cycleStrip({
      periods: cycles,
      start: 0,
      goneTo: 1,
      fits: 2,
      today: "2027-05-10",
    });
    expect([
      periods.map(({ weight, inView, selected, current }) => [
        weight,
        inView,
        selected,
        current,
      ]),
      previous?.name,
      next?.name,
    ]).toEqual([
      [
        [30, true, false, false],
        [31, true, true, true],
        [30, false, false, false],
      ],
      "Apr 2027",
      "Jun 2027",
    ]);
  });
});

describe("a column's width", () => {
  it.each([
    ["the room's share less its lines, in whole pixels", 1003, 250],
    ["never under the least", 500, 200],
  ])("is %s", (_, room, width) => {
    expect(wholeColumnWidth({ room, columns: 4, lines: 3, least: 200 })).toBe(
      width,
    );
  });
});
