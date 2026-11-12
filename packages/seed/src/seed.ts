// SPDX-License-Identifier: Apache-2.0

// Adds the fictional organization from @fathom/fixtures to a development database, and removes it
// again: its lists, the choices it adds to the built-in Positions list, the columns on people
// drawing on its lists and its note column, about 150 people, the newest with onboarding notes, its
// planned hires, from ./hires.ts, its release streams, from ./releases.ts, and its customers,
// proposals, and projects, from ./projects.ts, each recorded in the change history as made by
// Fathom itself, and an account for each persona, from ./accounts.ts, recorded in the access
// history. Seeding twice adds nothing more, and removing takes away only what seeding added,
// keeping a seeded column, list, release stream, project, proposal, customer, or person that
// something added by hand still uses, and deactivating the accounts. Drafts made by the personas,
// from ./drafts.ts, ./hires.ts, ./list-drafts.ts, and ./plan-drafts.ts, are added once the accounts
// are, and discarded before the rest is removed, unpublished changes first. A development-only
// package, never included in the runtime image.
// Usage: node src/seed.ts seed | unseed | accounts, where accounts adds only the personas'
// accounts, with the FATHOM_DB_* settings for the application role, and FATHOM_PUBLIC_URL and
// FATHOM_AUTH_SECRET_FILE, as the account command reads. Seeding also needs
// FATHOM_SEED_PASSWORD_FILE, naming the file that holds the accounts' shared password.

import {
  columnOrders,
  createDatabase,
  createPool,
  type Database,
  databaseCodes,
  describeError,
  drafts,
  featureTeamLeads,
  featureTeamMemberships,
  featureTeams,
  fields,
  fieldValues,
  listItems,
  lists,
  hasDatabaseCode,
  inChunks,
  loadDatabaseConfig,
  people,
  plannedHires,
  projects,
  proposals,
  recordChanges,
  reportingLines,
  teams,
  unpublishedDrafts,
  valueField,
} from "@fathom/db";
import {
  type FictionalOrganization,
  fictionalOrganization,
} from "@fathom/fixtures";
import { createAuth } from "@fathom/server/auth";
import { loadAuthConfig } from "@fathom/server/config";
import { createDataAccess } from "@fathom/server/data";
import { builtInColumnNames, dayIn } from "@fathom/shared";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { seedAccounts, unseedAccounts } from "./accounts.ts";
import {
  seedDrafts,
  seedUnpublishedPeople,
  unseedDrafts,
  unseedUnpublished,
} from "./drafts.ts";
import {
  positionsList,
  seedListDrafts,
  seedUnpublishedList,
  unseedListDrafts,
} from "./list-drafts.ts";
import { defaultPasswordSettings, passwordLength } from "@fathom/shared";
import { seedAllocations, unseedAllocations } from "./allocations.ts";
import { seedFeatures, unseedFeatures } from "./features.ts";
import {
  seedPlanDrafts,
  seedUnpublishedPlan,
  unseedPlanDrafts,
} from "./plan-drafts.ts";
import { seedProjects, unseedProjects } from "./projects.ts";
import {
  filledIn,
  recorded as recordedFields,
  type SeededChange,
} from "./recorded.ts";
import { seedReleases, unseedReleases } from "./releases.ts";
import {
  removeSeededHires,
  seedHireDrafts,
  seedHires,
  unseedHireDrafts,
} from "./hires.ts";

// The development data set's size.
export const developmentSize = 150;

// The changes that record a record's fields being created or deleted.
function recorded(
  recordType: string,
  recordId: string,
  action: SeededChange["action"],
  values: Record<string, unknown>,
  personalFieldNames: readonly string[] = [],
): SeededChange[] {
  return recordedFields(
    recordType,
    recordId,
    action,
    filledIn(values),
    (field) => (personalFieldNames.includes(field) ? "personal" : "general"),
  );
}

// The fields of a person that are Personal: their dates, and their manager, as the server records
// them.
const personalDetailFields = [
  "startDate",
  "endDate",
  "managerId",
  "managerFrom",
];

