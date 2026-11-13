// SPDX-License-Identifier: Apache-2.0

// Effort on screen: the conversions between units of effort, as the server keeps them for the whole
// of Fathom, each unit as a column offers it, named in full in the column's menu and by a short
// code in its cells, and the hours behind an amount shown, in words.

import {
  type EffortUnit,
  effortConversionsSchema,
  effortUnits,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import { getJson } from "./api.ts";
import { decimal } from "./numbers.ts";
import { type ColumnUnit, unitAmountWords } from "./table-view.ts";

export const effortConversionsQuery = queryOptions({
  queryKey: ["effort-conversions"],
  queryFn: async () =>
    getJson("/api/effort-conversions", effortConversionsSchema),
});

export const unitWords: Readonly<Record<EffortUnit, Omit<ColumnUnit, "key">>> =
  {
    hours: { label: "Hours", code: "h", name: "hours", one: "hour" },
    "person-days": {
      label: "Person-days",
      code: "PD",
      name: "person-days",
      one: "person-day",
    },
    "person-weeks": {
      label: "Person-weeks",
      code: "PW",
      name: "person-weeks",
      one: "person-week",
    },
    "person-months": {
      label: "Person-months",
      code: "PM",
      name: "person-months",
      one: "person-month",
    },
    "person-quarters": {
      label: "Person-quarters",
      code: "PQ",
      name: "person-quarters",
      one: "person-quarter",
    },
  };

type EffortColumnUnit = ColumnUnit & { key: EffortUnit };

const columnUnit = (unit: EffortUnit): EffortColumnUnit => ({
  key: unit,
  // The unit is one of the typed units, each a key of the table.
  // eslint-disable-next-line security/detect-object-injection
  ...unitWords[unit],
});

const [firstUnit, ...laterUnits] = effortUnits;

// Each unit of effort as a column offers it, in order, hours first.
export const effortColumnUnits: readonly [
  EffortColumnUnit,
  ...EffortColumnUnit[],
] = [columnUnit(firstUnit), ...laterUnits.map(columnUnit)];

// The hours behind an amount shown, in words, such as 316 hours, saying so when the amount shown
// was rounded up from them, such as 1 hour, rounded up.
export const hoursWords = (hours: number, roundedUp: boolean) =>
  `${unitAmountWords(decimal(hours), hours, effortColumnUnits[0])}${roundedUp ? ", rounded up" : ""}`;
