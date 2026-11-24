// SPDX-License-Identifier: Apache-2.0

// An activity as a request drafts it, for a project's or a release's. Part of the data access layer.

import {
  type ActivityOwner,
  activityOwnerFields,
  type ActivityRequest,
} from "@fathom/shared";
import { keptNote } from "./records.ts";

export const activityRecord = (
  owner: ActivityOwner,
  ownerId: string,
  request: ActivityRequest,
) => ({
  // The owner is always one of the two fixed ones.
  // eslint-disable-next-line security/detect-object-injection
  [activityOwnerFields[owner]]: ownerId,
  name: request.name,
  description: request.description,
  note: keptNote(request.note),
  estimateHours: request.estimateHours,
});
