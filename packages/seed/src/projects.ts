// SPDX-License-Identifier: Apache-2.0

// The fictional organization's customers, proposals, projects with their milestones, and the
// projects' and releases' activities, and removing them. A development-only package, never in the
// runtime image.

import {
  activities,
  type ChangeRecord,
  customers,
  type Database,
  drafts,
  features,
  listItems,
  lists,
  milestones,
  people,
  privateChanges,
  projects,
  proposals,
  type Reader,
  recordChanges,
  releases,
} from "@fathom/db";
import { fictionalId } from "@fathom/fixtures";
import { addDays } from "@fathom/shared";
import { and, asc, eq, inArray, notInArray, or, sql } from "drizzle-orm";
import {
  activityId,
  releaseActivityId,
  type SeededActivity,
  type SeededReleaseActivity,
  seededActivities,
  seededActivityIds,
  seededReleaseActivities,
} from "./activities.ts";
import { filledIn, recorded, type SeededChange } from "./recorded.ts";
import { releaseId } from "./releases.ts";
import { planningColumns } from "./seeded-planning.ts";

// Each record has a key of its own, which its identifier is made from. One customer has neither a
// description nor a note, and one a note long enough to fold.
export const seededCustomers: readonly {
  key: "harbour" | "clinics" | "transit" | "mining" | "air";
  name: string;
  description?: string;
  note?: string;
}[] = [
  {
    key: "harbour",
    name: "Bluefin Harbour Authority",
    description:
      "Port operator running two container terminals and a ferry quay.",
    note: [
      "**Quarterly review** in March, at the harbour office.",
      "Wants the crane work live before the summer peak; a slip past May costs them the season.",
      "- Prefers releases on Tuesdays, never in a month's last week",
      "- Their IT team tests on a copy for two weeks first",
      "- Asked twice about offline sync for the yard tablets",
      "Billing contact changed in October.",
      "Renewal talks start once the first handover is signed.",
      "Site visits need a day's notice at the gate.",
      "Their operations lead joins the monthly call; their finance lead joins each quarter.",
      "Crane downtime is planned for the first Sunday of each month.",
      "They keep a test terminal open for demonstrations.",
    ].join("\n\n"),
  },
  {
    key: "clinics",
    name: "Cedar Valley Clinics",
    description: "Group of six rural clinics sharing one booking system.",
    note: "Pilot at the north clinic first, then the other five.",
  },
  {
    key: "transit",
    name: "Marlow City Transit",
    description: "City bus and tram operator with displays at every stop.",
  },
  { key: "mining", name: "Kestrel Mining Cooperative" },
  {
    key: "air",
    name: "Orchid Regional Air",
    description: "Regional airline flying twelve island routes.",
  },
];

type CustomerKey = (typeof seededCustomers)[number]["key"];

// A proposal's status is named by the choice the built-in list starts with.
export const seededProposals: readonly {
  key: string;
  name: string;
  externalId: string | null;
  link: string | null;
  status: string;
  customers: readonly CustomerKey[];
  // Which of the organization's managers owns it, by their place among them, if anyone does.
  owner: number | null;
  // The seeded features it proposes, by key.
  features: readonly string[];
  // A seeded feature it proposed and no longer does, by key, with the reason given for removing it.
  removed?: { feature: string; reason: string };
}[] = [
  {
    key: "cranes",
    name: "Harbour Cranes Upgrade",
    externalId: "PR-101",
    link: "https://example.com/proposals/cranes",
    status: "Won",
    customers: ["harbour"],
    owner: 0,
    features: ["audit-export", "offline-sync"],
  },
  {
    key: "scheduling",
    name: "Clinic Scheduling Pilot",
    externalId: "PR-102",
    link: null,
    status: "Won",
    customers: ["clinics"],
    owner: 1,
    features: ["offline-sync", "scheduler-api"],
  },
  {
    key: "wifi",
    name: "Cabin Wi-Fi Refresh",
    externalId: null,
    link: "https://example.com/proposals/cabin-wifi",
    status: "Open",
    customers: ["air"],
    owner: 2,
    features: ["mobile-approvals", "voice-notes"],
  },
  {
    key: "fleet",
    name: "Fleet Tracking Bid",
    externalId: "PR-097",
    link: null,
    status: "Lost",
    customers: ["transit"],
    owner: null,
    features: ["retention-controls", "partner-portal"],
    removed: {
      feature: "report-builder",
      reason: "Reporting dropped from the bid",
    },
  },
  {
    key: "ore",
    name: "Ore Sorting Study",
    externalId: null,
    link: null,
    status: "Withdrawn",
    customers: ["mining"],
    owner: null,
    features: ["partner-portal"],
  },
];

