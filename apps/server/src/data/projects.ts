// SPDX-License-Identifier: Apache-2.0

// Drafting changes to customers, projects with their milestones, proposals and features. Part of
// the data access layer; the caller checks the actor may change the kind, and a feature's customers
// and feature team are checked here, since they take more than changing features.

import type { Database } from "@fathom/db";
import {
  type CustomerRequest,
  featureNamerKeys,
  type FeatureProjectsRequest,
  type FeatureRequest,
  type MilestoneRequest,
  type PlanAddingRequests,
  type ProjectRequest,
  type ProposalRequest,
  type RemovalReasonRequest,
  removalReasonsAfter,
  withRemovalReason,
  type RecordRef,
  type RecordType,
} from "@fathom/shared";
import { randomUUID } from "node:crypto";
import type { Actor } from "../access.ts";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../errors.ts";
import type { Added, Saved, Transaction } from "./changes.ts";
import { type Recorded, unseenDraft } from "./draft-records.ts";
import { refuseFeatureFieldChanges } from "./feature-field-editors.ts";
import { milestonesOf } from "./project-kinds.ts";
import { text } from "./reporting.ts";
import {
  type ChoiceReads,
  choiceReads,
  planningReads,
  type PlanningReads,
  planningRecord,
} from "./planning-records.ts";
import {
  addedOnly,
  linkedIds,
  recordExists,
  type RecordsState,
  shownIds,
  shownVersion,
  stateOf,
  versionOf,
} from "./record-state.ts";
import {
  changeableRecord,
  drafting,
  saveRecordDraft,
  saveRecordDrafts,
  type Wanted,
} from "./record-drafting.ts";
import { withUsedRecords } from "./bound-drafts.ts";
import { discardRecordDraft } from "./record-decisions.ts";
import { keptNote, readRecordsState } from "./records.ts";
import { hiddenPeople, shownPeople } from "./people-reads.ts";
import { readToday } from "./settings.ts";
import { planOut, type PlanRecords, reasonsOf } from "./project-reads.ts";

// Runs a change, and answers with every record as the editor now sees them.
export async function changingPlan(
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
      result: await planOut(transaction, editor, now, today),
      changeSetId,
    };
  });
}

// Reads what new records of a kind are checked against, once for all of them, and answers how each
// is made from its request, refusing what the maker may not add.
export type NewRecords<Request> = (
  transaction: Transaction,
  maker: Actor,
  requests: readonly Request[],
) => Promise<(request: Request) => Promise<Recorded>>;

// Adds records of one kind in one change set, all or none, each judged against the others as they
// will all be, and answers with their identifiers in the order asked.
export async function addingPlan<Request>(
  database: Database,
  maker: Actor,
  type: RecordType,
  requests: readonly Request[],
  newRecords: NewRecords<Request>,
): Promise<Added<PlanRecords>> {
  const adding = requests.map((request) => ({ id: randomUUID(), request }));
  const saved = await changingPlan(
    database,
    maker,
    async (transaction, state) => {
      const made = await newRecords(transaction, maker, requests);
      const wanted: Wanted[] = [];
      // In turn, since a transaction runs one query at a time.
      for (const { id, request } of adding) {
        wanted.push({ type, id, record: await made(request) });
      }
      return saveRecordDrafts(transaction, maker, state, wanted);
    },
  );
  return { ...saved, ids: adding.map(({ id }) => id) };
}

// Refuses deciding a project's or proposal's draft that gives or takes an owner the actor doesn't
// see, as a feature team's draft naming someone hidden is refused, since the actor can't tell what
// it does.
export async function checkOwnersAsked(
  transaction: Transaction,
  actor: Actor,
  records: readonly RecordRef[],
  today: string,
  asking: "approve" | "reject",
): Promise<void> {
  const state = await readRecordsState(transaction);
  // Approving a draft approves those it uses, so each of them is checked too; rejecting rejects only
  // those asked for.
  const decided =
    asking === "approve" ? withUsedRecords(state, records) : records;
  const changes = decided.flatMap(({ type, id }) => {
    if (type !== "project" && type !== "proposal") return [];
    const live = text(stateOf(state, type).live.get(id)?.ownerId);
    const drafted = text(versionOf(state, type, id)?.ownerId);
    return live === drafted ? [] : [live, drafted];
  });
  const hidden = await hiddenPeople(
    transaction,
    actor,
    changes.filter((id): id is string => id !== null),
    today,
  );
  if (hidden.size > 0) throw new ForbiddenError(unseenDraft);
}

// The owner a request gives a record: the current one when the request names the owner the actor is
// shown, which for one hidden from them is none, so a save never changes an owner they can't see;
// otherwise one of People as the actor sees them.
async function ownerFor(
  transaction: Transaction,
  actor: Actor,
  requested: string | null,
  had: unknown,
): Promise<string | null> {
  const current = typeof had === "string" ? had : null;
  const hidden = await hiddenPeople(
    transaction,
    actor,
    [requested, current].filter((id): id is string => id !== null),
    await readToday(transaction),
  );
  const shown = current !== null && hidden.has(current) ? null : current;
  if (requested === shown) return current;
  if (requested === null) return null;
  await refuseOwnersUnseen(transaction, actor, [requested]);
  return requested;
}

