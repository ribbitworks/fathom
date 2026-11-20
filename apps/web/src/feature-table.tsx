// SPDX-License-Identifier: Apache-2.0

// Features' table: its columns and the groups its rows can be put in.

import {
  type Choice,
  type EffortConversions,
  effortUnitSchema,
  enteredHours,
  exactEffort,
  largestEstimateHours,
  largestIn,
  type Feature,
  featureLengths,
  isCommitted,
  type Meaning,
  needsFeatureTeam,
  planColumnNames,
  roundedUpTo,
  shownEffort,
  startingEffortConversions,
  typedNumber,
} from "@fathom/shared";
import {
  addedColumn,
  type AddedColumns,
  cellRequest,
} from "./added-columns.ts";
import type { CellChange } from "./cell-kinds.tsx";
import { EffortCell } from "./effort-cell.tsx";
import { effortColumnUnits, hoursWords, unitLabel } from "./effort.ts";
import { decimalUpTo } from "./numbers.ts";
import { choice } from "./lists.ts";
import {
  cycleChoiceId,
  type ReleaseGroup,
  type FeatureFields,
  namersOf,
  type TableChoices,
  targetOf,
} from "./projects.ts";
import { byChoice, holdsChoices } from "./choice-grouping.ts";
import { inOrder } from "./grid-columns.tsx";
import {
  customersColumn,
  field,
  firstStatus,
  type Identified,
  merged,
  nameColumn,
  newKind,
  pickedColumn,
  type PlanChange,
  planTable,
  savedKind,
  wordsOf,
} from "./plan-table.tsx";
import type { Column, RecordTable, RowGrouping } from "./record-table.ts";
import type { ColumnUnit } from "./table-view.ts";
import { formatMonth } from "./day-formats.ts";
import { type RowGroup, rankOfNone } from "./row-groups.ts";

// A column of the projects or proposals that name a feature, which those records hold, so a change
// to it is a draft of each record added or taken away. It is set on a feature once it is added.
function namersColumn(
  key: "projectIds" | "proposalIds",
  label: string,
  records: readonly (Identified & { featureIds: readonly string[] })[],
  editable: boolean,
): Column<Feature, PlanChange> {
  return {
    ...pickedColumn<Feature>(key, label, records, (feature) =>
      namersOf(records, feature.id),
    ),
    readOnlyOn: (kind) => !editable || kind === newKind,
  };
}

const cycleOf = (target: {
  targetStreamId?: string | null | undefined;
  targetCycle?: string | null | undefined;
}): string[] =>
  typeof target.targetStreamId === "string" &&
  typeof target.targetCycle === "string"
    ? [cycleChoiceId(target.targetStreamId, target.targetCycle)]
    : [];

// Estimates are rough, so their amounts show no more than two decimal places, rounded up.
const effortPlaces = [0, 1, 2];
const effortPlacesAtFirst = 2;
// What floating point leaves of an amount that was not rounded, far below any place shown.
const roundingLeft = 1e-9;

const labelled = (
  unit: (typeof effortColumnUnits)[number],
  conversions: EffortConversions,
) => ({ ...unit, label: unitLabel(unit, conversions) });

