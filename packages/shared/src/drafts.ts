// SPDX-License-Identifier: Apache-2.0

// Drafts: changes waiting for approval, at most one for each record, the kinds of record that
// have them, and which drafts a user changed, so another approver must approve them.

import { z } from "zod";
import { changedFieldSchema } from "./changes.ts";
import { linkShape } from "./links.ts";
import { holdsAny, type Permission, permissionLabel } from "./access.ts";
import { eitherOf } from "./words.ts";

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
// with its own fields, which may link to other records, and the planning settings, one record.
export const recordTypeSchema = z.enum([
  "release-stream",
  "cycle-pattern",
  "release",
  "feature",
  "customer",
  "proposal",
  "project",
  "milestone",
  "activity",
  "allocation",
  "planning-settings",
]);

export type RecordType = z.infer<typeof recordTypeSchema>;

// The planning settings' one record, kept under this name rather than a generated identifier.
export const planningSettingsId = "planning-settings";

export const recordRefIdSchema = z.union([
  z.uuid(),
  z.literal(planningSettingsId),
]);

export const recordRefSchema = z.object({
  type: recordTypeSchema,
  id: recordRefIdSchema,
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
      // Shares by month, such as the planning settings' ramp-up.
      z.array(z.number()),
      linkShape,
      // Text by record, such as the reasons a proposal keeps by feature.
      z.record(z.string(), z.string()),
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
    asked.records.length;
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
  ...recordTypeSchema.options,
] as const;

export type DraftKind = (typeof draftKinds)[number];

// Whether a kind of record, as stored, is one Fathom keeps drafts of.
export const isDraftKind = (kind: string): kind is DraftKind =>
  (draftKinds as readonly string[]).includes(kind);

// The Approve permissions, one for each area whose drafts an Approver decides.
export type ApprovePermission = Exclude<
  Extract<Permission, `${string}:approve`>,
  "drafts:approve-own"
>;

// Who may change each kind of the plan's records, any one of the permissions sufficing. Schedules
// and their cycles are part of the plan, and planning configuration too.
export const recordEditors: Record<RecordType, readonly Permission[]> = {
  "release-stream": ["plan:edit", "configuration:edit"],
  "cycle-pattern": ["plan:edit", "configuration:edit"],
  release: ["features:edit"],
  feature: ["features:edit"],
  customer: ["plan:edit"],
  proposal: ["plan:edit"],
  project: ["plan:edit"],
  milestone: ["plan:edit"],
  activity: ["features:edit"],
  allocation: ["allocations:edit"],
  "planning-settings": ["configuration:edit"],
};

// The permissions that approve or reject each kind's drafts, any one of them sufficing: that of the
// area it belongs to, and, for schedules and their cycles, which are part of both the plan and
// planning configuration, either's. Every kind must be listed, which the compiler checks.
export const approvePermissions: Record<
  DraftKind,
  readonly [ApprovePermission, ...ApprovePermission[]]
> = {
  person: ["people:approve"],
  "planned-hire": ["hiring-plan:approve"],
  "feature-team": ["feature-teams:approve"],
  list: ["configuration:approve"],
  "list-item": ["configuration:approve"],
  "choice-order": ["configuration:approve"],
  field: ["configuration:approve"],
  "release-stream": ["plan:approve", "configuration:approve"],
  "cycle-pattern": ["plan:approve", "configuration:approve"],
  release: ["features:approve"],
  feature: ["features:approve"],
  customer: ["plan:approve"],
  proposal: ["plan:approve"],
  project: ["plan:approve"],
  milestone: ["plan:approve"],
  activity: ["features:approve"],
  allocation: ["allocations:approve"],
  "planning-settings": ["configuration:approve"],
};

// What the drafts each area's Approve permission decides are of, as refusals name them.
export const approvedAreaNames: Record<ApprovePermission, string> = {
  "people:approve": "people",
  "hiring-plan:approve": "planned hires",
  "feature-teams:approve": "feature teams",
  "configuration:approve": "configuration",
  "features:approve": "features and releases",
  "plan:approve": "the plan",
  "allocations:approve": "allocations",
};

// Whether drafts are being approved or rejected.
export type Asking = "approve" | "reject";

// Whether some permissions let a user approve and reject a kind's drafts.
export const approvesKind = (
  permissions: readonly string[],
  kind: DraftKind,
): boolean =>
  // The kind is always one of the fixed list above.
  // eslint-disable-next-line security/detect-object-injection
  holdsAny(permissions, approvePermissions[kind]);

// Why a role may not approve a draft that takes along another of a kind it does not approve, such
// as a column only drafted to be added that a feature is given a value in, naming that one, since
// approving one approves both; undefined when it may.
export const takenAlongRefusal = (
  permissions: readonly string[],
  kind: DraftKind,
  name: string,
): string | undefined =>
  approvesKind(permissions, kind)
    ? undefined
    : // The kind is always one of the fixed list above.
      // eslint-disable-next-line security/detect-object-injection
      `Approving this also approves ${name}, which needs ${eitherOf(approvePermissions[kind].map(permissionLabel))}.`;

// The kinds of draft some permissions let a user approve and reject.
export const approvableKinds = (permissions: readonly string[]): DraftKind[] =>
  draftKinds.filter((kind) => approvesKind(permissions, kind));

// A draft's key, its kind and its record's identifier, naming it alike on the server and the page.
export const draftKey = (kind: string, id: string): string => `${kind} ${id}`;

// The kind and record a draft's key names; a record's identifier may itself hold spaces.
export const fromDraftKey = (
  key: string,
): { recordType: string; recordId: string } => {
  const space = key.indexOf(" ");
  return { recordType: key.slice(0, space), recordId: key.slice(space + 1) };
};

// The key of each draft asked for.
export const draftKeysOf = (asked: DraftsAsked): string[] => {
  const of = (kind: DraftKind, ids: readonly string[] = []) =>
    ids.map((id) => draftKey(kind, id));
  return [
    ...of("person", asked.people),
    ...of("planned-hire", asked.plannedHires),
    ...of("feature-team", asked.featureTeams),
    ...of("list", asked.lists),
    ...of("list-item", asked.choices),
    ...of("choice-order", asked.orders),
    ...of("field", asked.columns),
    ...(asked.records ?? []).map(({ type, id }) => draftKey(type, id)),
  ];
};

// A user's unpublished changes given, by key, with every change they use, those use, and so on,
// from what each change uses, by key: those publishing them takes along.
export function withNeeded(
  uses: ReadonlyMap<string, readonly string[]>,
  given: readonly string[],
): Set<string> {
  const found = new Set(given);
  const queue = [...given];
  for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
    for (const used of uses.get(next) ?? []) {
      if (!found.has(used)) {
        found.add(used);
        queue.push(used);
      }
    }
  }
  return found;
}

