// SPDX-License-Identifier: Apache-2.0

// Duplicating a feature or an activity: the fields each copy keeps, the copy's name, and where an
// activity's copy goes.

import { z } from "zod";
import type { ActivityOwner } from "./activities.ts";
import { changeSetIdSchema } from "./people.ts";
import { recordNameLength } from "./record-fields.ts";

export type DuplicatedKind = "feature" | "activity";

// The fields each kind's copy keeps from its original, beside its name. A feature keeps what
// describes the work, not where it is committed, such as its target cycle, customers, projects and
// proposals, nor its status, in which a copy starts as any new feature does; an activity keeps
// everything but its allocations. A kind added later fails to compile until described.
export const copiedFields = {
  feature: [
    "description",
    "note",
    "priorityId",
    "sizeId",
    "riskId",
    "neededBy",
    "estimateHours",
    "featureTeamId",
  ],
  activity: ["description", "note", "estimateHours"],
} as const satisfies Record<DuplicatedKind, readonly string[]>;

// The fields a copy keeps from its original, of those its kind copies.
export function copyOf(
  kind: DuplicatedKind,
  record: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  // The kind is always one of the fixed kinds.
  // eslint-disable-next-line security/detect-object-injection
  const fields: readonly string[] = copiedFields[kind];
  return Object.fromEntries(
    // The field is one of the kind's own, named above.
    // eslint-disable-next-line security/detect-object-injection
    fields.map((field) => [field, record[field] ?? null]),
  );
}

// A copy's name: the original's with " (copy)" after it, or " (copy 2)" and on where its kind's
// rule finds that taken. The original is cut short, never within a character, so the name fits.
export function copyName(
  name: string,
  isTaken: (named: string) => boolean,
): string {
  const characters = Array.from(name.trim());
  for (let count = 1; ; count += 1) {
    const mark = count === 1 ? " (copy)" : ` (copy ${String(count)})`;
    const room = recordNameLength - Array.from(mark).length;
    const named = `${characters.slice(0, room).join("").trimEnd()}${mark}`;
    if (!isTaken(named)) return named;
  }
}

export const activityDuplicateRequestSchema = z.union([
  z.object({ projectId: z.uuid() }).strict(),
  z.object({ releaseId: z.uuid() }).strict(),
]);

export type ActivityDuplicateRequest = z.infer<
  typeof activityDuplicateRequestSchema
>;

// The project or release an activity's copy goes to.
export const activityPlace = (
  into: ActivityDuplicateRequest,
): { owner: ActivityOwner; ownerId: string } =>
  "projectId" in into
    ? { owner: "project", ownerId: into.projectId }
    : { owner: "release", ownerId: into.releaseId };

export const duplicatedSchema = z.object({
  id: z.string(),
  changeSetId: changeSetIdSchema,
});

export type Duplicated = z.infer<typeof duplicatedSchema>;
