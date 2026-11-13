// SPDX-License-Identifier: Apache-2.0

// Drafts of the fictional plan and feature teams, made through the server's data access layer as
// the personas who make and judge them would. The Product Manager drafts, on the Platform release
// stream, a release added after the last, the release ending this quarter renamed and given another
// colour, and the release to come moved one cycle later, and, on Patches, another colour for the
// release under way; renames a project, adds a milestone to another and renames and moves one of its
// milestones, gives the open proposal a Proposal ID, adds a customer, and renames a third project;
// changes a planned feature's estimate and description and adds a feature; and publishes them. The
// Engineering Operations Manager drafts retiring Patches, renaming the second feature team, and
// adding someone to the last and taking someone else off it, and publishes them. The Engineering
// Director rejects the Patches release's colour and the third project's new name with a reason.
// Then come changes left unpublished, which hold their records: the second Engineering Operations
// Manager's new names for Platform and the third feature team, and the Project Manager's new
// estimate for a possible feature in Later. Each group is made once since its records were last
// added. Removing the seed data discards these drafts first, unpublished ones included. A
// development-only package, never included in the runtime image.

import { changes, type Database, drafts } from "@fathom/db";
import type { FictionalOrganization, FictionalPerson } from "@fathom/fixtures";
import type { Actor } from "@fathom/server/access";
import { createDataAccess } from "@fathom/server/data";
import {
  addDays,
  type Feature,
  type FeatureRequest,
  type Project,
  type Proposal,
  type RecordType,
  type Release,
  type ReleaseStream,
} from "@fathom/shared";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { accountDomain } from "./accounts.ts";
import { actorOf, addedAt, rejection } from "./drafts.ts";
import { seededFeatures } from "./features.ts";
import {
  customerId,
  featureId,
  milestoneId,
  projectId,
  proposalId,
  seededCustomers,
  seededProjects,
  seededProposals,
} from "./projects.ts";
import { releaseId, seededKeys, streamId } from "./releases.ts";

const planEditorEmail = `product.manager@${accountDomain}`;
const otherPlanEditorEmail = `project.manager@${accountDomain}`;
const editorEmail = `engineering.operations.manager@${accountDomain}`;
const secondEditorEmail = `engineering.operations.manager.2@${accountDomain}`;
const approverEmail = `engineering.director@${accountDomain}`;

// The records the seed drafts adding, which nothing seeded is called.
export const addedRelease = "Harbor 4";
export const addedMilestone = "Second crane live";
export const addedCustomer = "Saltmarsh Ferries";
export const addedFeature = "Shift Handover Notes";

export const draftedFeatureTeamName = "Search and discovery";
export const heldStreamName = "Platform core";
export const heldFeatureTeamName = "Reliability guild";

// Days from the seed day to the milestone drafted adding, and how much later the moved one is.
const addedMilestoneDays = 75;
const movedMilestoneDays = 30;
const draftedEstimateHours = 720;
const heldEstimateHours = 1500;
// The cycles after the moved release's last before the one the release drafted adding is on.
const addedReleaseGap = 2;
// The colours drafted for the renamed release and the release whose colour is rejected.
const renamedReleaseColour = "teal";
const refusedReleaseColour = "red";

// The kinds of plan record the seed drafts, with feature teams, whose drafts it discards on removal.
export const planDraftTypes = [
  "release-stream",
  "release",
  "project",
  "milestone",
  "proposal",
  "customer",
  "feature",
] as const satisfies readonly RecordType[];
export const seededDraftTypes = [...planDraftTypes, "feature-team"] as const;
type SeededDraftType = (typeof seededDraftTypes)[number];

const [platformKeys, patchesKeys] = seededKeys;
const [craneControl, clinicBooking, transitDisplays] = seededProjects as [
  (typeof seededProjects)[number],
  (typeof seededProjects)[number],
  (typeof seededProjects)[number],
];
const openProposal = present(
  seededProposals.find(({ status }) => status === "Open"),
  "open proposal",
);

// A seeded record the drafts need, which the fixtures always make; stops the seed, naming it, if not.
export function present<Value>(value: Value | undefined, what: string): Value {
  if (value === undefined) throw new Error(`The seed data has no ${what}`);
  return value;
}

// The seeded features the drafts change, by their status and place: the first planned one with an
// estimate, and the first possible one in Later, which the Project Manager holds.
const changedFeature = featureId(
  present(
    seededFeatures.find(
      ({ status, hours }) => status === "planned" && hours !== null,
    )?.key,
    "planned feature with an estimate",
  ),
);
const heldFeature = featureId(
  present(
    seededFeatures.find(
      ({ status, cycle }) => status === "possible" && cycle === null,
    )?.key,
    "possible feature in Later",
  ),
);