// The changes given, with every change that uses them, those that use those, and so on: those
// discarding them takes along.
export function withUsers(
  uses: ReadonlyMap<string, readonly string[]>,
  given: readonly string[],
): Set<string> {
  const usedBy = new Map<string, string[]>();
  for (const [user, used] of uses) {
    for (const one of used) usedBy.set(one, [...(usedBy.get(one) ?? []), user]);
  }
  return withNeeded(usedBy, given);
}

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
    "release-stream": records.has("release-stream"),
    "cycle-pattern": records.has("cycle-pattern"),
    release: records.has("release"),
    feature: records.has("feature"),
    customer: records.has("customer"),
    proposal: records.has("proposal"),
    project: records.has("project"),
    milestone: records.has("milestone"),
    activity: records.has("activity"),
    allocation: records.has("allocation"),
    "planning-settings": records.has("planning-settings"),
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
      // The change's draft, by its key, and the user's other changes it goes together with: those it
      // uses, and those saved with it or in the same fill, which the page ticks with it.
      key: z.string(),
      linked: z.array(z.string()),
    }),
  ),
});

export type Unpublished = z.infer<typeof unpublishedSchema>;

// A field the user changed privately that someone else changed since, or with no field a record one
// of them removed, which the role in use no longer sees, so publishing gives it up, keeping the
// other side, rather than ask about what the user can't see.
export const blindFieldSchema = z.object({
  recordType: z.enum(draftKinds),
  recordId: z.string(),
  subject: z.string(),
  field: z.string().optional(),
});

