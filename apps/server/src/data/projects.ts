// SPDX-License-Identifier: Apache-2.0

// Drafting changes to customers, projects with their milestones, proposals and features. Part of
// the data access layer; the caller checks the actor may change the kind, and a feature's customers
// are checked here, since they take more than changing features.

import { type Database, people } from "@fathom/db";
import {
  type CustomerRequest,
  featureNamerKeys,
  type FeatureProjectsRequest,
  type FeatureRequest,
  type BuiltInList,
  type Meaning,
  type MilestoneRequest,
  type ProjectRequest,
  type ProposalRequest,
  type RemovalReasonRequest,
  removalReasonsAfter,
  withRemovalReason,
  type RecordType,
} from "@fathom/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Actor } from "../access.ts";
import { BadRequestError, ConflictError, NotFoundError } from "../errors.ts";
import { checkBuiltInChoice, firstOfferedOrRefused } from "./built-in-lists.ts";
import type { Saved, Transaction } from "./changes.ts";
import { type Recorded, tidy } from "./draft-records.ts";
import { refuseCustomersChange } from "./feature-customers.ts";
import { checkTeamForFeature } from "./feature-team-removals.ts";
import { typeOf } from "./column-types.ts";
import {
  checkedLinks,
  checkedNotes,
  checkedNumbers,
  checkedValues,
  choicesAskedFor,
  valuesOf,
} from "./person-fields.ts";
import { columnsWithAdded } from "./added-columns.ts";
import { milestonesOf } from "./project-kinds.ts";
import { isGeneralFeature } from "./release-kinds.ts";
import { fieldOfValue, valueField } from "./values.ts";
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
import { discardRecordDraft } from "./record-decisions.ts";
import { keptNote, readRecordsState } from "./records.ts";
import { readToday } from "./settings.ts";
import { planOut, type PlanRecords, reasonsOf } from "./project-reads.ts";

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
      result: await planOut(transaction, editor, now, today),
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

// Refuses a project's general feature, which is off the roadmap, as a feature a record names.
function checkRoadmapFeatures(
  state: RecordsState,
  featureIds: readonly string[],
): void {
  if (featureIds.some((id) => isGeneralFeature(state, id))) {
    throw new BadRequestError("Choose features from Features");
  }
}

// A customer, project, proposal, or feature, as a request adds or changes it.
export type PlanRecordRequest =
  | { type: "customer"; request: CustomerRequest }
  | { type: "project"; request: ProjectRequest }
  | { type: "proposal"; request: ProposalRequest }
  | { type: "feature"; request: FeatureRequest };

export type PlanKind = PlanRecordRequest["type"];

const customerRecord = (request: CustomerRequest) => ({
  name: request.name,
  description: request.description,
  note: keptNote(request.note),
});

