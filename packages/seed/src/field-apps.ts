// SPDX-License-Identifier: Apache-2.0

// The Field Apps release schedule of the fictional organization, its releases and features:
// six-month cycles placed so the seed day always falls about two thirds of the way through one, a
// release that has shipped, one on the current cycle shipping two weeks after it ends, a cycle in
// no release, and one to come, and features of every meaning in the cycles around today, one needed
// by last month, so a cycle late in its life shows what is still to start. A development-only
// package, never included in the runtime image.

import { addDays, addMonths, addToMonth, monthOf } from "@fathom/shared";
import type { SeededFeature } from "./features.ts";
import type { SeededStream } from "./releases.ts";

export const fieldAppsKeys = {
  name: "Field Apps",
  patterns: ["six-months"],
  releases: ["lantern-1", "lantern-2", "lantern-3"],
} as const;

// The current cycle starts on the first of the month this many months before the seed day's, so a
// fresh seed is always about two thirds through it, and cycles start this many before it.
const fieldAppsDates = {
  monthsIntoCycle: 4,
  cycleMonths: 6,
  cyclesBefore: 2,
} as const;

// How many days after its last cycle's end Lantern 2 ships.
const shipsAfterDays = 14;

export function fieldAppsStream(today: string): SeededStream {
  const { monthsIntoCycle, cycleMonths, cyclesBefore } = fieldAppsDates;
  const current = `${addToMonth(monthOf(today), -monthsIntoCycle)}-01`;
  const cycle = (offset: number) => addMonths(current, offset * cycleMonths);
  const [first, second, third] = fieldAppsKeys.releases;
  return {
    name: fieldAppsKeys.name,
    patterns: [
      {
        key: fieldAppsKeys.patterns[0],
        startsOn: cycle(-cyclesBefore),
        length: cycleMonths,
        unit: "months",
        naming: "FA{YY}.{N}",
      },
    ],
    releases: [
      {
        key: first,
        name: "Lantern 1",
        firstCycle: cycle(-1),
        lastCycle: cycle(-1),
        colour: "teal",
      },
      {
        key: second,
        name: "Lantern 2",
        firstCycle: cycle(0),
        lastCycle: cycle(0),
        colour: "indigo",
        shipsOn: addDays(cycle(1), shipsAfterDays - 1),
        note: "Ships two weeks after the cycle ends, once the depots have tried it.",
      },
      {
        key: third,
        name: "Lantern 3",
        firstCycle: cycle(2),
        lastCycle: cycle(2),
        colour: "lime",
      },
    ],
  };
}

// Field Apps' features, by cycle counted from the current one: two done last cycle; one done, two
// in progress, three planned and not started, and one possible in this one; and one planned in the
// next, which only a planned hire is allocated to.
export const fieldAppsFeatures: readonly SeededFeature[] = (
  [
    {
      key: "crew-roster",
      name: "Crew Roster",
      status: "done",
      priority: "High",
      size: "M",
      risk: "Low",
      cycle: -1,
      hours: 400,
      team: 2,
      description: "Who is on which crew, each day.",
    },
    {
      key: "job-sheets",
      name: "Job Sheets",
      status: "done",
      priority: "Medium",
      size: "S",
      risk: "Low",
      cycle: -1,
      hours: 240,
      team: 3,
      description: null,
    },
    {
      key: "offline-forms",
      name: "Offline Forms",
      status: "done",
      priority: "High",
      size: "M",
      risk: "Medium",
      cycle: 0,
      hours: 360,
      team: 3,
      description: "Fill in a form with no signal, sent once back in range.",
    },
    {
      key: "signature-capture",
      name: "Signature Capture",
      status: "in-progress",
      priority: "Critical",
      size: "S",
      risk: "Medium",
      neededIn: -1,
      cycle: 0,
      hours: 200,
      team: 3,
      description: "A customer signs on the device when a job is done.",
    },
    {
      key: "parts-lookup",
      name: "Parts Lookup",
      status: "in-progress",
      priority: "High",
      size: "L",
      risk: "High",
      cycle: 0,
      hours: 720,
      team: 2,
      description: null,
    },
    {
      key: "barcode-scanning",
      name: "Barcode Scanning",
      status: "planned",
      priority: "High",
      size: "M",
      risk: "Medium",
      cycle: 0,
      hours: 320,
      team: 3,
      description: null,
    },
    {
      key: "site-diary",
      name: "Site Diary",
      status: "planned",
      priority: "Medium",
      size: "XS",
      risk: "Low",
      cycle: 0,
      hours: 60,
      team: 2,
      description: null,
    },
    {
      key: "timesheet-sync",
      name: "Timesheet Sync",
      status: "planned",
      priority: "Medium",
      size: "S",
      risk: "Medium",
      cycle: 0,
      hours: 160,
      team: 2,
      description: null,
    },
    {
      key: "weather-alerts",
      name: "Weather Alerts",
      status: "possible",
      priority: "Low",
      size: "S",
      cycle: 0,
      hours: 120,
      team: null,
      description: null,
    },
    {
      key: "work-order-sync",
      name: "Work Order Sync",
      status: "planned",
      priority: "High",
      size: "L",
      risk: "High",
      cycle: 1,
      hours: 800,
      team: 3,
      description: "Work orders from the depot system, both ways.",
    },
  ] satisfies readonly Omit<SeededFeature, "stream">[]
).map((feature) => ({ ...feature, stream: fieldAppsKeys.name }));