// Each milestone's date is some days from the seed day: before it when negative.
export const seededProjects: readonly {
  key: string;
  name: string;
  externalId: string | null;
  customers: readonly CustomerKey[];
  proposals: readonly string[];
  owner: number | null;
  // The seeded features it needs, by key.
  features: readonly string[];
  milestones: readonly {
    key: string;
    name: string;
    days: number;
    customerDelivery: boolean;
  }[];
}[] = [
  {
    key: "crane-control",
    name: "Crane Control",
    externalId: "P-2001",
    customers: ["harbour"],
    proposals: ["cranes"],
    owner: 0,
    features: ["audit-export", "offline-sync"],
    milestones: [
      { key: "kickoff", name: "Kickoff", days: -60, customerDelivery: false },
      {
        key: "factory-test",
        name: "Factory test",
        days: -10,
        customerDelivery: false,
      },
      {
        key: "first-crane",
        name: "First crane live",
        days: 30,
        customerDelivery: true,
      },
      { key: "handover", name: "Handover", days: 120, customerDelivery: true },
    ],
  },
  {
    key: "clinic-booking",
    name: "Clinic Booking",
    externalId: null,
    customers: ["clinics"],
    proposals: ["scheduling"],
    owner: 1,
    features: ["offline-sync", "scheduler-api"],
    milestones: [
      {
        key: "design-review",
        name: "Design review",
        days: 14,
        customerDelivery: false,
      },
      { key: "pilot", name: "Pilot release", days: 75, customerDelivery: true },
    ],
  },
  {
    key: "transit-displays",
    name: "Transit Displays",
    externalId: "P-1984",
    customers: ["transit", "air"],
    proposals: [],
    owner: null,
    features: ["retention-controls"],
    milestones: [
      {
        key: "delivered",
        name: "Displays delivered",
        days: -45,
        customerDelivery: true,
      },
      {
        key: "warranty",
        name: "Warranty ends",
        days: 200,
        customerDelivery: false,
      },
    ],
  },
  {
    key: "internal-tools",
    name: "Internal Tools",
    externalId: null,
    customers: [],
    proposals: [],
    owner: null,
    features: ["usage-alerts"],
    milestones: [],
  },
  {
    key: "depot-operations",
    name: "Depot Operations",
    externalId: "P-2017",
    customers: ["mining"],
    proposals: [],
    owner: 2,
    features: ["parts-lookup", "barcode-scanning", "work-order-sync"],
    milestones: [
      {
        key: "depot-pilot",
        name: "Depot pilot",
        days: -30,
        customerDelivery: true,
      },
      {
        key: "all-depots",
        name: "All depots live",
        days: 150,
        customerDelivery: true,
      },
    ],
  },
];

export const customerId = (key: string) => fictionalId(`customer:${key}`);
export const proposalId = (key: string) => fictionalId(`proposal:${key}`);
export const projectId = (key: string) => fictionalId(`project:${key}`);
export const featureId = (key: string) => fictionalId(`feature:${key}`);
export const milestoneId = (project: string, key: string) =>
  fictionalId(`milestone:${project}:${key}`);

