// SPDX-License-Identifier: Apache-2.0

// The fictional projects' and releases' activities, seeded with the projects. A development-only
// package, never in the runtime image.

import { fictionalId } from "@fathom/fixtures";
import type { SeededPlanning } from "./seeded-planning.ts";

interface SeededActivityValues extends SeededPlanning {
  key: string;
  name: string;
  description: string | null;
  estimateHours: number | null;
}

// Each activity is known by its project's key and a key of its own.
export interface SeededActivity extends SeededActivityValues {
  project: string;
}

export const seededActivities: readonly SeededActivity[] = [
  {
    project: "crane-control",
    key: "general",
    name: "General",
    status: "in-progress",
    priority: "Medium",
    team: 0,
    description: null,
    estimateHours: null,
  },
  {
    project: "crane-control",
    key: "data-migration",
    name: "Data migration",
    status: "in-progress",
    priority: "Critical",
    size: "XL",
    risk: "High",
    neededIn: 2,
    team: 1,
    description: "Move the harbour's crane logs from the old yard system.",
    estimateHours: 640,
  },
  {
    project: "crane-control",
    key: "operator-training",
    name: "Operator training",
    status: "planned",
    priority: "Medium",
    size: "M",
    risk: "Low",
    neededIn: 4,
    team: 0,
    description: null,
    estimateHours: 240,
  },
  {
    project: "clinic-booking",
    key: "general",
    name: "General",
    status: "in-progress",
    priority: "Medium",
    team: 2,
    description: null,
    estimateHours: null,
  },
  {
    project: "transit-displays",
    key: "warranty-support",
    name: "Warranty support",
    status: "planned",
    priority: "Low",
    size: "M",
    risk: "Low",
    team: null,
    description: "Fix what the displays need during their year of warranty.",
    estimateHours: 320,
  },
  {
    project: "internal-tools",
    key: "general",
    name: "General",
    status: "possible",
    priority: "Low",
    team: null,
    description: null,
    estimateHours: null,
  },
  {
    project: "depot-operations",
    key: "depot-rollout",
    name: "Depot rollout",
    status: "planned",
    priority: "High",
    size: "L",
    risk: "Medium",
    neededIn: 6,
    team: 1,
    description: null,
    estimateHours: 480,
  },
];

// A release's activities, known by its schedule's name, its key and a key of their own.
export interface SeededReleaseActivity extends SeededActivityValues {
  stream: string;
  release: string;
}

export const seededReleaseActivities: readonly SeededReleaseActivity[] = [
  {
    stream: "Platform",
    release: "harbor-1",
    key: "release-testing",
    name: "Release testing",
    status: "done",
    priority: "High",
    size: "M",
    risk: "Medium",
    team: 0,
    description: "Test the release end to end before it ships.",
    estimateHours: 160,
  },
  {
    stream: "Platform",
    release: "harbor-1",
    key: "release-notes",
    name: "Release notes",
    status: "done",
    priority: "Medium",
    size: "S",
    risk: "Low",
    team: null,
    description: null,
    estimateHours: 24,
  },
  {
    stream: "Platform",
    release: "harbor-2",
    key: "release-testing",
    name: "Release testing",
    status: "possible",
    priority: "High",
    size: "M",
    team: 0,
    description: "Test the release end to end before it ships.",
    estimateHours: 160,
  },
];

export const activityId = (project: string, key: string) =>
  fictionalId(`activity:${project}:${key}`);

export const releaseActivityId = ({
  stream,
  release,
  key,
}: Pick<SeededReleaseActivity, "stream" | "release" | "key">) =>
  fictionalId(`activity:release:${stream}:${release}:${key}`);

export const seededProjectActivityIds = () =>
  seededActivities.map(({ project, key }) => activityId(project, key));

export const seededActivityIds = () => [
  ...seededProjectActivityIds(),
  ...seededReleaseActivities.map(releaseActivityId),
];
