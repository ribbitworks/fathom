// SPDX-License-Identifier: Apache-2.0

// Drafts: changes waiting for approval, at most one for each record, as the Decisions Log sets out.
// People, lists, choices, the People table's columns, the order of each list's choices and of the
// People table's columns, and the plan's records, such as release streams, have drafts, which an
// Approver approves or rejects, several kinds at once.

import { z } from "zod";
import type { Permission } from "./access.ts";

// A draft waits for approval until an Approver approves or rejects it; a rejected draft keeps its
// reason until it is changed again or discarded.
export const draftStateSchema = z.enum(["waiting", "rejected"]);

export type DraftState = z.infer<typeof draftStateSchema>;

// The most a rejection's reason holds.
export const reasonLength = 500;

// What every draft tells the user beside what it changes: whether it waits or was rejected, with
// the reason, who last changed it, of the changes the user may see, or null for Fathom itself, and
// when, both null when the history holds no such change, as for drafts written another way, and
// everyone who changed it.
export const draftShape = {
  state: draftStateSchema,
  reason: z.string().optional(),
  madeBy: z.string().nullable(),
  // The role who last changed it was acting as, null when unknown.
  madeAs: z.string().nullable().optional(),
  madeAt: z.iso.datetime({ offset: true }).nullable(),
  // Everyone who changed the draft, of the changes the user may see, first to last, null for Fathom
  // itself; several people's changes to one record make one draft.
  editors: z.array(z.string().nullable()).optional(),
  // Who last changed each field the draft changes, by the field's key, as the draft names it.
  changedBy: z.record(z.string(), z.string().nullable()).optional(),
  // True when the draft holds the user's own changes, not yet published, which only they see.
  unpublished: z.boolean().optional(),
  // True when the user changed the draft since it was last approved or discarded and their role
  // does not let them approve their own, so another approver must approve it.
  needsOtherApprover: z.boolean().optional(),
};

// Who holds a record by having unpublished changes to it, by name, when it is someone other than
// the user: until they publish or discard them, the user sees the record as published and cannot
// change, approve, or reject it.
export const heldBySchema = z.string().optional();

export const draftActionSchema = z.enum(["created", "changed", "deleted"]);

// The kinds of the plan's records that have drafts through one set of rules for all of them, each
// with its own fields, which may link to other records.
export const recordTypeSchema = z.enum([
  "release-stream",
  "cycle-pattern",
  "release",
  "feature",
  "customer",
  "proposal",
  "project",
  "milestone",
]);

export type RecordType = z.infer<typeof recordTypeSchema>;

export const recordRefSchema = z.object({
  type: recordTypeSchema,
  id: z.uuid(),
});

export type RecordRef = z.infer<typeof recordRefSchema>;

// A record's draft: whether it adds, changes, or removes the record, the fields it changes, and
// their live values, which a draft that adds the record has none of, and the records only drafted
// to be added that it links to, whose drafts approving it approves, and which are rejected only
// together with it.
export const recordDraftSchema = z.object({
  action: draftActionSchema,
  changed: z.array(z.string()),
  live: z.record(
    z.string(),
    z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      z.array(z.string()),
    ]),
  ),
  uses: z.array(recordRefSchema),
  ...draftShape,
});

export type RecordDraft = z.infer<typeof recordDraftSchema>;

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
// the People table's columns, of the order of lists' choices, named by their list, of the order of
// the People table's columns, and of the plan's records, by kind.
const draftsAsked = z.object({
  people: ids("person"),
  plannedHires: ids("planned hire"),
  featureTeams: ids("feature team"),
  lists: ids("list"),
  choices: ids("choice"),
  orders: ids("list"),
  columns: ids("column"),
  columnOrder: z.boolean().default(false),
  records: z
    .array(recordRefSchema)
    .max(draftsAtOnce)
    .refine(
      (given) =>
        new Set(given.map(({ type, id }) => `${type} ${id}`)).size ===
        given.length,
      "Each record once",
    )
    .default([]),
});

type Asked = z.infer<typeof draftsAsked>;

