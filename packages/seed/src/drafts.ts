// SPDX-License-Identifier: Apache-2.0

// Drafts in the fictional organization, made through the server's data access layer as the personas
// who make and judge them would, so they are drafted and recorded exactly as in use: the
// Engineering Operations Manager drafts adding two newcomers, changing three people, moving a
// report of the manager who has left to another manager, naming a team, and removing someone, and
// publishes them, a second Engineering Operations Manager changes another detail in one of those
// drafts, so one draft holds two people's changes, and publishes it, and the Engineering Director
// rejects two of the drafts with a reason. Each case a draft can be in is there to try: waiting to
// add, change, or remove someone, and rejected. Then come changes left unpublished, which hold
// their records: the Engineering Operations Manager's change to another person's site, and the
// second Engineering Operations Manager's change to a published draft. Removing the seed data
// discards the drafts first, unpublished ones included. A development-only package, never included
// in the runtime image.

import {
  changes,
  changeSets,
  type Database,
  drafts,
  privateChanges,
  users,
  valueField,
} from "@fathom/db";
import type { FictionalOrganization, FictionalPerson } from "@fathom/fixtures";
import { addMonths, draftingPermissions, lastDayOfMonth } from "@fathom/shared";
import type { Actor } from "@fathom/server/access";
import { createDataAccess } from "@fathom/server/data";
import { and, eq, gt, inArray, isNull, max, ne, or, sql } from "drizzle-orm";
import { accountDomain, personaAccounts, personaActor } from "./accounts.ts";

const editorEmail = `engineering.operations.manager@${accountDomain}`;
const secondEditorEmail = `engineering.operations.manager.2@${accountDomain}`;
const approverEmail = `engineering.director@${accountDomain}`;

export const rejection =
  "Fictional reason: this waits for the next planning review.";

// The persona account with the given address, acting with its persona's roles.
export async function actorOf(
  database: Database,
  email: string,
): Promise<Actor> {
  const [user] = await database
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.email, email));
  const persona = personaAccounts.find((account) => account.email === email);
  if (user === undefined || persona === undefined) {
    throw new Error(`The account ${email} is missing; seed the accounts first`);
  }
  return personaActor(user, persona.role);
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
  // Every fictional person has a site and a level.
  const had = new Map(Object.entries(person.values)).get(columnId) as string[];
  const other = list?.choices.find(({ id }) => !had.includes(id));
  return { [columnId]: [String(other?.id)] };
}

// A position other than the one a person has, never Architect, which no one is given.
function otherPosition(
  organization: FictionalOrganization,
  person: FictionalPerson,
): string {
  const other = organization.positions.find(
    ({ id, label }) => id !== person.positionId && label !== "Architect",
  );
  return String(other?.id);
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

// Discards drafts, as the persona who edits people, and publishes that.
async function discard(database: Database, ids: readonly string[]) {
  if (ids.length === 0) return;
  const data = createDataAccess(database);
  const editor = await actorOf(database, editorEmail);
  for (const id of ids) await data.people.discardDraft(editor, id);
  await data.unpublished.publish(editor);
}

// The last change that added a record as live, by its id, or null when none has: what the seed
// added since, it made anew, so a draft made before it, since removed, is not taken for the seed's.
export async function addedAt(
  database: Database,
  recordId: string,
): Promise<number | null> {
  const [added] = await database
    .select({ id: max(changes.id) })
    .from(changes)
    .where(
      and(
        eq(changes.recordId, recordId),
        eq(changes.action, "created"),
        eq(changes.draft, false),
      ),
    );
  return added?.id ?? null;
}

// The last change that added the fictional people, or, with none added yet, the start.
async function seededAt(
  database: Database,
  organization: FictionalOrganization,
): Promise<number> {
  const [first] = organization.people as [FictionalPerson];
  // None added yet reads as from the start.
  return Number(await addedAt(database, first.id));
}

// What the seed's drafts already did since the fictional people were last added: the seeded people
// whose drafts were changed, and the newcomers drafted, by Employee ID, read from the change history,
// so drafts approved, rejected, or discarded since are not made again.
async function draftedSinceSeeding(
  database: Database,
  organization: FictionalOrganization,
  editorId: string,
) {
  const { moved, named } = reportingDrafts(organization);
  const since = and(
    eq(changes.recordType, "person"),
    eq(changes.draft, true),
    gt(changes.id, await seededAt(database, organization)),
  );
  const people = await database
    .selectDistinct({ id: changes.recordId })
    .from(changes)
    .where(
      and(
        since,
        inArray(changes.recordId, [
          ...drafting(organization).map(({ id }) => id),
          ...[moved, named].map(({ id }) => id),
        ]),
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

// The person the drafts of lists and columns give a skill, whom no other seed draft changes.
export const skilledFor = (organization: FictionalOrganization) =>
  organization.people[6] as FictionalPerson;

// The seeded people whose reporting the drafts change, among those no other draft changes: a report
// of the manager who has left, moved to the manager at the top, who has none, so the move makes no
// loop; and a manager whose team has no name, given one. A fictional organization too small to have
// them is refused.
export function reportingDrafts(organization: FictionalOrganization): {
  top: FictionalPerson;
  moved: FictionalPerson;
  named: FictionalPerson;
} {
  const { people, reportingLines, teams } = organization;
  const others = new Set(
    [
      ...drafting(organization),
      unpublishedFor(organization),
      skilledFor(organization),
    ].map(({ id }) => id),
  );
  const later = people.filter(({ id }) => !others.has(id));
  const lineOf = (id: string) =>
    reportingLines.find(({ personId }) => personId === id);
  const managers = new Set(reportingLines.map(({ managerId }) => managerId));
  const left = (id: string) =>
    people.find((person) => person.id === id)?.endDate != null;
  const top = people.find(
    ({ id, endDate }) =>
      managers.has(id) && lineOf(id) === undefined && endDate === null,
  );
  const moved = later.find(({ id }) => left(String(lineOf(id)?.managerId)));
  const named = later.find(
    ({ id, endDate }) =>
      managers.has(id) &&
      endDate === null &&
      !teams.some(({ managerId }) => managerId === id),
  );
  if (top === undefined || moved === undefined || named === undefined) {
    throw new Error(
      "The fictional organization is too small for the drafts of reporting lines and team names",
    );
  }
  return { top, moved, named };
}

export const draftedTeamName = "Observability team";

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
  const { top, moved, named } = reportingDrafts(organization);
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
        positionId: newcomer.positionId,
        startDate: newcomer.startDate,
        endDate: newcomer.endDate,
        values: newcomer.values,
        links: {},
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
          // The end of the month seven months on, as a planned leaving date.
          endDate: lastDayOfMonth(addMonths(organization.referenceDate, 7)),
          values: otherChoice(organization, leaving, 1),
        }),
    ],
    [removed, () => data.people.delete(editor, removed.id)],
    [
      refused,
      () =>
        data.people.update(editor, refused.id, {
          positionId: otherPosition(organization, refused),
        }),
    ],
    [moved, () => data.people.update(editor, moved.id, { managerId: top.id })],
    [
      named,
      () => data.people.update(editor, named.id, { teamName: draftedTeamName }),
    ],
  ];
  let made = newcomers.length > 0;
  for (const [person, step] of steps) {
    if (!done.people.has(person.id)) {
      await step();
      made = true;
    }
  }
  if (made) await data.unpublished.publish(editor);
  // The second editor changes the first's draft once, unless someone else has changed it since.
  if (!done.others.has(changed.id)) {
    const second = await actorOf(database, secondEditorEmail);
    await data.people.update(second, changed.id, {
      values: otherChoice(organization, changed, 1),
    });
    await data.unpublished.publish(second);
    made = true;
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
    await data.drafts.reject(
      approver,
      { people: toReject, lists: [], choices: [], orders: [] },
      rejection,
    );
  }
  return made || toReject.length > 0;
}