// The seeded feature teams the drafts change: the second renamed, the third held, and the last
// given and losing members.
function draftedTeams(organization: FictionalOrganization) {
  const { featureTeams } = organization;
  return {
    renamed: present(featureTeams[1], "second feature team"),
    held: present(featureTeams[2], "third feature team"),
    regrouped: present(featureTeams.at(-1), "last feature team"),
  };
}

// Whether a draft of the record, by anyone, published or not, has been made since the seed data last
// added it; a record not added counts as drafted, so nothing is drafted of it.
async function draftedSinceAdded(
  database: Database,
  recordId: string,
): Promise<boolean> {
  const added = await addedAt(database, recordId);
  if (added === null) return true;
  const found = await database
    .select({ one: sql`1` })
    .from(changes)
    .where(
      and(
        eq(changes.recordId, recordId),
        eq(changes.draft, true),
        gt(changes.id, added),
      ),
    )
    .limit(1);
  return found.length > 0;
}

const byId = <Item extends { id: string }>(
  items: readonly Item[],
  id: string,
) =>
  // The seed data always has the records its drafts change.
  items.find((item) => item.id === id) as Item;

const releaseRequest = (release: Release) => ({
  name: release.name,
  firstCycle: release.firstCycle,
  lastCycle: release.lastCycle,
  shipsOn: release.shipsOn,
  colour: release.colour,
});

const projectRequest = (project: Project) => ({
  name: project.name,
  externalId: project.externalId,
  ownerId: project.ownerId,
  customerIds: project.customerIds,
  proposalIds: project.proposalIds,
  featureIds: project.featureIds,
});

const proposalRequest = (proposal: Proposal) => ({
  name: proposal.name,
  externalId: proposal.externalId,
  link: proposal.link,
  ownerId: proposal.ownerId,
  customerIds: proposal.customerIds,
  statusId: proposal.statusId,
  featureIds: proposal.featureIds,
});

const featureRequest = (feature: Feature): FeatureRequest => ({
  name: feature.name,
  statusId: feature.statusId,
  neededBy: feature.neededBy,
  customerIds: feature.customerIds,
  target:
    feature.targetStreamId === null || feature.targetCycle === null
      ? null
      : { streamId: feature.targetStreamId, cycle: feature.targetCycle },
  estimateHours: feature.estimateHours,
  featureTeamId: feature.featureTeamId,
  description: feature.description,
  note: feature.note,
  values: {},
  links: {},
  notes: {},
  numbers: {},
});

// The start of the cycle some cycles after the one starting on a day.
const cycleAfter = (stream: ReleaseStream, startsOn: string, by: number) =>
  present(
    stream.cycles.at(
      stream.cycles.findIndex((cycle) => cycle.startsOn === startsOn) + by,
    )?.startsOn,
    `cycle ${String(by)} after ${startsOn} in ${stream.name}`,
  );

// The drafts of releases and their streams, unless made since the streams were last added.
async function draftReleases(
  database: Database,
  editor: Actor,
  configurer: Actor,
): Promise<{ type: RecordType; id: string }[]> {
  const renamed = releaseId(platformKeys, platformKeys.releases[1]);
  if (await draftedSinceAdded(database, renamed)) return [];
  const data = createDataAccess(database);
  const { streams } = await data.releases.read(editor);
  const platform = byId(streams, streamId(platformKeys));
  const patches = byId(streams, streamId(patchesKeys));
  const ending = byId(platform.releases, renamed);
  await data.releases.updateRelease(editor, platform.id, ending.id, {
    ...releaseRequest(ending),
    name: `${ending.name} LTS`,
    colour: renamedReleaseColour,
  });
  const moved = byId(
    platform.releases,
    releaseId(platformKeys, platformKeys.releases[2]),
  );
  const movedLast = cycleAfter(platform, moved.lastCycle, 1);
  await data.releases.updateRelease(editor, platform.id, moved.id, {
    ...releaseRequest(moved),
    firstCycle: cycleAfter(platform, moved.firstCycle, 1),
    lastCycle: movedLast,
  });
  const added = cycleAfter(platform, movedLast, addedReleaseGap);
  await data.releases.addRelease(editor, platform.id, {
    name: addedRelease,
    firstCycle: added,
    lastCycle: added,
    shipsOn: null,
    colour: null,
  });
  const refused = byId(
    patches.releases,
    releaseId(patchesKeys, patchesKeys.releases[1]),
  );
  await data.releases.updateRelease(editor, patches.id, refused.id, {
    ...releaseRequest(refused),
    colour: refusedReleaseColour,
  });
  await data.unpublished.publish(editor);
  await data.releases.updateStream(configurer, patches.id, { retired: true });
  await data.unpublished.publish(configurer);
  return [{ type: "release", id: refused.id }];
}

