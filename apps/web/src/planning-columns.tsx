// SPDX-License-Identifier: Apache-2.0

// The columns features and activities share, for the planning fields they share, and the groups
// those columns put their rows in.

import {
  type Activity,
  type EffortConversions,
  effortUnitSchema,
  enteredHours,
  exactEffort,
  type Feature,
  featureLengths,
  isCommitted,
  largestEstimateHours,
  largestIn,
  type Meaning,
  needsFeatureTeam,
  planColumnNames,
  roundedUpTo,
  shownEffort,
  startingEffortConversions,
  typedNumber,
} from "@fathom/shared";
import { formatMonth } from "./day-formats.ts";
import { EffortCell } from "./effort-cell.tsx";
import { effortColumnUnits, hoursWords, unitLabel } from "./effort.ts";
import { choice } from "./lists.ts";
import { decimalUpTo } from "./numbers.ts";
import {
  addedColumn,
  drawnFields,
  type AddedColumns,
  cellRequest,
} from "./added-columns.ts";
import type { CellChange } from "./cell-kinds.tsx";
import { inOrder } from "./grid-columns.tsx";
import {
  field,
  firstStatus,
  merged,
  nameColumn,
  type PlanChange,
} from "./plan-table.tsx";
import type { TableChoices } from "./projects.ts";
import {
  type Column,
  type ColumnGroup,
  inGroupOrder,
  type RowGrouping,
} from "./record-table.ts";
import { rankOfNone } from "./row-groups.ts";
import type { ColumnUnit } from "./table-view.ts";

// The planned work whose rows these columns draw.
export type Planned = Feature | Activity;

// Estimates are rough, so their amounts show no more than two decimal places, rounded up.
const effortPlaces = [0, 1, 2];
const effortPlacesAtFirst = 2;
// What floating point leaves of an amount that was not rounded, far below any place shown.
const roundingLeft = 1e-9;

const labelled = (
  unit: (typeof effortColumnUnits)[number],
  conversions: EffortConversions,
) => ({ ...unit, label: unitLabel(unit, conversions) });

// The estimate of a feature or an activity, kept in hours and shown in the unit the view names, in
// which it is typed. Without the conversions, as for a draft's details, it is offered in hours alone,
// which need none.
export function effortColumn<Rec extends Planned>(
  conversions: EffortConversions | undefined,
): Column<Rec, PlanChange> {
  const [hours, ...others] = effortColumnUnits;
  const converting = conversions ?? startingEffortConversions;
  const shownIn = (
    unit: ColumnUnit,
    places: number,
  ): Column<Rec, PlanChange> => {
    const effortUnit = effortUnitSchema.catch(hours.key).parse(unit.key);
    const amountOf = (estimate: number) =>
      shownEffort(estimate, effortUnit, converting);
    const inUnit = (estimate: unknown) =>
      typeof estimate === "number" ? String(amountOf(estimate)) : "";
    return {
      ...field<Rec>("estimateHours", planColumnNames.estimateHours, "number"),
      unit,
      least: 0,
      most: largestIn(largestEstimateHours, effortUnit, converting),
      // Hours add up, shown in the unit the column is, rounded up as its cells are. A record's
      // effort is what its rows are most often added up by.
      sum: {
        amount: (record) => record.estimateHours,
        shown: (hours) =>
          decimalUpTo(roundedUpTo(amountOf(hours), places), places),
        atFirst: true,
      },
      value: (record) => inUnit(record.estimateHours),
      live: (draft) => inUnit((draft.live as Partial<Planned>).estimateHours),
      change: (value) => {
        const typed = typedNumber(value as string);
        return {
          estimateHours:
            typed === undefined
              ? null
              : enteredHours(typed, effortUnit, converting),
        };
      },
      content: ({ estimateHours }) => {
        if (estimateHours === null) return null;
        const amount = roundedUpTo(amountOf(estimateHours), places);
        const exact = exactEffort(estimateHours, effortUnit, converting);
        return (
          <EffortCell
            shown={decimalUpTo(amount, places)}
            amount={amount}
            unit={unit}
            hours={hoursWords(
              estimateHours,
              Math.abs(amount - exact) > roundingLeft,
            )}
          />
        );
      },
    };
  };
  return {
    ...shownIn(hours, effortPlacesAtFirst),
    // Breaking down by effort counts only whether records have an estimate, which says little.
    breaksDown: false,
    units: {
      offered:
        conversions === undefined
          ? [hours]
          : [
              labelled(hours, conversions),
              ...others.map((unit) => labelled(unit, conversions)),
            ],
      places: { offered: effortPlaces, starting: effortPlacesAtFirst },
      shownIn,
    },
  };
}

export const staffedColumnKey = "staffed";