// Refuses an owner asked for who isn't one of People as the actor sees them.
async function refuseOwnersUnseen(
  transaction: Transaction,
  actor: Actor,
  asked: readonly string[],
): Promise<void> {
  if (asked.length === 0) return;
  const today = await readToday(transaction);
  const shown = await shownPeople(transaction, actor, asked, today);
  if (asked.some((id) => !shown.has(id))) {
    throw new BadRequestError("Choose an owner from People");
  }
}

// Refuses new records' owners as a change's are refused, reading People once for all of them.
const refuseNewOwnersUnseen = (
  transaction: Transaction,
  maker: Actor,
  requests: readonly { ownerId: string | null }[],
) =>
  refuseOwnersUnseen(
    transaction,
    maker,
    requests.flatMap(({ ownerId }) => (ownerId === null ? [] : [ownerId])),
  );

// A customer, project, proposal, or feature, as a request adds or changes it.
export type PlanRecordRequest =
  | { type: "customer"; request: CustomerRequest }
  | { type: "project"; request: ProjectRequest }
  | { type: "proposal"; request: ProposalRequest }
  | { type: "feature"; request: FeatureRequest };

export type PlanKind = PlanRecordRequest["type"];

type AddedKind = Exclude<keyof PlanAddingRequests, "activity">;

// Records of one kind of the plan's, other than activities, as a request adds them.
export type PlanAdding<Kinds extends AddedKind = AddedKind> = {
  [Kind in Kinds]: { type: Kind; requests: PlanAddingRequests[Kind][] };
}[Kinds];

const customerRecord = (request: CustomerRequest) => ({
  name: request.name,
  description: request.description,
  note: keptNote(request.note),
});

export async function changeCustomer(
  database: Database,
  maker: Actor,
  id: string,
  request: CustomerRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, (transaction, state) =>
    saveRecordDraft(transaction, maker, state, "customer", id, {
      ...changeableRecord(state, "customer", id),
      ...customerRecord(request),
    }),
  );
}

const projectRecord = (request: ProjectRequest) => ({
  name: request.name,
  externalId: request.externalId,
  ownerId: request.ownerId,
  customerIds: request.customerIds,
  proposalIds: request.proposalIds,
  featureIds: request.featureIds,
});

export async function changeProject(
  database: Database,
  maker: Actor,
  id: string,
  request: ProjectRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, async (transaction, state) => {
    changeableRecord(state, "project", id);
    const ownerId = await ownerFor(
      transaction,
      maker,
      request.ownerId,
      shownVersion(state, "project", id)?.ownerId,
    );
    return saveRecordDraft(
      transaction,
      maker,
      state,
      "project",
      id,
      projectRecord({ ...request, ownerId }),
    );
  });
}

// A proposal as a request makes it, with the owner it is given, from the version shown, if any.
async function proposalRecord(
  choices: ChoiceReads,
  request: ProposalRequest,
  ownerId: string | null,
  current?: Recorded,
) {
  return {
    name: request.name,
    externalId: request.externalId,
    link: request.link,
    ownerId,
    customerIds: request.customerIds,
    statusId: await choices.status(
      "proposal-statuses",
      request.statusId,
      current?.statusId,
    ),
    featureIds: request.featureIds,
    removalReasons: removalReasonsAfter(
      reasonsOf(current),
      linkedIds(current, "featureIds"),
      request.featureIds,
    ),
  };
}

export async function changeProposal(
  database: Database,
  maker: Actor,
  id: string,
  request: ProposalRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, async (transaction, state) => {
    const proposal = changeableRecord(state, "proposal", id);
    const ownerId = await ownerFor(
      transaction,
      maker,
      request.ownerId,
      proposal.ownerId,
    );
    return saveRecordDraft(
      transaction,
      maker,
      state,
      "proposal",
      id,
      await proposalRecord(
        choiceReads(transaction),
        request,
        ownerId,
        proposal,
      ),
    );
  });
}

const featureReads = (
  transaction: Transaction,
  maker: Actor,
  requests: readonly FeatureRequest[],
) => planningReads(transaction, maker.user.id, "features", requests);

// A feature as a request makes it: its planning fields, then its customers and target cycle.
async function featureRecord(
  reads: PlanningReads,
  request: FeatureRequest,
  current?: Recorded,
) {
  return {
    ...(await planningRecord(reads, request, current)),
    customerIds: request.customerIds,
    targetStreamId: request.target?.streamId ?? null,
    targetCycle: request.target?.cycle ?? null,
  };
}

export async function changeFeature(
  database: Database,
  maker: Actor,
  id: string,
  request: FeatureRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, async (transaction, state) => {
    const feature = changeableRecord(state, "feature", id);
    const record = await featureRecord(
      await featureReads(transaction, maker, [request]),
      request,
      feature,
    );
    refuseFeatureFieldChanges(maker, feature, record);
    return saveRecordDraft(transaction, maker, state, "feature", id, record);
  });
}

