// SPDX-License-Identifier: Apache-2.0

// Tests for the whole months a timeline covers, where release streams' cycles and releases fall on
// it, how its axis is cut and named, and its quarters.

import { describe, expect, it } from "vitest";
import {
  fictionalRelease,
  fictionalStream,
  recordDraft,
} from "./test-support.tsx";
import type { ReleaseStream } from "@fathom/shared";
import {
  axisScale,
  dayRange,
  releaseLayer,
  releaseLayerRange,
  timelineAxis,
  timelineFrame,
  timelineQuarters,
} from "./timeline.ts";

const stream = fictionalStream();

// A timeline showing only the release layer, with its rows, as the Releases page shows it.
function releasesOnlyTimeline(
  streams: readonly ReleaseStream[],
  today: string,
) {
  const range = releaseLayerRange(streams);
  const frame = timelineFrame(range === undefined ? [] : [range], today);
  return frame && { ...frame, rows: releaseLayer(streams, frame.from) };
}

describe("a timeline's frame", () => {
  it("covers the whole months holding every range given", () => {
    expect(
      timelineFrame(
        [
          { first: "2027-02-10", last: "2027-03-05" },
          { first: "2027-01-20", last: "2027-01-25" },
        ],
        "2027-02-01",
      ),
    ).toEqual({ from: "2027-01-01", days: 90, today: 31 });
  });

  it("makes a range only of a first and a last day", () => {
    expect(dayRange("2027-01-01", "2027-02-01")).toEqual({
      first: "2027-01-01",
      last: "2027-02-01",
    });
    expect(dayRange(undefined, "2027-02-01")).toBeUndefined();
    expect(dayRange("2027-01-01", undefined)).toBeUndefined();
  });

  it("has nothing to cover when no range is given", () => {
    expect(timelineFrame([], "2027-02-01")).toBeUndefined();
  });

  it("is cut into quarters, the first and last cut short by its ends", () => {
    const frame = timelineFrame(
      [{ first: "2026-12-14", last: "2027-04-10" }],
      "2027-02-01",
    );
    expect(
      timelineQuarters(frame as NonNullable<typeof frame>).map(
        ({ label, short, at, days }) =>
          `${label} ${String(at)}+${String(days)} ${short}`,
      ),
    ).toEqual(["Q4 2026 0+31 Q4", "Q1 2027 31+90 Q1", "Q2 2027 121+30 Q2"]);
  });
});