export type BlindField = z.infer<typeof blindFieldSchema>;

// How many records' changes publishing or discarding them took.
export const unpublishedDoneSchema = z.object({ total: z.number().int() });

// Publishing also says how many changes it left, since the acting role may not make them, for a role
// that may.
export const unpublishedPublishedSchema = unpublishedDoneSchema.extend({
  left: z.number().int(),
  // The fields given up, since the role in use no longer sees them, when there are any.
  givenUp: z.array(blindFieldSchema).optional(),
});

export type UnpublishedPublished = z.infer<typeof unpublishedPublishedSchema>;

// The most a clash's token holds.
const tokenLength = 100;

// For a field of a record someone else changed since the user's private change began, which value
// publishing keeps: the user's own, or the one now in the draft or live. With no field, for a whole
// record one of them removed: the user's private change, or the other.
export const resolutionSchema = z.object({
  recordType: z.enum(draftKinds),
  recordId: z.string().min(1),
  field: z.string().min(1).optional(),
  keep: z.enum(["mine", "theirs"]),
  // The token of the clash as the user was shown it, so a side kept no longer holds once the
  // other side has changed again.
  token: z.string().min(1).max(tokenLength),
});

export type Resolution = z.infer<typeof resolutionSchema>;

// The user's own changes to publish or discard, by the drafts they make; every change when the
// request has no drafts at all.
export const unpublishedChosenSchema = z.object({
  drafts: draftsRequestSchema.optional(),
});

// The kinds of change set that start again who changed a draft, such as approving it, and those
// that neither change it nor start again, such as rejecting it, as the server's rules name them.
export interface MakerKinds {
  resets: ReadonlySet<string>;
  changesNothing: ReadonlySet<string>;
}

// Publishing also names which value to keep for each field someone else changed meanwhile.
export const unpublishedPublishSchema = unpublishedChosenSchema.extend({
  resolutions: z.array(resolutionSchema).max(draftsAtOnce).optional(),
});

export type UnpublishedPublish = z.infer<typeof unpublishedPublishSchema>;

// A field the user changed privately that someone else changed since, which publishing asks about.
// Each side is the change from the value both started from, as the change history shows it; both
// are absent for a field the history doesn't show, such as the list a choice is in. With no field,
// the clash is on the whole record: one side removes it, the other changes it.
export const privateConflictSchema = z.object({
  recordType: z.enum(draftKinds),
  recordId: z.string(),
  // The record, as the Drafts page names it.
  subject: z.string(),
  // The field's key, as the draft holds it, for naming the value to keep.
  field: z.string().optional(),
  mine: changedFieldSchema.optional(),
  theirs: changedFieldSchema.optional(),
  // For a clash on the whole record, whose change removes it.
  removedBy: z.enum(["theirs", "mine"]).optional(),
  // Where the other change is: in the published draft, waiting or rejected, or live.
  state: z.enum(["waiting", "rejected", "live"]),
  // Who last changed the field, or the record, in the published draft, of the changes the role
  // sees; null for Fathom itself, a live value, a field whose values aren't shown, or a change made
  // before the user's removal began.
  by: z.string().nullable(),
  // What the user is shown of the other side, which a resolution sends back.
  token: z.string(),
});

export type PrivateConflict = z.infer<typeof privateConflictSchema>;

// Publishing refused for fields someone else changed meanwhile, until a value is kept for each, with
// the fields it would give up.
export const privateConflictsSchema = z.object({
  error: z.string(),
  conflicts: z.array(privateConflictSchema),
  givenUp: z.array(blindFieldSchema).optional(),
});

export type PrivateConflicts = z.infer<typeof privateConflictsSchema>;

