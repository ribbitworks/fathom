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
  privateChanges,
  privateSetOf,
  privateSets,
  projects,
  reportingLines,
  teams,
  users,
} from "@fathom/db";
import { fictionalOrganization } from "@fathom/fixtures";
import { noteProblem } from "@fathom/shared";
import { and, count, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { reportingDrafts, seedDrafts, unseedDrafts } from "./drafts.ts";
import { seedHires } from "./hires.ts";
import { seed, unseed } from "./seed.ts";
import {
  organization,
  type SeedTestDatabase,
  startSeedTestDatabase,
  totalOf,
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

// A seeded position, which people added by hand are given.
const handPosition = String(
  organization.positions.find(({ label }) => label === "Software Engineer")?.id,
);

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
    await connection.insert(privateChanges).values({
      recordType: "feature-team",
      recordId: handDraft,
      userId: account.id,
      setId: await privateSetOf(connection, account.id),
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
        .select({ id: privateChanges.recordId })
        .from(privateChanges)
        .where(eq(privateChanges.recordType, "feature-team")),
    ).toEqual([]);
    await connection
      .delete(featureTeams)
      .where(eq(featureTeams.id, String(team?.id)));
    await connection
      .delete(privateSets)
      .where(eq(privateSets.userId, account.id));
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
