// SPDX-License-Identifier: Apache-2.0

// Customers, projects with their milestones, and proposals, as the Decisions Log sets out. Each is
// one of the plan's records, changed through drafts, and shown as its draft makes it, with the
// draft beside. A project's dates are not entered: they come from its milestones.

import { z } from "zod";
import { daySchema } from "./days.ts";
import { heldBySchema, recordDraftSchema } from "./drafts.ts";
import { addressProblem, linkLengths, webAddress } from "./links.ts";

export const projectLengths = {
  name: 100,
  externalId: 40,
} as const;

// How drafts and decisions name each kind of record, in the server and the browser alike.
export const projectSubjects = {
  customer: (customer: string) => `the customer ${customer}`,
  project: (project: string) => `the project ${project}`,
  milestone: (milestone: string, project: string) =>
    `the milestone ${milestone} of ${project}`,
  proposal: (proposal: string) => `the proposal ${proposal}`,
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

const recordShape = {
  id: z.string(),
  draft: recordDraftSchema.optional(),
  heldBy: heldBySchema,
};

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
});

export type Proposal = z.infer<typeof proposalSchema>;

// Every customer, project, and proposal, the live ones by name, then those drafted to be added, in
// the order drafted, with whether the user may change them.
export const projectPlanSchema = z.object({
  customers: z.array(customerSchema),
  projects: z.array(projectSchema),
  proposals: z.array(proposalSchema),
  canEdit: z.boolean(),
});

export type ProjectPlan = z.infer<typeof projectPlanSchema>;

// What a record of the plan can be given: people as owners, by name alone, those who have left
// retired, and the proposal statuses, in their list's order, so those who see the plan can choose
// them without seeing People or Lists.
const planChoiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  retired: z.boolean(),
});

export type PlanChoice = z.infer<typeof planChoiceSchema>;

export const planChoicesSchema = z.object({
  owners: z.array(planChoiceSchema),
  statuses: z.array(planChoiceSchema),
});

export type PlanChoices = z.infer<typeof planChoicesSchema>;

const name = z.string().trim().min(1).max(projectLengths.name);

// An optional ID, kept as typed without spaces around it, or null when empty.
const externalId = z
  .string()
  .trim()
  .max(projectLengths.externalId)
  .nullable()
  .default(null)
  .transform((value) => (value === "" ? null : value));

// The records picked, each once, in a stable order, so the same set is the same value.
const picked = z
  .array(z.uuid())
  .default([])
  .transform((ids) => [...new Set(ids)].sort());

export const customerRequestSchema = z.object({ name });

export type CustomerRequest = z.infer<typeof customerRequestSchema>;

export const projectRequestSchema = z.object({
  name,
  externalId,
  ownerId: z.uuid().nullable().default(null),
  customerIds: picked,
  proposalIds: picked,
});

export type ProjectRequest = z.infer<typeof projectRequestSchema>;

export const milestoneRequestSchema = z.object({
  name,
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
  name,
  externalId,
  link: webLink,
  ownerId: z.uuid().nullable().default(null),
  customerIds: picked,
  statusId: z.uuid().optional(),
});

export type ProposalRequest = z.infer<typeof proposalRequestSchema>;
