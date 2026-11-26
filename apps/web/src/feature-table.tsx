// SPDX-License-Identifier: Apache-2.0

// Features' table: its columns and the groups its rows can be put in.

import {
  type Choice,
  type Feature,
  featureKeptBy,
  planColumnNames,
  type Project,
  type Proposal,
} from "@fathom/shared";
import { type AddedColumns } from "./added-columns.ts";
import { choice } from "./lists.ts";
import {
  cycleChoiceId,
  type ReleaseGroup,
  type TableChoices,
  targetOf,
} from "./projects.ts";
import { type FeatureFields } from "./plan-record-operations.ts";
import { byChoice, holdsChoices } from "./choice-grouping.ts";
import {
  customersColumn,
  field,
  namersColumn,
  newKind,
  type PlanChange,
  planTable,
  removeTurnedOffBy,
  savedKind,
  wordsOf,
} from "./plan-table.tsx";
import {
  type Column,
  type ColumnGroup,
  type RecordTable,
  type RowGrouping,
} from "./record-table.ts";
import { type RowGroup, rankOfNone } from "./row-groups.ts";
import {
  byNeededBy,
  inGroupsThenAdded,
  plannedRequest,
  planningColumns,
  staffedColumnKey,
} from "./planning-columns.tsx";

// A column of the projects or proposals that name a feature. It is set on a feature once it is added.
function featureNamersColumn(
  key: "projectIds" | "proposalIds",
  label: string,
  records: readonly (Project | Proposal)[],
  drafted: readonly (Project | Proposal)[],
  editable: boolean,
): Column<Feature, PlanChange> {
  return {
    ...namersColumn<Feature>(key, label, records, drafted, "featureIds"),
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
    choiceColour: (key) => groups.get(key)?.colour ?? null,
    value: releaseOf,
    live: (draft) => releaseOf(draft.live),
    change: () => ({}),
  };
}

// A feature's built-in columns in the headed groups its details show them in, in order: the order
// the table starts its columns in too, so the two read alike.
export const featureColumnGroups: readonly ColumnGroup[] = [
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

// The fields of a feature that another kind's editors decide, and whether they can be changed here.
export interface FeatureEdits {
  // A feature's customers, and the projects and proposals that name it: by those who edit the plan.
  editsCommitments?: boolean;
  // A feature's feature team: by those who edit feature teams.
  editsFeatureTeams?: boolean;
}

export function featureColumns(
  choices: TableChoices,
  {
    shown: { fields, lists, order } = choices.featureColumns,
    editsCommitments = false,
    editsFeatureTeams = false,
  }: { shown?: AddedColumns } & FeatureEdits = {},
): Column<Feature, PlanChange>[] {
  const builtIn: Column<Feature, PlanChange>[] = [
    ...planningColumns<Feature>(choices, { editsFeatureTeams }),
    {
      ...customersColumn<Feature>(choices.customers, choices.drafted.features),
      readOnlyOn: () => !editsCommitments,
    },
    featureNamersColumn(
      "projectIds",
      planColumnNames.projectIds,
      choices.projects,
      choices.drafted.projects,
      editsCommitments,
    ),
    featureNamersColumn(
      "proposalIds",
      planColumnNames.proposalIds,
      choices.proposals,
      choices.drafted.proposals,
      editsCommitments,
    ),
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
  ];
  return inGroupsThenAdded(builtIn, featureColumnGroups, {
    fields,
    lists,
    order,
  });
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

// Why a feature with allocations can't be removed. Being staffed, an allocation giving it a month,
// stands for having allocations, which the plan doesn't send.
export const allocatedFeatureWords =
  "This feature has allocations, so cancel it instead.";

// Features' table, or, for the board, whose columns are cycles, its rows grouped by anything else.
export function featureTable(
  choices: TableChoices,
  {
    onOpen,
    board = false,
    ...edits
  }: {
    onOpen?: (feature: Feature) => void;
    // Whether the rows are a board's, whose columns are cycles.
    board?: boolean;
  } & FeatureEdits = {},
): RecordTable<Feature, PlanChange, FeatureFields> {
  const byListed = featureColumns(choices, edits)
    .filter(groupedByChoice)
    .map((column) =>
      byChoice(column, groupedByName.has(column.key) ? { holds: "names" } : {}),
    );
  return planTable<Feature, FeatureFields>({
    type: "feature",
    ...wordsOf("features"),
    kinds: [newKind, savedKind],
    columns: (shown) => featureColumns(choices, { shown, ...edits }),
    groupings: [
      ...(board ? [] : [byCycle(choices.cycles)]),
      byTarget("release", "Release", choices.releaseOfCycle),
      byNeededBy,
      ...byListed,
    ],
    request: (changes) => plannedRequest(changes) as FeatureFields,
    showDetails: onOpen,
    // Allocations keep a feature first, as the server checks them first.
    removeTurnedOff: (feature) =>
      feature.staffed
        ? allocatedFeatureWords
        : removeTurnedOffBy(featureKeptBy(choices, feature.id), "feature"),
  });
}
