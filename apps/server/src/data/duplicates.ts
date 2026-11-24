// SPDX-License-Identifier: Apache-2.0

// Duplicating a feature or an activity as a draft adding its copy. Part of the data access layer;
// the caller checks the actor may add the copy's kind.

import { type Database, fieldOfValue } from "@fathom/db";
import {
  type ActivityDuplicateRequest,
  activityOwnerFields,
  activityPlace,
  activityRequestSchema,
  activityTypeList,
  activityTypes,
  copyName,
  copyOf,
  type Duplicated,
  type FeatureRequest,
  featureRequestSchema,
  type RecordType,
} from "@fathom/shared";
import { randomUUID } from "node:crypto";
import type { Actor } from "../access.ts";
import { NotFoundError } from "../errors.ts";
import { activityRecord } from "./activity-records.ts";
import type { Transaction } from "./changes.ts";
import type { Recorded } from "./draft-records.ts";
import { featureRecord } from "./projects.ts";
import {
  readsKind,
  type RecordsState,
  shownVersion,
  valueTaken,
} from "./record-state.ts";
import { drafting, saveRecordDraft } from "./record-drafting.ts";
import { kindOf } from "./records.ts";
import { readColumns } from "./values.ts";

// A copy's name, counting on while the kind's own rule finds it taken, as by another record of the
// same project or release.
const nameFor = (
  state: RecordsState,
  type: RecordType,
  copy: string,
  record: Recorded,
) =>
  copyName(String(record.name), (name) =>
    valueTaken(kindOf(type), state, { ...record, name }, copy),
  );

// A feature's values in the columns added to Features, as a request adding it names them, so they
// are checked as any new feature's are.
async function addedAsRequested(
  transaction: Transaction,
  feature: Recorded,
): Promise<Pick<FeatureRequest, "values" | "links" | "notes" | "numbers">> {
  const columns = await readColumns(transaction, true, "features");
  const requested = {
    values: {} as Record<string, unknown>,
    links: {} as Record<string, unknown>,
    notes: {} as Record<string, unknown>,
    numbers: {} as Record<string, unknown>,
  };
  const into = {
    choice: requested.values,
    link: requested.links,
    note: requested.notes,
    number: requested.numbers,
  } as const;
  for (const [field, value] of Object.entries(feature)) {
    const column = columns.find(({ id }) => id === fieldOfValue(field));
    if (column === undefined) continue;
    // A column's type is one of the fixed column types, which the server checks as it is kept.
    const held = into[column.type as keyof typeof into];
    held[column.id] = value;
  }
  return featureRequestSchema
    .pick({ values: true, links: true, notes: true, numbers: true })
    .parse(requested);
}

// Drafts a copy of a feature, as adding a feature would, with what describes its work: in a status a
// new feature starts in, with no target cycle, customers, projects or proposals. A choice it holds
// that is no longer offered is refused, as adding refuses one.
export async function duplicateFeature(
  database: Database,
  maker: Actor,
  id: string,
): Promise<Duplicated> {
  const copy = randomUUID();
  const changeSetId = await drafting(
    database,
    maker.user.id,
    async (transaction, state) => {
      const original = shownVersion(state, "feature", id);
      if (original === undefined) {
        throw new NotFoundError("There is no such feature");
      }
      const request = featureRequestSchema.parse({
        ...copyOf("feature", original),
        ...(await addedAsRequested(transaction, original)),
        name: nameFor(state, "feature", copy, original),
      });
      return saveRecordDraft(
        transaction,
        maker,
        state,
        "feature",
        copy,
        await featureRecord(transaction, request),
      );
    },
  );
  return { id: copy, changeSetId };
}

// Drafts a copy of an activity into the project or release asked for, refusing one the actor may not
// read.
export async function duplicateActivity(
  database: Database,
  maker: Actor,
  id: string,
  into: ActivityDuplicateRequest,
): Promise<Duplicated> {
  const copy = randomUUID();
  const { owner, ownerId } = activityPlace(into);
  // The owner is always one of the two fixed ones.
  // eslint-disable-next-line security/detect-object-injection
  const type = activityTypes[owner];
  const changeSetId = await drafting(
    database,
    maker.user.id,
    async (transaction, state) => {
      const original = activityTypeList
        .filter((kind) => readsKind(kindOf(kind), maker.permissions))
        .map((kind) => shownVersion(state, kind, id))
        .find((version) => version !== undefined);
      if (original === undefined) {
        throw new NotFoundError("There is no such activity");
      }
      const placed = {
        ...original,
        // eslint-disable-next-line security/detect-object-injection
        [activityOwnerFields[owner]]: ownerId,
      };
      const request = activityRequestSchema.parse({
        ...copyOf("activity", original),
        name: nameFor(state, type, copy, placed),
      });
      return saveRecordDraft(
        transaction,
        maker,
        state,
        type,
        copy,
        activityRecord(owner, ownerId, request),
      );
    },
  );
  return { id: copy, changeSetId };
}
