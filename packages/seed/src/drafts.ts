// SPDX-License-Identifier: Apache-2.0

// Drafts in the fictional organization, made through the server's data access layer as the personas
// who make and judge them would, so they are drafted and recorded exactly as in use: the Engineering
// Operations Manager drafts adding two newcomers, changing three people, and removing one, and the
// Engineering Director rejects two of those drafts with a reason. Each case a draft can be in is
// there to try: waiting to add, change, or remove someone, and rejected. Removing the seed data
// discards the drafts first. A development-only package, never included in the runtime image.

import { changes, changeSets, type Database, drafts, users } from "@fathom/db";
import type { FictionalOrganization, FictionalPerson } from "@fathom/fixtures";
import { type Actor, actorFor } from "@fathom/server/access";
import { createDataAccess } from "@fathom/server/data";
import { and, eq, gt, inArray, isNull, max, ne, or, sql } from "drizzle-orm";
import { accountDomain, personaAccounts } from "./accounts.ts";

const editorEmail = `engineering.operations.manager@${accountDomain}`;
const approverEmail = `engineering.director@${accountDomain}`;

export const rejection =
  "Fictional reason: this waits for the next planning review.";

// The persona account with the given address, acting with its persona's roles.
async function actorOf(database: Database, email: string): Promise<Actor> {
  const [user] = await database
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.email, email));
  const persona = personaAccounts.find((account) => account.email === email);
  if (user === undefined || persona === undefined) {
    throw new Error(`The account ${email} is missing; seed the accounts first`);
  }
  return actorFor(user, persona.roles);
}

// A choice in a column's list other than the one a person has.
function otherChoice(
  organization: FictionalOrganization,
  person: FictionalPerson,
  columnIndex: number,
): Record<string, string[]> {
  const column = organization.columns.at(columnIndex);
  const list = organization.lists.find(({ id }) => id === column?.listId);
  const columnId = String(column?.id);
  // Every fictional person has a site, a position, and a level.
  const had = new Map(Object.entries(person.values)).get(columnId) as string[];
  const other = list?.choices.find(({ id }) => !had.includes(id));
  return { [columnId]: [String(other?.id)] };
}

// The drafts of the people given, and of the newcomers, found by Employee ID, since drafting
// someone added gives them a new identifier.
async function draftedIds(
  database: Database,
  organization: FictionalOrganization,
  people: readonly FictionalPerson[],
): Promise<string[]> {
  const rows = await database
    .select({ id: drafts.recordId })
    .from(drafts)
    .where(
      and(
        eq(drafts.recordType, "person"),
        or(
          inArray(
            drafts.recordId,
            people.map(({ id }) => id),
          ),
          inArray(
            sql`${drafts.fields}->>'employeeId'`,
            organization.newcomers.map(({ employeeId }) => employeeId),
          ),
        ),
      ),
    );
  return rows.map(({ id }) => id);
}

// Discards drafts, as the persona who edits people.
async function discard(database: Database, ids: readonly string[]) {
  if (ids.length === 0) return;
  const data = createDataAccess(database);
  const editor = await actorOf(database, editorEmail);
  for (const id of ids) await data.people.discardDraft(editor, id);
}

// What the seed's drafts already did since the fictional people were last added: the seeded people
// whose drafts were changed, and the newcomers drafted, by Employee ID, read from the change history,
// so drafts approved, rejected, or discarded since are not made again.
async function draftedSinceSeeding(
  database: Database,
  organization: FictionalOrganization,
  editorId: string,
) {
  const [first] = organization.people as [FictionalPerson];
  const [seeded] = await database
    .select({ id: max(changes.id) })
    .from(changes)
    .where(
      and(
        eq(changes.recordId, first.id),
        eq(changes.action, "created"),
        eq(changes.draft, false),
      ),
    );
  const since = and(
    eq(changes.recordType, "person"),
    eq(changes.draft, true),
    // No people seeded yet reads as from the start.
    gt(changes.id, Number(seeded?.id)),
  );
  const people = await database
    .selectDistinct({ id: changes.recordId })
    .from(changes)
    .where(
      and(
        since,
        inArray(
          changes.recordId,
          drafting(organization).map(({ id }) => id),
        ),
      ),
    );
  const newcomers = await database
    .selectDistinct({ employeeId: sql<string>`${changes.newValue} #>> '{}'` })
    .from(changes)
    .where(
      and(
        since,
        eq(changes.field, "employeeId"),
        inArray(
          sql`${changes.newValue} #>> '{}'`,
          organization.newcomers.map(({ employeeId }) => employeeId),
        ),
      ),
    );
  const rejected = await database
    .selectDistinct({ id: changes.recordId })
    .from(changes)
    .where(and(since, eq(changes.field, "rejected")));
  // Drafts someone other than the seed's editor has changed since, which are theirs to leave alone.
  const others = await database
    .selectDistinct({ id: changes.recordId })
    .from(changes)
    .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
    .where(
      and(
        since,
        ne(changeSets.kind, "rejection"),
        or(isNull(changeSets.madeBy), ne(changeSets.madeBy, editorId)),
      ),
    );
  return {
    people: new Set(people.map(({ id }) => id)),
    newcomers: new Set(newcomers.map(({ employeeId }) => employeeId)),
    rejected: new Set(rejected.map(({ id }) => id)),
    others: new Set(others.map(({ id }) => id)),
  };
}

