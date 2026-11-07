// SPDX-License-Identifier: Apache-2.0

// Tests for seeding a database with the fictional organization and removing it again, against a
// migrated PostgreSQL server: what is added and recorded, that seeding twice adds nothing more,
// that removing keeps what was added by hand and what it still uses, and the command that runs
// both.

import {
  changes,
  changeSets,
  columnOrders,
  createDatabase,
  drafts,
  createPool,
  type Database,
  fields,
  fieldValues,
  listItems,
  lists,
  people,
  plannedHires,
  recordChanges,
  reportingLines,
  teams,
  unpublishedDrafts,
  runMigrations,
  users,
} from "@fathom/db";
import { fictionalOrganization } from "@fathom/fixtures";
import { noteProblem } from "@fathom/shared";
import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import { and, count, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { personaAccounts } from "./accounts.ts";
import { actorFor } from "@fathom/server/access";
import { createDataAccess } from "@fathom/server/data";
import { columnRejection, listRejection } from "./list-drafts.ts";
import {
  actorOf,
  draftedTeamName,
  rejection,
  reportingDrafts,
  seedDrafts,
  unseedDrafts,
} from "./drafts.ts";
import { seedHires } from "./hires.ts";
import { seed, seedCommand, unseed } from "./seed.ts";

let database: TestDatabase;
let pool: ReturnType<typeof createPool>;
let connection: Database;
let folder: string;

beforeAll(async () => {
  database = await startTestDatabase();
  await runMigrations(database.migrator);
  pool = createPool(database.app, () => undefined);
  connection = createDatabase(pool);
  folder = mkdtempSync(join(tmpdir(), "fathom-seed-"));
});

afterAll(async () => {
  await pool.end();
  await database.container.stop();
  rmSync(folder, { recursive: true, force: true });
});

const organization = fictionalOrganization({ size: 20 });
// A seeded position, which people added by hand are given.
const handPosition = String(
  organization.positions.find(({ label }) => label === "Software Engineer")?.id,
);

// A session secret and an account password used only by tests.
const sessionSecret = "fictional-session-secret-for-tests-only-0123456789";
const accountPassword = "fictional-seed-password";

async function totalOf(
  table:
    | typeof people
    | typeof lists
    | typeof fields
    | typeof reportingLines
    | typeof teams,
) {
  const [row] = await connection.select({ total: count() }).from(table);
  return row?.total;
}

describe("seeding", () => {
  it("adds the lists, columns, and people, recorded as made by Fathom itself, and adds nothing the second time", async () => {
    expect(await seed(connection, organization)).toBe(true);
    expect(await totalOf(people)).toBe(20);
    // With the two lists Fathom builds in, Positions holding the seeded positions.
    expect(await totalOf(lists)).toBe(7);
    expect(await totalOf(fields)).toBe(4);
    const [order] = await connection.select().from(columnOrders);
    expect(order?.keys.slice(0, 4)).toEqual([
      "preferredName",
      "employeeId",
      "positionId",
      organization.columns[0]?.id,
    ]);
    const positioned = await connection
      .select({ total: count() })
      .from(people)
      .innerJoin(listItems, eq(listItems.id, people.positionId))
      .innerJoin(lists, eq(lists.id, listItems.listId))
      .where(eq(lists.builtIn, "positions"));
    expect(positioned[0]?.total).toBe(20);
    const recorded = await connection
      .select({ total: count() })
      .from(changes)
      .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
      .where(isNull(changeSets.madeBy));
    expect(recorded[0]?.total).toBeGreaterThan(80);
    const [person] = organization.people;
    const history = await connection
      .select({ field: changes.field, tier: changes.tier })
      .from(changes)
      .where(eq(changes.recordId, String(person?.id)));
    expect(history).toContainEqual({ field: "startDate", tier: "restricted" });
    expect(organization.reportingLines.length).toBeGreaterThan(10);
    expect(await totalOf(reportingLines)).toBe(
      organization.reportingLines.length,
    );
    expect(await totalOf(teams)).toBe(organization.teams.length);
    const [line] = organization.reportingLines;
    const lineHistory = await connection
      .select({ field: changes.field, tier: changes.tier })
      .from(changes)
      .where(eq(changes.recordId, String(line?.personId)));
    expect(lineHistory).toContainEqual({
      field: "managerId",
      tier: "restricted",
    });
    expect(await seed(connection, organization)).toBe(false);
    expect(await totalOf(people)).toBe(20);
  });

  it("records each link a removed person had", async () => {
    const [person] = organization.people;
    const personId = String(person?.id);
    const link = { address: "https://wiki.example.test/", text: "Wiki" };
    const [column] = await connection
      .insert(fields)
      .values({
        tableName: "people",
        name: "Fictional Hand Link",
        type: "link",
        visibility: "general",
      })
      .returning({ id: fields.id });
    const fieldId = String(column?.id);
    await connection.insert(fieldValues).values({
      fieldId,
      personId,
      linkAddress: link.address,
      linkText: link.text,
    });
    await unseed(connection, organization);
    const [removed] = await connection
      .select({ oldValue: changes.oldValue })
      .from(changes)
      .where(
        and(
          eq(changes.recordId, personId),
          eq(changes.field, `value:${fieldId}`),
        ),
      );
    expect(removed?.oldValue).toEqual(link);
    await connection.delete(fields).where(eq(fields.id, fieldId));
    expect(await seed(connection, organization)).toBe(true);
  });

  it("records each value a removed planned hire had: its choices, a link, and a note", async () => {
    const hire = organization.hires.find(
      ({ values }) => Object.keys(values).length > 0,
    );
    const plannedHireId = String(hire?.id);
    expect(await seedHires(connection, organization)).toBe(true);
    const link = { address: "https://example.test/hire", text: "" };
    const note = "*Fictional* hire note";
    const added = await connection
      .insert(fields)
      .values([
        {
          tableName: "people",
          name: "Fictional Hire Link",
          type: "link",
          visibility: "general",
        },
        {
          tableName: "people",
          name: "Fictional Hire Note",
          type: "note",
          visibility: "general",
        },
      ])
      .returning({ id: fields.id });
    const [linkId, noteId] = added.map(({ id }) => id);
    await connection.insert(fieldValues).values([
      {
        fieldId: String(linkId),
        plannedHireId,
        linkAddress: link.address,
        linkText: link.text,
      },
      { fieldId: String(noteId), plannedHireId, note },
    ]);
    // Several choices in one column, as a column taking several holds them.
    const roles = organization.columns.find(({ multiple }) => multiple);
    const roleChoices =
      organization.lists
        .find(({ id }) => id === roles?.listId)
        ?.choices.map(({ id }) => id) ?? [];
    await connection.insert(fieldValues).values(
      roleChoices.map((choiceId) => ({
        fieldId: String(roles?.id),
        plannedHireId,
        choiceId,
      })),
    );
    await unseed(connection, organization);
    const removed = new Map(
      (
        await connection
          .select({ field: changes.field, oldValue: changes.oldValue })
          .from(changes)
          .where(
            and(
              eq(changes.recordType, "planned-hire"),
              eq(changes.recordId, plannedHireId),
              eq(changes.action, "deleted"),
            ),
          )
      ).map(({ field, oldValue }) => [field, oldValue]),
    );
    expect(removed.get(`value:${String(linkId)}`)).toEqual(link);
    expect(removed.get(`value:${String(noteId)}`)).toEqual(note);
    expect(removed.get(`value:${String(roles?.id)}`)).toEqual(roleChoices);
    for (const [columnId, chosen] of Object.entries(hire?.values ?? {})) {
      expect(removed.get(`value:${columnId}`)).toEqual(chosen);
    }
    await connection
      .delete(fields)
      .where(inArray(fields.id, [String(linkId), String(noteId)]));
    expect(await seed(connection, organization)).toBe(true);
  });

  it("adds the newest starters' onboarding notes, as notes allow, recorded as made by Fathom itself", async () => {
    await seed(connection, organization);
    const written = organization.people.flatMap(({ id, notes }) =>
      Object.entries(notes).map(([fieldId, note]) => ({
        personId: id,
        fieldId,
        note,
      })),
    );
    expect(written.length).toBeGreaterThan(0);
    expect(written.map(({ note }) => noteProblem(note))).toEqual(
      written.map(() => undefined),
    );
    const kept = await connection
      .select({
        personId: fieldValues.personId,
        fieldId: fieldValues.fieldId,
        note: fieldValues.note,
      })
      .from(fieldValues)
      .where(isNotNull(fieldValues.note));
    expect(kept).toEqual(expect.arrayContaining(written));
    expect(kept).toHaveLength(written.length);
    const [first] = written;
    const history = await connection
      .select({
        newValue: changes.newValue,
        tier: changes.tier,
        madeBy: changeSets.madeBy,
      })
      .from(changes)
      .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
      .where(
        and(
          eq(changes.recordId, String(first?.personId)),
          eq(changes.field, `value:${String(first?.fieldId)}`),
          eq(changes.action, "created"),
        ),
      );
    expect(history.length).toBeGreaterThan(0);
    for (const change of history) {
      expect(change).toEqual({
        newValue: first?.note,
        tier: "general",
        madeBy: null,
      });
    }
    await unseed(connection, organization);
    const left = await connection
      .select({ id: fields.id })
      .from(fields)
      .where(eq(fields.id, String(first?.fieldId)));
    expect(left).toEqual([]);
    await seed(connection, organization);
  });

  it("records each note a removed person had", async () => {
    const [person] = organization.people;
    const personId = String(person?.id);
    const note = "*Fictional* note";
    const [column] = await connection
      .insert(fields)
      .values({
        tableName: "people",
        name: "Fictional Hand Note",
        type: "note",
        visibility: "general",
      })
      .returning({ id: fields.id });
    const fieldId = String(column?.id);
    await connection.insert(fieldValues).values({ fieldId, personId, note });
    await unseed(connection, organization);
    const [removed] = await connection
      .select({ oldValue: changes.oldValue })
      .from(changes)
      .where(
        and(
          eq(changes.recordId, personId),
          eq(changes.field, `value:${fieldId}`),
        ),
      );
    expect(removed?.oldValue).toBe(note);
    await connection.delete(fields).where(eq(fields.id, fieldId));
    expect(await seed(connection, organization)).toBe(true);
  });

  it("keeps the seeded managers whom people added by hand report to, and those above them", async () => {
    const [line] = organization.reportingLines;
    const managerId = String(line?.managerId);
    const handId = "00000000-0000-4000-8000-000000000002";
    await connection.insert(people).values({
      id: handId,
      preferredName: "Fictional Hand Report",
      employeeId: "H-2",
      positionId: handPosition,
    });
    await connection
      .insert(reportingLines)
      .values({ personId: handId, managerId, fromDate: "2026-01-01" });
    const kept = await unseed(connection, organization);
    const manager = organization.people.find(({ id }) => id === managerId);
    expect(kept).toContain(
      `${String(manager?.preferredName)}, whom people or planned hires added by hand report to, or have`,
    );
    expect(kept).toContain(
      "The Software Engineer position, which people or planned hires added by hand have, live or in drafts",
    );
    const left = await connection.select({ id: people.id }).from(people);
    expect(left.map(({ id }) => id)).toContain(managerId);
    await connection.delete(people).where(eq(people.id, handId));
    expect(await unseed(connection, organization)).toEqual([]);
    expect(await totalOf(people)).toBe(0);
    expect(await totalOf(reportingLines)).toBe(0);
    expect(await seed(connection, organization)).toBe(true);
  });

  it("keeps the seeded manager a planned hire added by hand names", async () => {
    const managerId = String(organization.reportingLines.at(-1)?.managerId);
    const [state] = await connection
      .select({ id: listItems.id })
      .from(listItems)
      .innerJoin(lists, eq(lists.id, listItems.listId))
      .where(eq(lists.builtIn, "hiring-states"));
    const [hire] = await connection
      .insert(plannedHires)
      .values({
        requisition: "Fictional-REQ-Hand",
        positionId: handPosition,
        stateId: String(state?.id),
        managerId,
      })
      .returning({ id: plannedHires.id });
    const kept = await unseed(connection, organization);
    const manager = organization.people.find(({ id }) => id === managerId);
    expect(kept).toContain(
      `${String(manager?.preferredName)}, whom people or planned hires added by hand report to, or have`,
    );
    await connection
      .delete(plannedHires)
      .where(eq(plannedHires.id, String(hire?.id)));
    expect(await unseed(connection, organization)).toEqual([]);
    expect(await seed(connection, organization)).toBe(true);
  });

  it("removes only what seeding added, keeping a column and list that people added by hand use", async () => {
    const [site] = organization.columns;
    const [sites, levels] = organization.lists;
    await connection.insert(people).values({
      id: "00000000-0000-4000-8000-000000000001",
      preferredName: "Fictional Hand Entry",
      employeeId: "H-1",
      positionId: handPosition,
    });
    await connection.insert(fieldValues).values({
      fieldId: String(site?.id),
      personId: "00000000-0000-4000-8000-000000000001",
      choiceId: String(sites?.choices[0]?.id),
    });
    await connection.insert(listItems).values({
      listId: String(levels?.id),
      label: "Fictional Hand Choice",
    });
    const kept = await unseed(connection, organization);
    expect(kept).toEqual([
      "The Site column, which people added by hand have values in, live or in drafts",
      "The Sites list, which a column uses",
      "The Levels list, which has choices added by hand",
      "The Software Engineer position, which people or planned hires added by hand have, live or in drafts",
    ]);
    expect(await totalOf(people)).toBe(1);
    expect(await totalOf(fields)).toBe(1);
    expect(await totalOf(lists)).toBe(4);
    expect(await unseed(connection, organization)).toEqual(kept);
  });

  it("puts seeded columns right after Employee ID in a stored order, once each, when seeding again", async () => {
    await connection.delete(people);
    await connection.delete(fields);
    await connection.delete(lists).where(isNull(lists.builtIn));
    await connection.delete(listItems).where(
      inArray(
        listItems.id,
        organization.positions.map(({ id }) => id),
      ),
    );
    await connection.delete(columnOrders);
    await connection.insert(columnOrders).values({
      tableName: "people",
      keys: ["employeeId", "preferredName", "startDate", "endDate"],
    });
    const seeded = [
      "employeeId",
      ...organization.columns.map(({ id }) => id),
      "preferredName",
      "startDate",
      "endDate",
    ];
    await seed(connection, organization);
    expect(await unseed(connection, organization)).toEqual([]);
    await seed(connection, organization);
    const [order] = await connection.select().from(columnOrders);
    expect(order?.keys).toEqual(seeded);
    expect(await unseed(connection, organization)).toEqual([]);
    expect(await totalOf(people)).toBe(0);
  });
});

describe("seed drafts", () => {
  it("refuse an organization too small for the drafts of reporting lines and team names", () => {
    expect(() => reportingDrafts(fictionalOrganization({ size: 20 }))).toThrow(
      "The fictional organization is too small for the drafts of reporting lines and team names",
    );
  });

  it("need the personas' accounts, and are discarded only when there are some", async () => {
    await expect(seedDrafts(connection, organization)).rejects.toThrow(
      /^The account engineering\.operations\.manager@fathom\.test is missing/,
    );
    expect(await unseedDrafts(connection, organization)).toBe(0);
  });
});

describe("the seed command", () => {
  const environment = () => {
    writeFileSync(join(folder, "password"), database.app.password);
    writeFileSync(join(folder, "secret"), sessionSecret);
    writeFileSync(join(folder, "accounts"), `${accountPassword}\n`);
    return {
      FATHOM_PUBLIC_URL: "https://fathom.example.test",
      FATHOM_AUTH_SECRET_FILE: join(folder, "secret"),
      FATHOM_SEED_PASSWORD_FILE: join(folder, "accounts"),
      FATHOM_DB_HOST: database.app.host,
      FATHOM_DB_PORT: String(database.app.port),
      FATHOM_DB_NAME: database.app.database,
      FATHOM_DB_USER: database.app.user,
      FATHOM_DB_PASSWORD_FILE: join(folder, "password"),
    };
  };

  it("seeds, says when it already has, and unseeds", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(await seedCommand(["seed"], environment())).toBe(0);
    const made = await connection.select().from(drafts);
    // Of people, then of lists: a person moved to another manager, a team named, a site renamed and
    // described by two people, a role retired, Roles on the team renamed, Languages retired, the
    // Sites, Levels, and Positions orders, and a Positions description; the Skills list, its two
    // choices, and Harbourside added; and a person, an unused position, and the Certifications list
    // removed; then the Skills column added, and a person given Rust in it; and of planned hires,
    // one moved to an open state, one added, and one given no target date, which is rejected.
    expect(made.map(({ action }) => action).sort()).toEqual([
      ...Array<string>(18).fill("changed"),
      ...Array<string>(9).fill("created"),
      ...Array<string>(4).fill("deleted"),
    ]);
    expect(
      made
        .filter(({ state }) => state === "rejected")
        .map(({ reason }) => reason)
        .sort(),
    ).toEqual(
      [
        columnRejection,
        listRejection,
        listRejection,
        listRejection,
        rejection,
        rejection,
        rejection,
      ].sort(),
    );
    // Left unpublished: the first editor's change to a person and the Equipment list with its
    // choice, and the second editor's change to a published draft of a person.
    const holders = async () =>
      (
        await connection
          .select({
            recordType: unpublishedDrafts.recordType,
            recordId: unpublishedDrafts.recordId,
            email: users.email,
          })
          .from(unpublishedDrafts)
          .innerJoin(users, eq(users.id, unpublishedDrafts.userId))
      )
        .map(({ recordType, email }) => `${recordType} ${email}`)
        .sort();
    const seededPeople = fictionalOrganization({ size: 150 }).people;
    expect(await holders()).toEqual([
      "list engineering.operations.manager@fathom.test",
      "list-item engineering.operations.manager@fathom.test",
      "person engineering.operations.manager.2@fathom.test",
      "person engineering.operations.manager@fathom.test",
    ]);
    const heldPeople = await connection
      .select({ id: unpublishedDrafts.recordId })
      .from(unpublishedDrafts)
      .where(eq(unpublishedDrafts.recordType, "person"));
    expect(heldPeople.map(({ id }) => id).sort()).toEqual(
      [String(seededPeople[0]?.id), String(seededPeople[5]?.id)].sort(),
    );
    expect(await seedCommand(["seed"], environment())).toBe(0);
    expect(await totalOf(people)).toBe(150);
    expect(await connection.select().from(drafts)).toHaveLength(31);
    const reportingDrafts = made.filter(
      ({ recordType, fields }) =>
        recordType === "person" &&
        ("managerId" in fields || "teamName" in fields),
    );
    expect(
      reportingDrafts.map(({ fields }) => fields.teamName ?? null),
    ).toEqual(expect.arrayContaining([draftedTeamName, null]));
    expect(reportingDrafts).toHaveLength(2);
    expect(await holders()).toHaveLength(4);
    // Seeding again after the Approver approves the waiting drafts nobody is changing, but the
    // person given a skill, which would approve the Skills list too, makes none again, and leaves
    // alone a draft made by hand of another seeded person, which removing the seed data discards,
    // since it removes that person.
    const waiting = (
      await connection
        .select({ id: drafts.recordId })
        .from(drafts)
        .where(
          and(eq(drafts.state, "waiting"), eq(drafts.recordType, "person")),
        )
    ).filter(
      ({ id }) =>
        id !== seededPeople[6]?.id && !heldPeople.some((one) => one.id === id),
    );
    const [director] = await connection
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.email, "engineering.director@fathom.test"));
    await createDataAccess(connection).drafts.approve(
      actorFor(
        director as { id: string; name: string; email: string },
        "engineering-director",
      ),
      {
        people: waiting.map(({ id }) => id),
        lists: [],
        choices: [],
        orders: [],
      },
    );
    const seeded = fictionalOrganization({ size: 150 });
    await connection.insert(drafts).values({
      recordType: "person",
      recordId: String(seeded.people[10]?.id),
      action: "changed",
      fields: { preferredName: "Fictional Hand Draft" },
    });
    await recordChanges(connection, director?.id ?? null, [
      {
        recordType: "person",
        recordId: String(seeded.people[10]?.id),
        action: "changed",
        field: "preferredName",
        tier: "general",
        oldValue: seeded.people[10]?.preferredName,
        newValue: "Fictional Hand Draft",
        draft: true,
      },
    ]);
    expect(await seedCommand(["seed"], environment())).toBe(0);
    // The two rejected drafts of people, the one being changed, the one given a skill, the one made
    // by hand, the fourteen of lists, the five of columns, and the three of planned hires.
    expect(await connection.select().from(drafts)).toHaveLength(27);
    expect(await holders()).toHaveLength(4);
    const levels = fictionalOrganization({ size: 1 }).lists[1];
    await connection.insert(listItems).values({
      listId: String(levels?.id),
      label: "Fictional Hand Choice",
    });
    // A column drafted by hand on the list kept is not the seed's, so is left alone.
    const handColumn = {
      recordType: "field",
      recordId: "00000000-0000-4000-8000-0000000000c1",
      action: "created",
      fields: {
        tableName: "people",
        name: "Fictional Hand Column",
        listId: String(levels?.id),
        multiple: false,
        required: false,
      },
    };
    await connection.insert(drafts).values(handColumn);
    // An unpublished change made by hand to a seeded person goes with the person.
    await connection.insert(unpublishedDrafts).values({
      recordType: "person",
      recordId: String(seeded.people[11]?.id),
      userId: String(director?.id),
      action: "changed",
      fields: { preferredName: "Fictional Hand Change" },
    });
    // The newcomer approved is no longer seed data, so is removed by hand first.
    await connection
      .delete(people)
      .where(eq(people.employeeId, String(seeded.newcomers[0]?.employeeId)));
    expect(await seedCommand(["unseed"], environment())).toBe(0);
    const addresses = personaAccounts.map(({ email }) => email);
    expect(log.mock.calls.map(([line]) => line as string)).toEqual([
      "Added 150 fictional people, with their lists and columns",
      "Added 8 fictional planned hires",
      "Added fictional release streams, with their cycles and releases",
      ...addresses.map((email) => `Account ready: ${email}`),
      "Added drafts made by the personas",
      "Added drafts of planned hires made by the personas",
      "Added drafts of lists and columns made by the personas",
      "Added unpublished changes made by the personas",
      "The fictional data is already in the database",
      "The fictional data is already in the database",
      "Discarded 4 unpublished changes made by the personas",
      "Discarded 3 drafts of planned hires",
      "Discarded 5 drafts made by the personas",
      "Discarded 17 drafts of lists and columns made by the personas",
      "Removed the fictional data",
      "Kept: The Levels list, which has choices added by hand",
      ...addresses.map((email) => `Deactivated the account ${email}`),
    ]);
    expect(
      await connection
        .select({ recordId: drafts.recordId })
        .from(drafts)
        .where(eq(drafts.recordType, "field")),
    ).toEqual([{ recordId: handColumn.recordId }]);
    expect(await holders()).toEqual([]);
    await connection
      .delete(drafts)
      .where(eq(drafts.recordId, handColumn.recordId));
    // With nothing left to discard, unseeding again says nothing of drafts.
    log.mockClear();
    expect(await seedCommand(["unseed"], environment())).toBe(0);
    expect(log.mock.calls.map(([line]) => line as string)).not.toContainEqual(
      expect.stringMatching(/^Discarded/),
    );
    log.mockRestore();
  });

  it("makes every draft anew when the seed data is removed and added again", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const ofLists = () =>
      connection
        .select()
        .from(drafts)
        .where(
          inArray(drafts.recordType, [
            "list",
            "list-item",
            "choice-order",
            "field",
            "column-order",
          ]),
        );
    // The Positions list kept by the test before, for the choice added to it by hand.
    await connection
      .delete(listItems)
      .where(eq(listItems.label, "Fictional Hand Choice"));
    expect(await seedCommand(["unseed"], environment())).toBe(0);
    expect(await seedCommand(["seed"], environment())).toBe(0);
    expect(await ofLists()).toHaveLength(19);
    expect(await seedCommand(["unseed"], environment())).toBe(0);
    expect(await ofLists()).toHaveLength(0);
    expect(await seedCommand(["seed"], environment())).toBe(0);
    expect(await ofLists()).toHaveLength(19);
    // Publishing the changes the seed leaves unpublished, as a manual test does, publishes the list
    // it drafts adding, which removing the seed data takes back too.
    await createDataAccess(connection).unpublished.publish(
      await actorOf(connection, "engineering.operations.manager@fathom.test"),
    );
    expect(await seedCommand(["unseed"], environment())).toBe(0);
    expect(await ofLists()).toHaveLength(0);
    expect(await seedCommand(["seed"], environment())).toBe(0);
    expect(await seedCommand(["unseed"], environment())).toBe(0);
    log.mockRestore();
  });

  it("stops before adding anything when sign-in settings or the accounts' password are missing or unusable", async () => {
    const problems = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    writeFileSync(join(folder, "short"), "too-short\n");
    for (const changed of [
      { FATHOM_PUBLIC_URL: undefined },
      { FATHOM_SEED_PASSWORD_FILE: join(folder, "short") },
    ]) {
      expect(
        await seedCommand(["seed"], { ...environment(), ...changed }),
      ).toBe(1);
    }
    expect(await totalOf(people)).toBe(0);
    expect(problems.mock.calls.map(([line]) => line as string)).toEqual([
      expect.stringMatching(/^error: Invalid server configuration: /),
      "error: The file FATHOM_SEED_PASSWORD_FILE names must hold a password of 12 to 128 characters",
    ]);
    vi.restoreAllMocks();
  });

  it("says what went wrong: a wrong command, missing settings, or data in the way", async () => {
    const problems = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(await seedCommand(["grow"], environment())).toBe(1);
    expect(await seedCommand(["seed"], {})).toBe(1);
    const withoutPassword = {
      ...environment(),
      FATHOM_SEED_PASSWORD_FILE: undefined,
    };
    expect(await seedCommand(["seed"], withoutPassword)).toBe(1);
    expect(await totalOf(people)).toBe(0);
    await connection.insert(lists).values({ name: "Sites" });
    expect(await seedCommand(["seed"], environment())).toBe(1);
    expect(problems.mock.calls.map(([line]) => line as string)).toEqual([
      "error: Usage: seed.ts seed | unseed | accounts",
      expect.stringMatching(/^error: /),
      "error: FATHOM_SEED_PASSWORD_FILE is not set",
      "error: A list, column, release stream, or Employee ID in the fictional data is already used by something added by hand; rename that, then try again",
    ]);
    vi.restoreAllMocks();
  });

  it("adds only the personas' accounts when asked, with no fictional data", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const before = await totalOf(people);
    expect(await seedCommand(["accounts"], environment())).toBe(0);
    expect(log.mock.calls.map(([line]) => line as string)).toEqual(
      personaAccounts.map(({ email }) => `Account ready: ${email}`),
    );
    expect(await totalOf(people)).toBe(before);
    log.mockRestore();
  });
});