// The drafts of projects, their milestones, proposals, and customers, unless made since the
// projects were last added.
async function draftProjects(
  database: Database,
  editor: Actor,
  today: string,
): Promise<{ type: RecordType; id: string }[]> {
  const renamedId = projectId(clinicBooking.key);
  if (await draftedSinceAdded(database, renamedId)) return [];
  const data = createDataAccess(database);
  const plan = await data.projects.read(editor);
  const renamed = byId(plan.projects, renamedId);
  await data.projects.change(editor, renamed.id, {
    type: "project",
    request: { ...projectRequest(renamed), name: `${renamed.name} Rollout` },
  });
  const cranes = byId(plan.projects, projectId(craneControl.key));
  await data.projects.addMilestone(editor, cranes.id, {
    name: addedMilestone,
    date: addDays(today, addedMilestoneDays),
    customerDelivery: true,
  });
  const lastKey = present(
    craneControl.milestones.at(-1)?.key,
    "milestone of Crane Control",
  );
  const last = byId(cranes.milestones, milestoneId(craneControl.key, lastKey));
  await data.projects.changeMilestone(editor, cranes.id, last.id, {
    name: `Final ${last.name.toLowerCase()}`,
    date: addDays(last.date, movedMilestoneDays),
    customerDelivery: last.customerDelivery,
  });
  const proposal = byId(plan.proposals, proposalId(openProposal.key));
  await data.projects.change(editor, proposal.id, {
    type: "proposal",
    request: { ...proposalRequest(proposal), externalId: "PR-110" },
  });
  await data.projects.add(editor, {
    type: "customer",
    request: { name: addedCustomer },
  });
  const refused = byId(plan.projects, projectId(transitDisplays.key));
  await data.projects.change(editor, refused.id, {
    type: "project",
    request: { ...projectRequest(refused), name: `${refused.name} Phase 2` },
  });
  await data.unpublished.publish(editor);
  return [{ type: "project", id: refused.id }];
}

// The drafts of features, unless made since the features were last added.
async function draftFeatures(
  database: Database,
  editor: Actor,
  organization: FictionalOrganization,
): Promise<boolean> {
  if (await draftedSinceAdded(database, changedFeature)) return false;
  const data = createDataAccess(database);
  const { features } = await data.projects.read(editor);
  const changed = byId(features, changedFeature);
  await data.projects.change(editor, changed.id, {
    type: "feature",
    request: {
      ...featureRequest(changed),
      estimateHours: draftedEstimateHours,
      description: "Approve requests from a phone.",
    },
  });
  await data.projects.add(editor, {
    type: "feature",
    request: {
      name: addedFeature,
      neededBy: null,
      customerIds: [],
      target: null,
      estimateHours: null,
      featureTeamId: present(organization.featureTeams[0]?.id, "feature team"),
      description: "Pass notes from one shift to the next.",
      note: null,
      values: {},
      links: {},
      notes: {},
      numbers: {},
    },
  });
  await data.unpublished.publish(editor);
  return true;
}

// Someone current on the reference date on no feature team, the latest such in the fictional
// people, so no other seed draft changes them.
function teamless(organization: FictionalOrganization): FictionalPerson {
  const onTeams = new Set(
    organization.featureTeams.flatMap(({ memberships }) =>
      memberships.map(({ personId }) => personId),
    ),
  );
  return present(
    organization.people.findLast(
      ({ id, startDate, endDate }) =>
        !onTeams.has(id) &&
        endDate === null &&
        String(startDate) <= organization.referenceDate,
    ),
    "current person on no feature team",
  );
}

// The drafts of feature teams, unless made since the teams were last added.
async function draftFeatureTeams(
  database: Database,
  editor: Actor,
  organization: FictionalOrganization,
): Promise<boolean> {
  const { renamed, regrouped } = draftedTeams(organization);
  if (await draftedSinceAdded(database, renamed.id)) return false;
  const data = createDataAccess(database);
  await data.featureTeams.update(editor, renamed.id, {
    name: draftedFeatureTeamName,
  });
  const leaving = regrouped.memberships.find(
    ({ personId, member }) => member && personId !== regrouped.leadId,
  );
  await data.featureTeams.update(editor, regrouped.id, {
    add: [teamless(organization).id],
    remove: [present(leaving?.personId, "member to take off a team")],
  });
  await data.unpublished.publish(editor);
  return true;
}