const customerIds = (keys: readonly string[]) => keys.map(customerId).sort();
const featureIds = (keys: readonly string[]) => keys.map(featureId).sort();

// Whether a draft's fields link, by a list of identifiers under a name, to any of these.
export const linksAny = (
  fields: unknown,
  name: string,
  ids: readonly string[],
) =>
  ids.length === 0
    ? undefined
    : sql`jsonb_exists_any(${fields}->${name}, ARRAY[${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )}]::text[])`;

// The built-in proposal statuses' choices by label, in lower case, and the first in the list's
// order, for a status renamed since.
async function readStatuses(
  reader: Reader,
): Promise<(label: string) => string | undefined> {
  const rows = await reader
    .select({ id: listItems.id, label: listItems.label })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(eq(lists.builtIn, "proposal-statuses"))
    .orderBy(asc(listItems.position), asc(listItems.id));
  const byLabel = new Map(
    rows.map(({ id, label }) => [label.toLowerCase(), id]),
  );
  return (label) => byLabel.get(label.toLowerCase()) ?? rows[0]?.id;
}

// The current managers the seed data added, in order, who own records by their place among them.
async function readOwners(
  reader: Reader,
  managerIds: readonly string[],
): Promise<(place: number | null) => string | null> {
  const present = new Set(
    (
      await reader
        .select({ id: people.id })
        .from(people)
        .where(inArray(people.id, [...managerIds]))
    ).map(({ id }) => id),
  );
  const owners = managerIds.filter((id) => present.has(id));
  return (place) => (place === null ? null : (owners.at(place) ?? null));
}