describe("the timeline of release streams", () => {
  const minors = fictionalStream({
    id: "s2",
    name: "Fictional Minors",
    cycles: [
      { startsOn: "2026-12-14", endsOn: "2027-01-10", name: "M1", months: [] },
    ],
  });

  it("lays every stream's cycles on one axis of whole months", () => {
    const layout = releasesOnlyTimeline(
      [
        stream,
        minors,
        fictionalStream({ id: "s4", name: "Fictional Empty", cycles: [] }),
      ],
      "2027-02-15",
    );
    expect(layout?.days).toBe(31 + 365);
    expect(layout?.from).toBe("2026-12-01");
    expect(layout?.rows.map((row) => row.stream.name)).toEqual([
      "Fictional Majors",
      "Fictional Minors",
    ]);
    expect(
      layout?.rows.map((row) =>
        row.cycles.map(({ name, at, days }) => ({ name, at, days })),
      ),
    ).toEqual([
      [
        { name: "27.1", at: 31, days: 90 },
        { name: "27.2", at: 121, days: 91 },
        { name: "27.3", at: 212, days: 92 },
        { name: "27.4", at: 304, days: 92 },
      ],
      [{ name: "M1", at: 13, days: 28 }],
    ]);
  });

  it("marks where a stream that ends has its last day, and nothing for one that keeps going", () => {
    const ending = fictionalStream({ endsOn: "2027-05-15" });
    const layout = releasesOnlyTimeline([ending, minors], "2027-02-15");
    expect(layout?.rows.map(({ end }) => end)).toEqual([
      { day: "2027-05-15", at: 31 + 31 + 28 + 31 + 30 + 15 },
      undefined,
    ]);
  });

  it("spans each release across its cycles, to the end of the day it ships", () => {
    const layout = releasesOnlyTimeline(
      [
        fictionalStream({
          releases: [
            fictionalRelease({ lastCycle: "2027-04-01" }),
            fictionalRelease({
              id: "r2",
              name: "Fictional Two",
              firstCycle: "2027-07-01",
              lastCycle: "2027-07-01",
              shipsOn: "2027-08-14",
            }),
            fictionalRelease({
              id: "r3",
              name: "Fictional Four",
              firstCycle: "2027-10-01",
              lastCycle: "2027-10-01",
            }),
            fictionalRelease({
              id: "r4",
              name: "Fictional Far",
              firstCycle: "2031-01-01",
              lastCycle: "2031-01-01",
            }),
          ],
        }),
      ],
      "2027-02-15",
    );
    expect(
      layout?.rows[0]?.releases.map(
        ({ release, cycleWords, shipsOn, at, days, shipsAt }) => ({
          name: release.name,
          cycleWords,
          shipsOn,
          at,
          days,
          shipsAt,
        }),
      ),
    ).toEqual([
      {
        name: "Fictional One",
        cycleWords: "27.1 to 27.2",
        shipsOn: "2027-06-30",
        at: 0,
        days: 181,
        shipsAt: 181,
      },
      {
        name: "Fictional Two",
        cycleWords: "27.3",
        shipsOn: "2027-08-14",
        at: 181,
        days: 92,
        shipsAt: 226,
      },
      {
        name: "Fictional Four",
        cycleWords: "27.4",
        shipsOn: "2027-12-31",
        at: 273,
        days: 92,
        shipsAt: 365,
      },
    ]);
  });

  it("lays out, beside live, each release a draft moves as it is live", () => {
    const moved = fictionalStream({
      releases: [
        fictionalRelease({
          firstCycle: "2027-04-01",
          lastCycle: "2027-04-01",
          draft: recordDraft({ changed: ["firstCycle", "lastCycle"] }),
        }),
        fictionalRelease({
          id: "r2",
          name: "Fictional Renamed",
          firstCycle: "2027-07-01",
          lastCycle: "2027-07-01",
          draft: recordDraft({ changed: ["name"] }),
        }),
        fictionalRelease({
          id: "r3",
          name: "Fictional Later",
          firstCycle: "2027-10-01",
          lastCycle: "2027-10-01",
          shipsOn: "2028-01-15",
          draft: recordDraft({ changed: ["shipsOn"] }),
        }),
      ],
    });
    const live = fictionalStream({
      releases: [
        fictionalRelease(),
        fictionalRelease({ id: "r2" }),
        fictionalRelease({
          id: "r3",
          name: "Fictional Later",
          firstCycle: "2027-10-01",
          lastCycle: "2027-10-01",
        }),
      ],
    });
    const [row] = releaseLayer([moved], "2027-01-01", [live]);
    expect(
      row?.live.map(({ release, at, days }) => [release.name, at, days]),
    ).toEqual([
      ["Fictional One", 0, 90],
      ["Fictional Later", 273, 92],
    ]);
    expect(releaseLayer([moved], "2027-01-01")[0]?.live).toEqual([]);
  });

  it("marks today only while it is on the timeline", () => {
    const today = (day: string) => releasesOnlyTimeline([stream], day)?.today;
    expect(today("2027-02-15")).toBe(45);
    expect(today("2026-12-31")).toBeUndefined();
    expect(today("2028-01-01")).toBeUndefined();
  });

  it("lays out the streams given in their order, retired ones included", () => {
    expect(
      releasesOnlyTimeline(
        [{ ...minors, name: "Fictional Retired", retired: true }, stream],
        "2027-02-15",
      )?.rows.map((row) => row.stream.name),
    ).toEqual(["Fictional Retired", "Fictional Majors"]);
  });

  it("has nothing to show while no stream has cycles", () => {
    expect(releasesOnlyTimeline([], "2027-02-15")).toBeUndefined();
    expect(
      releasesOnlyTimeline([fictionalStream({ cycles: [] })], "2027-02-15"),
    ).toBeUndefined();
  });

  describe("its axis", () => {
    const layout = releasesOnlyTimeline([stream, minors], "2027-02-15");
    const axis = (scale: Parameters<typeof timelineAxis>[1]) => {
      const { above, ticks } = timelineAxis(
        layout as NonNullable<typeof layout>,
        scale,
      );
      const words = (cut: typeof ticks) =>
        cut.map(({ label, short, at, days }) =>
          [label, `${String(at)}+${String(days)}`, short]
            .filter((part) => part !== undefined)
            .join(" "),
        );
      return { above: words(above), ticks: words(ticks) };
    };

    const monthTicks = ["Dec 0+31", "Jan 31+31", "Feb 62+28"];

    it("cuts the axis as finely as its names fit the pixels a day takes", () => {
      // "Wed 30" needs 50 pixels in a day, "30" 22 in a week, "Sep" 29 in 28 days, and "Q1 27"
      // 43 in 90 days.
      expect(
        [50, 49.9, 22 / 7, 3.14, 29 / 28, 1.03, 43 / 90, 0.47].map(axisScale),
      ).toEqual([
        "days",
        "weeks",
        "weeks",
        "months",
        "months",
        "quarters",
        "quarters",
        "halves",
      ]);
    });

    it("shows half years under their years, starting with the part of the first", () => {
      expect(axis("halves")).toEqual({
        above: ["2026 0+31", "2027 31+365"],
        ticks: [
          "Jul to Dec 26 0+31 Jul",
          "Jan to Jun 27 31+181 Jan",
          "Jul to Dec 27 212+184 Jul",
        ],
      });
    });

    it("shows quarters under their half years", () => {
      expect(axis("quarters")).toEqual({
        above: [
          "Jul to Dec 2026 0+31 Jul 2026",
          "Jan to Jun 2027 31+181 Jan 2027",
          "Jul to Dec 2027 212+184 Jul 2027",
        ],
        ticks: [
          "Q4 26 0+31 Q4",
          "Q1 27 31+90 Q1",
          "Q2 27 121+91 Q2",
          "Q3 27 212+92 Q3",
          "Q4 27 304+92 Q4",
        ],
      });
    });

    it("shows months under their quarters", () => {
      const { above, ticks } = axis("months");
      expect(above.slice(0, 2)).toEqual([
        "Q4 2026 0+31 Q4",
        "Q1 2027 31+90 Q1",
      ]);
      expect(ticks.slice(0, 3)).toEqual(monthTicks);
      expect(ticks).toHaveLength(13);
    });

    it("shows weeks by their Mondays under their months", () => {
      const { above, ticks } = axis("weeks");
      expect(above.slice(0, 2)).toEqual(["Dec 2026 0+31", "Jan 2027 31+31"]);
      // 2026-12-01 is a Tuesday, so the first week is cut short and left unnamed.
      expect(ticks.slice(0, 3)).toEqual([
        " 0+6 1",
        "Dec 7 6+7 7",
        "Dec 14 13+7 14",
      ]);
      expect(ticks.at(-1)).toBe("Dec 27 391+5 27");
    });

    it("shows days with their weekdays under their months", () => {
      const { above, ticks } = axis("days");
      expect(above.slice(0, 2)).toEqual(["Dec 2026 0+31", "Jan 2027 31+31"]);
      expect(ticks.slice(0, 2)).toEqual(["Tue 1 0+1", "Wed 2 1+1"]);
      expect(ticks.at(-1)).toBe("Fri 31 395+1");
      expect(ticks).toHaveLength(396);
    });
  });
});