// The live person the Engineering Operations Manager changes without publishing, whom no other seed
// draft changes.
const unpublishedFor = (organization: FictionalOrganization) =>
  organization.people[5] as FictionalPerson;

// Whether a draft change to a person's field, by anyone, published or not, has been made since the
// fictional people were last added.
async function changedSince(
  database: Database,
  organization: FictionalOrganization,
  personId: string,
  field: string,
): Promise<boolean> {
  const found = await database
    .select({ one: sql`1` })
    .from(changes)
    .where(
      and(
        eq(changes.recordId, personId),
        eq(changes.field, field),
        eq(changes.draft, true),
        gt(changes.id, await seededAt(database, organization)),
      ),
    )
    .limit(1);
  return found.length > 0;
}

// Makes the changes to people the seed leaves unpublished, after every seed draft is published: the
// Engineering Operations Manager's change to a live person's site, and the second Engineering
// Operations Manager's change to the position in the published draft both editors made. Each is
// made once since the fictional people were last added. Returns whether it made any.
export async function seedUnpublishedPeople(
  database: Database,
  organization: FictionalOrganization,
): Promise<boolean> {
  const data = createDataAccess(database);
  const [changed] = drafting(organization);
  const person = unpublishedFor(organization);
  const site = valueField(String(organization.columns[0]?.id));
  const position = "positionId";
  let made = false;
  if (!(await changedSince(database, organization, person.id, site))) {
    await data.people.update(await actorOf(database, editorEmail), person.id, {
      values: otherChoice(organization, person, 0),
    });
    made = true;
  }
  if (!(await changedSince(database, organization, changed.id, position))) {
    const second = await actorOf(database, secondEditorEmail);
    await data.people.update(second, changed.id, {
      positionId: otherPosition(organization, changed),
    });
    made = true;
  }
  return made;
}

// Discards every persona's unpublished changes, since removing the seed data removes what they
// change, and returns how many records' changes that took. Unpublished drafts of the seed's people
// made by hand by others are removed with them.
export async function unseedUnpublished(
  database: Database,
  organization: FictionalOrganization,
): Promise<number> {
  const data = createDataAccess(database);
  const accounts = await database
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(
      inArray(
        users.email,
        personaAccounts.map(({ email }) => email),
      ),
    );
  let discarded = 0;
  for (const account of accounts) {
    // Every persona account read has its persona.
    const { role } = personaAccounts.find(
      ({ email }) => email === account.email,
    ) as (typeof personaAccounts)[number];
    const persona = personaActor(account, role);
    if (draftingPermissions.some((one) => persona.permissions.includes(one))) {
      discarded += await data.unpublished.discard(persona);
    }
  }
  await database.delete(privateChanges).where(
    inArray(
      privateChanges.recordId,
      organization.people.map(({ id }) => id),
    ),
  );
  return discarded;
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