// Adds the customers, proposals, and projects unless any is already there. Returns whether it
// added them.
export async function seedProjects(
  database: Database,
  today: string,
  managerIds: readonly string[],
  teamIds: readonly string[],
): Promise<boolean> {
  return database.transaction(async (transaction) => {
    const [present] = await transaction
      .select({ id: customers.id })
      .from(customers)
      .where(
        inArray(
          customers.id,
          seededCustomers.map(({ key }) => customerId(key)),
        ),
      );
    if (present !== undefined) return false;
    const status = await readStatuses(transaction);
    const owner = await readOwners(transaction, managerIds);
    const planningOf = await planningColumns(transaction, today, teamIds);
    const made: SeededChange[] = [];
    const addActivity = async (
      recordId: string,
      activity: SeededActivity | SeededReleaseActivity,
      belongsTo: { projectId: string } | { releaseId: string },
    ) => {
      const values = {
        ...belongsTo,
        name: activity.name,
        ...planningOf(activity),
        description: activity.description,
        estimateHours: activity.estimateHours,
      };
      await transaction.insert(activities).values({ id: recordId, ...values });
      made.push(...recorded("activity", recordId, "created", filledIn(values)));
    };
    // Features removed from proposals, recorded after the proposals were added, as an edit is.
    const removals: ChangeRecord[] = [];
    for (const { key, name, description, note } of seededCustomers) {
      const id = customerId(key);
      const fields = {
        name,
        description: description ?? null,
        note: note ?? null,
      };
      await transaction.insert(customers).values({ id, ...fields });
      made.push(...recorded("customer", id, "created", filledIn(fields)));
    }
    for (const proposal of seededProposals) {
      const id = proposalId(proposal.key);
      const row = {
        name: proposal.name,
        externalId: proposal.externalId,
        link: proposal.link,
        ownerId: owner(proposal.owner),
        customerIds: customerIds(proposal.customers),
        statusId: String(status(proposal.status)),
        featureIds: featureIds(proposal.features),
      };
      const { removed } = proposal;
      const proposed =
        removed === undefined
          ? row.featureIds
          : featureIds([...proposal.features, removed.feature]);
      const reasons =
        removed === undefined
          ? {}
          : { [featureId(removed.feature)]: removed.reason };
      await transaction
        .insert(proposals)
        .values({ id, ...row, removalReasons: reasons });
      made.push(
        ...recorded("proposal", id, "created", {
          ...row,
          featureIds: proposed,
        }),
      );
      if (removed !== undefined) {
        removals.push(
          ...(
            [
              ["featureIds", proposed, row.featureIds],
              ["removalReasons", {}, reasons],
            ] as const
          ).map(([field, oldValue, newValue]): ChangeRecord => ({
            recordType: "proposal",
            recordId: id,
            action: "changed",
            field,
            tier: "general",
            oldValue,
            newValue,
          })),
        );
      }
    }
    for (const project of seededProjects) {
      const id = projectId(project.key);
      const row = {
        name: project.name,
        externalId: project.externalId,
        ownerId: owner(project.owner),
        customerIds: customerIds(project.customers),
        proposalIds: project.proposals.map(proposalId).sort(),
        featureIds: featureIds(project.features),
      };
      await transaction.insert(projects).values({ id, ...row });
      made.push(...recorded("project", id, "created", row));
      for (const milestone of project.milestones) {
        const recordId = milestoneId(project.key, milestone.key);
        const values = {
          projectId: id,
          name: milestone.name,
          date: addDays(today, milestone.days),
          customerDelivery: milestone.customerDelivery,
        };
        await transaction
          .insert(milestones)
          .values({ id: recordId, ...values });
        made.push(...recorded("milestone", recordId, "created", values));
      }
      for (const activity of seededActivities.filter(
        (each) => each.project === project.key,
      )) {
        await addActivity(activityId(project.key, activity.key), activity, {
          projectId: id,
        });
      }
    }
    // The releases' activities, for those of the seeded releases that are there.
    const releaseOf = (activity: SeededReleaseActivity) =>
      releaseId({ name: activity.stream }, activity.release);
    const releasesPresent = new Set(
      (
        await transaction
          .select({ id: releases.id })
          .from(releases)
          .where(inArray(releases.id, seededReleaseActivities.map(releaseOf)))
      ).map(({ id }) => id),
    );
    for (const activity of seededReleaseActivities) {
      const release = releaseOf(activity);
      if (releasesPresent.has(release)) {
        await addActivity(releaseActivityId(activity), activity, {
          releaseId: release,
        });
      }
    }
    await recordChanges(transaction, null, made);
    await recordChanges(transaction, null, removals);
    return true;
  });
}

