// SPDX-License-Identifier: Apache-2.0

// Drafts: changes waiting for approval, at most one for each record, as the Decisions Log sets out.
// People, lists, choices, and the order of each list's choices have drafts, which an Approver
// approves or rejects, several kinds at once.

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
};

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

// The drafts an Approver approves or rejects at once: of people, lists, and choices, and of the
// order of lists' choices, named by their list.
const draftsAsked = z.object({
  people: ids("person"),
  lists: ids("list"),
  choices: ids("choice"),
  orders: ids("list"),
});

type Asked = z.infer<typeof draftsAsked>;

// Between one draft and as many as are approved or rejected at once.
const fewEnough = (asked: Asked) => {
  const total =
    asked.people.length +
    asked.lists.length +
    asked.choices.length +
    asked.orders.length;
  return total > 0 && total <= draftsAtOnce;
};
const fewEnoughMessage = `Choose from 1 to ${String(draftsAtOnce)} drafts`;

export const draftsRequestSchema = draftsAsked.refine(
  fewEnough,
  fewEnoughMessage,
);

export type DraftsRequest = z.infer<typeof draftsRequestSchema>;

export const rejectionRequestSchema = draftsAsked
  .extend({ reason: z.string().trim().min(1).max(reasonLength) })
  .refine(fewEnough, fewEnoughMessage);
