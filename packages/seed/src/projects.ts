// SPDX-License-Identifier: Apache-2.0

// The fictional organization's customers, proposals, and projects with their milestones, added live
// and dated from the day they are added, each recorded in the change history as made by Fathom
// itself. Proposals are in every status, some linked from projects; projects have customer
// deliveries before and after that day, and one has no milestones. Owners are people the seed data
// adds, left out when they are not there. Removing them first discards every draft, published or
// not, of their records, and keeps any that something added by hand uses. A development-only
// package, never included in the runtime image.

import {
  customers,
  features,
  type Database,
  drafts,
  listItems,
  lists,
  milestones,
  people,
  projects,
  proposals,
  recordChanges,
  unpublishedDrafts,
} from "@fathom/db";
import { fictionalId } from "@fathom/fixtures";
import { addDays } from "@fathom/shared";
import { and, asc, eq, inArray, notInArray, or, sql } from "drizzle-orm";
import { recorded, type SeededChange } from "./recorded.ts";

// Each record has a key of its own, which its identifier is made from.
export const seededCustomers = [
  { key: "harbour", name: "Bluefin Harbour Authority" },
  { key: "clinics", name: "Cedar Valley Clinics" },
  { key: "transit", name: "Marlow City Transit" },
  { key: "mining", name: "Kestrel Mining Cooperative" },
  { key: "air", name: "Orchid Regional Air" },
] as const;

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
}[] = [
  {
    key: "cranes",
    name: "Harbour Cranes Upgrade",
    externalId: "PR-101",
    link: "https://example.com/proposals/cranes",
    status: "Won",
    customers: ["harbour"],
    owner: 0,
  },
  {
    key: "scheduling",
    name: "Clinic Scheduling Pilot",
    externalId: "PR-102",
    link: null,
    status: "Won",
    customers: ["clinics"],
    owner: 1,
  },
  {
    key: "wifi",
    name: "Cabin Wi-Fi Refresh",
    externalId: null,
    link: "https://example.com/proposals/cabin-wifi",
    status: "Open",
    customers: ["air"],
    owner: 2,
  },
  {
    key: "fleet",
    name: "Fleet Tracking Bid",
    externalId: "PR-097",
    link: null,
    status: "Lost",
    customers: ["transit"],
    owner: null,
  },
  {
    key: "ore",
    name: "Ore Sorting Study",
    externalId: null,
    link: null,
    status: "Withdrawn",
    customers: ["mining"],
    owner: null,
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
    milestones: [],
  },
];

export const customerId = (key: string) => fictionalId(`customer:${key}`);
export const proposalId = (key: string) => fictionalId(`proposal:${key}`);
export const projectId = (key: string) => fictionalId(`project:${key}`);
export const milestoneId = (project: string, key: string) =>
  fictionalId(`milestone:${project}:${key}`);

const customerIds = (keys: readonly string[]) => keys.map(customerId).sort();

type Reader = Pick<Database, "select">;

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
    const made: SeededChange[] = [];
    for (const { key, name } of seededCustomers) {
      const id = customerId(key);
      await transaction.insert(customers).values({ id, name });
      made.push(...recorded("customer", id, "created", { name }));
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
      };
      await transaction.insert(proposals).values({ id, ...row });
      made.push(...recorded("proposal", id, "created", row));
    }
    for (const project of seededProjects) {
      const id = projectId(project.key);
      const row = {
        name: project.name,
        externalId: project.externalId,
        ownerId: owner(project.owner),
        customerIds: customerIds(project.customers),
        proposalIds: project.proposals.map(proposalId).sort(),
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
    }
    await recordChanges(transaction, null, made);
    return true;
  });
}

// Removes the customers, proposals, projects, and milestones seeding added, each with every draft
// of it or linking to it, and returns those it kept because something added by hand uses them: a project with
// milestones added by hand, and the proposals and customers records kept use.
export async function unseedProjects(database: Database): Promise<string[]> {
  return database.transaction(async (transaction) => {
    const seededMilestoneIds = seededProjects.flatMap((project) =>
      project.milestones.map(({ key }) => milestoneId(project.key, key)),
    );
    const handMilestones = await transaction
      .select({ projectId: milestones.projectId })
      .from(milestones)
      .where(notInArray(milestones.id, seededMilestoneIds));
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
        handMilestones
          .map((milestone) => milestone.projectId)
          .filter((id) => id !== null),
      ),
      (name) => `The project ${name}, which has milestones added by hand`,
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
    const recordIds = [
      ...milestoneRows.map(({ id }) => id),
      ...projectIds,
      ...proposalIds,
      ...customerIdsRemoved,
    ];
    // Drafts made by hand that link to a record removed go with it.
    const linksAny = (fields: unknown, name: string, ids: readonly string[]) =>
      ids.length === 0
        ? undefined
        : sql`jsonb_exists_any(${fields}->${name}, ARRAY[${sql.join(
            ids.map((id) => sql`${id}`),
            sql`, `,
          )}]::text[])`;
    for (const table of [drafts, unpublishedDrafts]) {
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
              eq(table.recordType, "milestone"),
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
