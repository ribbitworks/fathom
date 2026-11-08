// SPDX-License-Identifier: Apache-2.0

// Customers, projects with their milestones, and proposals: reading them as the viewer sees them,
// each project with its dates from its milestones, and drafting each added, changed, and removed.
// Part of the data access layer; the caller checks the actor's permissions. Every change is a
// draft of a plan record, as records.ts sets out, with the kinds project-kinds.ts describes.

import { type Database, listItems, lists, people } from "@fathom/db";
import {
  type CustomerRequest,
  type Customer,
  type Milestone,
  type MilestoneRequest,
  type PlanChoices,
  type Project,
  type ProjectPlan,
  type ProjectRequest,
  type Proposal,
  type ProposalRequest,
  projectDates,
  type RecordType,
  sameDates,
} from "@fathom/shared";
import { asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Actor } from "../access.ts";
import { BadRequestError, ConflictError, NotFoundError } from "../errors.ts";
import { checkBuiltInChoice, firstOffered } from "./built-in-lists.ts";
import type { Saved, Transaction } from "./changes.ts";
import type { Recorded } from "./drafts.ts";
import { milestonesOf } from "./project-kinds.ts";
import {
  addedOnly,
  linkedIds,
  type RecordsState,
  shownIds,
  shownVersion,
  stateOf,
  versionOf,
} from "./record-state.ts";
import {
  changeableRecord,
  discardRecordDraft,
  drafting,
  kindOf,
  type Makers,
  readRecordMakers,
  readRecordsState,
  recordDraftOut,
  recordHeldBy,
  saveRecordDraft,
  saveRecordDrafts,
  type Wanted,
} from "./records.ts";
import { readToday } from "./settings.ts";

export type PlanRecords = Omit<ProjectPlan, "canEdit">;

const extras = (
  state: RecordsState,
  makers: Makers,
  type: RecordType,
  id: string,
) => {
  const draft = recordDraftOut(kindOf(type), state, makers, id);
  return {
    ...(draft === undefined ? {} : { draft }),
    ...recordHeldBy(state, type, id),
  };
};

const text = (value: unknown) => (typeof value === "string" ? value : null);

// The records of a kind shown: the live ones by name, then those drafted to be added, in the order
// drafted.
function inOrder(state: RecordsState, type: RecordType): string[] {
  const { live } = stateOf(state, type);
  const name = (id: string) => String(shownVersion(state, type, id)?.name);
  return [
    ...[...live.keys()].sort((a, b) => name(a).localeCompare(name(b))),
    ...shownIds(state, type).filter((id) => !live.has(id)),
  ];
}

function milestoneOut(
  state: RecordsState,
  makers: Makers,
  id: string,
): Milestone {
  const milestone = shownVersion(state, "milestone", id) as Recorded;
  return {
    id,
    projectId: String(milestone.projectId),
    name: String(milestone.name),
    date: String(milestone.date),
    customerDelivery: milestone.customerDelivery === true,
    ...extras(state, makers, "milestone", id),
  };
}

const asDay = (milestone: Recorded) => ({
  date: String(milestone.date),
  customerDelivery: milestone.customerDelivery === true,
});

// A project's milestones by day, its dates as their drafts make them, those drafted to be removed
// left out, and, where that differs, its dates from the live milestones.
function projectOut(
  state: RecordsState,
  makers: Makers,
  id: string,
  today: string,
): Project {
  const project = shownVersion(state, "project", id) as Recorded;
  const found = milestonesOf(state, id);
  const drafted = found.flatMap((milestone) => {
    const version = versionOf(state, "milestone", milestone);
    return version === undefined ? [] : [asDay(version)];
  });
  const live = [...stateOf(state, "milestone").live.values()]
    .filter((milestone) => milestone.projectId === id)
    .map(asDay);
  const dates = projectDates(drafted, today);
  const liveDates = projectDates(live, today);
  return {
    id,
    name: String(project.name),
    externalId: text(project.externalId),
    ownerId: text(project.ownerId),
    customerIds: linkedIds(project, "customerIds"),
    proposalIds: linkedIds(project, "proposalIds"),
    milestones: found
      .map((milestone) => milestoneOut(state, makers, milestone))
      .sort(
        (a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name),
      ),
    dates,
    ...(sameDates(dates, liveDates) ? {} : { liveDates }),
    ...extras(state, makers, "project", id),
  };
}

function proposalOut(
  state: RecordsState,
  makers: Makers,
  id: string,
): Proposal {
  const proposal = shownVersion(state, "proposal", id) as Recorded;
  return {
    id,
    name: String(proposal.name),
    externalId: text(proposal.externalId),
    link: text(proposal.link),
    ownerId: text(proposal.ownerId),
    customerIds: linkedIds(proposal, "customerIds"),
    statusId: String(proposal.statusId),
    ...extras(state, makers, "proposal", id),
  };
}

