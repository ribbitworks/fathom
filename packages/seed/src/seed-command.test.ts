// SPDX-License-Identifier: Apache-2.0

// Tests for the seed command, each on a database of its own, and for how it describes a failure.

import {
  drafts,
  listItems,
  lists,
  people,
  recordChanges,
  unpublishedDrafts,
  users,
} from "@fathom/db";
import { fictionalOrganization } from "@fathom/fixtures";
import { and, eq, inArray } from "drizzle-orm";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { personaAccounts } from "./accounts.ts";
import { actorFor } from "@fathom/server/access";
import { createDataAccess } from "@fathom/server/data";
import { columnRejection, listRejection } from "./list-drafts.ts";
import { actorOf, draftedTeamName, rejection } from "./drafts.ts";
import { describeFailure, seedCommand } from "./seed.ts";
import {
  organization,
  type SeedTestDatabase,
  startSeedTestDatabase,
  totalOf,
} from "./test-seed-command.ts";

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
