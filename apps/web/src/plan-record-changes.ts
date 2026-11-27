// SPDX-License-Identifier: Apache-2.0

// The plan as the Projects, Features and Activities pages show it while a change to its records is
// saved.

import type { FeatureColumns, ProjectPlan } from "@fathom/shared";
import { withCellChange } from "./added-columns.ts";
import type { CellChange } from "./cell-kinds.tsx";
import { pendingDraft, unsavedKeyNumber } from "./drafts.ts";
import { livePlanRecords, type PlanChange } from "./plan-table.tsx";
import {
  isPlanned,
  namersIn,
  type PlanRecord,
  type PlanRecordKind,
  withNamers,
} from "./projects.ts";
import { operationsOf } from "./plan-record-operations.ts";

// The plan with the columns of one of its tables of planned work changed.
const withPlannedColumns =
  (key: "featureColumns" | "activityColumns") =>
  (
    plan: ProjectPlan,
    change: (columns: FeatureColumns) => Partial<FeatureColumns>,
  ): ProjectPlan => ({
    ...plan,
    // The key is always one of the two fixed ones.
    // eslint-disable-next-line security/detect-object-injection
    [key]: { ...plan[key], ...change(plan[key]) },
  });

export const withFeatureColumns = withPlannedColumns("featureColumns");
export const withActivityColumns = withPlannedColumns("activityColumns");

// A record being added, as the table shows it before it is saved: a draft adding it.
export function adding(
  kind: PlanRecordKind,
  id: string,
  request: CellChange,
): PlanRecord {
  const blank = operationsOf(kind).blank;
  return {
    ...blank,
    ...request,
    ...("values" in blank ? withCellChange(blank, request) : {}),
    id,
    keyNumber: unsavedKeyNumber,
    draft: { ...pendingDraft("created", {}), uses: [] },
  };
}

// The plan with a record of a kind changed, or taken out when the change gives none.
export function withRecord(
  plan: ProjectPlan,
  kind: PlanRecordKind,
  id: string,
  change: (record: PlanRecord) => PlanRecord | undefined,
): ProjectPlan {
  const { all, withAll } = operationsOf(kind);
  return withAll(
    plan,
    all(plan).flatMap((record) => {
      if (record.id !== id) return [record];
      const next = change(record);
      return next === undefined ? [] : [next];
    }),
  );
}

export function withAdded(
  plan: ProjectPlan,
  kind: PlanRecordKind,
  added: readonly PlanRecord[],
): ProjectPlan {
  const { all, withAll } = operationsOf(kind);
  return withAll(plan, [...all(plan), ...added]);
}

// A record with a change applied, as the table shows it before it is saved.
const withChange = (record: PlanRecord, change: PlanChange): PlanRecord => ({
  ...record,
  ...change,
  ...(isPlanned(record) ? withCellChange(record, change) : {}),
});

// The plan with a change to a record applied, as the table shows it before it is saved: the
// projects and proposals that name a feature hold it, rather than the feature.
export function withRecordChange(
  plan: ProjectPlan,
  type: PlanRecordKind,
  id: string,
  change: PlanChange,
): ProjectPlan {
  const { namers, own } = namersIn(change);
  return withNamers(
    withRecord(plan, type, id, (shown) => withChange(shown, own)),
    id,
    namers,
  );
}

export const removing = (record: PlanRecord): PlanRecord => ({
  ...record,
  draft: { ...pendingDraft("deleted", {}), uses: [] },
});

export const discarded = (record: PlanRecord): PlanRecord | undefined =>
  record.draft?.action === "created"
    ? undefined
    : livePlanRecords([record]).at(0);