// A person's current line and their team's name, as the server records them.
interface Reporting {
  managerId?: string | null;
  managerFrom?: string;
  teamName?: string;
}

function reportingOf(
  line: { managerId: string | null; fromDate: string } | undefined,
  teamName: string | undefined,
): Reporting {
  return {
    ...(line === undefined
      ? {}
      : { managerId: line.managerId, managerFrom: line.fromDate }),
    ...(teamName === undefined ? {} : { teamName }),
  };
}

function personFields(
  person: FictionalOrganization["people"][number],
  reporting: Reporting = {},
) {
  return {
    preferredName: person.preferredName,
    employeeId: person.employeeId,
    positionId: person.positionId,
    startDate: person.startDate,
    endDate: person.endDate,
    isManager: person.isManager,
    ...reporting,
    ...Object.fromEntries(
      Object.entries(person.values).map(([columnId, chosen]) => [
        valueField(columnId),
        chosen,
      ]),
    ),
    ...Object.fromEntries(
      Object.entries(person.notes).map(([columnId, note]) => [
        valueField(columnId),
        note,
      ]),
    ),
  };
}

// Adds the organization, unless it is already there. Returns whether it added it.
export async function seed(
  database: Database,
  organization: FictionalOrganization,
): Promise<boolean> {
  return database.transaction(async (transaction) => {
    const [first] = organization.lists;
    const present = await transaction
      .select({ id: lists.id })
      .from(lists)
      .where(eq(lists.id, String(first?.id)));
    if (present.length > 0) return false;
    const made: SeededChange[] = [];
    for (const list of organization.lists) {
      const row = {
        id: list.id,
        name: list.name,
        description: "",
        visibility: "general",
        retired: false,
      };
      await transaction.insert(lists).values(row);
      const { id, ...listFields } = row;
      made.push(...recorded("list", id, "created", listFields));
      for (const [index, choice] of list.choices.entries()) {
        await transaction.insert(listItems).values({
          id: choice.id,
          listId: list.id,
          label: choice.label,
          position: index + 1,
        });
        made.push(
          ...recorded("list-item", choice.id, "created", {
            listId: list.id,
            label: choice.label,
            description: "",
            retired: false,
          }),
        );
      }
    }
    const positionsId = (await positionsList(transaction, organization)).id;
    const [last] = await transaction
      .select({
        position: sql<number>`coalesce(max(${listItems.position}), 0)`,
      })
      .from(listItems)
      .where(eq(listItems.listId, positionsId));
    for (const [index, choice] of organization.positions.entries()) {
      await transaction.insert(listItems).values({
        id: choice.id,
        listId: positionsId,
        label: choice.label,
        position: Number(last?.position) + index + 1,
      });
      made.push(
        ...recorded("list-item", choice.id, "created", {
          listId: positionsId,
          label: choice.label,
          description: "",
          retired: false,
        }),
      );
    }
    for (const column of organization.columns) {
      const row = {
        ...column,
        tableName: "people",
        required: false,
        onPlannedHires: true,
      };
      await transaction.insert(fields).values(row);
      const { id, ...settings } = row;
      made.push(...recorded("field", id, "created", settings));
    }
    // The seeded columns go right after Position, with the other columns in any stored order
    // kept as they are, so seeding again after unseeding, which leaves their keys in it, lays them
    // out the same way. A stored order names every built-in column, as Fathom always stores a whole
    // order, so Position is found; an order stored before Position was built in has them after
    // Employee ID, which Position then goes just after.
    const [stored] = await transaction
      .select({ keys: columnOrders.keys })
      .from(columnOrders)
      .where(eq(columnOrders.tableName, "people"));
    const added = organization.columns.map(({ id }) => id);
    const others = (stored?.keys ?? [...builtInColumnNames.keys()]).filter(
      (key) => !added.includes(key),
    );
    const at =
      others.indexOf(
        others.includes("positionId") ? "positionId" : "employeeId",
      ) + 1;
    const keys = [...others.slice(0, at), ...added, ...others.slice(at)];
    await transaction
      .insert(columnOrders)
      .values({ tableName: "people", keys })
      .onConflictDoUpdate({ target: columnOrders.tableName, set: { keys } });
    const lineOf = new Map(
      organization.reportingLines.map((line) => [line.personId, line]),
    );
    const teamOf = new Map(
      organization.teams.map(({ managerId, name }) => [managerId, name]),
    );
    for (const person of organization.people) {
      const { values, notes, ...row } = person;
      await transaction.insert(people).values(row);
      const chosen = Object.entries(values).flatMap(([fieldId, choiceIds]) =>
        choiceIds.map((choiceId) => ({
          fieldId,
          personId: person.id,
          choiceId,
        })),
      );
      const noted = Object.entries(notes).map(([fieldId, note]) => ({
        fieldId,
        personId: person.id,
        note,
      }));
      // Every fictional person has a site, so there is always something to add.
      await transaction.insert(fieldValues).values([...chosen, ...noted]);
      made.push(
        ...recorded(
          "person",
          person.id,
          "created",
          personFields(
            person,
            reportingOf(lineOf.get(person.id), teamOf.get(person.id)),
          ),
          personalDetailFields,
        ),
      );
    }
    for (const chunk of inChunks(organization.reportingLines)) {
      await transaction.insert(reportingLines).values(chunk);
    }
    for (const chunk of inChunks(organization.teams)) {
      await transaction.insert(teams).values(chunk);
    }
    made.push(...(await addFeatureTeams(transaction, organization)));
    // Made by Fathom itself.
    await recordChanges(transaction, null, made);
    return true;
  });
}

