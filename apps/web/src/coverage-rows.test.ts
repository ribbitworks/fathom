// SPDX-License-Identifier: Apache-2.0

// Tests for Capacity's Coverage rows: the first month someone is employed in, the hours each work's
// allocations deliver, and each work's effort, allocated hours, what is left and its months.

import { startingPlanningSettings } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import type { AllocationLine, AllocationRow } from "./allocation-months.tsx";
import { coverageRows, deliveredByWork } from "./coverage-rows.ts";
import { fictionalFeature } from "./test-support.tsx";
import { project } from "./test-projects-page.tsx";
import { fictionalStream, streamId } from "./test-releases.ts";

const settings = { ...startingPlanningSettings, bufferPercent: 25 };

const line = (featureId: string, live: number, percentage = live) =>
  ({ featureId, live, percentage }) as AllocationLine;

const allocationRow = (
  allocated: Record<string, AllocationLine[]>,
  outside: readonly string[] = [],
): AllocationRow => ({
  id: "r-1",
  personId: "p-1",
  name: "Fictional Person",
  manager: null,
  values: {},
  links: {},
  allocated: new Map(Object.entries(allocated)),
  outside: new Set(outside),
});

describe("deliveredByWork", () => {
  it("adds up each work's hours by month, at the focus and ramp-up the settings give", () => {
    // Given one person on Checkout at half a month in March, and a planned hire starting in April
    // on it full time, ramping up
    const rows = [
      allocationRow({ "2027-03": [line("f-checkout", 50)] }),
      allocationRow(
        {
          "2027-04": [line("f-checkout", 100)],
          "2027-05": [line("f-checkout", 100)],
        },
        ["2027-03"],
      ),
    ];

    // When their hours are added up
    const delivered = deliveredByWork({
      rows,
      months: ["2027-03", "2027-04", "2027-05"],
      settings,
      show: "live",
    });

    // Then March gets 160 h × 50% × 80% focus, April the hire's first month at 50%, May at 75%
    expect(delivered).toEqual(
      new Map([
        [
          "f-checkout",
          new Map([
            ["2027-03", 64],
            ["2027-04", 64],
            ["2027-05", 96],
          ]),
        ],
      ]),
    );
  });

  it("counts drafted percentages only with drafts applied, and nothing outside employment", () => {
    const rows = [
      allocationRow(
        {
          "2027-03": [line("f-checkout", 0, 50)],
          "2027-04": [line("f-checkout", 50)],
        },
        ["2027-04"],
      ),
    ];
    const months = ["2027-03", "2027-04"];
    expect(deliveredByWork({ rows, months, settings, show: "live" })).toEqual(
      new Map(),
    );
    expect(
      deliveredByWork({ rows, months, settings, show: "drafts" }).get(
        "f-checkout",
      ),
    ).toEqual(new Map([["2027-03", 64]]));
  });
});

describe("coverageRows", () => {
  const stream = fictionalStream();

  it("gives a feature its effort with the buffer, hours allocated, what is left and its months", () => {
    // Given a feature of 96 h targeting the cycle from April to June 2027, with 60 h allocated in
    // April, seen in March
    const [row] = coverageRows({
      features: [
        fictionalFeature({
          id: "f-checkout",
          name: "Checkout",
          estimateHours: 96,
          targetStreamId: streamId,
          targetCycle: "2027-04-01",
        }),
      ],
      projects: [],
      meanings: new Map(),
      allocatedWork: [],
      streams: [stream],
      settings,
      delivered: new Map([["f-checkout", new Map([["2027-04", 60]])]]),
      currentMonth: "2027-03",
    });

    // Then it needs 120 h with the buffer, 60 h left, spread evenly over the cycle's three months
    expect(row).toMatchObject({
      id: "f-checkout",
      name: "Checkout",
      effort: 120,
      allocated: 60,
      remaining: 60,
      coverage: {
        months: [
          { month: "2027-04", allocated: 60, needed: 40 },
          { month: "2027-05", allocated: 0, needed: 40 },
          { month: "2027-06", allocated: 0, needed: 40 },
        ],
      },
    });
  });

  it("leaves out features done or cancelled, and not their allocated work's row either", () => {
    const rows = coverageRows({
      features: [
        fictionalFeature({
          id: "f-done",
          statusId: "s-done",
          estimateHours: 80,
        }),
        fictionalFeature({ id: "f-open", statusId: "s-planned", name: "Open" }),
      ],
      projects: [],
      meanings: new Map([
        ["s-done", "done"],
        ["s-planned", "planned"],
      ]),
      allocatedWork: [{ id: "f-done", name: "Done" }],
      streams: [stream],
      settings,
      delivered: new Map([["f-done", new Map([["2027-03", 64]])]]),
      currentMonth: "2027-03",
    });
    expect(rows.map(({ name }) => name)).toEqual(["Open"]);
  });

  it("gives a feature with no estimate, no cycle and no Needed by no effort, done Later", () => {
    const [row] = coverageRows({
      features: [fictionalFeature({ id: "f-idea", name: "Idea" })],
      projects: [],
      meanings: new Map(),
      allocatedWork: [],
      streams: [stream],
      settings,
      delivered: new Map(),
      currentMonth: "2027-03",
    });
    expect(row).toMatchObject({ allocated: 0, coverage: { later: {} } });
    expect(row?.effort).toBeUndefined();
    expect(row?.remaining).toBeUndefined();
  });

  it("adds a row for other allocated work, a project's own named with its ID first, and none for unallocated", () => {
    const depot = project({
      id: "p-depot",
      name: "Depot Operations",
      externalId: "P-2001",
    });
    const rows = coverageRows({
      features: [],
      projects: [depot],
      meanings: new Map(),
      allocatedWork: [
        { id: "g-depot", name: "Depot Operations", projectId: depot.id },
        { id: "g-other", name: "Other Work" },
        { id: "g-idle", name: "Idle Project" },
      ],
      streams: [stream],
      settings,
      delivered: new Map([
        ["g-depot", new Map([["2027-03", 40]])],
        ["g-other", new Map([["2027-03", 8]])],
      ]),
      currentMonth: "2027-03",
    });
    expect(
      rows.map(({ name, allocated, project: of }) => ({
        name,
        allocated,
        projectId: of?.id,
      })),
    ).toEqual([
      { name: "P-2001 Depot Operations", allocated: 40, projectId: depot.id },
      { name: "Other Work", allocated: 8, projectId: undefined },
    ]);
  });

  it("names a project's own work as allocations do, with no project, for a role that doesn't see Projects", () => {
    const [row] = coverageRows({
      features: [],
      projects: [],
      meanings: new Map(),
      allocatedWork: [
        { id: "g-depot", name: "Depot Operations", projectId: "p-unseen" },
      ],
      streams: [stream],
      settings,
      delivered: new Map([["g-depot", new Map([["2027-03", 40]])]]),
      currentMonth: "2027-03",
    });
    expect(row?.name).toBe("Depot Operations");
    expect(row?.project).toBeUndefined();
  });
});
