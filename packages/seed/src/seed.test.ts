// SPDX-License-Identifier: Apache-2.0

// Tests for seeding a database with the fictional organization and removing it again.

import {
  changes,
  changeSets,
  columnOrders,
  type Database,
  drafts,
  featureTeamLeads,
  featureTeams,
  fields,
  fieldValues,
  listItems,
  lists,
  people,
  plannedHires,
  projects,
  type Reader,
  recordChanges,
  reportingLines,
  teams,
  unpublishedDrafts,
  users,
} from "@fathom/db";
import { fictionalOrganization } from "@fathom/fixtures";
import { noteProblem } from "@fathom/shared";
import { and, count, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { writeFileSync } from "node:fs";
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
import { describeFailure, seed, seedCommand, unseed } from "./seed.ts";
import {
  type SeedTestDatabase,
  startSeedTestDatabase,
} from "./test-seed-command.ts";

let fileDatabase: SeedTestDatabase;
let connection: Database;

beforeAll(async () => {
  fileDatabase = await startSeedTestDatabase();
  ({ connection } = fileDatabase);
});

afterAll(async () => {
  await fileDatabase.remove();
});

const organization = fictionalOrganization({ size: 20 });
// A seeded position, which people added by hand are given.
const handPosition = String(
  organization.positions.find(({ label }) => label === "Software Engineer")?.id,
);

async function totalOf(
  reader: Reader,
  table:
    | typeof people
    | typeof lists
    | typeof fields
    | typeof reportingLines
    | typeof teams,
) {
  const [row] = await reader.select({ total: count() }).from(table);
  return row?.total;
}

describe("seeding", () => {
  it("adds the lists, columns, and people, recorded as made by Fathom itself, and adds nothing the second time", async () => {
    expect(await seed(connection, organization)).toBe(true);
    expect(await totalOf(connection, people)).toBe(20);
    // With the seven lists Fathom builds in, Positions holding the seeded positions.
    expect(await totalOf(connection, lists)).toBe(15);
    expect(await totalOf(connection, fields)).toBe(7);
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
    expect(history).toContainEqual({ field: "startDate", tier: "personal" });
    expect(organization.reportingLines.length).toBeGreaterThan(10);
    expect(await totalOf(connection, reportingLines)).toBe(
      organization.reportingLines.length,
    );
    expect(await totalOf(connection, teams)).toBe(organization.teams.length);
    const [line] = organization.reportingLines;
    const lineHistory = await connection
      .select({ field: changes.field, tier: changes.tier })
      .from(changes)
      .where(eq(changes.recordId, String(line?.personId)));
    expect(lineHistory).toContainEqual({
      field: "managerId",
      tier: "personal",
    });
    expect(await seed(connection, organization)).toBe(false);
    expect(await totalOf(connection, people)).toBe(20);
  });

  it("gives each list the class it is seeded in, one Personal and two Confidential", async () => {
    const [workPatterns] = await connection
      .select({ visibility: lists.visibility })
      .from(lists)
      .where(eq(lists.name, "Work patterns"));
    expect(workPatterns?.visibility).toBe("personal");
    const confidential = await connection
      .select({ name: lists.name })
      .from(lists)
      .where(eq(lists.visibility, "confidential"));
    expect(confidential.map(({ name }) => name).sort()).toEqual([
      "Compensation bands",
      "Performance ratings",
    ]);
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

  it("records a planned hire's name as General and its own details as Confidential, as the server does", async () => {
    await seed(connection, organization);
    await seedHires(connection, organization);
    const created = await connection
      .select({ field: changes.field, tier: changes.tier })
      .from(changes)
      .where(
        and(
          eq(changes.recordType, "planned-hire"),
          eq(changes.action, "created"),
          inArray(changes.field, ["name", "requisition"]),
        ),
      );
    const tiersOf = (field: string) =>
      new Set(
        created
          .filter((change) => change.field === field)
          .map(({ tier }) => tier),
      );
    expect(tiersOf("name")).toEqual(new Set(["general"]));
    expect(tiersOf("requisition")).toEqual(new Set(["confidential"]));
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

  it("records a person's Confidential values at their class, when added and when removed", async () => {
    const [person] = organization.people;
    const band = organization.columns.find(
      ({ name }) => name === "Compensation band",
    );
    const field = `value:${String(band?.id)}`;
    await unseed(connection, organization);
    const recordedAs = await connection
      .select({ action: changes.action, tier: changes.tier })
      .from(changes)
      .where(
        and(eq(changes.recordId, String(person?.id)), eq(changes.field, field)),
      );
    expect(recordedAs).toEqual(
      expect.arrayContaining([
        { action: "created", tier: "confidential" },
        { action: "deleted", tier: "confidential" },
      ]),
    );
    expect(recordedAs.every(({ tier }) => tier === "confidential")).toBe(true);
    expect(await seed(connection, organization)).toBe(true);
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
    expect(await totalOf(connection, people)).toBe(0);
    expect(await totalOf(connection, reportingLines)).toBe(0);
    expect(await seed(connection, organization)).toBe(true);
  });

  it("removes someone added by filling a seeded hire, so the seed data can be added again", async () => {
    // Given someone added by hand who fills a seeded hire and reports to a seeded manager
    const managerId = String(organization.reportingLines[0]?.managerId);
    const fillerId = "00000000-0000-4000-8000-000000000003";
    const hire = organization.hires.find(({ filledBy }) => filledBy === null);
    await seedHires(connection, organization);
    await connection.insert(people).values({
      id: fillerId,
      preferredName: "Fictional Hire Filler",
      employeeId: "H-3",
      positionId: handPosition,
    });
    await connection
      .insert(reportingLines)
      .values({ personId: fillerId, managerId, fromDate: "2026-01-01" });
    await connection
      .update(plannedHires)
      .set({ filledBy: fillerId })
      .where(eq(plannedHires.id, String(hire?.id)));

    // When the seed data is removed
    const kept = await unseed(connection, organization);

    // Then nothing is kept for them, and it can be added again
    expect(kept).toEqual([]);
    expect(await totalOf(connection, people)).toBe(0);
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

  it("keeps a seeded person who leads a feature team left behind, and discards every feature team draft", async () => {
    const [lead, member] = organization.people;
    const account = { id: "fictional-hand-account" };
    await connection.insert(users).values({
      ...account,
      name: "Fictional Hand Account",
      email: "hand.account@example.test",
      emailVerified: false,
    });
    const [team] = await connection
      .insert(featureTeams)
      .values({ name: "Fictional Hand Team" })
      .returning({ id: featureTeams.id });
    await connection.insert(featureTeamLeads).values({
      teamId: String(team?.id),
      leadId: lead?.id,
      fromDate: "2020-01-01",
    });
    const handDraft = "00000000-0000-4000-8000-0000000000e1";
    await connection.insert(drafts).values({
      recordType: "feature-team",
      recordId: handDraft,
      action: "created",
      fields: { name: "Fictional Drafted Team", members: [member?.id] },
    });
    await connection.insert(unpublishedDrafts).values({
      recordType: "feature-team",
      recordId: handDraft,
      userId: account.id,
      action: "created",
      fields: { name: "Fictional Unpublished Team" },
    });

    const kept = await unseed(connection, organization);

    expect(kept).toContain(
      `${String(lead?.preferredName)}, who leads a feature team kept`,
    );
    expect(
      (await connection.select({ id: people.id }).from(people)).map(
        ({ id }) => id,
      ),
    ).toContain(lead?.id);
    expect(
      await connection
        .select({ id: drafts.recordId })
        .from(drafts)
        .where(eq(drafts.recordType, "feature-team")),
    ).toEqual([]);
    expect(
      await connection
        .select({ id: unpublishedDrafts.recordId })
        .from(unpublishedDrafts)
        .where(eq(unpublishedDrafts.recordType, "feature-team")),
    ).toEqual([]);
    await connection
      .delete(featureTeams)
      .where(eq(featureTeams.id, String(team?.id)));
    await connection.delete(users).where(eq(users.id, account.id));
    expect(await unseed(connection, organization)).toEqual([]);
    expect(await seed(connection, organization)).toBe(true);
  });

  it("keeps a seeded person who owns a project left behind, and discards drafts naming one removed", async () => {
    const [owner, other] = organization.people;
    const [project] = await connection
      .insert(projects)
      .values({ name: "Fictional Hand Project", ownerId: owner?.id })
      .returning({ id: projects.id });
    await connection.insert(drafts).values({
      recordType: "proposal",
      recordId: "00000000-0000-4000-8000-0000000000d1",
      action: "changed",
      fields: { ownerId: String(other?.id) },
    });
    const kept = await unseed(connection, organization);
    expect(kept).toContain(
      `${String(owner?.preferredName)}, who owns a project or proposal kept`,
    );
    expect(
      (await connection.select({ id: people.id }).from(people)).map(
        ({ id }) => id,
      ),
    ).toContain(owner?.id);
    expect(
      await connection
        .select()
        .from(drafts)
        .where(eq(drafts.recordType, "proposal")),
    ).toEqual([]);
    await connection
      .delete(projects)
      .where(eq(projects.id, String(project?.id)));
    expect(await unseed(connection, organization)).toEqual([]);
    expect(await seed(connection, organization)).toBe(true);
  });

  it("adds the seed data again around a project kept for its seeded owner, with the planned hires", async () => {
    // Given a project added by hand, owned by a seeded person, so removing the seed data keeps them
    const [owner] = organization.people;
    const ownerId = String(owner?.id);
    const [project] = await connection
      .insert(projects)
      .values({ name: "Fictional Kept Project", ownerId })
      .returning({ id: projects.id });
    try {
      await seedHires(connection, organization);
      await unseed(connection, organization);
      const linesBefore = await connection
        .select({ id: reportingLines.id })
        .from(reportingLines)
        .where(eq(reportingLines.personId, ownerId));
      const ownerChangesBefore = await connection
        .select({ id: changes.id })
        .from(changes)
        .where(eq(changes.recordId, ownerId));

      // When the seed data is added again
      const added = await seed(connection, organization);

      // Then every seeded person is back once, the kept owner neither added nor recorded again, and
      // the planned hires, whose managers are among them, can be added
      expect(added).toBe(true);
      const ids = organization.people.map(({ id }) => id);
      const [row] = await connection
        .select({ total: count() })
        .from(people)
        .where(inArray(people.id, ids));
      expect(row?.total).toBe(ids.length);
      expect(
        await connection
          .select({ id: reportingLines.id })
          .from(reportingLines)
          .where(eq(reportingLines.personId, ownerId)),
      ).toHaveLength(linesBefore.length);
      expect(
        await connection
          .select({ id: changes.id })
          .from(changes)
          .where(eq(changes.recordId, ownerId)),
      ).toHaveLength(ownerChangesBefore.length);
      expect(await seedHires(connection, organization)).toBe(true);
    } finally {
      await connection
        .delete(projects)
        .where(eq(projects.id, String(project?.id)));
      await unseed(connection, organization);
      await seed(connection, organization);
    }
  });

  it("adds a seeded feature team removed by hand, leaving the people and the other teams as they are", async () => {
    // Given the seed data, with its first feature team removed by hand
    const [first] = organization.featureTeams;
    await connection
      .delete(featureTeams)
      .where(eq(featureTeams.id, String(first?.id)));
    const peopleBefore = await totalOf(connection, people);

    // When the seed data is added again
    const added = await seed(connection, organization);

    // Then that team is back, each other team is there once, and no person is added
    expect(added).toBe(true);
    const [teamsAfter] = await connection
      .select({ total: count() })
      .from(featureTeams);
    expect(teamsAfter?.total).toBe(organization.featureTeams.length);
    expect(await totalOf(connection, people)).toBe(peopleBefore);
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
    expect(await totalOf(connection, people)).toBe(1);
    expect(await totalOf(connection, fields)).toBe(1);
    expect(await totalOf(connection, lists)).toBe(9);
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
    expect(await totalOf(connection, people)).toBe(0);
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

// Each test seeds a database of its own, held only by the test, since one that runs out of time
// goes on running, and would leave its data in another test's way.
const ownDatabaseTest = it.extend<{ own: SeedTestDatabase }>({
  // eslint-disable-next-line no-empty-pattern -- Vitest reads a fixture's needs from this pattern.
  own: async ({}, use) => {
    const own = await startSeedTestDatabase();
    await use(own);
    await own.remove();
  },
});

describe("the seed command", () => {
  ownDatabaseTest(
    "seeds, says when it already has, and unseeds",
    async ({ own }) => {
      const { connection, command } = own;
      const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
      expect(await seedCommand(["seed"], command.environment())).toBe(0);
      // The drafts of the plan and feature teams, which plan-drafts.test.ts tries, are left out.
      const peopleAndLists = [
        "person",
        "planned-hire",
        "list",
        "list-item",
        "choice-order",
        "field",
      ];
      const ofPeopleAndLists = () =>
        connection
          .select()
          .from(drafts)
          .where(inArray(drafts.recordType, peopleAndLists));
      const made = await ofPeopleAndLists();
      // Of people, then of lists: a person moved to another manager, a team named, a site renamed and
      // described by two people, a role retired, Roles on the team renamed, Languages retired, the
      // Sites, Levels, and Positions orders, and a Positions description; the Skills list, its two
      // choices, and Harbourside added; and a person, an unused position, and the Certifications list
      // removed; then the Skills column added, and a person given Rust in it; and of planned hires,
      // one moved to an open state, one added, and one given no target date, which is rejected.
      expect(made.map(({ action }) => action).sort()).toEqual([
        ...Array<string>(17).fill("changed"),
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
            .where(inArray(unpublishedDrafts.recordType, peopleAndLists))
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
      expect(await seedCommand(["seed"], command.environment())).toBe(0);
      expect(await totalOf(connection, people)).toBe(150);
      expect(await ofPeopleAndLists()).toHaveLength(30);
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
          id !== seededPeople[6]?.id &&
          !heldPeople.some((one) => one.id === id),
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
      await recordChanges(
        connection,
        director ? { userId: director.id, roleId: null } : null,
        [
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
        ],
      );
      expect(await seedCommand(["seed"], command.environment())).toBe(0);
      // The two rejected drafts of people, the one being changed, the one given a skill, the one made
      // by hand, the fourteen of lists, the four of columns, and the three of planned hires.
      expect(await ofPeopleAndLists()).toHaveLength(26);
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
      expect(await seedCommand(["unseed"], command.environment())).toBe(0);
      const addresses = personaAccounts.map(({ email }) => email);
      expect(log.mock.calls.map(([line]) => line as string)).toEqual([
        "Added the fictional people, with their lists, columns and feature teams, that were missing",
        "Added 12 fictional planned hires",
        "Added fictional schedules, with their cycles and releases",
        "Added fictional features",
        "Added fictional customers, proposals, and projects with their milestones",
        "Added fictional allocations",
        ...addresses.map((email) => `Account ready: ${email}`),
        "Added drafts made by the personas",
        "Added drafts of planned hires made by the personas",
        "Added drafts of lists and columns made by the personas",
        "Added drafts of releases, projects, features, and feature teams made by the personas",
        "Added unpublished changes made by the personas",
        "The fictional data is already in the database",
        "The fictional data is already in the database",
        "Discarded 8 unpublished changes made by the personas",
        "Discarded 3 drafts of planned hires",
        "Discarded 5 drafts made by the personas",
        "Discarded 16 drafts of lists and columns made by the personas",
        "Discarded 15 drafts of releases, projects, features, and feature teams",
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
      expect(await seedCommand(["unseed"], command.environment())).toBe(0);
      expect(log.mock.calls.map(([line]) => line as string)).not.toContainEqual(
        expect.stringMatching(/^Discarded/),
      );
    },
  );

  ownDatabaseTest(
    "makes the list drafts anew when the seed data is removed after its unpublished changes are published",
    async ({ own }) => {
      const { connection, command } = own;
      // Given the seed data, with the changes it leaves unpublished published, its drafted list too
      vi.spyOn(console, "log").mockImplementation(() => undefined);
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
            ]),
          );
      expect(await seedCommand(["seed"], command.environment())).toBe(0);
      await createDataAccess(connection).unpublished.publish(
        await actorOf(connection, "engineering.operations.manager@fathom.test"),
      );

      // When the seed data is removed and added again
      expect(await seedCommand(["unseed"], command.environment())).toBe(0);
      const listDraftsAfterRemoving = await ofLists();
      expect(await seedCommand(["seed"], command.environment())).toBe(0);

      // Then removing it took back every list draft, and adding it made them all anew
      expect(listDraftsAfterRemoving).toHaveLength(0);
      expect(await ofLists()).toHaveLength(18);
    },
  );

  ownDatabaseTest(
    "seeds again after the drafted Skills and Equipment lists are approved, keeping them and not drafting them again",
    async ({ own }) => {
      const { connection, command } = own;
      // Given the seed data, with its drafts adding the Skills list and the Equipment list, once
      // published, approved
      vi.spyOn(console, "log").mockImplementation(() => undefined);
      expect(await seedCommand(["seed"], command.environment())).toBe(0);
      await createDataAccess(connection).unpublished.publish(
        await actorOf(connection, "engineering.operations.manager@fathom.test"),
      );
      const listsNamed = async (name: string) =>
        connection.select().from(lists).where(eq(lists.name, name));
      const skills = () => listsNamed("Skills");
      const listDrafts = await connection
        .select()
        .from(drafts)
        .where(inArray(drafts.recordType, ["list", "list-item"]));
      const drafted = ["Skills", "Equipment"].map((name) =>
        String(
          listDrafts.find(
            ({ recordType, fields }) =>
              recordType === "list" && fields.name === name,
          )?.recordId,
        ),
      );
      await createDataAccess(connection).drafts.approve(
        await actorOf(connection, "engineering.director@fathom.test"),
        {
          people: [],
          lists: drafted,
          choices: listDrafts
            .filter(({ fields }) => drafted.includes(String(fields.listId)))
            .map(({ recordId }) => recordId),
          orders: [],
        },
      );
      expect(await skills()).toHaveLength(1);
      expect(await listsNamed("Equipment")).toHaveLength(1);

      // When the seed data is removed and added again
      expect(await seedCommand(["unseed"], command.environment())).toBe(0);
      const seededAgain = await seedCommand(["seed"], command.environment());

      // Then it is added again, with one of each list
      expect(seededAgain).toBe(0);
      expect(await skills()).toHaveLength(1);
      expect(await listsNamed("Equipment")).toHaveLength(1);
    },
  );

  ownDatabaseTest(
    "removes the seed data while filling a planned manager waits for approval",
    async ({ own }) => {
      const { connection, command } = own;
      // Given a fill that drafts several planned hires together
      vi.spyOn(console, "log").mockImplementation(() => undefined);
      expect(await seedCommand(["seed"], command.environment())).toBe(0);
      const data = createDataAccess(connection);
      const editor = await actorOf(
        connection,
        "engineering.operations.manager@fathom.test",
      );
      const manager = organization.hires.find(({ isManager }) => isManager);
      const [open] = await connection
        .select({ id: listItems.id })
        .from(listItems)
        .innerJoin(lists, eq(lists.id, listItems.listId))
        .where(
          and(
            eq(lists.builtIn, "hiring-states"),
            eq(listItems.meaning, "open"),
          ),
        );
      await data.hires.update(editor, String(manager?.id), {
        stateId: String(open?.id),
      });
      await data.hires.fill(editor, String(manager?.id), {
        by: "new person",
        preferredName: "Fictional Fill Lead",
        employeeId: "H-4",
        startDate: null,
        values:
          organization.hires.find(({ name }) => name === "Backend engineer 2")
            ?.values ?? {},
        links: {},
        notes: {},
      });
      await data.unpublished.publish(editor);

      // When the seed data is removed
      const removed = await seedCommand(["unseed"], command.environment());

      // Then it finishes, leaving no draft of a planned hire
      expect(removed).toBe(0);
      expect(
        await connection
          .select()
          .from(drafts)
          .where(eq(drafts.recordType, "planned-hire")),
      ).toHaveLength(0);
    },
  );

  ownDatabaseTest(
    "stops before adding anything when sign-in settings or the accounts' password are missing or unusable",
    async ({ own }) => {
      const { connection, command } = own;
      const problems = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      writeFileSync(join(command.folder, "short"), "too-short\n");
      for (const changed of [
        { FATHOM_PUBLIC_URL: undefined },
        { FATHOM_SEED_PASSWORD_FILE: join(command.folder, "short") },
      ]) {
        expect(
          await seedCommand(["seed"], { ...command.environment(), ...changed }),
        ).toBe(1);
      }
      expect(await totalOf(connection, people)).toBe(0);
      expect(problems.mock.calls.map(([line]) => line as string)).toEqual([
        expect.stringMatching(/^error: Invalid server configuration: /),
        "error: The file FATHOM_SEED_PASSWORD_FILE names must hold a password of 12 to 128 characters",
      ]);
    },
  );

  ownDatabaseTest(
    "says what went wrong: a wrong command, missing settings, or data in the way",
    async ({ own }) => {
      const { connection, command } = own;
      const problems = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      vi.spyOn(console, "log").mockImplementation(() => undefined);
      expect(await seedCommand(["grow"], command.environment())).toBe(1);
      expect(await seedCommand(["seed"], {})).toBe(1);
      const withoutPassword = {
        ...command.environment(),
        FATHOM_SEED_PASSWORD_FILE: undefined,
      };
      expect(await seedCommand(["seed"], withoutPassword)).toBe(1);
      expect(await totalOf(connection, people)).toBe(0);
      await connection.insert(lists).values({ name: "Sites" });
      expect(await seedCommand(["seed"], command.environment())).toBe(1);
      expect(problems.mock.calls.map(([line]) => line as string)).toEqual([
        "error: Usage: seed.ts seed | unseed | accounts",
        expect.stringMatching(/^error: /),
        "error: FATHOM_SEED_PASSWORD_FILE is not set",
        "error: A list, column, schedule, feature, customer, project, proposal, or Employee ID in the fictional data is already used by something added by hand; rename that, then try again",
      ]);
    },
  );

  ownDatabaseTest(
    "adds only the personas' accounts when asked, with no fictional data",
    async ({ own }) => {
      const { connection, command } = own;
      const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
      const before = await totalOf(connection, people);
      expect(await seedCommand(["accounts"], command.environment())).toBe(0);
      expect(log.mock.calls.map(([line]) => line as string)).toEqual(
        personaAccounts.map(({ email }) => `Account ready: ${email}`),
      );
      expect(await totalOf(connection, people)).toBe(before);
    },
  );
});

describe("describing a failure", () => {
  it("adds the reason a failed query gives", () => {
    expect(
      describeFailure(new Error("Failed query", { cause: new Error("Why") })),
    ).toBe("Failed query\nWhy");
  });

  it("gives the message alone when there is no cause", () => {
    expect(describeFailure(new Error("Something"))).toBe("Something");
    expect(describeFailure("Something else")).toBe("Something else");
  });
});