export function planOut(
  state: RecordsState,
  makers: Makers,
  today: string,
): PlanRecords {
  return {
    customers: inOrder(state, "customer").map((id): Customer => ({
      id,
      name: String(shownVersion(state, "customer", id)?.name),
      ...extras(state, makers, "customer", id),
    })),
    projects: inOrder(state, "project").map((id) =>
      projectOut(state, makers, id, today),
    ),
    proposals: inOrder(state, "proposal").map((id) =>
      proposalOut(state, makers, id),
    ),
  };
}

// Every customer, project, and proposal as the viewer sees them.
export async function readPlanRecords(
  database: Database,
  viewer: Actor,
  asOf?: string,
): Promise<PlanRecords> {
  const today = asOf ?? (await readToday(database));
  // Read as of one moment, so an approval saved meanwhile is seen whole or not at all.
  return database.transaction(
    async (transaction) => {
      const state = await readRecordsState(transaction, viewer.user.id);
      return planOut(
        state,
        await readRecordMakers(transaction, state, viewer),
        today,
      );
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

// Runs a change, and answers with every record as the editor now sees them.
async function changingPlan(
  database: Database,
  editor: Actor,
  change: (
    transaction: Transaction,
    state: RecordsState,
  ) => Promise<string | null>,
  asOf?: string,
): Promise<Saved<PlanRecords>> {
  const today = asOf ?? (await readToday(database));
  return drafting(database, editor.user.id, async (transaction, state) => {
    const changeSetId = await change(transaction, state);
    const now = await readRecordsState(transaction, editor.user.id);
    return {
      result: planOut(
        now,
        await readRecordMakers(transaction, now, editor),
        today,
      ),
      changeSetId,
    };
  });
}

// Refuses an owner who is not one of People.
async function checkOwner(
  transaction: Transaction,
  ownerId: string | null,
): Promise<void> {
  if (ownerId === null) return;
  const [found] = await transaction
    .select({ id: people.id })
    .from(people)
    .where(eq(people.id, ownerId));
  if (found === undefined) {
    throw new BadRequestError("Choose an owner from People");
  }
}

// A customer, project, or proposal, as a request adds or changes it.
export type PlanRecordRequest =
  | { type: "customer"; request: CustomerRequest }
  | { type: "project"; request: ProjectRequest }
  | { type: "proposal"; request: ProposalRequest };

export type PlanKind = PlanRecordRequest["type"];

export async function addCustomer(
  database: Database,
  maker: Actor,
  request: CustomerRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, (transaction, state) =>
    saveRecordDraft(transaction, maker, state, "customer", randomUUID(), {
      name: request.name,
    }),
  );
}

export async function changeCustomer(
  database: Database,
  maker: Actor,
  id: string,
  request: CustomerRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, (transaction, state) =>
    saveRecordDraft(transaction, maker, state, "customer", id, {
      ...changeableRecord(state, "customer", id),
      name: request.name,
    }),
  );
}

const projectRecord = (request: ProjectRequest) => ({
  name: request.name,
  externalId: request.externalId,
  ownerId: request.ownerId,
  customerIds: request.customerIds,
  proposalIds: request.proposalIds,
});

export async function addProject(
  database: Database,
  maker: Actor,
  request: ProjectRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, async (transaction, state) => {
    await checkOwner(transaction, request.ownerId);
    return saveRecordDraft(
      transaction,
      maker,
      state,
      "project",
      randomUUID(),
      projectRecord(request),
    );
  });
}

export async function changeProject(
  database: Database,
  maker: Actor,
  id: string,
  request: ProjectRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, async (transaction, state) => {
    changeableRecord(state, "project", id);
    await checkOwner(transaction, request.ownerId);
    return saveRecordDraft(
      transaction,
      maker,
      state,
      "project",
      id,
      projectRecord(request),
    );
  });
}

// The status a proposal is given: the one asked for, if it is offered or the proposal already has
// it, or, for a proposal added without one, the first status offered.
async function statusFor(
  transaction: Transaction,
  asked: string | undefined,
  had: unknown,
): Promise<string> {
  if (asked !== undefined) {
    await checkBuiltInChoice(transaction, "proposal-statuses", asked, had);
    return asked;
  }
  if (typeof had === "string") return had;
  const first = await firstOffered(transaction, "proposal-statuses");
  if (first === undefined) {
    throw new ConflictError(
      "No proposal status is offered. Add one to the list first.",
    );
  }
  return first;
}

