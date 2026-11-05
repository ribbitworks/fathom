// SPDX-License-Identifier: Apache-2.0

// Tests for where release streams' cycles and releases fall on the timeline, and how its axis is
// cut and named.

import { describe, expect, it } from "vitest";
import {
  fictionalRelease,
  fictionalStream,
  recordDraft,
} from "./test-support.tsx";
import { axisScale, timelineAxis, timelineLayout } from "./timeline.ts";

const stream = fictionalStream();

describe("the timeline of release streams", () => {
  const minors = fictionalStream({
    id: "s2",
    name: "Fictional Minors",
    cycles: [
      { startsOn: "2026-12-14", endsOn: "2027-01-10", name: "M1", months: [] },
    ],
  });

  it("lays every current stream's cycles on one axis of whole months", () => {
    const layout = timelineLayout(
      [
        stream,
        minors,
        fictionalStream({ id: "s3", name: "Fictional Old", retired: true }),
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

  it("spans each release across its cycles, to the end of the day it ships", () => {
    const layout = timelineLayout(
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
              name: "Fictional Gone",
              firstCycle: "2027-10-01",
              lastCycle: "2027-10-01",
              draft: recordDraft({ action: "deleted" }),
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
    ]);
  });

  it("marks today only while it is on the timeline", () => {
    const today = (day: string) => timelineLayout([stream], day)?.today;
    expect(today("2027-02-15")).toBe(45);
    expect(today("2026-12-31")).toBeUndefined();
    expect(today("2028-01-01")).toBeUndefined();
  });

  it("has nothing to show while no current stream has cycles", () => {
    expect(timelineLayout([], "2027-02-15")).toBeUndefined();
    expect(
      timelineLayout(
        [fictionalStream({ cycles: [] }), fictionalStream({ retired: true })],
        "2027-02-15",
      ),
    ).toBeUndefined();
  });

  describe("its axis", () => {
    const layout = timelineLayout([stream, minors], "2027-02-15");
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
