// SPDX-License-Identifier: Apache-2.0

// Adds the fictional organization from @fathom/fixtures to a development database, and removes it
// again: its lists, the columns on people drawing on them, and about 150 people, each recorded in the
// change history as made by Fathom itself, and an account for each persona, from ./accounts.ts,
// recorded in the access history. Seeding twice adds nothing more, and removing takes away only what
// seeding added, keeping a seeded column or list that something added by hand still uses, and
// deactivating the accounts. Drafts made by the personas, from ./drafts.ts, are added once the
// accounts are, and discarded before the rest is removed, unpublished changes first. A development-only package, never included
// in the runtime image.
// Usage: node src/seed.ts seed | unseed, with the FATHOM_DB_* settings for the application role,
// and FATHOM_PUBLIC_URL and FATHOM_AUTH_SECRET_FILE, as the account command reads. Seeding also
// needs FATHOM_SEED_PASSWORD_FILE, naming the file that holds the accounts' shared password.

import {
  type ChangeRecord,
  columnOrders,
  createDatabase,
  createPool,
  type Database,
  databaseCodes,
  describeError,
  drafts,
  fields,
  fieldValues,
  listItems,
  lists,
  hasDatabaseCode,
  loadDatabaseConfig,
  people,
  recordChanges,
  valueField,
} from "@fathom/db";
import {
  type FictionalOrganization,
  fictionalOrganization,
} from "@fathom/fixtures";
import { createAuth } from "@fathom/server/auth";
import { loadAuthConfig } from "@fathom/server/config";
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
  seedListDrafts,
  seedUnpublishedList,
  unseedListDrafts,
} from "./list-drafts.ts";
import { passwordLength } from "@fathom/shared";

// The development data set's size.
export const developmentSize = 150;

type Change = ChangeRecord & { action: "created" | "deleted" };

// The changes that record a record's fields being created or deleted.
function recorded(
  recordType: string,
  recordId: string,
  action: Change["action"],
  values: Record<string, unknown>,
  restricted: readonly string[] = [],
): Change[] {
  return Object.entries(values)
    .filter(([, value]) => value !== null)
    .map(([field, value]) => ({
      recordType,
      recordId,
      action,
      field,
      tier: restricted.includes(field) ? "restricted" : "general",
      oldValue: action === "deleted" ? value : null,
      newValue: action === "created" ? value : null,
    }));
}

const dates = ["startDate", "endDate"];