// Adds the fictional feature teams, with every record of their members joining and leaving, and
// returns the changes that record them, with members as they are on the reference date.
async function addFeatureTeams(
  transaction: Pick<Database, "insert">,
  organization: FictionalOrganization,
): Promise<SeededChange[]> {
  const made: SeededChange[] = [];
  for (const team of organization.featureTeams) {
    const { memberships, leadId, ...row } = team;
    await transaction.insert(featureTeams).values(row);
    await transaction
      .insert(featureTeamMemberships)
      .values(memberships.map((one) => ({ teamId: team.id, ...one })));
    // A team's lead has led it since they first joined it.
    const ledFrom = memberships
      .filter((one) => one.member && one.personId === leadId)
      .map(({ fromDate }) => fromDate)
      .sort()[0];
    if (ledFrom !== undefined) {
      await transaction
        .insert(featureTeamLeads)
        .values({ teamId: team.id, leadId, fromDate: ledFrom });
    }
    const latest = new Map(
      [...memberships]
        .filter(({ fromDate }) => fromDate <= organization.referenceDate)
        .sort((a, b) => a.fromDate.localeCompare(b.fromDate))
        .map(({ personId, member }) => [personId, member]),
    );
    made.push(
      ...recorded("feature-team", team.id, "created", {
        name: team.name,
        leadId: team.leadId,
        members: [...latest]
          .filter(([, member]) => member)
          .map(([personId]) => personId)
          .sort(),
      }),
    );
  }
  return made;
}

// Removes the seeded feature teams, with every record of their members, and returns the changes
// that record them going. Every draft of a feature team goes first, published or not, since drafts
// made by hand may name seeded people.
async function removeFeatureTeams(
  transaction: Pick<Database, "delete">,
  organization: FictionalOrganization,
): Promise<SeededChange[]> {
  const ids = organization.featureTeams.map(({ id }) => id);
  for (const table of [drafts, unpublishedDrafts]) {
    await transaction.delete(table).where(eq(table.recordType, "feature-team"));
  }
  const removed = await transaction
    .delete(featureTeams)
    .where(inArray(featureTeams.id, ids))
    .returning();
  return removed.flatMap((team) =>
    recorded("feature-team", team.id, "deleted", {
      name: team.name,
      leadId:
        organization.featureTeams.find(({ id }) => id === team.id)?.leadId ??
        null,
    }),
  );
}

