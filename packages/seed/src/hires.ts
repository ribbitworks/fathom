// SPDX-License-Identifier: Apache-2.0

// The fictional organization's planned hires, from @fathom/fixtures: added live, as made by Fathom
// itself, each in the first hiring state with its meaning, and those without a requisition given a
// temporary ID; then drafts the Engineering Operations Manager makes and publishes, moving a
// proposed hire to an open state, adding a hire, and changing a target date, which the Engineering
// Director rejects. Removing the seed data discards the drafts of seeded hires, and of hires
// drafted under seeded people, and then removes the seeded hires with the rest. A development-only
// package, never included in the runtime image.

import {
  type ChangeRecord,
  type Database,
  drafts,
  listItems,
  lists,
  plannedHires,
  plannedHireTemporaryNumbers,
  recordChanges,
} from "@fathom/db";
import type { FictionalHire, FictionalOrganization } from "@fathom/fixtures";
import { createDataAccess } from "@fathom/server/data";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { accountDomain } from "./accounts.ts";
import { actorOf, rejection } from "./drafts.ts";

const editorEmail = `engineering.operations.manager@${accountDomain}`;
const approverEmail = `engineering.director@${accountDomain}`;

// The requisition of the hire the Engineering Operations Manager drafts adding.
export const draftedRequisition = "REQ-2050";

type Change = ChangeRecord & { action: "created" | "deleted" };
type Reader = Pick<Database, "select">;
type HireRow = typeof plannedHires.$inferSelect;

// The first choice of the hiring states list with each meaning, and the tier of the Positions and
// hiring states lists, which a hire's position and state are recorded at.
async function hiringSettings(reader: Reader) {
  const states = await reader
    .select({ id: listItems.id, meaning: listItems.meaning })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(eq(lists.builtIn, "hiring-states"))
    .orderBy(asc(listItems.position));
  const tiers = new Map(
    (
      await reader
        .select({ builtIn: lists.builtIn, visibility: lists.visibility })
        .from(lists)
        .where(inArray(lists.builtIn, ["positions", "hiring-states"]))
    ).map(({ builtIn, visibility }) => [builtIn, visibility]),
  );
  const first = (meaning: FictionalHire["meaning"]) =>
    String(states.find((state) => state.meaning === meaning)?.id);
  return {
    stateOf: (meaning: FictionalHire["meaning"]) => first(meaning),
    // Fathom builds both lists in.
    tierOf: (field: string) => {
      if (field === "positionId") return String(tiers.get("positions"));
      if (field === "stateId") return String(tiers.get("hiring-states"));
      return "confidential";
    },
  };
}

// The changes that record a hire's fields being created or deleted, each at its tier.
function recorded(
  row: HireRow,
  action: Change["action"],
  tierOf: (field: string) => string,
): Change[] {
  const { id, ...details } = row;
  return Object.entries(details)
    .filter(([, value]) => value !== null)
    .map(([field, value]) => ({
      recordType: "planned-hire",
      recordId: id,
      action,
      field,
      tier: tierOf(field),
      oldValue: action === "deleted" ? value : null,
      newValue: action === "created" ? value : null,
    }));
}

// Adds the planned hires, unless any of them is already there. Returns whether it added them.
export async function seedHires(
  database: Database,
  organization: FictionalOrganization,
): Promise<boolean> {
  return database.transaction(async (transaction) => {
    const present = await transaction
      .select({ id: plannedHires.id })
      .from(plannedHires)
      .where(
        inArray(
          plannedHires.id,
          organization.hires.map(({ id }) => id),
        ),
      );
    if (present.length > 0 || organization.hires.length === 0) return false;
    const { stateOf, tierOf } = await hiringSettings(transaction);
    const made: Change[] = [];
    for (const { meaning, requisition, ...hire } of organization.hires) {
      const temporaryNumber =
        requisition === null
          ? Number(
              (
                await transaction.execute<{ number: string }>(
                  sql`SELECT nextval(${`"fathom"."${String(plannedHireTemporaryNumbers.seqName)}"`}::regclass) AS number`,
                )
              ).rows[0]?.number,
            )
          : null;
      const row: HireRow = {
        ...hire,
        requisition,
        temporaryNumber,
        stateId: stateOf(meaning),
      };
      await transaction.insert(plannedHires).values(row);
      made.push(...recorded(row, "created", tierOf));
    }
    // Made by Fathom itself.
    await recordChanges(transaction, null, made);
    return true;
  });
}

