// SPDX-License-Identifier: Apache-2.0

// The Capacity page's modes, and which a role sees: each needs a permission of its own, and People
// also what its grid reads, the feature teams' months and the org chart's planned hires, with the
// Personal details they need; the page opens for a role that sees any of them.

import { allocationsGridPermissions, type ClassAccess } from "@fathom/shared";
import { z } from "zod";
import { opensWith, type PageNeed } from "./page-access.ts";

export const capacityModeSchema = z.enum(["people", "settings"]);

export type CapacityMode = z.infer<typeof capacityModeSchema>;

const [opening, ...others] = allocationsGridPermissions;

const modeNeeds: Record<CapacityMode, PageNeed> = {
  people: {
    permission: opening,
    with: others,
    view: "allocations",
  },
  settings: { permission: "configuration:view" },
};

export const capacityNeeds: readonly PageNeed[] = Object.values(modeNeeds);

export const capacityModes = (access: ClassAccess) =>
  capacityModeSchema.options.filter((mode) =>
    // The mode is always one of the fixed modes above.
    // eslint-disable-next-line security/detect-object-injection
    opensWith([modeNeeds[mode]], access),
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