// What else each kind that names features keeps once the features it names change: a proposal,
// the reason for each feature removed from it.
const keptWithScope: Readonly<
  Record<
    keyof typeof featureNamerKeys,
    (change: { record: Recorded; featureIds: readonly string[] }) => Recorded
  >
> = {
  project: () => ({}),
  proposal: ({ record, featureIds }) => ({
    removalReasons: removalReasonsAfter(
      reasonsOf(record),
      linkedIds(record, "featureIds"),
      featureIds,
    ),
  }),
};

// Adds a feature to, or takes it from, each project and proposal whose naming of it the request
// changes, as their drafts, in one change set. Those whose naming it keeps are left as they are, and
// so is one drafted to be removed that the request leaves out, since a view of the drafts applied
// does not show it.
export async function changeFeatureProjects(
  database: Database,
  maker: Actor,
  featureId: string,
  request: FeatureProjectsRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, async (transaction, state) => {
    if (shownVersion(state, "feature", featureId) === undefined) {
      throw new NotFoundError("There is no such feature");
    }
    const wanted = Object.entries(featureNamerKeys).flatMap(([kind, key]) => {
      const type = kind as keyof typeof featureNamerKeys;
      // The key is always one of the fixed keys.
      // eslint-disable-next-line security/detect-object-injection
      const named = request[key];
      if (named === undefined) return [];
      const asked = new Set(named);
      const naming = shownIds(state, type).filter((id) =>
        linkedIds(versionOf(state, type, id), "featureIds").includes(featureId),
      );
      const changing = [
        ...naming.filter((id) => !asked.has(id)),
        ...[...asked].filter((id) => !naming.includes(id)),
      ];
      return changing.map((id) => {
        if (
          recordExists(state, type, id) &&
          versionOf(state, type, id) === undefined
        ) {
          throw new ConflictError(
            `The ${type} ${String(shownVersion(state, type, id)?.name)} is drafted to be removed, so it can't be changed`,
          );
        }
        const record = changeableRecord(state, type, id);
        const others = linkedIds(record, "featureIds").filter(
          (other) => other !== featureId,
        );
        const featureIds = asked.has(id)
          ? [...others, featureId].sort()
          : others;
        // The kind is always one of the fixed kinds above.
        // eslint-disable-next-line security/detect-object-injection
        const kept = keptWithScope[type]({
          record,
          featureIds,
        });
        return { type, id, record: { ...record, featureIds, ...kept } };
      });
    });
    return saveRecordDrafts(transaction, maker, state, wanted);
  });
}

// Changes the reason for removing a feature from a proposal, while a draft removes it.
export async function changeRemovalReason(
  database: Database,
  maker: Actor,
  featureId: string,
  proposalId: string,
  request: RemovalReasonRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, async (transaction, state) => {
    const proposal = changeableRecord(state, "proposal", proposalId);
    const live = stateOf(state, "proposal").live.get(proposalId);
    if (
      !linkedIds(live, "featureIds").includes(featureId) ||
      linkedIds(proposal, "featureIds").includes(featureId)
    ) {
      throw new ConflictError(
        "No draft removes this feature from the proposal, so it has no reason to change",
      );
    }
    return saveRecordDraft(transaction, maker, state, "proposal", proposalId, {
      ...proposal,
      removalReasons: withRemovalReason(
        reasonsOf(proposal),
        featureId,
        request.removalReason,
      ),
    });
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

// How each kind is made new from its requests. A milestone's project is checked as any link is.
const newRecords: {
  [Kind in AddedKind]: NewRecords<PlanAddingRequests[Kind]>;
} = {
  customer: () =>
    Promise.resolve((request) => Promise.resolve(customerRecord(request))),
  project: async (transaction, maker, requests) => {
    await refuseNewOwnersUnseen(transaction, maker, requests);
    return (request) => Promise.resolve(projectRecord(request));
  },
  proposal: async (transaction, maker, requests) => {
    await refuseNewOwnersUnseen(transaction, maker, requests);
    const choices = choiceReads(transaction);
    return (request) => proposalRecord(choices, request, request.ownerId);
  },
  feature: async (transaction, maker, requests) => {
    const reads = await featureReads(transaction, maker, requests);
    return async (request) => {
      const record = await featureRecord(reads, request);
      refuseFeatureFieldChanges(maker, undefined, record);
      return record;
    };
  },
  milestone: () =>
    Promise.resolve(({ projectId, ...request }) =>
      Promise.resolve(milestoneRecord(projectId, request)),
    ),
};

export const addRecords = <Kind extends AddedKind>(
  database: Database,
  maker: Actor,
  { type, requests }: PlanAdding<Kind>,
) =>
  // eslint-disable-next-line security/detect-object-injection
  addingPlan(database, maker, type, requests, newRecords[type]);

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
export async function removing(
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
  if (discards) return discardRecordDraft(database, maker, type, id);
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
  type: PlanKind | "activity",
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
