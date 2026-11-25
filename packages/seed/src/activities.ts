// SPDX-License-Identifier: Apache-2.0

// The fictional projects' activities, seeded with their projects. A development-only package, never
// in the runtime image.

import { fictionalId } from "@fathom/fixtures";
import type { SeededPlanning } from "./seeded-planning.ts";

// Each activity is known by its project's key and a key of its own.
export interface SeededActivity extends SeededPlanning {
  project: string;
  key: string;
  name: string;
  description: string | null;
  estimateHours: number | null;
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

export const activityId = (project: string, key: string) =>
  fictionalId(`activity:${project}:${key}`);

export const seededActivityIds = () =>
  seededActivities.map(({ project, key }) => activityId(project, key));
