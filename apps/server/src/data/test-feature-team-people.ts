// SPDX-License-Identifier: Apache-2.0

// Fictional people and planned hires for the unit tests of the feature team rules.

import type { Person, PlannedHire } from "./feature-team-rules.ts";

export const someone = (details: Partial<Person> = {}): Person => ({
  kind: "person",
  preferredName: "Fictional Person",
  startDate: "2020-01-01",
  endDate: null,
  started: true,
  left: false,
  ...details,
});

// An open planned hire, expected from June 2026 unless told otherwise.
export const plannedHire = (
  details: Partial<PlannedHire> = {},
): PlannedHire => ({
  kind: "planned-hire",
  preferredName: "Fictional Planned Hire",
  name: "Fictional Planned Hire",
  shownId: "REQ-FICTIONAL-1",
  position: "Fictional Engineer",
  firstDay: "2026-06-01",
  dated: true,
  filledBy: null,
  removing: false,
  ...details,
});
