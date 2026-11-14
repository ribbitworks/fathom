// SPDX-License-Identifier: Apache-2.0

// Customers, projects with their milestones, and proposals, as the Decisions Log sets out. Each is
// one of the plan's records, changed through drafts, and shown as its draft makes it, with the
// draft beside. A project's dates are not entered: they come from its milestones. A project names
// the features it needs, and a proposal those it proposes.

import { z } from "zod";
import { daySchema } from "./days.ts";
import { featureSchema } from "./features.ts";
import { listSchema, meaningSchema } from "./lists.ts";
import { addressProblem, linkLengths, webAddress } from "./links.ts";
import { fieldSchema } from "./people.ts";
import {
  optionalText,
  picked,
  pickedIfNamed,
  recordName,
  recordNameLength,
  recordShape,
} from "./record-fields.ts";

export const projectLengths = {
  name: recordNameLength,
  externalId: 40,
  removalReason: 200,
} as const;

// How drafts and decisions name each kind of record, in the server and the browser alike.
// The labels of the plan's built-in columns, shared so its tables and the change history name them
// alike, and each kind's own ID.
export const planColumnNames = {
  name: "Name",
  ownerId: "Owner",
  customerIds: "Customers",
  projectIds: "Projects",
  proposalIds: "Proposals",
  featureIds: "Features",
  link: "Link",
  statusId: "Status",
  projectId: "Project",
  date: "Date",
  customerDelivery: "Customer delivery",
  estimateHours: "Effort",
  priorityId: "Priority",
  sizeId: "Size",
  riskId: "Risk",
  neededBy: "Needed by",
  description: "Description",
  note: "Notes",
  targetCycle: "Target cycle",
  featureTeamId: "Feature team",
} as const;

export const planIdNames = {
  project: "Project ID",
  proposal: "Proposal ID",
} as const;

// The plan's kinds of record whose columns those are.
export const planColumnKinds = [
  "customer",
  "project",
  "proposal",
  "milestone",
  "feature",
] as const;

export const projectSubjects = {
  customer: (customer: string) => `the customer ${customer}`,
  project: (project: string) => `the project ${project}`,
  milestone: (milestone: string, project: string) =>
    `the milestone ${milestone} of ${project}`,
  proposal: (proposal: string) => `the proposal ${proposal}`,
  feature: (feature: string) => `the feature ${feature}`,
};

// The first and last days of a project's milestones, and the day of its next customer delivery
// from today, each null when it has no such milestone.
export const projectDatesSchema = z.object({
  first: z.string().nullable(),
  last: z.string().nullable(),
  nextDelivery: z.string().nullable(),
});

export type ProjectDates = z.infer<typeof projectDatesSchema>;

export interface MilestoneDay {
  date: string;
  customerDelivery: boolean;
}

// A project's dates, from its milestones, as of today.
export function projectDates(
  milestones: readonly MilestoneDay[],
  today: string,
): ProjectDates {
  const days = milestones.map(({ date }) => date).sort();
  const deliveries = milestones
    .filter(({ customerDelivery, date }) => customerDelivery && date >= today)
    .map(({ date }) => date)
    .sort();
  return {
    first: days.at(0) ?? null,
    last: days.at(-1) ?? null,
    nextDelivery: deliveries.at(0) ?? null,
  };
}

export const sameDates = (first: ProjectDates, second: ProjectDates) =>
  first.first === second.first &&
  first.last === second.last &&
  first.nextDelivery === second.nextDelivery;

export const customerSchema = z.object({
  ...recordShape,
  name: z.string(),
});

export type Customer = z.infer<typeof customerSchema>;

export const milestoneSchema = z.object({
  ...recordShape,
  projectId: z.string(),
  name: z.string(),
  date: z.string(),
  customerDelivery: z.boolean(),
});

export type Milestone = z.infer<typeof milestoneSchema>;

// A project as its draft makes it, with its milestones, by day, each as its draft makes it, and its
// dates from them; where drafts of its milestones change its dates, its live dates beside.
export const projectSchema = z.object({
  ...recordShape,
  name: z.string(),
  // The Project ID, or null when it has none.
  externalId: z.string().nullable(),
  // The person who owns it, or null.
  ownerId: z.string().nullable(),
  customerIds: z.array(z.string()),
  proposalIds: z.array(z.string()),
  // The features it needs: its scope.
  featureIds: z.array(z.string()),
  milestones: z.array(milestoneSchema),
  dates: projectDatesSchema,
  liveDates: projectDatesSchema.optional(),
});

export type Project = z.infer<typeof projectSchema>;

export const proposalSchema = z.object({
  ...recordShape,
  name: z.string(),
  // The Proposal ID, or null when it has none.
  externalId: z.string().nullable(),
  // A web address, or null.
  link: z.string().nullable(),
  ownerId: z.string().nullable(),
  customerIds: z.array(z.string()),
  // A choice in the built-in proposal statuses list.
  statusId: z.string(),
  // The features it proposes.
  featureIds: z.array(z.string()),
  // The reason given for removing each feature from it, by feature, while that feature is not in it.
  removalReasons: z.record(z.string(), z.string()),
});

export type Proposal = z.infer<typeof proposalSchema>;

// The columns added to Features, the order of Features' columns, and the lists those columns draw
// on, which everyone who sees the plan is sent, though they may not see Lists.
export const featureColumnsSchema = z.object({
  fields: z.array(fieldSchema),
  order: z.array(z.string()),
  lists: z.array(listSchema),
});

export type FeatureColumns = z.infer<typeof featureColumnsSchema>;