// Removes the customers, proposals, projects, milestones, and activities seeding added, releases'
// activities included, each with every draft of it or linking to it, and returns those it kept
// because something added by hand uses them: a project with milestones or activities added by hand,
// and the proposals and customers records kept use.
export async function unseedProjects(database: Database): Promise<string[]> {
  return database.transaction(async (transaction) => {
    const seededMilestoneIds = seededProjects.flatMap((project) =>
      project.milestones.map(({ key }) => milestoneId(project.key, key)),
    );
    const handMilestones = await transaction
      .select({ projectId: milestones.projectId })
      .from(milestones)
      .where(notInArray(milestones.id, seededMilestoneIds));
    const handActivities = await transaction
      .select({ projectId: activities.projectId })
      .from(activities)
      .where(notInArray(activities.id, seededActivityIds()));
    const kept: string[] = [];
    const keep = <Row extends { id: string; name: string }>(
      rows: readonly Row[],
      used: ReadonlySet<string>,
      reason: (name: string) => string,
    ) => {
      for (const { name } of rows.filter(({ id }) => used.has(id))) {
        kept.push(reason(name));
      }
      return rows.filter(({ id }) => !used.has(id));
    };
    const removingProjects = keep(
      await transaction
        .select()
        .from(projects)
        .where(
          inArray(
            projects.id,
            seededProjects.map(({ key }) => projectId(key)),
          ),
        ),
      new Set(
        [...handMilestones, ...handActivities]
          .map((record) => record.projectId)
          .filter((id) => id !== null),
      ),
      (name) =>
        `The project ${name}, which has milestones or activities added by hand`,
    );
    const projectIds = removingProjects.map(({ id }) => id);
    const otherProjects = await transaction
      .select({
        customerIds: projects.customerIds,
        proposalIds: projects.proposalIds,
      })
      .from(projects)
      .where(notInArray(projects.id, projectIds));
    const removingProposals = keep(
      await transaction
        .select()
        .from(proposals)
        .where(
          inArray(
            proposals.id,
            seededProposals.map(({ key }) => proposalId(key)),
          ),
        ),
      new Set(otherProjects.flatMap((project) => project.proposalIds)),
      (name) => `The proposal ${name}, which a project kept uses`,
    );
    const proposalIds = removingProposals.map(({ id }) => id);
    const otherProposals = await transaction
      .select({ customerIds: proposals.customerIds })
      .from(proposals)
      .where(notInArray(proposals.id, proposalIds));
    const otherFeatures = await transaction
      .select({ customerIds: features.customerIds })
      .from(features);
    const removingCustomers = keep(
      await transaction
        .select()
        .from(customers)
        .where(
          inArray(
            customers.id,
            seededCustomers.map(({ key }) => customerId(key)),
          ),
        ),
      new Set(
        [...otherProjects, ...otherProposals, ...otherFeatures].flatMap(
          (record) => record.customerIds,
        ),
      ),
      (name) =>
        `The customer ${name}, which a project, proposal, or feature kept uses`,
    );
    const customerIdsRemoved = removingCustomers.map(({ id }) => id);
    const milestoneRows = await transaction
      .select()
      .from(milestones)
      .where(inArray(milestones.projectId, projectIds));
    // A project's activities go with it, and the releases' seeded with the projects go too.
    const removingActivities = or(
      inArray(activities.projectId, projectIds),
      inArray(activities.id, seededReleaseActivities.map(releaseActivityId)),
    );
    const activityRows = await transaction
      .select()
      .from(activities)
      .where(removingActivities);
    const recordIds = [
      ...milestoneRows.map(({ id }) => id),
      ...activityRows.map(({ id }) => id),
      ...projectIds,
      ...proposalIds,
      ...customerIdsRemoved,
    ];
    // Drafts made by hand that link to a record removed go with it.
    for (const table of [drafts, privateChanges]) {
      const linking = or(
        linksAny(table.fields, "customerIds", customerIdsRemoved),
        linksAny(table.fields, "proposalIds", proposalIds),
      );
      await transaction
        .delete(table)
        .where(
          or(
            inArray(table.recordId, recordIds),
            and(
              inArray(table.recordType, ["milestone", "activity"]),
              inArray(sql`${table.fields}->>'projectId'`, projectIds),
            ),
            linking === undefined
              ? undefined
              : and(
                  inArray(table.recordType, ["project", "proposal", "feature"]),
                  linking,
                ),
          ),
        );
    }
    const made: SeededChange[] = [];
    for (const [type, rows] of [
      ["milestone", milestoneRows],
      ["activity", activityRows],
      ["project", removingProjects],
      ["proposal", removingProposals],
      ["customer", removingCustomers],
    ] as const) {
      for (const { id, ...values } of rows) {
        made.push(...recorded(type, id, "deleted", values));
      }
    }
    await transaction
      .delete(milestones)
      .where(inArray(milestones.projectId, projectIds));
    await transaction.delete(activities).where(removingActivities);
    await transaction.delete(projects).where(inArray(projects.id, projectIds));
    await transaction
      .delete(proposals)
      .where(inArray(proposals.id, proposalIds));
    await transaction
      .delete(customers)
      .where(inArray(customers.id, customerIdsRemoved));
    await recordChanges(transaction, null, made);
    return kept;
  });
}