// A feature's estimate, kept in hours and shown in the unit the view names, in which it is typed.
// Without the conversions, as for a draft's details, it is offered in hours alone, which need none.
function effortColumn(
  conversions: EffortConversions | undefined,
): Column<Feature, PlanChange> {
  const [hours, ...others] = effortColumnUnits;
  const converting = conversions ?? startingEffortConversions;
  const shownIn = (
    unit: ColumnUnit,
    places: number,
  ): Column<Feature, PlanChange> => {
    const effortUnit = effortUnitSchema.catch(hours.key).parse(unit.key);
    const amountOf = (estimate: number) =>
      shownEffort(estimate, effortUnit, converting);
    const inUnit = (estimate: unknown) =>
      typeof estimate === "number" ? String(amountOf(estimate)) : "";
    return {
      ...field<Feature>(
        "estimateHours",
        planColumnNames.estimateHours,
        "number",
      ),
      unit,
      least: 0,
      most: largestIn(largestEstimateHours, effortUnit, converting),
      value: (feature) => inUnit(feature.estimateHours),
      live: (draft) => inUnit((draft.live as Partial<Feature>).estimateHours),
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
    // Breaking down by effort counts only whether features have an estimate, which says little.
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

export const releaseColumnKey = "release";

// The release a feature's target cycle is in, or that cycle's stream when it is in none, worked out
// rather than entered, and empty in Later.
function releaseColumn(
  releaseOfCycle: ReadonlyMap<string, ReleaseGroup>,
): Column<Feature, PlanChange> {
  const groups = new Map(
    [...releaseOfCycle.values()].map((group) => [group.key, group]),
  );
  const releaseOf = (target: Partial<Feature>) =>
    cycleOf(target).flatMap((cycle) => {
      const group = releaseOfCycle.get(cycle);
      return group === undefined ? [] : [group.key];
    });
  return {
    ...field<Feature>(releaseColumnKey, "Release", "choice", {
      readOnly: true,
      emptyLabel: "Later",
      choices: [...groups.values()]
        .sort((a, b) => a.rank - b.rank)
        .map(({ key, name }) => choice(key, name, false)),
    }),
    value: releaseOf,
    live: (draft) => releaseOf(draft.live),
    change: () => ({}),
  };
}

export const staffedColumnKey = "staffed";

export const staffedChoices = { yes: "yes", no: "no" } as const;

// Yes or No for a committed feature, whether any allocation gives it a month, and empty for others,
// worked out rather than entered, so Not staffed is a plain filter.
function staffedColumn(
  meaningOf: ReadonlyMap<string, Meaning | null | undefined>,
): Column<Feature, PlanChange> {
  const staffedOf = ({
    statusId,
    staffed,
  }: Pick<Feature, "statusId" | "staffed">) => {
    if (!isCommitted(meaningOf.get(statusId))) return [];
    return [staffed ? staffedChoices.yes : staffedChoices.no];
  };
  return {
    ...field<Feature>(staffedColumnKey, "Staffed", "choice", {
      readOnly: true,
      emptyLabel: "Not committed",
      choices: [
        choice(staffedChoices.yes, "Yes", false),
        choice(staffedChoices.no, "No", false),
      ],
    }),
    value: staffedOf,
    // Allocations' drafts change it, never the feature's own, so its draft never names it.
    live: () => [],
    change: () => ({}),
  };
}

// A feature's built-in columns in the headed groups its details show them in, in order: the order
// the table starts its columns in too, so the two read alike.
export const featureColumnGroups: readonly {
  title: string;
  keys: readonly string[];
}[] = [
  { title: "Details", keys: ["name", "statusId", "description", "note"] },
  {
    title: "Customers and commitments",
    keys: ["customerIds", "projectIds", "proposalIds"],
  },
  {
    title: "Planning",
    keys: [
      "priorityId",
      "neededBy",
      "estimateHours",
      "sizeId",
      "riskId",
      releaseColumnKey,
      "targetCycle",
      "featureTeamId",
      staffedColumnKey,
    ],
  },
];

// The title of the group of columns an organization added, after the others, as on a person.
export const addedColumnsTitle = "Columns";

const featureColumnOrder = featureColumnGroups.flatMap(({ keys }) => keys);

export function featureColumns(
  choices: TableChoices,
  {
    shown: { fields, lists, order } = choices.featureColumns,
    editsNamers = false,
  }: {
    shown?: AddedColumns;
    // Whether the projects and proposals that name a feature can be changed here.
    editsNamers?: boolean;
  } = {},
): Column<Feature, PlanChange>[] {
  const meaningOf = new Map(
    choices.featureStatuses.map(({ id, meaning }) => [id, meaning]),
  );
  const builtIn: Column<Feature, PlanChange>[] = [
    nameColumn<Feature>(),
    {
      ...field<Feature>("statusId", planColumnNames.statusId, "choice", {
        required: true,
        choices: choices.featureStatuses,
      }),
      newRowValue: () => firstStatus(choices.featureStatuses, "possible"),
    },
    field<Feature>("priorityId", planColumnNames.priorityId, "choice", {
      choices: choices.priorities,
    }),
    field<Feature>("sizeId", planColumnNames.sizeId, "choice", {
      choices: choices.sizes,
    }),
    field<Feature>("riskId", planColumnNames.riskId, "choice", {
      choices: choices.risks,
    }),
    field<Feature>("neededBy", planColumnNames.neededBy, "month"),
    customersColumn<Feature>(choices.customers),
    namersColumn(
      "projectIds",
      planColumnNames.projectIds,
      choices.projects,
      editsNamers,
    ),
    namersColumn(
      "proposalIds",
      planColumnNames.proposalIds,
      choices.proposals,
      editsNamers,
    ),
    field<Feature>("description", planColumnNames.description, "text", {
      maxLength: featureLengths.description,
    }),
    field<Feature>("note", planColumnNames.note, "note"),
    {
      ...field<Feature>("targetCycle", planColumnNames.targetCycle, "choice", {
        choices: choices.cycles,
        emptyLabel: "Later",
      }),
      value: cycleOf,
      live: (draft) => cycleOf(draft.live as Partial<Feature>),
      change: (value) => targetOf((value as string[]).at(0)),
    },
    releaseColumn(choices.releaseOfCycle),
    effortColumn(choices.effortConversions),
    staffedColumn(meaningOf),
    {
      ...field<Feature>(
        "featureTeamId",
        planColumnNames.featureTeamId,
        "choice",
        {
          choices: choices.featureTeams,
          emptyLabel: "No feature team",
        },
      ),
      status: (feature) =>
        needsFeatureTeam(meaningOf.get(feature.statusId), feature.featureTeamId)
          ? { words: "No team", spoken: "it needs a feature team to own it" }
          : undefined,
    },
  ];
  const inGroups = [...builtIn].sort(
    (a, b) =>
      featureColumnOrder.indexOf(a.key) - featureColumnOrder.indexOf(b.key),
  );
  // The built-in columns follow the details' groups; the server's order places the added ones.
  return [
    ...inGroups,
    ...inOrder(
      // A value can be given only in a column already approved.
      fields.map((added) => ({
        ...addedColumn<Feature, CellChange>(added, lists),
        readOnly: added.draft?.action === "created",
      })),
      order,
    ),
  ];
}

// After every group, for the features that target no cycle, or one no longer offered.
const later: RowGroup = {
  key: "later",
  label: "Later",
  rank: rankOfNone,
};

// The rows' groups by the cycle each feature targets, then Later.
const byTarget = (
  key: string,
  label: string,
  groupOfCycle: ReadonlyMap<string, RowGroup>,
): RowGrouping<Feature> => ({
  key,
  label,
  holds: "time",
  of: (feature) => {
    const [cycle = ""] = cycleOf(feature);
    return [groupOfCycle.get(cycle) ?? later];
  },
});

// Each cycle in the choices' order.
const byCycle = (cycles: readonly Choice[]) =>
  byTarget(
    "targetCycle",
    "Cycle",
    new Map(
      cycles.map(({ id, label }, rank) => [id, { key: id, label, rank }]),
    ),
  );

// The rows' groups: each month a feature is needed by, earliest first, then those with none.
const byNeededBy: RowGrouping<Feature> = {
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

// The columns whose choices the rows can be grouped by, a feature under each it holds, apart from
// the target cycle and its release, grouped by their own.
// The grouped columns whose choices are listed by name, as the server sends them.
const groupedByName = new Set([
  "featureTeamId",
  "customerIds",
  "projectIds",
  "proposalIds",
]);

const groupedByChoice = (column: Column<Feature, PlanChange>) =>
  holdsChoices(column) &&
  column.key !== "targetCycle" &&
  column.key !== releaseColumnKey;

// Features' table, or, for the board, whose columns are cycles, its rows grouped by anything else.
export function featureTable(
  choices: TableChoices,
  {
    onOpen,
    editsNamers = false,
    board = false,
  }: {
    onOpen?: (feature: Feature) => void;
    // Whether the projects and proposals that name a feature can be changed here.
    editsNamers?: boolean;
    // Whether the rows are a board's, whose columns are cycles.
    board?: boolean;
  } = {},
): RecordTable<Feature, PlanChange, FeatureFields> {
  const byListed = featureColumns(choices)
    .filter(groupedByChoice)
    .map((column) =>
      byChoice(column, groupedByName.has(column.key) ? { holds: "names" } : {}),
    );
  return planTable<Feature, FeatureFields>({
    type: "feature",
    ...wordsOf("features"),
    kinds: [newKind, savedKind],
    columns: (shown) => featureColumns(choices, { shown, editsNamers }),
    groupings: [
      ...(board ? [] : [byCycle(choices.cycles)]),
      byTarget("release", "Release", choices.releaseOfCycle),
      byNeededBy,
      ...byListed,
    ],
    request: (changes) => {
      const request: PlanChange = {
        ...merged(changes),
        ...cellRequest(changes),
      };
      return request as FeatureFields;
    },
    showDetails: onOpen,
  });
}
