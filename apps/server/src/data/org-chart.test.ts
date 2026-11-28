// SPDX-License-Identifier: Apache-2.0

// Unit tests for hireCardPlace, where the org chart draws a planned hire's card.

import { describe, expect, it } from "vitest";
import { hireCardPlace } from "./org-chart.ts";

const today = "2026-06-15";
const later = "2026-08-03";
const earlier = "2026-03-02";

const sightOf = (seesPersonal: boolean, seesFeatureTeams = true) => ({
  seesPersonal,
  seesFeatureTeams,
  today,
});

describe("where a planned hire's card is drawn", () => {
  it.each([true, false])(
    "is on the chart while the hire is not filled, whether or not the reader sees Personal details (%s)",
    (seesPersonal) => {
      expect(
        hireCardPlace(
          { filledBy: null, fillerStart: undefined },
          sightOf(seesPersonal),
        ),
      ).toBe("chart");
    },
  );

  it("is on the chart, as not yet filled, until its person starts, for a reader who doesn't see them", () => {
    expect(
      hireCardPlace(
        { filledBy: "starter", fillerStart: later },
        sightOf(false),
      ),
    ).toBe("chart");
  });

  it("is only on its feature teams until its person starts, for a reader who sees them in its place", () => {
    expect(
      hireCardPlace({ filledBy: "starter", fillerStart: later }, sightOf(true)),
    ).toBe("teams");
  });

  it("is nowhere until its person starts for a reader who sees them in its place but not feature teams", () => {
    expect(
      hireCardPlace(
        { filledBy: "starter", fillerStart: later },
        sightOf(true, false),
      ),
    ).toBe("none");
  });

  it.each([
    ["has started", earlier],
    ["starts today", today],
    ["has no start date", null],
    ["isn't read", undefined],
  ])(
    "is nowhere once its person %s, whether or not the reader sees them",
    (_, fillerStart) => {
      for (const seesPersonal of [true, false]) {
        expect(
          hireCardPlace(
            { filledBy: "starter", fillerStart },
            sightOf(seesPersonal),
          ),
        ).toBe("none");
      }
    },
  );
});