export const staffedChoices = { yes: "yes", no: "no" } as const;

// Yes or No for committed work, whether any allocation gives it a month, and empty for others,
// worked out rather than entered, so Not staffed is a plain filter.
function staffedColumn<Rec extends Planned>(
  meaningOf: ReadonlyMap<string, Meaning | null | undefined>,
): Column<Rec, PlanChange> {
  const staffedOf = ({
    statusId,
    staffed,
  }: Pick<Planned, "statusId" | "staffed">) => {
    if (!isCommitted(meaningOf.get(statusId))) return [];
    return [staffed ? staffedChoices.yes : staffedChoices.no];
  };
  return {
    ...field<Rec>(staffedColumnKey, "Staffed", "choice", {
      readOnly: true,
      emptyLabel: "Not committed",
      choices: [
        choice(staffedChoices.yes, "Yes", false),
        choice(staffedChoices.no, "No", false),
      ],
    }),
    value: staffedOf,
    // Allocations' drafts change it, never the record's own, so its draft never names it.
    live: () => [],
    change: () => ({}),
  };
}

// The rows' groups: each month work is needed by, earliest first, then those with none.
export const byNeededBy: RowGrouping<Planned> = {
  key: "neededBy",
  label: "Needed by",
  holds: "time",
  of: ({ neededBy }) => [
    neededBy === null
      ? { key: "no-date", label: "No date", rank: rankOfNone }
      : {
          key: neededBy,
          label: formatMonth(neededBy),
          rank: Number(neededBy.replace("-", "")),
        },
  ],
};

// The words for a record with no feature team, as its empty value and as the warning in its place.
const noFeatureTeam = "No feature team";

// The columns of the planning fields features and activities share, in no order of their own: each
// table orders them as its details' groups do. A record's feature team is changed only by those who
// edit feature teams.
export function planningColumns<Rec extends Planned>(
  choices: Pick<
    TableChoices,
    | "featureStatuses"
    | "priorities"
    | "sizes"
    | "risks"
    | "featureTeams"
    | "featureTeamColours"
    | "effortConversions"
  >,
  { editsFeatureTeams = false }: { editsFeatureTeams?: boolean } = {},
): Column<Rec, PlanChange>[] {
  const meaningOf = new Map(
    choices.featureStatuses.map(({ id, meaning }) => [id, meaning]),
  );
  return [
    nameColumn<Rec>(),
    {
      ...field<Rec>("statusId", planColumnNames.statusId, "choice", {
        required: true,
        choices: choices.featureStatuses,
      }),
      newRowValue: () => firstStatus(choices.featureStatuses, "possible"),
    },
    field<Rec>("priorityId", planColumnNames.priorityId, "choice", {
      choices: choices.priorities,
    }),
    field<Rec>("sizeId", planColumnNames.sizeId, "choice", {
      choices: choices.sizes,
    }),
    field<Rec>("riskId", planColumnNames.riskId, "choice", {
      choices: choices.risks,
    }),
    field<Rec>("neededBy", planColumnNames.neededBy, "month"),
    field<Rec>("description", planColumnNames.description, "text", {
      maxLength: featureLengths.description,
    }),
    field<Rec>("note", planColumnNames.note, "note"),
    effortColumn<Rec>(choices.effortConversions),
    staffedColumn<Rec>(meaningOf),
    {
      ...field<Rec>("featureTeamId", planColumnNames.featureTeamId, "choice", {
        choices: choices.featureTeams,
        emptyLabel: noFeatureTeam,
      }),
      choiceColour: (id) => choices.featureTeamColours.get(id) ?? null,
      status: (record) =>
        needsFeatureTeam(meaningOf.get(record.statusId), record.featureTeamId)
          ? {
              words: noFeatureTeam,
              spoken: "it needs a feature team to own it",
            }
          : undefined,
      readOnlyOn: () => !editsFeatureTeams,
    },
  ];
}

// A table of planned work's columns: its own in its details' groups' order, then those added to it
// in the order the server keeps.
export function inGroupsThenAdded<Rec extends Planned>(
  builtIn: readonly Column<Rec, PlanChange>[],
  groups: readonly ColumnGroup[],
  { fields, lists, order }: AddedColumns,
): Column<Rec, PlanChange>[] {
  return [
    ...inGroupOrder(builtIn, groups),
    ...inOrder(
      drawnFields(fields).map((added) =>
        addedColumn<Rec, CellChange>(added, lists),
      ),
      order,
    ),
  ];
}

// The request a new row of planned work makes, from the changes its columns' values save.
export const plannedRequest = (changes: PlanChange[]): PlanChange => ({
  ...merged(changes),
  ...cellRequest(changes),
});