function personFields(person: FictionalOrganization["people"][number]) {
  return {
    preferredName: person.preferredName,
    employeeId: person.employeeId,
    startDate: person.startDate,
    endDate: person.endDate,
    ...Object.fromEntries(
      Object.entries(person.values).map(([columnId, chosen]) => [
        valueField(columnId),
        chosen,
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
    const made: Change[] = [];
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
    for (const column of organization.columns) {
      const row = { ...column, tableName: "people", required: false };
      await transaction.insert(fields).values(row);
      const { id, ...settings } = row;
      made.push(...recorded("field", id, "created", settings));
    }
    // The seeded columns go right after Employee ID, with the other columns in any stored order kept
    // as they are, so seeding again after unseeding, which leaves their keys in it, lays them out the
    // same way. A stored order names every built-in column, as Fathom always stores a whole order,
    // so Employee ID is found; were it missing, the seeded columns would go first.
    const [stored] = await transaction
      .select({ keys: columnOrders.keys })
      .from(columnOrders)
      .where(eq(columnOrders.tableName, "people"));
    const added = organization.columns.map(({ id }) => id);
    const others = (
      stored?.keys ?? ["preferredName", "employeeId", "startDate", "endDate"]
    ).filter((key) => !added.includes(key));
    const at = others.indexOf("employeeId") + 1;
    const keys = [...others.slice(0, at), ...added, ...others.slice(at)];
    await transaction
      .insert(columnOrders)
      .values({ tableName: "people", keys })
      .onConflictDoUpdate({ target: columnOrders.tableName, set: { keys } });
    for (const person of organization.people) {
      const { values, ...row } = person;
      await transaction.insert(people).values(row);
      const chosen = Object.entries(values).flatMap(([fieldId, choiceIds]) =>
        choiceIds.map((choiceId) => ({
          fieldId,
          personId: person.id,
          choiceId,
        })),
      );
      // Every fictional person has a site, so there is always something to add.
      await transaction.insert(fieldValues).values(chosen);
      made.push(
        ...recorded(
          "person",
          person.id,
          "created",
          personFields(person),
          dates,
        ),
      );
    }
    // Made by Fathom itself.
    await recordChanges(transaction, null, made);
    return true;
  });
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
    const made: Change[] = [];
    // The seeded people still there, and all their values, read at once.
    const present = await transaction
      .select()
      .from(people)
      .where(
        inArray(
          people.id,
          organization.people.map(({ id }) => id),
        ),
      );
    const presentIds = present.map(({ id }) => id);
    const held = await transaction
      .select({
        personId: fieldValues.personId,
        fieldId: fieldValues.fieldId,
        choiceId: fieldValues.choiceId,
      })
      .from(fieldValues)
      .where(inArray(fieldValues.personId, presentIds));
    for (const row of present) {
      const byColumn = new Map<string, string[]>();
      for (const { personId, fieldId, choiceId } of held) {
        if (personId !== row.id) continue;
        byColumn.set(fieldId, [...(byColumn.get(fieldId) ?? []), choiceId]);
      }
      made.push(
        ...recorded(
          "person",
          row.id,
          "deleted",
          personFields({ ...row, values: Object.fromEntries(byColumn) }),
          dates,
        ),
      );
    }
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
  if (
    password.length < passwordLength.minimum ||
    password.length > passwordLength.maximum
  ) {
    throw new Error(
      `The file FATHOM_SEED_PASSWORD_FILE names must hold a password of ${String(passwordLength.minimum)} to ${String(passwordLength.maximum)} characters`,
    );
  }
  return password;
}

// Seeds or unseeds the database the FATHOM_DB_* settings name. Returns a failing exit code after
// reporting what went wrong.
export async function seedCommand(
  args: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  const [command] = args;
  if (command !== "seed" && command !== "unseed") {
    console.error("error: Usage: seed.ts seed | unseed");
    return 1;
  }
  let pool: ReturnType<typeof createPool> | undefined;
  try {
    pool = createPool(loadDatabaseConfig(environment));
    const database = createDatabase(pool);
    const organization = fictionalOrganization({ size: developmentSize });
    // Read first, so missing settings stop the command before anything is changed.
    const auth = createAuth(database, loadAuthConfig(environment));
    if (command === "seed") {
      const password = readPassword(environment);
      const added = await seed(database, organization);
      console.log(
        added
          ? `Added ${String(organization.people.length)} fictional people, with their lists and columns`
          : "The fictional data is already in the database",
      );
      const accounts = await seedAccounts(auth, database, password);
      for (const email of accounts) console.log(`Account ready: ${email}`);
      if (await seedDrafts(database, organization)) {
        console.log("Added drafts made by the personas");
      }
      if (await seedListDrafts(database, organization)) {
        console.log("Added drafts of lists and columns made by the personas");
      }
      // After every published draft, so publishing them leaves these unpublished.
      const people = await seedUnpublishedPeople(database, organization);
      if ((await seedUnpublishedList(database, organization)) || people) {
        console.log("Added unpublished changes made by the personas");
      }
    } else {
      const unpublished = await unseedUnpublished(database, organization);
      if (unpublished > 0) {
        console.log(
          `Discarded ${String(unpublished)} unpublished changes made by the personas`,
        );
      }
      // People first, since the drafts of lists and columns cannot be discarded while theirs use them.
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
      const kept = await unseed(database, organization);
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
          ? "A list, column, or Employee ID in the fictional data is already used by something added by hand; rename that, then try again"
          : describeError(error)
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