async function total(query: Promise<{ total: number }[]>): Promise<number> {
  return (await query).reduce((sum, row) => sum + row.total, 0);
}

// Removes what seeding added, and returns what it kept because something added by hand uses it.
export async function unseed(
  database: Database,
  organization: FictionalOrganization,
): Promise<string[]> {
  return database.transaction(async (transaction) => {
    const kept: string[] = [];
    const made: SeededChange[] = [];
    // The seeded people still there, and all their values, read at once, but for those whom people
    // added by hand report to, or have, and the managers above them. Whoever filled a seeded hire
    // goes with it, since no hire is left to say why they were added.
    const fillers = await transaction
      .select({ filledBy: plannedHires.filledBy })
      .from(plannedHires)
      .where(
        inArray(
          plannedHires.id,
          organization.hires.map(({ id }) => id),
        ),
      );
    const seededIds = [
      ...new Set([
        ...organization.people.map(({ id }) => id),
        ...fillers.flatMap(({ filledBy }) => filledBy ?? []),
      ]),
    ];
    const lines = await transaction
      .select()
      .from(reportingLines)
      .orderBy(reportingLines.fromDate);
    // The seeded hires go first, since they name people. People whom planned hires added by hand
    // name are kept like managers, with those above them.
    made.push(...(await removeSeededHires(transaction, organization)));
    made.push(...(await removeFeatureTeams(transaction, organization)));
    const managing = new Set<string>(
      (await transaction.select().from(plannedHires))
        .flatMap(({ managerId, filledBy }) => [managerId, filledBy])
        .filter((id): id is string => id !== null && seededIds.includes(id)),
    );
    // People who own a project or proposal left behind are kept too, with those above them.
    const owners = new Set(
      [
        ...(await transaction
          .select({ ownerId: projects.ownerId })
          .from(projects)),
        ...(await transaction
          .select({ ownerId: proposals.ownerId })
          .from(proposals)),
      ]
        .map(({ ownerId }) => ownerId)
        .filter((id): id is string => id !== null && seededIds.includes(id)),
    );
    for (const id of owners) managing.add(id);
    // People who lead a feature team left behind are kept too, with those above them.
    const leads = new Set(
      (
        await transaction
          .select({ leadId: featureTeamLeads.leadId })
          .from(featureTeamLeads)
      )
        .map(({ leadId }) => leadId)
        .filter((id): id is string => id !== null && seededIds.includes(id)),
    );
    for (const id of leads) managing.add(id);
    for (let grew = true; grew;) {
      grew = false;
      for (const line of lines) {
        const handled =
          !seededIds.includes(line.personId) || managing.has(line.personId);
        if (
          handled &&
          line.managerId !== null &&
          seededIds.includes(line.managerId) &&
          !managing.has(line.managerId)
        ) {
          managing.add(line.managerId);
          grew = true;
        }
      }
    }
    const present = (
      await transaction
        .select()
        .from(people)
        .where(inArray(people.id, seededIds))
    ).filter(({ id }) => !managing.has(id));
    const presentIds = present.map(({ id }) => id);
    if (managing.size > 0) {
      for (const row of await transaction
        .select({ id: people.id, preferredName: people.preferredName })
        .from(people)
        .where(inArray(people.id, [...managing]))) {
        let reason =
          "whom people or planned hires added by hand report to, or have";
        if (owners.has(row.id)) reason = "who owns a project or proposal kept";
        else if (leads.has(row.id)) reason = "who leads a feature team kept";
        kept.push(`${row.preferredName}, ${reason}`);
      }
    }
    const currentLine = new Map(lines.map((line) => [line.personId, line]));
    const teamNames = new Map(
      (await transaction.select().from(teams)).map(({ managerId, name }) => [
        managerId,
        name,
      ]),
    );
    const held = await transaction
      .select({
        personId: fieldValues.personId,
        fieldId: fieldValues.fieldId,
        choiceId: fieldValues.choiceId,
        linkAddress: fieldValues.linkAddress,
        linkText: fieldValues.linkText,
        note: fieldValues.note,
      })
      .from(fieldValues)
      .where(inArray(fieldValues.personId, presentIds));
    for (const row of present) {
      const byColumn = new Map<string, string[]>();
      const single: Record<string, { address: string; text: string } | string> =
        {};
      for (const { personId, fieldId, choiceId, note, ...link } of held) {
        if (personId !== row.id) continue;
        if (choiceId !== null) {
          byColumn.set(fieldId, [...(byColumn.get(fieldId) ?? []), choiceId]);
        } else if (note !== null) {
          single[valueField(fieldId)] = note;
        } else {
          single[valueField(fieldId)] = {
            address: String(link.linkAddress),
            text: String(link.linkText),
          };
        }
      }
      made.push(
        ...recorded(
          "person",
          row.id,
          "deleted",
          {
            ...personFields(
              { ...row, values: Object.fromEntries(byColumn), notes: {} },
              reportingOf(currentLine.get(row.id), teamNames.get(row.id)),
            ),
            ...single,
          },
          personalDetailFields,
        ),
      );
    }
    // Drafts made by hand that name a person removed as an owner go with them.
    for (const table of [drafts, unpublishedDrafts]) {
      await transaction
        .delete(table)
        .where(
          and(
            inArray(table.recordType, ["project", "proposal"]),
            inArray(sql`${table.fields}->>'ownerId'`, presentIds),
          ),
        );
    }
    await transaction
      .delete(reportingLines)
      .where(inArray(reportingLines.personId, presentIds));
    await transaction.delete(people).where(inArray(people.id, presentIds));
    for (const column of organization.columns) {
      const [row] = await transaction
        .select()
        .from(fields)
        .where(eq(fields.id, column.id));
      if (row === undefined) continue;
      const used = await total(
        transaction
          .select({ total: count() })
          .from(fieldValues)
          .where(eq(fieldValues.fieldId, column.id)),
      );
      const drafted = await total(
        transaction
          .select({ total: count() })
          .from(drafts)
          .where(
            and(
              eq(drafts.recordType, "person"),
              sql`${drafts.fields} ? ${`value:${column.id}`}::text`,
            ),
          ),
      );
      if (used + drafted > 0) {
        kept.push(
          `The ${row.name} column, which people added by hand have values in, live or in drafts`,
        );
        continue;
      }
      await transaction.delete(fields).where(eq(fields.id, column.id));
      const { id, ...settings } = row;
      made.push(...recorded("field", id, "deleted", settings));
    }
    for (const list of organization.lists) {
      const [row] = await transaction
        .select()
        .from(lists)
        .where(eq(lists.id, list.id));
      if (row === undefined) continue;
      const drawing = await total(
        transaction
          .select({ total: count() })
          .from(fields)
          .where(eq(fields.listId, list.id)),
      );
      const choices = await transaction
        .select()
        .from(listItems)
        .where(eq(listItems.listId, list.id));
      const seeded = list.choices.map(({ id }) => id);
      if (drawing > 0) {
        kept.push(`The ${row.name} list, which a column uses`);
        continue;
      }
      if (choices.some(({ id }) => !seeded.includes(id))) {
        kept.push(`The ${row.name} list, which has choices added by hand`);
        continue;
      }
      await transaction.delete(lists).where(eq(lists.id, list.id));
      made.push(
        ...recorded("list", row.id, "deleted", {
          name: row.name,
          description: row.description,
          visibility: row.visibility,
          retired: row.retired,
        }),
        ...choices.flatMap((choice) =>
          recorded("list-item", choice.id, "deleted", {
            listId: choice.listId,
            label: choice.label,
            description: choice.description,
            retired: choice.retired,
          }),
        ),
      );
    }
    // The seeded positions, unless people or planned hires added by hand have them, live or in
    // drafts.
    for (const choice of organization.positions) {
      const [row] = await transaction
        .select()
        .from(listItems)
        .where(eq(listItems.id, choice.id));
      if (row === undefined) continue;
      const used = await total(
        transaction
          .select({ total: count() })
          .from(people)
          .where(eq(people.positionId, choice.id)),
      );
      const hired = await total(
        transaction
          .select({ total: count() })
          .from(plannedHires)
          .where(eq(plannedHires.positionId, choice.id)),
      );
      const drafted = await total(
        transaction
          .select({ total: count() })
          .from(drafts)
          .where(sql`${drafts.fields}->>'positionId' = ${choice.id}`),
      );
      const unpublished = await total(
        transaction
          .select({ total: count() })
          .from(unpublishedDrafts)
          .where(
            sql`${unpublishedDrafts.fields}->>'positionId' = ${choice.id}`,
          ),
      );
      if (used + hired + drafted + unpublished > 0) {
        kept.push(
          `The ${row.label} position, which people or planned hires added by hand have, live or in drafts`,
        );
        continue;
      }
      await transaction.delete(listItems).where(eq(listItems.id, choice.id));
      made.push(
        ...recorded("list-item", row.id, "deleted", {
          listId: row.listId,
          label: row.label,
          description: row.description,
          retired: row.retired,
        }),
      );
    }
    // Made by Fathom itself.
    await recordChanges(transaction, null, made);
    return kept;
  });
}

