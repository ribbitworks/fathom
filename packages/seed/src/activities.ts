// SPDX-License-Identifier: Apache-2.0

// The fictional projects' activities, seeded with their projects. A development-only package, never
// in the runtime image.

import { fictionalId } from "@fathom/fixtures";

// Each activity is known by its project's key and a key of its own.
export const seededActivities: readonly {
  project: string;
  key: string;
  name: string;
  description: string | null;
  estimateHours: number | null;
}[] = [
  {
    project: "crane-control",
    key: "general",
    name: "General",
    description: null,
    estimateHours: null,
  },
  {
    project: "crane-control",
    key: "data-migration",
    name: "Data migration",
    description: "Move the harbour's crane logs from the old yard system.",
    estimateHours: 640,
  },
  {
    project: "crane-control",
    key: "operator-training",
    name: "Operator training",
    description: null,
    estimateHours: 240,
  },
  {
    project: "clinic-booking",
    key: "general",
    name: "General",
    description: null,
    estimateHours: null,
  },
  {
    project: "transit-displays",
    key: "warranty-support",
    name: "Warranty support",
    description: "Fix what the displays need during their year of warranty.",
    estimateHours: 320,
  },
  {
    project: "internal-tools",
    key: "general",
    name: "General",
    description: null,
    estimateHours: null,
  },
  {
    project: "depot-operations",
    key: "depot-rollout",
    name: "Depot rollout",
    description: null,
    estimateHours: 480,
  },
];

export const activityId = (project: string, key: string) =>
  fictionalId(`activity:${project}:${key}`);

export const seededActivityIds = () =>
  seededActivities.map(({ project, key }) => activityId(project, key));
