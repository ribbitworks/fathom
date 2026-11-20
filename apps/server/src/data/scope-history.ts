// SPDX-License-Identifier: Apache-2.0

// A project's or proposal's scope history: the features it was given and those removed from it, as
// approved, each dated when it was drafted, newest first, read from the change history, with the
// reason given for removing a feature from a proposal. Part of the data access layer; the caller
// checks the actor's permissions.

import { changes, changeSets, type Database } from "@fathom/db";
import {
  removalReasonsIn,
  type ScopeChange,
  type ScopeHistory,
} from "@fathom/shared";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { strings } from "./history-names.ts";

const reasonIn = (value: unknown, id: string): string | null =>
  new Map(Object.entries(removalReasonsIn(value))).get(id) ?? null;

export async function readScopeHistory(
  database: Database,
  type: "project" | "proposal",
  recordId: string,
): Promise<ScopeHistory> {
  const rows = await database
    .select({
      changeSetId: changes.changeSetId,
      field: changes.field,
      oldValue: changes.oldValue,
      newValue: changes.newValue,
      madeAt: changeSets.madeAt,
    })
    .from(changes)
    .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
    .where(
      and(
        eq(changes.draft, false),
        eq(changeSets.unpublished, false),
        eq(changes.recordType, type),
        eq(changes.recordId, recordId),
        inArray(changes.field, ["featureIds", "removalReasons"]),
      ),
    )
    .orderBy(desc(changeSets.madeAt), desc(changes.id));
  // The changes to the record's drafts of its features, published, oldest first, so each approved
  // change is dated when it was drafted.
  const drafted = await database
    .select({
      oldValue: changes.oldValue,
      newValue: changes.newValue,
      madeAt: changeSets.madeAt,
    })
    .from(changes)
    .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
    .where(
      and(
        eq(changes.draft, true),
        eq(changeSets.unpublished, false),
        eq(changes.recordType, type),
        eq(changes.recordId, recordId),
        eq(changes.field, "featureIds"),
      ),
    )
    .orderBy(changeSets.madeAt, changes.id);
  // When a feature's addition or removal approved at the time given was last drafted, or that time
  // for a change saved without a draft, such as the seed's.
  const draftedAt = (featureId: string, added: boolean, approved: Date) =>
    (
      drafted.findLast(
        ({ oldValue, newValue, madeAt }) =>
          madeAt <= approved &&
          strings(newValue).includes(featureId) === added &&
          strings(oldValue).includes(featureId) !== added,
      )?.madeAt ?? approved
    ).toISOString();
  const reasonsOf = new Map(
    rows
      .filter(({ field }) => field === "removalReasons")
      .map(({ changeSetId, newValue }) => [changeSetId, newValue]),
  );
  const scoped = rows
    .filter(({ field }) => field === "featureIds")
    .flatMap((row) => {
      const before = strings(row.oldValue);
      const after = strings(row.newValue);
      return [
        ...after
          .filter((id) => !before.includes(id))
          .map((featureId) => ({
            featureId,
            added: true,
            at: draftedAt(featureId, true, row.madeAt),
            reason: null,
          })),
        ...before
          .filter((id) => !after.includes(id))
          .map((featureId) => ({
            featureId,
            added: false,
            at: draftedAt(featureId, false, row.madeAt),
            reason: reasonIn(reasonsOf.get(row.changeSetId), featureId),
          })),
      ];
    })
    .sort((a, b) => b.at.localeCompare(a.at));
  if (scoped.length === 0) return { changes: [] };
  const names = await database
    .selectDistinctOn([changes.recordId], {
      recordId: changes.recordId,
      name: changes.newValue,
    })
    .from(changes)
    .where(
      and(
        eq(changes.draft, false),
        eq(changes.recordType, "feature"),
        eq(changes.field, "name"),
        inArray(changes.recordId, [
          ...new Set(scoped.map(({ featureId }) => featureId)),
        ]),
        isNotNull(changes.newValue),
      ),
    )
    .orderBy(changes.recordId, desc(changes.id));
  const nameOf = new Map(
    names.map(({ recordId: id, name }) => [id, String(name)]),
  );
  return {
    changes: scoped.map((change): ScopeChange => ({
      ...change,
      name: nameOf.get(change.featureId) ?? null,
    })),
  };
}