// Every customer, project, proposal, and feature, the live ones by name, then those drafted to be
// added, in the order drafted, with whether the user may change them: features apart from the rest,
// since Edit Features is a permission of its own.
export const projectPlanSchema = z.object({
  customers: z.array(customerSchema),
  projects: z.array(projectSchema),
  proposals: z.array(proposalSchema),
  features: z.array(featureSchema),
  featureColumns: featureColumnsSchema,
  canEdit: z.boolean(),
  canEditFeatures: z.boolean(),
});

export type ProjectPlan = z.infer<typeof projectPlanSchema>;

// What a record of the plan can be given: people as owners, by name alone, those who have left
// retired, the proposal and feature statuses, in their lists' order, the feature statuses with their
// meanings, and the feature teams, so those who see the plan can choose them without seeing People,
// Lists, or the org chart.
const planChoiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  retired: z.boolean(),
});

export type PlanChoice = z.infer<typeof planChoiceSchema>;

export const planChoicesSchema = z.object({
  owners: z.array(planChoiceSchema),
  statuses: z.array(planChoiceSchema),
  featureStatuses: z.array(planChoiceSchema.extend({ meaning: meaningSchema })),
  priorities: z.array(planChoiceSchema),
  // Each size with its weight, how many of the list's S it is.
  sizes: z.array(planChoiceSchema.extend({ weight: z.number().nullable() })),
  risks: z.array(planChoiceSchema),
  featureTeams: z.array(planChoiceSchema),
});

export type PlanChoices = z.infer<typeof planChoicesSchema>;

const externalId = optionalText(projectLengths.externalId);

// The reason for removing a feature from a proposal, given once a draft removes it, or null for none.
const removalReason = z
  .string()
  .trim()
  .max(projectLengths.removalReason)
  .nullable()
  .default(null)
  .transform((value) => (value === "" ? null : value));

export const customerRequestSchema = z.object({ name: recordName });

export type CustomerRequest = z.infer<typeof customerRequestSchema>;

export const projectRequestSchema = z.object({
  name: recordName,
  externalId,
  ownerId: z.uuid().nullable().default(null),
  customerIds: picked,
  proposalIds: picked,
  featureIds: picked,
});

export type ProjectRequest = z.infer<typeof projectRequestSchema>;

export const milestoneRequestSchema = z.object({
  name: recordName,
  date: daySchema,
  customerDelivery: z.boolean().default(false),
});

export type MilestoneRequest = z.infer<typeof milestoneRequestSchema>;

// A web address, kept in the form webAddress gives it back, or null when empty.
const webLink = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((value, context) => {
    if (value === null || value === "") return null;
    const kept = webAddress(value);
    if (kept === null || kept.length > linkLengths.address) {
      context.addIssue({ code: "custom", message: addressProblem });
      return z.NEVER;
    }
    return kept;
  });

// A proposal added without a status starts in the first status offered.
export const proposalRequestSchema = z.object({
  name: recordName,
  externalId,
  link: webLink,
  ownerId: z.uuid().nullable().default(null),
  customerIds: picked,
  statusId: z.uuid().optional(),
  featureIds: picked,
});

export type ProposalRequest = z.infer<typeof proposalRequestSchema>;

// The projects that need a feature and the proposals that propose it, changed from the feature's
// side: each project or proposal it is added to or taken from gets a draft, and a kind not named
// is left as it is.
export const featureProjectsRequestSchema = z.object({
  projectIds: pickedIfNamed,
  proposalIds: pickedIfNamed,
});

export type FeatureProjectsRequest = z.infer<
  typeof featureProjectsRequestSchema
>;

// The reason for removing a feature from a proposal, changed while the removal is a draft.
export const removalReasonRequestSchema = z.object({ removalReason });

export type RemovalReasonRequest = z.infer<typeof removalReasonRequestSchema>;

// The reasons a proposal keeps, by feature, from a value as stored, or none for anything else.
export const removalReasonsIn = (value: unknown): Record<string, string> =>
  z.record(z.string(), z.string()).catch({}).parse(value);

// The reasons a proposal keeps once it proposes the features given rather than those it had: a
// feature removed now starts with no reason, given afterwards, and a feature it proposes keeps none.
export function removalReasonsAfter(
  reasons: Readonly<Record<string, string>>,
  had: readonly string[],
  featureIds: readonly string[],
): Record<string, string> {
  const taken = had.filter((id) => !featureIds.includes(id));
  return Object.fromEntries(
    Object.entries(reasons).filter(
      ([id]) => !taken.includes(id) && !featureIds.includes(id),
    ),
  );
}

// The reasons a proposal keeps once the reason for removing one feature from it is changed.
export function withRemovalReason(
  reasons: Readonly<Record<string, string>>,
  featureId: string,
  reason: string | null,
): Record<string, string> {
  const others = Object.entries(reasons).filter(([id]) => id !== featureId);
  return Object.fromEntries(
    reason === null ? others : [...others, [featureId, reason]],
  );
}

// A feature a project or proposal was given or had removed, as approved, newest first, named as
// the history last named it.
export const scopeChangeSchema = z.object({
  featureId: z.string(),
  name: z.string().nullable(),
  added: z.boolean(),
  at: z.iso.datetime({ offset: true }),
  // The reason given for removing it from a proposal, or null.
  reason: z.string().nullable(),
});

export type ScopeChange = z.infer<typeof scopeChangeSchema>;

export const scopeHistorySchema = z.object({
  changes: z.array(scopeChangeSchema),
});

export type ScopeHistory = z.infer<typeof scopeHistorySchema>;

// The kinds of record that name features, each by the request's field of its records.
export const featureNamerKeys = {
  project: "projectIds",
  proposal: "proposalIds",
} as const satisfies Record<string, keyof FeatureProjectsRequest>;
