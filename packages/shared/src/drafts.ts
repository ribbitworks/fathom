// SPDX-License-Identifier: Apache-2.0

// Drafts: changes waiting for approval, at most one for each record, as the Decisions Log sets out.
// People, lists, choices, the People table's columns, and the order of each list's choices and of
// the People table's columns have drafts, which an Approver approves or rejects, several kinds at
// once.

import { z } from "zod";

// A draft waits for approval until an Approver approves or rejects it; a rejected draft keeps its
// reason until it is changed again or discarded.
export const draftStateSchema = z.enum(["waiting", "rejected"]);

export type DraftState = z.infer<typeof draftStateSchema>;

// The most a rejection's reason holds.
export const reasonLength = 500;

// What every draft tells the user beside what it changes: whether it waits or was rejected, with the
// reason, who last changed it, of the changes the user may see, or null for Fathom itself, and when,
// both null when the history holds no such change, as for drafts written another way, and everyone
// who changed it.
export const draftShape = {
  state: draftStateSchema,
  reason: z.string().optional(),
  madeBy: z.string().nullable(),
  madeAt: z.iso.datetime({ offset: true }).nullable(),
  // Everyone who changed the draft, of the changes the user may see, first to last, null for Fathom
  // itself; several people's changes to one record make one draft.
  editors: z.array(z.string().nullable()).optional(),
  // Who last changed each field the draft changes, by the field's key, as the draft names it.
  changedBy: z.record(z.string(), z.string().nullable()).optional(),
  // True when the draft holds the user's own changes, not yet published, which only they see.
  unpublished: z.boolean().optional(),
};

// Who holds a record by having unpublished changes to it, by name, when it is someone other than the
// user: until they publish or discard them, the user sees the record as published and cannot change,
// approve, or reject it.
export const heldBySchema = z.string().optional();

export const draftActionSchema = z.enum(["created", "changed", "deleted"]);

// The most drafts approved or rejected at once, as many people as can be added at once.
export const draftsAtOnce = 1000;

const ids = (what: string) =>
  z
    .array(z.uuid())
    .max(draftsAtOnce)
    .refine(
      (given) => new Set(given).size === given.length,
      `Each ${what} once`,
    )
    .default([]);

// The drafts an Approver approves or rejects at once: of people, planned hires, lists, choices, and
// the People table's columns, of the order of lists' choices, named by their list, and of the order
// of the People table's columns.
const draftsAsked = z.object({
  people: ids("person"),
  plannedHires: ids("planned hire"),
  lists: ids("list"),
  choices: ids("choice"),
  orders: ids("list"),
  columns: ids("column"),
  columnOrder: z.boolean().default(false),
});

type Asked = z.infer<typeof draftsAsked>;

// Between one draft and as many as are approved or rejected at once.
const fewEnough = (asked: Asked) => {
  const total =
    asked.people.length +
    asked.plannedHires.length +
    asked.lists.length +
    asked.choices.length +
    asked.orders.length +
    asked.columns.length +
    (asked.columnOrder ? 1 : 0);
  return total > 0 && total <= draftsAtOnce;
};
const fewEnoughMessage = `Choose from 1 to ${String(draftsAtOnce)} drafts`;

export const draftsRequestSchema = draftsAsked.refine(
  fewEnough,
  fewEnoughMessage,
);

export type DraftsRequest = z.infer<typeof draftsRequestSchema>;

// Drafts asked for in code, naming only the kinds there are any of.
export type DraftsAsked = z.input<typeof draftsRequestSchema>;

export const rejectionRequestSchema = draftsAsked
  .extend({ reason: z.string().trim().min(1).max(reasonLength) })
  .refine(fewEnough, fewEnoughMessage);

// The user's own unpublished changes, one for each record they change, named as the Drafts page
// names drafts, such as "the list Sites" or "the new order for Sites", newest first.
export const unpublishedSchema = z.object({
  changes: z.array(
    z.object({
      subject: z.string(),
      // What the change does to the record, absent for a new order.
      action: draftActionSchema.optional(),
      // True when the change takes back the record's published draft, which publishing removes.
      discarded: z.boolean().optional(),
    }),
  ),
});

export type Unpublished = z.infer<typeof unpublishedSchema>;

// How many records' changes publishing or discarding them took.
export const unpublishedDoneSchema = z.object({ total: z.number().int() });
