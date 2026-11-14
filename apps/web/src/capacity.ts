// SPDX-License-Identifier: Apache-2.0

// The Capacity page's modes, and which a role sees, from each mode's needs.

import {
  type CapacityMode,
  capacityModeNames,
  capacityModeNeeds,
  type ClassAccess,
  opensWith,
} from "@fathom/shared";
import { z } from "zod";

export const capacityModeSchema = z.enum(capacityModeNames);

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
