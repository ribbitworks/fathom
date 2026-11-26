// SPDX-License-Identifier: Apache-2.0

// Records named by an ID of their own beside their name, such as projects, and the choices of them a
// column offers.

import type { Choice } from "@fathom/shared";

// A record that may have an ID of its own, such as a Project ID, beside its name.
export interface Identified {
  id: string;
  name: string;
  externalId?: string | null;
  draft?: { action: string } | undefined;
}

// A choice of a record, which keeps the record so its ID can be shown apart from its name.
export interface IdentifiedChoice extends Choice {
  record: Identified;
}

export const isIdentifiedChoice = <Option extends object>(
  choice: Option,
): choice is Option & { record: Identified } =>
  "record" in choice &&
  typeof choice.record === "object" &&
  choice.record !== null &&
  "name" in choice.record;
