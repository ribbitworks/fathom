// SPDX-License-Identifier: Apache-2.0

// Planned hires, drafted through the server's API from the People table, where each is a row: its
// name is its preferred name, its ID its requisition, cleared to give it a temporary ID, and its
// start date its target date; its manager may be a person or a planned manager, and its values in
// the added columns are kept as a person's are. Each change returns the change set it was saved
// in, which undoing it names, or null when nothing changed.

import {
  changeSetIdSchema,
  type HireChange,
  type HireRequest,
  savedSchema,
} from "@fathom/shared";
import { z } from "zod";
import { sendDeleteFor, sendJsonFor } from "./api.ts";
import type { RowChange, RowRequest } from "./people-rows.ts";

const hirePath = (id: string) => `/api/planned-hires/${encodeURIComponent(id)}`;

// A requisition from the ID column: none when it is cleared, so the hire is given a temporary ID.
const requisitionOf = (id: string) => (id.trim() === "" ? null : id);

// A name from the Name column: none when it is empty.
const nameOf = (name: string) => (name.trim() === "" ? null : name);

// The request that adds a hire, from a new row of the People table.
export function hireRequest(row: RowRequest): HireRequest {
  return {
    name: nameOf(row.preferredName),
    requisition: requisitionOf(row.employeeId),
    positionId: row.positionId,
    targetDate: row.startDate ?? null,
    managerId: row.managerId ?? null,
    isManager: row.isManager ?? false,
    ...(row.stateId === undefined ? {} : { stateId: row.stateId }),
    values: row.values,
    links: row.links,
    ...(row.notes === undefined ? {} : { notes: row.notes }),
  };
}

// The change to a hire that a change to its row makes.
export function hireChange(change: RowChange): HireChange {
  return {
    ...(change.preferredName === undefined
      ? {}
      : { name: nameOf(change.preferredName) }),
    ...(change.employeeId === undefined
      ? {}
      : { requisition: requisitionOf(change.employeeId) }),
    ...(change.positionId === undefined
      ? {}
      : { positionId: change.positionId }),
    ...(change.startDate === undefined ? {} : { targetDate: change.startDate }),
    ...(change.stateId === undefined ? {} : { stateId: change.stateId }),
    ...(change.managerId === undefined ? {} : { managerId: change.managerId }),
    ...(change.isManager === undefined ? {} : { isManager: change.isManager }),
    ...(change.values === undefined ? {} : { values: change.values }),
    ...(change.links === undefined ? {} : { links: change.links }),
    ...(change.notes === undefined ? {} : { notes: change.notes }),
  };
}

// Adds hires together, as one change, returning their identifiers in the order asked.
export async function createHires(
  requests: HireRequest[],
): Promise<{ ids: string[]; changeSetId: string | null }> {
  return sendJsonFor(
    "POST",
    "/api/planned-hires",
    { hires: requests },
    z.object({ ids: z.array(z.string()), changeSetId: changeSetIdSchema }),
  );
}

export async function updateHire(
  id: string,
  change: HireChange,
): Promise<string | null> {
  return (await sendJsonFor("PATCH", hirePath(id), change, savedSchema))
    .changeSetId;
}

// Drafts removing a hire, or discards the draft of one only drafted to be added.
export async function deleteHire(id: string): Promise<string | null> {
  return (await sendDeleteFor(hirePath(id), savedSchema)).changeSetId;
}

export async function discardHireDraft(id: string): Promise<string | null> {
  return (await sendDeleteFor(`${hirePath(id)}/draft`, savedSchema))
    .changeSetId;
}

// Sends a rejected draft for approval again, unchanged.
export async function resubmitHireDraft(id: string): Promise<string | null> {
  return (await sendDeleteFor(`${hirePath(id)}/draft/rejection`, savedSchema))
    .changeSetId;
}
