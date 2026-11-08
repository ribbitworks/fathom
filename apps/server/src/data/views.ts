// SPDX-License-Identifier: Apache-2.0

// Saved views of the People table: reading those a user may see, and saving, changing, and deleting
// them. Part of the data access layer, the only server code that queries the database. Everyone who
// sees people sees the table's saved views, except a view that filters, sorts, or breaks down by a
// column they may not see, since its filters and metrics could reveal values they may not see.
// Anyone who sees people may save a view; only its maker, or someone who may change planning
// configuration, may change or delete it. Each change is recorded in the change history with the
// most sensitive tier of the view's columns.

import { type Database, savedViews } from "@fathom/db";
import {
  type SavedView,
  type SavedViewChange,
  type SavedViewRequest,
  type Tier,
  draftFilterKey,
  type ViewDefinition,
  viewColumnKeys,
  viewDefinitionSchema,
} from "@fathom/shared";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { type Actor, mostSensitive, seesSensitivity } from "../access.ts";
import { BadRequestError, ForbiddenError, NotFoundError } from "../errors.ts";
import {
  type Change,
  changesBetween,
  recordChanges,
  refusingDuplicates,
  type Saved,
  type Transaction,
} from "./changes.ts";
import { builtInColumnTiers, readColumns } from "./values.ts";

const table = "people";
const noView = "There is no such view";
const duplicateView = "There is already a view with that name";
const notYours =
  "Only the person who saved a view, or someone who may change planning configuration, can change it";
const hiddenColumns = "Choose only columns you can see";

type Reader = Pick<Database, "select">;
type ViewRow = typeof savedViews.$inferSelect;

const viewFields = ["tableName", "name", "definition", "createdBy"] as const;

// The tier of each of the People table's columns, by key.
async function columnTiers(reader: Reader): Promise<Map<string, Tier>> {
  const columns = await readColumns(reader);
  return new Map<string, Tier>([
    ...builtInColumnTiers(columns),
    ...columns.map((column): [string, Tier] => [column.id, column.tier]),
  ]);
}

// A view as stored, read back through the same checks as the page address.
function definitionOf(row: ViewRow): ViewDefinition {
  return viewDefinitionSchema.parse(row.definition);
}

// The tiers of the columns a view uses that still exist; a deleted column is ignored, as it is in
// the page address.
function usedTiers(
  tiers: ReadonlyMap<string, Tier>,
  definition: ViewDefinition,
): Tier[] {
  return viewColumnKeys(definition).flatMap((key) => {
    const tier = tiers.get(key);
    return tier === undefined ? [] : [tier];
  });
}

function sees(
  actor: Actor,
  tiers: ReadonlyMap<string, Tier>,
  definition: ViewDefinition,
): boolean {
  return usedTiers(tiers, definition).every((tier) =>
    seesSensitivity(actor, tier),
  );
}

// Whether the actor may rename, update, or delete a view.
export function mayChange(actor: Actor, createdBy: string): boolean {
  return (
    createdBy === actor.user.id ||
    actor.permissions.includes("configuration:edit")
  );
}

// Whether the actor may see a column, which they may unless it is one of the table's they may not;
// a column the table no longer has hides nothing.
function seesColumn(
  actor: Actor,
  tiers: ReadonlyMap<string, Tier>,
  key: string,
): boolean {
  const tier = tiers.get(key);
  return tier === undefined || seesSensitivity(actor, tier);
}

// The widths a view sets for columns the actor may see, or, given `seen` false, for those they may
// not.
function widthsSeen(
  actor: Actor,
  tiers: ReadonlyMap<string, Tier>,
  widths: Record<string, number> | undefined,
  seen: boolean,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(widths ?? {}).filter(
      ([key]) => seesColumn(actor, tiers, key) === seen,
    ),
  );
}

