// SPDX-License-Identifier: Apache-2.0

// Which customers a feature is for is the plan's call, as the projects and proposals that name it
// are: only a role that edits those changes it, whether by adding or changing a feature, or by
// discarding or resubmitting a draft that changes it.

import type { Actor } from "../access.ts";
import { ForbiddenError } from "../errors.ts";
import { type Recorded, same } from "./draft-records.ts";
import { editsKind } from "./draft-editors.ts";

export const customersNeedPlan =
  "This role can't change which customers a feature is for";

// Whether a feature's customers differ between two versions of it; a draft removing the feature,
// with no version, changes none.
export const changesCustomers = (
  before: Recorded | undefined,
  after: Recorded | undefined,
): boolean =>
  after !== undefined &&
  !same(before?.customerIds ?? [], after.customerIds ?? []);

export function refuseCustomersChange(
  actor: Actor,
  before: Recorded | undefined,
  after: Recorded | undefined,
): void {
  if (changesCustomers(before, after) && !editsKind(actor, "project")) {
    throw new ForbiddenError(customersNeedPlan);
  }
}