// Every refusal of a publish: one asking which values to keep, or any other, with the field it is
// about where it is about one.
export const publishRefusalSchema = z.union([
  privateConflictsSchema,
  z.object({ error: z.string(), field: z.string().optional() }),
]);

// A change to a draft, or a decision on it, with when it was made and when others could first see it
// (null while private), in microseconds, for ordering as changes count.
export interface TimedChange {
  id: number;
  recordId: string;
  kind: string;
  makerId: string | null;
  madeAtMicros: number;
  publishedAtMicros: number | null;
}

// The changes in the order they count in for who changed a draft. A change counts from when others
// could see it, so one saved privately before a decision and published after it counts after it,
// and the reader's own still private last. A decision counts from when it was made, so a private
// discard published later starts again only what was published before it, and with it its maker's
// own changes to the record made before it, published with it or still private. Then as made.
export function inCountedOrder<Row extends TimedChange>(
  rows: readonly Row[],
  kinds: MakerKinds,
): Row[] {
  const decidedBy = (row: TimedChange) =>
    JSON.stringify([row.makerId, row.recordId, row.publishedAtMicros]);
  // The latest decision of each maker on each record, by when it was published. Fathom's own changes,
  // with no maker, are never covered by a decision.
  const lastDecision = new Map<string, number>();
  for (const row of rows.filter(
    ({ kind, makerId }) => kinds.resets.has(kind) && makerId !== null,
  )) {
    const key = decidedBy(row);
    lastDecision.set(
      key,
      Math.max(lastDecision.get(key) ?? 0, row.madeAtMicros),
    );
  }
  const counted = (row: TimedChange) =>
    kinds.resets.has(row.kind) ||
    (lastDecision.get(decidedBy(row)) ?? 0) > row.madeAtMicros
      ? row.madeAtMicros
      : (row.publishedAtMicros ?? Infinity);
  return [...rows].sort(
    (first, second) =>
      counted(first) - counted(second) ||
      first.madeAtMicros - second.madeAtMicros ||
      first.id - second.id,
  );
}

// A change to a draft, or a decision on it, as the history holds it, with whether it counts for the
// reader: published, or the reader's own held.
export interface DraftChange {
  // The change's place in the history, which a change taking it back names.
  id: number;
  recordType: string;
  recordId: string;
  field: string;
  draft: boolean;
  kind: string;
  makerId: string | null;
  counts: boolean;
  // For a change taking back one of its maker's private changes, the change it takes back.
  takesBack: number | null;
}

// The changes to each record's draft standing since the last decision on it that counts, from the
// history in order, by the record's key. Rejecting or resubmitting a draft does not change it, so
// neither stands nor starts again; someone's private discard doesn't start again; and a change or
// discard given up on publishing, with the change naming it as taken back, is as if never made. One
// walk for the drafts marked on screen, who changed them, and the approvals refused.
export function standingChanges<Change extends DraftChange>(
  rows: readonly Change[],
  kinds: MakerKinds,
): Map<string, Change[]> {
  const taken = new Set(rows.map(({ takesBack }) => takesBack));
  const standing = new Map<string, Change[]>();
  for (const row of rows) {
    if (
      row.takesBack !== null ||
      taken.has(row.id) ||
      kinds.changesNothing.has(row.kind)
    ) {
      continue;
    }
    const key = draftKey(row.recordType, row.recordId);
    if (kinds.resets.has(row.kind)) {
      if (row.counts) standing.delete(key);
    } else if (row.draft) {
      const made = standing.get(key) ?? [];
      made.push(row);
      standing.set(key, made);
    }
  }
  return standing;
}

// The records whose drafts a user changed since each was last decided, of the changes that count,
// by their identifiers, for rows of one kind of record.
export const draftsChangedBy = (
  rows: readonly DraftChange[],
  userId: string,
  kinds: MakerKinds,
): Set<string> =>
  new Set(
    [...standingChanges(rows, kinds).values()]
      .flat()
      .filter(({ makerId, counts }) => makerId === userId && counts)
      .map(({ recordId }) => recordId),
  );