// The seeded people the drafts change: one given another site, one given an end date and another
// level, one removed, and one given another position, which is rejected.
const drafting = (organization: FictionalOrganization) =>
  organization.people.slice(0, 4) as [
    FictionalPerson,
    FictionalPerson,
    FictionalPerson,
    FictionalPerson,
  ];

// Makes each draft the seed data has that it has not made since the fictional people were last
// added, so a run that stopped partway is finished, and drafts approved, rejected, or discarded since
// are not made again, such as a removal that has since been approved. The two drafts the seed data
// rejects are rejected while they wait, unless they have been rejected since the people were added,
// or someone other than the seed's editor has changed them, so a run that stopped before rejecting
// is finished too, and drafts made by hand are never rejected. Returns whether it made or rejected any.
export async function seedDrafts(
  database: Database,
  organization: FictionalOrganization,
): Promise<boolean> {
  const data = createDataAccess(database);
  const editor = await actorOf(database, editorEmail);
  const approver = await actorOf(database, approverEmail);
  const [changed, leaving, removed, refused] = drafting(organization);
  const done = await draftedSinceSeeding(
    database,
    organization,
    editor.user.id,
  );
  const newcomers = organization.newcomers.filter(
    ({ employeeId }) => !done.newcomers.has(employeeId),
  );
  if (newcomers.length > 0) {
    await data.people.create(
      editor,
      newcomers.map((newcomer) => ({
        preferredName: newcomer.preferredName,
        employeeId: newcomer.employeeId,
        startDate: newcomer.startDate,
        endDate: newcomer.endDate,
        values: newcomer.values,
      })),
    );
  }
  const steps: [FictionalPerson, () => Promise<unknown>][] = [
    [
      changed,
      () =>
        data.people.update(editor, changed.id, {
          values: otherChoice(organization, changed, 0),
        }),
    ],
    [
      leaving,
      () =>
        data.people.update(editor, leaving.id, {
          endDate: "2027-06-30",
          values: otherChoice(organization, leaving, 2),
        }),
    ],
    [removed, () => data.people.delete(editor, removed.id)],
    [
      refused,
      () =>
        data.people.update(editor, refused.id, {
          values: otherChoice(organization, refused, 1),
        }),
    ],
  ];
  let made = newcomers.length > 0;
  for (const [person, step] of steps) {
    if (!done.people.has(person.id)) {
      await step();
      made = true;
    }
  }
  const waiting = await database
    .select({
      id: drafts.recordId,
      employeeId: sql<string | null>`${drafts.fields}->>'employeeId'`,
    })
    .from(drafts)
    .where(and(eq(drafts.recordType, "person"), eq(drafts.state, "waiting")));
  const lastNewcomer = String(organization.newcomers.at(-1)?.employeeId);
  const toReject = waiting
    .filter(
      ({ id, employeeId }) =>
        (id === refused.id || employeeId === lastNewcomer) &&
        !done.rejected.has(id) &&
        !done.others.has(id),
    )
    .map(({ id }) => id);
  if (toReject.length > 0) {
    await data.people.rejectDrafts(approver, toReject, rejection);
  }
  return made || toReject.length > 0;
}

// Discards the drafts of the seed data's people, those made by hand included, since removing the
// seed data removes the people they change, as the persona who edits people, and returns how many.
export async function unseedDrafts(
  database: Database,
  organization: FictionalOrganization,
): Promise<number> {
  const ids = await draftedIds(database, organization, organization.people);
  await discard(database, ids);
  return ids.length;
}
