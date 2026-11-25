// SPDX-License-Identifier: Apache-2.0

// The fields of a feature that only the editors of another kind may change.

import type { DraftKind } from "@fathom/shared";
import type { Actor } from "../access.ts";
import { ForbiddenError } from "../errors.ts";
import { type Recorded, same } from "./draft-records.ts";
import { editsDraft } from "./draft-editors.ts";

export const customersNeedPlan =
  "This role can't change which customers a feature is for";

export const featureTeamNeedsTeamEditors =
  "This role can't change a feature's feature team";

type GuardedField = "customerIds" | "featureTeamId";

// Whether a field differs between two versions of a feature; a draft removing the feature, with no
// version, changes none.
const changesField =
  (field: GuardedField, empty: unknown) =>
  (before: Recorded | undefined, after: Recorded | undefined): boolean =>
    after !== undefined &&
    // Only the fixed field names below are read.
    // eslint-disable-next-line security/detect-object-injection
    !same(before?.[field] ?? empty, after[field] ?? empty);

export const changesCustomers = changesField("customerIds", []);

// Which customers a feature is for is the plan's call, as the projects and proposals that name it
// are, and which team builds it is feature teams'. Adding, changing, discarding and resubmitting are
// all checked, since each can change a field.
const guardedFields: readonly {
  changes: (
    before: Recorded | undefined,
    after: Recorded | undefined,
  ) => boolean;
  editedWith: DraftKind;
  refusal: string;
}[] = [
  {
    changes: changesCustomers,
    editedWith: "project",
    refusal: customersNeedPlan,
  },
  {
    changes: changesField("featureTeamId", null),
    editedWith: "feature-team",
    refusal: featureTeamNeedsTeamEditors,
  },
];

export function refuseFeatureFieldChanges(
  actor: Actor,
  before: Recorded | undefined,
  after: Recorded | undefined,
): void {
  const refused = guardedFields.find(
    ({ changes, editedWith }) =>
      changes(before, after) && !editsDraft(actor, editedWith),
  );
  if (refused !== undefined) throw new ForbiddenError(refused.refusal);
}
