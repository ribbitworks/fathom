// SPDX-License-Identifier: Apache-2.0

// Saved views of the People table: reading those a user may see, and saving, changing, and deleting
// them. Part of the data access layer, the only server code that queries the database. A personal
// view is seen and changed only by its maker. Everyone who sees people sees the table's shared
// views, except a view that filters, sorts, or breaks down by a column they may not see, since its
// filters and metrics could reveal values they may not see. Anyone who sees people may save a
// personal view; those who may change planning configuration may save shared ones, and share their
// own personal views or take them back. Only a shared view's maker, or someone who may change
// planning configuration, may change or delete it. Each change is recorded in the change history
// with the most sensitive tier of the view's columns.

import { changes, type Database, inChunks, savedViews } from "@fathom/db";
import {
  builtInColumnTiers,
  type SavedView,
  type SavedViewChange,
  type SavedViewRequest,
  type Tier,
  draftFilterKey,
  inPlacesOf,
  type ViewDefinition,
  viewColumnKeys,
  viewDefinitionSchema,
  viewScopeSchema,
} from "@fathom/shared";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
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
import { readColumns } from "./values.ts";

const table = "people";
const noView = "There is no such view";
const duplicateView = "There is already a view with that name";
const notYours =
  "Only the person who saved a view, or someone who may change planning configuration, can change it";
const notSharer =
  "Only someone who may change planning configuration can share a view they saved, or take it back";
const notSharedViewMaker =
  "Only someone who may change planning configuration can save a shared view";
const hiddenColumns = "Choose only columns this role can see";

type Reader = Pick<Database, "select">;
type ViewRow = typeof savedViews.$inferSelect;

const viewFields = [
  "tableName",
  "name",
  "scope",
  "definition",
  "createdBy",
] as const;

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

const makesSharedViews = (actor: Actor) =>
  actor.permissions.includes("configuration:edit");

// Whether the actor may rename, update, or delete a view.
export function mayChange(
  actor: Actor,
  createdBy: string,
  scope: string,
): boolean {
  return (
    createdBy === actor.user.id ||
    (scope === "shared" && makesSharedViews(actor))
  );
}

const mayShare = (actor: Actor, createdBy: string) =>
  createdBy === actor.user.id && makesSharedViews(actor);

const isOthersPersonal = (
  actor: Actor,
  row: Pick<ViewRow, "createdBy" | "scope">,
) => row.scope === "personal" && row.createdBy !== actor.user.id;

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
// it was saved, nor the widths or places of columns the reader may not see. Neither reveals a value,
// so a view keeps those of columns others may not see, and of any the table no longer has, as it
// keeps the unit and decimal places each column is shown in.
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
    order: definition.order?.filter((key) => seesColumn(actor, tiers, key)),
    widths:
      definition.widths && widthsSeen(actor, tiers, definition.widths, true),
    units: definition.units,
    places: definition.places,
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
    scope: viewScopeSchema.parse(row.scope),
    definition: sentTo(actor, tiers, definitionOf(row)),
    canChange: mayChange(actor, row.createdBy, row.scope),
    canShare: mayShare(actor, row.createdBy),
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
    .where(
      and(
        eq(savedViews.tableName, table),
        or(
          eq(savedViews.scope, "shared"),
          eq(savedViews.createdBy, actor.user.id),
        ),
      ),
    )
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
  if (request.scope === "shared" && !makesSharedViews(actor)) {
    throw new ForbiddenError(notSharedViewMaker);
  }
  const row: ViewRow = {
    id: randomUUID(),
    tableName: table,
    name: request.name,
    scope: request.scope,
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
  if (
    row === undefined ||
    isOthersPersonal(actor, row) ||
    !sees(actor, tiers, definitionOf(row))
  ) {
    throw new NotFoundError(noView);
  }
  if (!mayChange(actor, row.createdBy, row.scope)) {
    throw new ForbiddenError(notYours);
  }
  return { row, tiers };
}

