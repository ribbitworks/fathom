// SPDX-License-Identifier: Apache-2.0

// Which of the user's unpublished changes are chosen, and which go with them, as the server links
// them.

import {
  type DraftsAsked,
  draftKeysOf,
  type Unpublished,
  withNeeded,
} from "@fathom/shared";

// The user's other changes that publishing those asked for publishes with them, as the server adds
// them: every change they use, or were saved with, the whole way along, in the order listed.
export function publishedAlong(
  changes: Unpublished["changes"],
  asked: DraftsAsked,
): Unpublished["changes"] {
  const chosen = new Set(draftKeysOf(asked));
  const going = withNeeded(
    new Map(changes.map(({ key, linked }) => [key, linked])),
    [...chosen],
  );
  return changes.filter(({ key }) => going.has(key) && !chosen.has(key));
}

// The user's changes asked for, in the order listed.
export function askedAmong(
  changes: Unpublished["changes"],
  asked: DraftsAsked,
): Unpublished["changes"] {
  const chosen = new Set(draftKeysOf(asked));
  return changes.filter(({ key }) => chosen.has(key));
}