async function proposalRecord(
  transaction: Transaction,
  request: ProposalRequest,
  had?: unknown,
) {
  await checkOwner(transaction, request.ownerId);
  return {
    name: request.name,
    externalId: request.externalId,
    link: request.link,
    ownerId: request.ownerId,
    customerIds: request.customerIds,
    statusId: await statusFor(transaction, request.statusId, had),
  };
}

export async function addProposal(
  database: Database,
  maker: Actor,
  request: ProposalRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, async (transaction, state) =>
    saveRecordDraft(
      transaction,
      maker,
      state,
      "proposal",
      randomUUID(),
      await proposalRecord(transaction, request),
    ),
  );
}

export async function changeProposal(
  database: Database,
  maker: Actor,
  id: string,
  request: ProposalRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, async (transaction, state) => {
    const proposal = changeableRecord(state, "proposal", id);
    return saveRecordDraft(
      transaction,
      maker,
      state,
      "proposal",
      id,
      await proposalRecord(transaction, request, proposal.statusId),
    );
  });
}

// A project's milestone to change, refusing one of another project.
function projectMilestone(
  state: RecordsState,
  projectId: string,
  id: string,
): Recorded {
  const milestone = changeableRecord(state, "milestone", id);
  if (milestone.projectId !== projectId) {
    throw new NotFoundError("There is no such milestone in this project");
  }
  return milestone;
}

const milestoneRecord = (projectId: string, request: MilestoneRequest) => ({
  projectId,
  name: request.name,
  date: request.date,
  customerDelivery: request.customerDelivery,
});

// Saving refuses a project that does not exist, as it does any link to a record.
export async function addMilestone(
  database: Database,
  maker: Actor,
  projectId: string,
  request: MilestoneRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, (transaction, state) =>
    saveRecordDraft(
      transaction,
      maker,
      state,
      "milestone",
      randomUUID(),
      milestoneRecord(projectId, request),
    ),
  );
}

export async function changeMilestone(
  database: Database,
  maker: Actor,
  projectId: string,
  id: string,
  request: MilestoneRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, (transaction, state) => {
    projectMilestone(state, projectId, id);
    return saveRecordDraft(
      transaction,
      maker,
      state,
      "milestone",
      id,
      milestoneRecord(projectId, request),
    );
  });
}

// Drafts removing a record, refusing one another record still uses; removing one only drafted to
// be added discards its draft, as records.ts discards drafts. A project is removed with its
// milestones.
async function removing(
  database: Database,
  maker: Actor,
  type: RecordType,
  id: string,
  check: (state: RecordsState) => void,
): Promise<string | null> {
  const discards = await drafting(
    database,
    maker.user.id,
    (_transaction, state) => {
      check(state);
      return Promise.resolve(addedOnly(state, type, id));
    },
  );
  if (discards) return discardRecordDraft(database, maker, type, id, true);
  return drafting(database, maker.user.id, (transaction, state) => {
    check(state);
    const wanted: Wanted[] = [{ type, id, record: undefined }];
    if (type === "project") {
      for (const milestone of milestonesOf(state, id)) {
        if (versionOf(state, "milestone", milestone) !== undefined) {
          changeableRecord(state, "milestone", milestone);
          wanted.push({ type: "milestone", id: milestone, record: undefined });
        }
      }
    }
    return saveRecordDrafts(transaction, maker, state, wanted);
  });
}

export async function removeRecord(
  database: Database,
  maker: Actor,
  type: PlanKind,
  id: string,
): Promise<string | null> {
  return removing(database, maker, type, id, (state) => {
    changeableRecord(state, type, id);
  });
}

export async function removeMilestone(
  database: Database,
  maker: Actor,
  projectId: string,
  id: string,
): Promise<string | null> {
  return removing(database, maker, "milestone", id, (state) => {
    projectMilestone(state, projectId, id);
  });
}

// People as owners, by name alone, those whose end date has passed retired, and the proposal
// statuses, in their list's order.
export async function readPlanChoices(
  database: Database,
  asOf?: string,
): Promise<PlanChoices> {
  const today = asOf ?? (await readToday(database));
  const owners = await database
    .select({
      id: people.id,
      name: people.preferredName,
      endDate: people.endDate,
    })
    .from(people)
    .orderBy(asc(people.preferredName), asc(people.id));
  const statuses = await database
    .select({
      id: listItems.id,
      name: listItems.label,
      retired: listItems.retired,
    })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(eq(lists.builtIn, "proposal-statuses"))
    .orderBy(asc(listItems.position), asc(listItems.id));
  return {
    owners: owners.map(({ id, name, endDate }) => ({
      id,
      name,
      retired: endDate !== null && endDate < today,
    })),
    statuses,
  };
}