// The drafts of the seeded hires, of the hire the seed drafts adding, and of any hire drafted under
// a seeded person, those made by hand included.
async function hireDraftIds(
  reader: Reader,
  organization: FictionalOrganization,
): Promise<string[]> {
  const rows = await reader
    .select({ id: drafts.recordId })
    .from(drafts)
    .where(
      and(
        eq(drafts.recordType, "planned-hire"),
        or(
          inArray(
            drafts.recordId,
            organization.hires.map(({ id }) => id),
          ),
          eq(sql`${drafts.fields}->>'requisition'`, draftedRequisition),
          inArray(
            sql`${drafts.fields}->>'managerId'`,
            organization.people.map(({ id }) => id),
          ),
        ),
      ),
    );
  return rows.map(({ id }) => id);
}

// The hires not yet filled, by meaning, in the fixtures' order.
const unfilled = (
  organization: FictionalOrganization,
  meaning: FictionalHire["meaning"],
) =>
  organization.hires.filter(
    (hire) => hire.filledBy === null && hire.meaning === meaning,
  );

// Drafts, as the Engineering Operations Manager, moving the first proposed hire to an open state,
// adding a hire with a temporary ID under the first open hire's manager, and changing that open
// hire's target date, publishes them, and has the Engineering Director reject the last. Does
// nothing once any seeded hire has a draft. Returns whether it drafted them.
export async function seedHireDrafts(
  database: Database,
  organization: FictionalOrganization,
): Promise<boolean> {
  if ((await hireDraftIds(database, organization)).length > 0) return false;
  // The fixtures have hires not yet filled in both meanings.
  const proposed = unfilled(organization, "proposed")[0] as FictionalHire;
  const open = unfilled(organization, "open")[0] as FictionalHire;
  const data = createDataAccess(database);
  const editor = await actorOf(database, editorEmail);
  const approver = await actorOf(database, approverEmail);
  const { stateOf } = await hiringSettings(database);
  await data.hires.update(editor, proposed.id, { stateId: stateOf("open") });
  await data.hires.create(editor, [
    {
      name: null,
      requisition: draftedRequisition,
      positionId: open.positionId,
      targetDate: open.targetDate,
      managerId: open.managerId,
    },
  ]);
  await data.hires.update(editor, open.id, { targetDate: null });
  await data.unpublished.publish(editor);
  await data.drafts.reject(
    approver,
    {
      people: [],
      plannedHires: [open.id],
      lists: [],
      choices: [],
      orders: [],
    },
    rejection,
  );
  return true;
}

// Discards the drafts of planned hires that removing the seed data would leave naming what it
// removes, as the persona who edits people, and returns how many.
export async function unseedHireDrafts(
  database: Database,
  organization: FictionalOrganization,
): Promise<number> {
  const ids = await hireDraftIds(database, organization);
  if (ids.length === 0) return 0;
  const data = createDataAccess(database);
  const editor = await actorOf(database, editorEmail);
  for (const id of ids) await data.hires.discardDraft(editor, id);
  await data.unpublished.publish(editor);
  return ids.length;
}

// Removes the seeded hires still there, and returns the changes that record it, as made by Fathom
// itself.
export async function removeSeededHires(
  transaction: Pick<Database, "select" | "delete">,
  organization: FictionalOrganization,
): Promise<Change[]> {
  const { tierOf } = await hiringSettings(transaction);
  const seeded = await transaction
    .select()
    .from(plannedHires)
    .where(
      inArray(
        plannedHires.id,
        organization.hires.map(({ id }) => id),
      ),
    );
  if (seeded.length === 0) return [];
  await transaction.delete(plannedHires).where(
    inArray(
      plannedHires.id,
      seeded.map(({ id }) => id),
    ),
  );
  return seeded.flatMap((row) => recorded(row, "deleted", tierOf));
}