// The view as a reader is sent it: without filters, sorts, and breakdowns on columns deleted since
// it was saved, nor widths of columns the reader may not see. A width reveals no value, so a view
// keeps widths of columns others may not see, and of any the table no longer has.
function sentTo(
  actor: Actor,
  tiers: ReadonlyMap<string, Tier>,
  definition: ViewDefinition,
): ViewDefinition {
  const filters = Object.entries(definition.filters ?? {}).filter(
    ([key]) => tiers.has(key) || key === draftFilterKey,
  );
  const sort = (definition.sort ?? []).filter((level) =>
    tiers.has(level.replace(/^-/, "")),
  );
  return stored({
    search: definition.search,
    show: definition.show,
    filters: filters.length === 0 ? undefined : Object.fromEntries(filters),
    sort: sort.length === 0 ? undefined : sort,
    breakdown: definition.breakdown?.filter((key) => tiers.has(key)),
    frozen: definition.frozen,
    widths:
      definition.widths && widthsSeen(actor, tiers, definition.widths, true),
  });
}

function toSavedView(
  row: ViewRow,
  actor: Actor,
  tiers: ReadonlyMap<string, Tier>,
): SavedView {
  return {
    id: row.id,
    name: row.name,
    definition: sentTo(actor, tiers, definitionOf(row)),
    canChange: mayChange(actor, row.createdBy),
  };
}

// The saved views of the People table the actor may see, by name.
export async function readViews(
  reader: Reader,
  actor: Actor,
): Promise<SavedView[]> {
  const tiers = await columnTiers(reader);
  const rows = await reader
    .select()
    .from(savedViews)
    .where(eq(savedViews.tableName, table))
    .orderBy(asc(sql`lower(${savedViews.name})`), asc(savedViews.id));
  return rows
    .filter((row) => sees(actor, tiers, definitionOf(row)))
    .map((row) => toSavedView(row, actor, tiers));
}

// Refuses a view that filters, sorts, or breaks down by a column the actor may not see, or that the
// table does not have, and returns the most sensitive tier of its columns. A view may filter on
// drafts too, which is General, since each user is sent only the drafts they may see, but not sort
// or break down by them.
function requireSeen(
  actor: Actor,
  tiers: ReadonlyMap<string, Tier>,
  definition: ViewDefinition,
): Tier {
  const unknown = (key: string) => !tiers.has(key);
  const filters = Object.keys(definition.filters ?? {});
  const sort = (definition.sort ?? []).map((level) => level.replace(/^-/, ""));
  if (
    filters.some((key) => unknown(key) && key !== draftFilterKey) ||
    sort.some(unknown) ||
    (definition.breakdown ?? []).some(unknown) ||
    !sees(actor, tiers, definition)
  ) {
    throw new BadRequestError(hiddenColumns);
  }
  return mostSensitive(usedTiers(tiers, definition));
}

// A view as stored, leaving out what is not set.
function stored(definition: ViewDefinition): ViewDefinition {
  return JSON.parse(JSON.stringify(definition)) as ViewDefinition;
}

const viewChanges = (
  id: string,
  action: Change["action"],
  before: ViewRow | undefined,
  after: ViewRow | undefined,
  tier: Tier,
) =>
  changesBetween(
    "saved-view",
    id,
    action,
    before,
    after,
    viewFields,
    () => tier,
  );

export async function createView(
  database: Database,
  actor: Actor,
  request: SavedViewRequest,
): Promise<Saved<SavedView>> {
  const row: ViewRow = {
    id: randomUUID(),
    tableName: table,
    name: request.name,
    definition: stored(request.definition),
    createdBy: actor.user.id,
  };
  return refusingDuplicates(duplicateView, () =>
    database.transaction(async (transaction) => {
      const tiers = await columnTiers(transaction);
      const tier = requireSeen(actor, tiers, request.definition);
      await transaction.insert(savedViews).values(row);
      const changeSetId = await recordChanges(
        transaction,
        actor,
        viewChanges(row.id, "created", undefined, row, tier),
      );
      return { result: toSavedView(row, actor, tiers), changeSetId };
    }),
  );
}

// The view, locked for a change, with the columns' tiers, once the actor is known to see and may
// change it.
async function lockView(
  transaction: Transaction,
  actor: Actor,
  id: string,
): Promise<{ row: ViewRow; tiers: Map<string, Tier> }> {
  const [row] = await transaction
    .select()
    .from(savedViews)
    .where(eq(savedViews.id, id))
    .for("update");
  const tiers = await columnTiers(transaction);
  if (row === undefined || !sees(actor, tiers, definitionOf(row))) {
    throw new NotFoundError(noView);
  }
  if (!mayChange(actor, row.createdBy)) throw new ForbiddenError(notYours);
  return { row, tiers };
}

