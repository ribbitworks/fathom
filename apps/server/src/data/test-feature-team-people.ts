// SPDX-License-Identifier: Apache-2.0

// Fictional people for the unit tests of the feature team rules.

import type { Person } from "./feature-team-rules.ts";

export const someone = (details: Partial<Person> = {}): Person => ({
  preferredName: "Fictional Person",
  startDate: "2020-01-01",
  endDate: null,
  started: true,
  left: false,
  ...details,
});