// Between one draft and as many as are approved or rejected at once.
const fewEnough = (asked: Asked) => {
  const total =
    asked.people.length +
    asked.plannedHires.length +
    asked.featureTeams.length +
    asked.lists.length +
    asked.choices.length +
    asked.orders.length +
    asked.columns.length +
    asked.records.length +
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

// The kinds of record that have drafts. A list's choice is a list item, a People column a field,
// and a list's choice order is one record, named by its list.
export const draftKinds = [
  "person",
  "planned-hire",
  "feature-team",
  "list",
  "list-item",
  "choice-order",
  "field",
  "column-order",
  ...recordTypeSchema.options,
] as const;

export type DraftKind = (typeof draftKinds)[number];

// The permission that approves or rejects each kind's drafts, that of the area it belongs to, as the
// Decisions Log sets out. Every kind must be listed, which the compiler checks.
export const approvePermissions = {
  person: "people:approve",
  "planned-hire": "hiring-plan:approve",
  "feature-team": "feature-teams:approve",
  list: "configuration:approve",
  "list-item": "configuration:approve",
  "choice-order": "configuration:approve",
  field: "configuration:approve",
  "column-order": "configuration:approve",
  "release-stream": "releases:approve",
  "cycle-pattern": "releases:approve",
  release: "releases:approve",
  feature: "plan:approve",
  customer: "plan:approve",
  proposal: "plan:approve",
  project: "plan:approve",
  milestone: "plan:approve",
} as const satisfies Record<DraftKind, Permission>;

export type ApprovePermission = (typeof approvePermissions)[DraftKind];

// What the drafts each area's Approve permission decides are of, as refusals name them.
export const approvedAreaNames: Record<ApprovePermission, string> = {
  "people:approve": "people",
  "hiring-plan:approve": "planned hires",
  "feature-teams:approve": "feature teams",
  "configuration:approve": "configuration",
  "releases:approve": "releases",
  "plan:approve": "the plan",
};

// Whether drafts are being approved or rejected.
export type Asking = "approve" | "reject";

// The kinds of draft some permissions let a user approve and reject.
export const approvableKinds = (permissions: readonly string[]): DraftKind[] =>
  draftKinds.filter((kind) =>
    // The kind is always one of the fixed list above.
    // eslint-disable-next-line security/detect-object-injection
    permissions.includes(approvePermissions[kind]),
  );

// The drafts asked for of the kinds a test keeps.
export function draftsWhere(
  asked: DraftsRequest,
  kept: (kind: DraftKind) => boolean,
): DraftsRequest {
  return {
    people: kept("person") ? asked.people : [],
    plannedHires: kept("planned-hire") ? asked.plannedHires : [],
    featureTeams: kept("feature-team") ? asked.featureTeams : [],
    lists: kept("list") ? asked.lists : [],
    choices: kept("list-item") ? asked.choices : [],
    orders: kept("choice-order") ? asked.orders : [],
    columns: kept("field") ? asked.columns : [],
    columnOrder: asked.columnOrder && kept("column-order"),
    records: asked.records.filter(({ type }) => kept(type)),
  };
}

// The kinds there are drafts of among those asked for.
export function kindsAsked(asked: DraftsRequest): DraftKind[] {
  const records = new Set(asked.records.map(({ type }) => type));
  const asks: Record<DraftKind, boolean> = {
    person: asked.people.length > 0,
    "planned-hire": asked.plannedHires.length > 0,
    "feature-team": asked.featureTeams.length > 0,
    list: asked.lists.length > 0,
    "list-item": asked.choices.length > 0,
    "choice-order": asked.orders.length > 0,
    field: asked.columns.length > 0,
    "column-order": asked.columnOrder,
    "release-stream": records.has("release-stream"),
    "cycle-pattern": records.has("cycle-pattern"),
    release: records.has("release"),
    feature: records.has("feature"),
    customer: records.has("customer"),
    proposal: records.has("proposal"),
    project: records.has("project"),
    milestone: records.has("milestone"),
  };
  // The kind is always one of the fixed list above.
  // eslint-disable-next-line security/detect-object-injection
  return draftKinds.filter((kind) => asks[kind]);
}

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
