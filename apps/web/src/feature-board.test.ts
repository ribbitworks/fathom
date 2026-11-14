// SPDX-License-Identifier: Apache-2.0

// Tests for the Features Board's rules: which cycles are its columns and their releases, which
// column a feature is in, whether a draft moves it, the order of its cards, a risk's step, and
// which parts its cards show.

import type { Feature } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  boardColumns,
  cardOrder,
  columnOf,
  firstShown,
  laterKey,
  movesCycle,
  riskStep,
  shownParts,
} from "./feature-board.ts";
import {
  featureDraft,
  fictionalRelease,
  fictionalStream,
  quarters,
  recordDraft,
  streamId,
} from "./test-support.tsx";

const cycles = quarters(6);

describe("the cycles shown first", () => {
  it("starts from the cycle asked for", () => {
    expect(firstShown(cycles, 2, "2027-05-01", "2027-07-01")).toBe(2);
  });

  it("starts from the current cycle when none is asked for", () => {
    expect(firstShown(cycles, 2, "2027-05-01")).toBe(1);
  });

  it("starts from the next cycle to come between cycles", () => {
    expect(firstShown(quarters(2), 1, "2026-12-01")).toBe(0);
  });

  it("starts from the last cycle once every one has ended", () => {
    expect(firstShown(cycles, 1, "2030-01-01")).toBe(5);
  });

  it("moves back so as many as fit are shown", () => {
    expect(firstShown(cycles, 3, "2027-05-01", "2028-04-01")).toBe(3);
  });

  it("starts from the first when they all fit", () => {
    expect(firstShown(cycles, 10, "2028-05-01")).toBe(0);
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
