// SPDX-License-Identifier: Apache-2.0

// Which kinds of draft a role may change. Part of the data access layer.

import {
  type ClassifiedView,
  columnTableOf,
  type DraftKind,
  editsColumnsOf,
  type Permission,
  type RecordType,
  seesView,
} from "@fathom/shared";
import { type Actor, holdsAnyPermission, requireView } from "../access.ts";
import { ForbiddenError } from "../errors.ts";
import { changesTeams } from "./feature-teams.ts";
import { editsHires } from "./hire-checks.ts";
import type { Recorded } from "./draft-records.ts";
import { isRecordType, kindOf } from "./records.ts";
import { readsKind } from "./record-state.ts";

// Who may change each kind of the plan's records, any one of the permissions sufficing. Schedules
// and their cycles are part of the plan, and planning configuration too.
const recordEditors: Record<RecordType, readonly Permission[]> = {
  "release-stream": ["plan:edit", "configuration:edit"],
  "cycle-pattern": ["plan:edit", "configuration:edit"],
  release: ["features:edit"],
  feature: ["features:edit"],
  customer: ["plan:edit"],
  proposal: ["plan:edit"],
  project: ["plan:edit"],
  milestone: ["plan:edit"],
  allocation: ["allocations:edit"],
  "planning-settings": ["configuration:edit"],
};

// The kinds of the plan's records whose changes show classified data, which their editor must see.
const recordViews: Partial<Record<RecordType, ClassifiedView>> = {
  allocation: "allocations",
};

// Whether the actor holds an editor's permission for a kind, and reads it, since some, such as
// editing the plan, change kinds they do not grant seeing.
const holdsEditor = (actor: Actor, type: RecordType): boolean =>
  // The kind is always one of the fixed kinds listed above.
  // eslint-disable-next-line security/detect-object-injection
  holdsAnyPermission(actor, recordEditors[type]) &&
  readsKind(kindOf(type), actor.permissions);

export const editsKind = (actor: Actor, type: RecordType): boolean => {
  // The kind is always one of the fixed kinds listed above.
  // eslint-disable-next-line security/detect-object-injection
  const view = recordViews[type];
  return (
    holdsEditor(actor, type) && (view === undefined || seesView(view, actor))
  );
};

// Refuses an actor who may not change a kind, saying which data it can't see where that is why.
export function recordEditor(actor: Actor, type: RecordType): Actor {
  if (!holdsEditor(actor, type)) throw new ForbiddenError();
  // The kind is always one of the fixed kinds listed above.
  // eslint-disable-next-line security/detect-object-injection
  const view = recordViews[type];
  if (view !== undefined) requireView(actor, view);
  return actor;
}

const changesConfiguration = (actor: Actor): boolean =>
  actor.permissions.includes("configuration:edit");

// Who may change each kind of draft kept outside the plan's records, but a column's, whose table
// decides. Every kind must be listed, which the compiler checks.
const otherEditors: Record<
  Exclude<DraftKind, RecordType | "field">,
  (actor: Actor) => boolean
> = {
  person: (actor) => actor.permissions.includes("people:edit"),
  "planned-hire": editsHires,
  "feature-team": changesTeams,
  list: changesConfiguration,
  "list-item": changesConfiguration,
  "choice-order": changesConfiguration,
};

const otherEditorOf = new Map<string, (actor: Actor) => boolean>(
  Object.entries(otherEditors),
);

// Whether the actor may change a draft of a kind: of a column, those who set up the table the
// column is on, so none when the column is unknown; of a kind Fathom no longer has, none.
export const editsDraft = (
  actor: Actor,
  kind: string,
  column?: Recorded,
): boolean => {
  if (kind === "field") {
    return (
      column !== undefined &&
      editsColumnsOf(actor.permissions, columnTableOf(column.tableName))
    );
  }
  return isRecordType(kind)
    ? editsKind(actor, kind)
    : (otherEditorOf.get(kind)?.(actor) ?? false);
};
