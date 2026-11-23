// SPDX-License-Identifier: Apache-2.0

// The Capacity page's tabs, which a role sees, from each tab's needs, and the table of views each
// grid tab keeps.

import {
  allocationsViewChoices,
  type CapacityMode,
  type ViewTable,
  capacityModeNames,
  capacityModeNeeds,
  type ClassAccess,
  opensWith,
} from "@fathom/shared";
import { z } from "zod";

// An address from before Allocations was named so opens it.
export const capacityModeSchema = z.preprocess(
  (mode) => (mode === "people" ? "allocations" : mode),
  z.enum(capacityModeNames),
);

// Each grid tab's table, whose views it keeps; Settings keeps none.
export const capacityTables = {
  "feature-teams": "feature-assignments",
  allocations: "capacity",
} as const satisfies Partial<Record<CapacityMode, ViewTable>>;

export type CapacityGridMode = keyof typeof capacityTables;

// The choices each grid tab keeps in its view, by their names in the address.
export const capacityTabChoices: Record<
  CapacityMode,
  readonly (keyof typeof allocationsViewChoices.shape)[]
> = {
  "feature-teams": [],
  allocations: allocationsViewChoices.keyof().options,
  settings: [],
};

// The grid tab each table is shown on; none for another page's table.
const capacityModesOfTables: Partial<Record<ViewTable, CapacityGridMode>> = {
  [capacityTables["feature-teams"]]: "feature-teams",
  [capacityTables.allocations]: "allocations",
};

export const capacityModeOfTable = (
  table: ViewTable,
): CapacityGridMode | undefined =>
  // The table is always one of the fixed tables.
  // eslint-disable-next-line security/detect-object-injection
  capacityModesOfTables[table];

export const capacityModes = (access: ClassAccess) =>
  capacityModeNames.filter((mode) =>
    // The mode is always one of the fixed modes.
    // eslint-disable-next-line security/detect-object-injection
    opensWith([capacityModeNeeds[mode]], access),
  );

// The mode shown: the one asked for, where the role sees it, or else the first it sees, Settings
// for a role that sees no mode, which the page's route keeps out.
export function shownCapacityMode(
  asked: CapacityMode | undefined,
  access: ClassAccess,
): CapacityMode {
  const modes = capacityModes(access);
  return modes.find((mode) => mode === asked) ?? modes[0] ?? "settings";
}