// Makes each group of the seed's drafts of the plan and feature teams not made since its records
// were last added, and has the Engineering Director reject those it rejects. Returns whether it made
// any.
export async function seedPlanDrafts(
  database: Database,
  organization: FictionalOrganization,
): Promise<boolean> {
  const editor = await actorOf(database, planEditorEmail);
  const configurer = await actorOf(database, editorEmail);
  const refused = [
    ...(await draftReleases(database, editor, configurer)),
    ...(await draftProjects(database, editor, organization.referenceDate)),
  ];
  const features = await draftFeatures(database, editor, organization);
  const teams = await draftFeatureTeams(database, configurer, organization);
  if (refused.length > 0) {
    await createDataAccess(database).drafts.reject(
      await actorOf(database, approverEmail),
      { records: refused },
      rejection,
    );
  }
  return refused.length > 0 || features || teams;
}

// Makes the changes to the plan and feature teams the seed leaves unpublished, after every seed
// draft is published: the second Engineering Operations Manager's new names for Platform and the
// third feature team, and the Project Manager's new estimate for a possible feature in Later. Each
// is made once since its record was last added. Returns whether it made any.
export async function seedUnpublishedPlan(
  database: Database,
  organization: FictionalOrganization,
): Promise<boolean> {
  const data = createDataAccess(database);
  const platform = streamId(platformKeys);
  const { held } = draftedTeams(organization);
  let made = false;
  if (!(await draftedSinceAdded(database, platform))) {
    await data.releases.updateStream(
      await actorOf(database, secondEditorEmail),
      platform,
      { name: heldStreamName },
    );
    made = true;
  }
  if (!(await draftedSinceAdded(database, held.id))) {
    await data.featureTeams.update(
      await actorOf(database, secondEditorEmail),
      held.id,
      { name: heldFeatureTeamName },
    );
    made = true;
  }
  if (!(await draftedSinceAdded(database, heldFeature))) {
    const holder = await actorOf(database, otherPlanEditorEmail);
    const { features } = await data.projects.read(holder);
    await data.projects.change(holder, heldFeature, {
      type: "feature",
      request: {
        ...featureRequest(byId(features, heldFeature)),
        estimateHours: heldEstimateHours,
      },
    });
    made = true;
  }
  return made;
}

// The seeded records of the plan and feature teams, and those the seed drafts adding, by kind.
function seededRecords(organization: FictionalOrganization) {
  return {
    ids: new Set([
      ...seededKeys.flatMap((stream) => [
        streamId(stream),
        ...stream.releases.map((key) => releaseId(stream, key)),
      ]),
      ...seededProjects.flatMap((project) => [
        projectId(project.key),
        ...project.milestones.map(({ key }) => milestoneId(project.key, key)),
      ]),
      ...seededProposals.map(({ key }) => proposalId(key)),
      ...seededCustomers.map(({ key }) => customerId(key)),
      ...seededFeatures.map(({ key }) => featureId(key)),
      ...organization.featureTeams.map(({ id }) => id),
    ]),
    added: new Set([
      `release ${addedRelease}`,
      `milestone ${addedMilestone}`,
      `customer ${addedCustomer}`,
      `feature ${addedFeature}`,
    ]),
  };
}

// Discards the published drafts of the seed data's plan records and feature teams, and of those it
// drafted adding, those made by hand included, since removing the seed data removes the records
// they change, as the Engineering Director, who may change every kind, and returns how many.
// Unpublished changes go first, as unseedUnpublished discards them.
export async function unseedPlanDrafts(
  database: Database,
  organization: FictionalOrganization,
): Promise<number> {
  const { ids, added } = seededRecords(organization);
  const found = (
    await database
      .select({
        // Only these kinds are selected, below.
        recordType: sql<SeededDraftType>`${drafts.recordType}`,
        recordId: drafts.recordId,
        action: drafts.action,
        name: sql<string | null>`${drafts.fields}->>'name'`,
      })
      .from(drafts)
      .where(inArray(drafts.recordType, [...seededDraftTypes]))
  ).filter(
    ({ recordType, recordId, action, name }) =>
      ids.has(recordId) ||
      (action === "created" && added.has(`${recordType} ${String(name)}`)),
  );
  if (found.length === 0) return 0;
  const data = createDataAccess(database);
  const approver = await actorOf(database, approverEmail);
  const asRecord = (type: (typeof planDraftTypes)[number]) => (id: string) =>
    data.records.discardDraft(approver, type, id);
  // How a draft of each kind is discarded: feature teams have a store of their own.
  const discards: Record<SeededDraftType, (id: string) => Promise<unknown>> = {
    "release-stream": asRecord("release-stream"),
    release: asRecord("release"),
    project: asRecord("project"),
    milestone: asRecord("milestone"),
    proposal: asRecord("proposal"),
    customer: asRecord("customer"),
    feature: asRecord("feature"),
    "feature-team": (id) => data.featureTeams.discardDraft(approver, id),
  };
  for (const { recordType, recordId } of found) {
    // The kind is one of the union's own.
    // eslint-disable-next-line security/detect-object-injection
    await discards[recordType](recordId);
  }
  await data.unpublished.publish(approver);
  return found.length;
}