// Renames a view, saves a new view over it, or both.
export async function updateView(
  database: Database,
  actor: Actor,
  id: string,
  change: SavedViewChange,
): Promise<Saved<SavedView>> {
  return refusingDuplicates(duplicateView, () =>
    database.transaction(async (transaction) => {
      const { row: before, tiers } = await lockView(transaction, actor, id);
      // The actor was not sent the widths of columns they may not see, so keeps those already set.
      const keepingHidden = (row: ViewRow, definition: ViewDefinition) => {
        const widths = {
          ...widthsSeen(actor, tiers, definitionOf(row).widths, false),
          ...definition.widths,
        };
        return {
          ...definition,
          widths: Object.keys(widths).length === 0 ? undefined : widths,
        };
      };
      const after: ViewRow = {
        ...before,
        ...(change.name === undefined ? {} : { name: change.name }),
        ...(change.definition === undefined
          ? {}
          : { definition: stored(keepingHidden(before, change.definition)) }),
      };
      const tier = mostSensitive([
        mostSensitive(usedTiers(tiers, definitionOf(before))),
        change.definition === undefined
          ? "general"
          : requireSeen(actor, tiers, change.definition),
      ]);
      const changeSetId = await recordChanges(
        transaction,
        actor,
        viewChanges(id, "changed", before, after, tier),
      );
      if (changeSetId !== null) {
        await transaction
          .update(savedViews)
          .set({ name: after.name, definition: after.definition })
          .where(eq(savedViews.id, id));
      }
      return { result: toSavedView(after, actor, tiers), changeSetId };
    }),
  );
}

export async function deleteView(
  database: Database,
  actor: Actor,
  id: string,
): Promise<string | null> {
  return database.transaction(async (transaction) => {
    const { row, tiers } = await lockView(transaction, actor, id);
    await transaction.delete(savedViews).where(eq(savedViews.id, id));
    return recordChanges(
      transaction,
      actor,
      viewChanges(
        id,
        "deleted",
        row,
        undefined,
        mostSensitive(usedTiers(tiers, definitionOf(row))),
      ),
    );
  });
}

// The most sensitive tier of the columns a view uses now, as it is and as a change set held it, so
// undoing a change to a view on a column whose list has since become more sensitive needs that tier.
export async function viewTierNow(
  transaction: Transaction,
  id: string,
  held: readonly unknown[],
): Promise<Tier> {
  // The tier of the one view asked for is always found.
  return (await viewTiersNow(transaction, new Map([[id, held]]))).get(
    id,
  ) as Tier;
}

// The same for several views at once, by identifier, as the change history needs.
export async function viewTiersNow(
  reader: Reader,
  held: ReadonlyMap<string, readonly unknown[]>,
): Promise<Map<string, Tier>> {
  const tiers = await columnTiers(reader);
  const rows = await reader
    .select({ id: savedViews.id, definition: savedViews.definition })
    .from(savedViews)
    .where(inArray(savedViews.id, [...held.keys()]));
  const current = new Map(rows.map((row) => [row.id, row.definition]));
  return new Map(
    [...held].map(([id, definitions]) => [
      id,
      mostSensitive(
        [current.get(id), ...definitions].flatMap((definition) => {
          const read = viewDefinitionSchema.safeParse(definition);
          return read.success ? usedTiers(tiers, read.data) : [];
        }),
      ),
    ]),
  );
}

// Refuses to undo a change to a view unless the actor still may change it: they made it, or may
// change planning configuration. A view the undo puts back is checked against who made it.
export async function requireViewUndo(
  transaction: Transaction,
  actor: Actor,
  id: string,
  oldCreatedBy: unknown,
): Promise<void> {
  const [row] = await transaction
    .select({ createdBy: savedViews.createdBy })
    .from(savedViews)
    .where(eq(savedViews.id, id));
  const createdBy = row?.createdBy ?? oldCreatedBy;
  if (typeof createdBy !== "string" || !mayChange(actor, createdBy)) {
    throw new ForbiddenError(notYours);
  }
}