// Renames a view, saves a new view over it, shares it or takes it back, or any of these.
export async function updateView(
  database: Database,
  actor: Actor,
  id: string,
  change: SavedViewChange,
): Promise<Saved<SavedView>> {
  return refusingDuplicates(duplicateView, () =>
    database.transaction(async (transaction) => {
      const { row: before, tiers } = await lockView(transaction, actor, id);
      if (
        change.scope !== undefined &&
        change.scope !== before.scope &&
        !mayShare(actor, before.createdBy)
      ) {
        throw new ForbiddenError(notSharer);
      }
      // The actor was not sent the widths or places of columns they may not see, so keeps those
      // already set.
      const keepingHidden = (row: ViewRow, definition: ViewDefinition) => {
        const kept = definitionOf(row);
        const widths = {
          ...widthsSeen(actor, tiers, kept.widths, false),
          ...definition.widths,
        };
        return {
          ...definition,
          order:
            definition.order &&
            inPlacesOf(
              (kept.order ?? []).filter(
                (key) =>
                  definition.order?.includes(key) === true ||
                  !seesColumn(actor, tiers, key),
              ),
              definition.order,
            ),
          widths: Object.keys(widths).length === 0 ? undefined : widths,
        };
      };
      const after: ViewRow = {
        ...before,
        ...(change.name === undefined ? {} : { name: change.name }),
        ...(change.scope === undefined ? {} : { scope: change.scope }),
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
        // Sharing or taking back has no dialog to show which name is taken, so the refusal says.
        await refusingDuplicates(
          after.scope === before.scope
            ? duplicateView
            : `There is already a ${after.scope} view named ${after.name}`,
          async () =>
            transaction
              .update(savedViews)
              .set({
                name: after.name,
                scope: after.scope,
                definition: after.definition,
              })
              .where(eq(savedViews.id, id)),
        );
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

interface ViewHistory {
  createdBy: unknown;
  opening: unknown;
  scopes: { from: number; scope: unknown }[];
}

const scopeAt = (view: ViewHistory, id: number) =>
  view.scopes.reduce(
    (scope, change) => (change.from <= id ? change.scope : scope),
    view.opening,
  );

// Whether each change to the views given is kept from the actor: every change to another user's
// view that is personal now, as the history last recorded it, which it still holds once the view is
// deleted, and those made while a view now shared was personal, so sharing a view shows nothing of
// its private past. A name changed in the same request as sharing is recorded before the scope, so
// its old name stays kept too.
export async function readKeptViewChanges(
  reader: Reader,
  actor: Actor,
  ids: readonly string[],
): Promise<(change: { id: number; recordId: string }) => boolean> {
  const views = new Map<string, ViewHistory>(
    ids.map((id) => [id, { createdBy: undefined, opening: null, scopes: [] }]),
  );
  for (const chunk of inChunks([...ids])) {
    const rows = await reader
      .select({
        id: changes.id,
        recordId: changes.recordId,
        field: changes.field,
        oldValue: changes.oldValue,
        newValue: changes.newValue,
      })
      .from(changes)
      .where(
        and(
          eq(changes.recordType, "saved-view"),
          inArray(changes.field, ["scope", "createdBy"]),
          inArray(changes.recordId, chunk),
        ),
      )
      .orderBy(asc(changes.id));
    for (const { id, recordId, field, oldValue, newValue } of rows) {
      // Every view asked for has its entry, made just above.
      const view = views.get(recordId) as ViewHistory;
      const value = newValue ?? oldValue;
      if (field === "createdBy") {
        view.createdBy = value;
      } else {
        view.opening ??= oldValue ?? newValue;
        view.scopes.push({ from: id, scope: value });
      }
    }
  }
  return ({ id, recordId }) => {
    const view = views.get(recordId) as ViewHistory;
    return (
      view.createdBy !== actor.user.id &&
      (scopeAt(view, Number.POSITIVE_INFINITY) === "personal" ||
        scopeAt(view, id) === "personal")
    );
  };
}

// Refuses to undo a change to a view unless the actor still may change it: they made it, or it is
// shared and they may change planning configuration. A view the undo puts back is checked against
// who made it and how it was kept. Undoing also needs what the undo does to the view's scope:
// sharing it or taking it back as for doing so directly, and putting back a deleted shared view as
// for saving one.
export async function requireViewUndo(
  transaction: Transaction,
  actor: Actor,
  id: string,
  old: ReadonlyMap<string, unknown>,
): Promise<void> {
  const [row] = await transaction
    .select({ createdBy: savedViews.createdBy, scope: savedViews.scope })
    .from(savedViews)
    .where(eq(savedViews.id, id));
  // A view its maker has since taken back: the undo is refused as changed since.
  if (row !== undefined && isOthersPersonal(actor, row)) return;
  const createdBy = row?.createdBy ?? old.get("createdBy");
  if (
    typeof createdBy !== "string" ||
    !mayChange(actor, createdBy, String(row?.scope ?? old.get("scope")))
  ) {
    throw new ForbiddenError(notYours);
  }
  const scopeBack = old.get("scope");
  if (row === undefined) {
    if (scopeBack === "shared" && !makesSharedViews(actor)) {
      throw new ForbiddenError(notSharedViewMaker);
    }
  } else if (typeof scopeBack === "string" && !mayShare(actor, createdBy)) {
    throw new ForbiddenError(notSharer);
  }
}