export async function addCustomer(
  database: Database,
  maker: Actor,
  request: CustomerRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, (transaction, state) =>
    saveRecordDraft(
      transaction,
      maker,
      state,
      "customer",
      randomUUID(),
      customerRecord(request),
    ),
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

export async function addProject(
  database: Database,
  maker: Actor,
  request: ProjectRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, async (transaction, state) => {
    await checkOwner(transaction, request.ownerId);
    checkRoadmapFeatures(state, request.featureIds);
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
    checkRoadmapFeatures(state, request.featureIds);
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

type StatusList = Extract<
  BuiltInList,
  "proposal-statuses" | "feature-statuses"
>;

// How a record with no status starts: in the first status offered, of a meaning when one is named.
const startingStatus: Readonly<
  Record<StatusList, { meaning?: Meaning; missing: string }>
> = {
  "proposal-statuses": {
    missing: "No proposal status is offered. Add one to the list first.",
  },
  "feature-statuses": {
    meaning: "possible",
    missing: "No feature status means Possible. Add one to the list first.",
  },
};

// The status a record is given: the one asked for, if it is offered or the record already has it,
// or, for a record added without one, the first status it can start in.
async function statusFor(
  transaction: Transaction,
  list: StatusList,
  asked: string | undefined,
  had: unknown,
): Promise<string> {
  if (asked !== undefined) {
    await checkBuiltInChoice(transaction, list, asked, had);
    return asked;
  }
  if (typeof had === "string") return had;
  // The list is always one of the two above.
  // eslint-disable-next-line security/detect-object-injection
  const { meaning, missing } = startingStatus[list];
  return firstOfferedOrRefused(transaction, list, meaning, missing);
}

// A proposal as a request makes it, from the version shown, if any.
async function proposalRecord(
  transaction: Transaction,
  state: RecordsState,
  request: ProposalRequest,
  current?: Recorded,
) {
  await checkOwner(transaction, request.ownerId);
  checkRoadmapFeatures(state, request.featureIds);
  return {
    name: request.name,
    externalId: request.externalId,
    link: request.link,
    ownerId: request.ownerId,
    customerIds: request.customerIds,
    statusId: await statusFor(
      transaction,
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
      await proposalRecord(transaction, state, request),
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
      await proposalRecord(transaction, state, request, proposal),
    );
  });
}

// A feature's values in the columns added to Features, live or drafted to be added as the editor sees
// them: those a request names replace those it has, each checked against its column, and every
// required column must then hold one.
async function featureValues(
  transaction: Transaction,
  editor: string,
  request: FeatureRequest,
  current: Recorded | undefined,
): Promise<Recorded> {
  const columns = await columnsWithAdded(transaction, editor, true, "features");
  const known = await choicesAskedFor(transaction, editor, [request]);
  const had = current === undefined ? undefined : valuesOf(current);
  const chosen = checkedValues(columns, known, request.values, had);
  const kept = Object.fromEntries(
    Object.entries(current ?? {}).filter(
      ([field]) => fieldOfValue(field) !== null,
    ),
  );
  const values: Recorded = {
    ...kept,
    ...Object.fromEntries(
      [...chosen].map(([fieldId, ids]) => [valueField(fieldId), ids]),
    ),
    ...checkedLinks(columns, request.links),
    ...checkedNotes(columns, request.notes),
    ...checkedNumbers(columns, request.numbers),
  };
  for (const column of columns) {
    if (
      column.required &&
      typeOf(column).count(values[valueField(column.id)]) === 0
    ) {
      throw new BadRequestError(`${column.name} must be filled in`);
    }
  }
  return tidy(values);
}

// A choice of a built-in list a record need not have: none, or one offered or the record already has.
async function optionalChoice(
  transaction: Transaction,
  list: BuiltInList,
  asked: string | null,
  had: unknown,
): Promise<string | null> {
  if (asked !== null) await checkBuiltInChoice(transaction, list, asked, had);
  return asked;
}

async function featureRecord(
  transaction: Transaction,
  editor: string,
  request: FeatureRequest,
  current?: Recorded,
) {
  await checkTeamForFeature(transaction, request.featureTeamId);
  const added = await featureValues(transaction, editor, request, current);
  return {
    ...added,
    name: request.name,
    statusId: await statusFor(
      transaction,
      "feature-statuses",
      request.statusId,
      current?.statusId,
    ),
    priorityId: await optionalChoice(
      transaction,
      "feature-priorities",
      request.priorityId,
      current?.priorityId,
    ),
    sizeId: await optionalChoice(
      transaction,
      "feature-sizes",
      request.sizeId,
      current?.sizeId,
    ),
    riskId: await optionalChoice(
      transaction,
      "feature-risks",
      request.riskId,
      current?.riskId,
    ),
    neededBy: request.neededBy,
    customerIds: request.customerIds,
    targetStreamId: request.target?.streamId ?? null,
    targetCycle: request.target?.cycle ?? null,
    estimateHours: request.estimateHours,
    featureTeamId: request.featureTeamId,
    description: request.description,
    note: keptNote(request.note),
  };
}

export async function addFeature(
  database: Database,
  maker: Actor,
  request: FeatureRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, async (transaction, state) => {
    const record = await featureRecord(transaction, maker.user.id, request);
    refuseCustomersChange(maker, undefined, record);
    return saveRecordDraft(
      transaction,
      maker,
      state,
      "feature",
      randomUUID(),
      record,
    );
  });
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
      transaction,
      maker.user.id,
      request,
      feature,
    );
    refuseCustomersChange(maker, feature, record);
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
    if (
      shownVersion(state, "feature", featureId) === undefined ||
      isGeneralFeature(state, featureId)
    ) {
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