// The accounts' shared password, from the file FATHOM_SEED_PASSWORD_FILE names, checked against the
// lengths accounts allow, so a bad file stops the command before anything is added.
function readPassword(environment: NodeJS.ProcessEnv): string {
  const file = environment.FATHOM_SEED_PASSWORD_FILE;
  if (!file) throw new Error("FATHOM_SEED_PASSWORD_FILE is not set");
  // The path comes from the development scripts, not from users of the application.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const password = readFileSync(file, "utf8").trim();
  // As long as a new database's password rules ask for, though the accounts need not meet them.
  const minimum = defaultPasswordSettings.rules.minimumLength;
  if (password.length < minimum || password.length > passwordLength.maximum) {
    throw new Error(
      `The file FATHOM_SEED_PASSWORD_FILE names must hold a password of ${String(minimum)} to ${String(passwordLength.maximum)} characters`,
    );
  }
  return password;
}

// What went wrong, for the console. A failed query's own message is the query; the reason is in its
// cause.
export function describeFailure(error: unknown): string {
  const cause = error instanceof Error ? error.cause : undefined;
  return cause === undefined
    ? describeError(error)
    : `${describeError(error)}\n${describeError(cause)}`;
}

// Seeds or unseeds the database the FATHOM_DB_* settings name. Returns a failing exit code after
// reporting what went wrong.
export async function seedCommand(
  args: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  const [command] = args;
  if (command !== "seed" && command !== "unseed" && command !== "accounts") {
    console.error("error: Usage: seed.ts seed | unseed | accounts");
    return 1;
  }
  let pool: ReturnType<typeof createPool> | undefined;
  try {
    pool = createPool(loadDatabaseConfig(environment));
    const database = createDatabase(pool);
    // Dated from today in Fathom's time zone, so the data looks the same whatever day it is added.
    const organization = fictionalOrganization({
      size: developmentSize,
      referenceDate: dayIn(
        (await createDataAccess(database).readSettings()).timeZone,
      ),
    });
    // Read first, so missing settings stop the command before anything is changed.
    const auth = createAuth(database, loadAuthConfig(environment));
    if (command === "accounts") {
      const password = readPassword(environment);
      const accounts = await seedAccounts(auth, database, password);
      for (const email of accounts) console.log(`Account ready: ${email}`);
    } else if (command === "seed") {
      const password = readPassword(environment);
      const added = await seed(database, organization);
      console.log(
        added
          ? `Added ${String(organization.people.length)} fictional people, with their lists and columns`
          : "The fictional data is already in the database",
      );
      if (await seedHires(database, organization)) {
        console.log(
          `Added ${String(organization.hires.length)} fictional planned hires`,
        );
      }
      if (await seedReleases(database, organization.referenceDate)) {
        console.log(
          "Added fictional release streams, with their cycles and releases",
        );
      }
      if (
        await seedFeatures(
          database,
          organization.referenceDate,
          organization.featureTeams.map(({ id }) => id),
        )
      ) {
        console.log("Added fictional features");
      }
      if (
        await seedProjects(
          database,
          organization.referenceDate,
          organization.people
            .filter(({ isManager, endDate }) => isManager && endDate === null)
            .map(({ id }) => id),
        )
      ) {
        console.log(
          "Added fictional customers, proposals, and projects with their milestones",
        );
      }
      if (await seedAllocations(database, organization)) {
        console.log("Added fictional allocations");
      }
      const accounts = await seedAccounts(auth, database, password);
      for (const email of accounts) console.log(`Account ready: ${email}`);
      if (await seedDrafts(database, organization)) {
        console.log("Added drafts made by the personas");
      }
      if (await seedHireDrafts(database, organization)) {
        console.log("Added drafts of planned hires made by the personas");
      }
      if (await seedListDrafts(database, organization)) {
        console.log("Added drafts of lists and columns made by the personas");
      }
      if (await seedPlanDrafts(database, organization)) {
        console.log(
          "Added drafts of releases, projects, features, and feature teams made by the personas",
        );
      }
      // After every published draft, so publishing them leaves these unpublished.
      const people = await seedUnpublishedPeople(database, organization);
      const plan = await seedUnpublishedPlan(database, organization);
      if (
        (await seedUnpublishedList(database, organization)) ||
        people ||
        plan
      ) {
        console.log("Added unpublished changes made by the personas");
      }
    } else {
      const unpublished = await unseedUnpublished(database, organization);
      if (unpublished > 0) {
        console.log(
          `Discarded ${String(unpublished)} unpublished changes made by the personas`,
        );
      }
      // Planned hires first, since they name people, then people, since the drafts of lists and
      // columns cannot be discarded while theirs use them.
      const discardedHires = await unseedHireDrafts(database, organization);
      if (discardedHires > 0) {
        console.log(
          `Discarded ${String(discardedHires)} drafts of planned hires`,
        );
      }
      const discarded = await unseedDrafts(database, organization);
      if (discarded > 0) {
        console.log(
          `Discarded ${String(discarded)} drafts made by the personas`,
        );
      }
      const discardedLists = await unseedListDrafts(database, organization);
      if (discardedLists > 0) {
        console.log(
          `Discarded ${String(discardedLists)} drafts of lists and columns made by the personas`,
        );
      }
      const discardedPlan = await unseedPlanDrafts(database, organization);
      if (discardedPlan > 0) {
        console.log(
          `Discarded ${String(discardedPlan)} drafts of releases, projects, features, and feature teams`,
        );
      }
      // Allocations before the people, planned hires, and features they name, features before the
      // release streams and feature teams they name, and projects and proposals before people, whom
      // they name as owners.
      await unseedAllocations(database, organization);
      const keptWithFeatures = await unseedFeatures(
        database,
        organization.featureTeams.map(({ id }) => id),
      );
      const kept = [
        ...keptWithFeatures,
        ...(await unseedProjects(database)),
        ...(await unseedReleases(database)),
        ...(await unseed(database, organization)),
      ];
      console.log("Removed the fictional data");
      for (const item of kept) console.log(`Kept: ${item}`);
      for (const email of await unseedAccounts(auth, database)) {
        console.log(`Deactivated the account ${email}`);
      }
    }
    return 0;
  } catch (error) {
    console.error(
      `error: ${
        hasDatabaseCode(error, databaseCodes.uniqueViolation)
          ? "A list, column, release stream, feature, customer, project, proposal, or Employee ID in the fictional data is already used by something added by hand; rename that, then try again"
          : describeFailure(error)
      }`,
    );
    return 1;
  } finally {
    await pool?.end();
  }
}

/* v8 ignore start -- Only runs as a separate process; the tests call seedCommand. */
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await seedCommand(process.argv.slice(2));
}
/* v8 ignore stop */
