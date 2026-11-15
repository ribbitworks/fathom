// SPDX-License-Identifier: Apache-2.0

// Saved views of each table that keeps them: reading those a user may see, and saving, changing, and
// deleting them. Part of the data access layer, the only server code that queries the database. A
// view belongs to one table, and is seen and saved only by those who open the table's page, as its
// rules in view-tables.ts decide. A personal view is seen and changed only by its maker. Everyone
// who opens the page sees the table's shared views, except a view that filters, sorts, breaks down,
// or groups by a column they may not see, at either level, or whose grouping needs data they may
// not see, since its filters, metrics, and headings could reveal values they may not see; its
// maker is still sent their own personal view, by name and what is missing, to rename or delete.
// Those who may share views on the table may save shared ones, and share their own personal views
// or take them back. Only a shared view's maker, or someone who may share views on its table, may
// change or delete it. Each change is recorded in the change history with the most sensitive class
// of the view's columns and groupings.

import { changes, type Database, inChunks, savedViews } from "@fathom/db";
import {
  classesOfView,
  draftFilterKey,
  inPlacesOf,
  type ListedView,
  opensWith,
  type SavedViewChange,
  type SavedViewRequest,
  seesClass,
  seesView,
  sharesViews,
  type Tier,
  type UnusableView,
  viewChoiceSchemas,
  viewColumnKeys,
  viewGroupings,
  type ViewDefinition,
  viewDefinitionSchema,
  viewScopeSchema,
  type ViewTable,
  viewTableSchema,
} from "@fathom/shared";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { type Actor, mostSensitive } from "../access.ts";
import { BadRequestError, ForbiddenError, NotFoundError } from "../errors.ts";
import {
  type Change,
  changesBetween,
  recordChanges,
  refusingDuplicates,
  type Saved,
  type Transaction,
} from "./changes.ts";
import { type ViewColumns, viewTables } from "./view-tables.ts";

const noView = "There is no such view";
const duplicateView = "There is already a view with that name";
const notYours =
  "Only the person who saved a view, or someone who may share views on its table, can change it";
const notSharer =
  "Only someone who may share views on its table can share a view they saved, or stop sharing it";
const notSharedViewMaker =
  "Only someone who may share views on this table can save a shared view";
const hiddenColumns = "Choose only columns this role can see";
const unknownChoices = "Choose only what this page offers";

type Reader = Pick<Database, "select">;
type ViewRow = typeof savedViews.$inferSelect;

const viewFields = [
  "tableName",
  "name",
  "scope",
  "definition",
  "createdBy",
] as const;

// What a view is checked against: its table's rules and columns.
interface Table {
  name: ViewTable;
  columns: ViewColumns;
}

const rulesOf = (table: Table) => viewTables[table.name];

async function readTable(reader: Reader, name: ViewTable): Promise<Table> {
  // The table is always one of the fixed tables.
  // eslint-disable-next-line security/detect-object-injection
  return { name, columns: await viewTables[name].columns(reader) };
}

const opensTable = (actor: Actor, name: ViewTable | undefined) =>
  name !== undefined &&
  // The table is always one of the fixed tables.
  // eslint-disable-next-line security/detect-object-injection
  opensWith(viewTables[name].opens, actor);

// A table's views are kept from those who don't open its page, as the page is.
function requireOpens(actor: Actor, name: ViewTable): void {
  if (!opensTable(actor, name)) throw new ForbiddenError();
}

// A view as stored, read back through the same checks as the page address.
function definitionOf(row: Pick<ViewRow, "definition">): ViewDefinition {
  return viewDefinitionSchema.parse(row.definition);
}

const knows = (table: Table, key: string) =>
  table.columns.open || table.columns.classed.has(key);

const groupingNeed = (table: Table, grouping: string) =>
  rulesOf(table).groupingNeeds?.get(grouping);

// Whether the table groups by a key: one of its columns, or a grouping with a need of its own.
const groups = (table: Table, grouping: string) =>
  knows(table, grouping) || groupingNeed(table, grouping) !== undefined;

const seesColumn = (actor: Actor, table: Table, key: string) => {
  const column = table.columns.classed.get(key);
  return column === undefined || seesClass(actor.permissions, column.tier);
};

// The classes a view's columns and groupings are kept in; a deleted column is ignored, as it is in
// the page address.
function usedTiers(
  actor: Actor,
  table: Table,
  definition: ViewDefinition,
): Tier[] {
  return [
    ...viewColumnKeys(definition).flatMap((key) => {
      const column = table.columns.classed.get(key);
      return column === undefined ? [] : [column.tier];
    }),
    ...viewGroupings(definition).flatMap((grouping) => {
      const need = groupingNeed(table, grouping);
      return need === undefined ? [] : classesOfView(need.view, actor);
    }),
  ];
}

// What a view uses that the actor may not see: the columns it filters, sorts, or breaks down by,
// and its groupings, by name.
function missingFor(
  actor: Actor,
  table: Table,
  definition: ViewDefinition,
): UnusableView["missing"] {
  const groupings = viewGroupings(definition);
  const unseen = (key: string) => !seesColumn(actor, table, key);
  const nameOf = (key: string) =>
    // Only a column with a class, which is named, goes unseen.
    (table.columns.classed.get(key) as { name: string }).name;
  return {
    columns: viewColumnKeys(definition)
      .filter((key) => !groupings.includes(key) && unseen(key))
      .map(nameOf),
    groupings: groupings.flatMap((grouping) => {
      const need = groupingNeed(table, grouping);
      const missing =
        unseen(grouping) || (need !== undefined && !seesView(need.view, actor));
      // A grouping missing for want of a need's class has a need; any other is a column.
      return missing ? [need?.name ?? nameOf(grouping)] : [];
    }),
  };
}

const usable = (missing: UnusableView["missing"]) =>
  missing.columns.length === 0 && missing.groupings.length === 0;

const sees = (actor: Actor, table: Table, definition: ViewDefinition) =>
  usable(missingFor(actor, table, definition));

const makesSharedViews = (actor: Actor, name: ViewTable) =>
  sharesViews(name, actor.permissions);

// Whether the actor may rename, update, or delete a view.
const mayChange = (
  actor: Actor,
  name: ViewTable,
  createdBy: string,
  scope: string,
): boolean =>
  createdBy === actor.user.id ||
  (scope === "shared" && makesSharedViews(actor, name));

const mayShare = (actor: Actor, name: ViewTable, createdBy: string) =>
  createdBy === actor.user.id && makesSharedViews(actor, name);

const isOthersPersonal = (
  actor: Actor,
  row: Pick<ViewRow, "createdBy" | "scope">,
) => row.scope === "personal" && row.createdBy !== actor.user.id;

const isOwnPersonal = (actor: Actor, row: ViewRow) =>
  row.scope === "personal" && row.createdBy === actor.user.id;

// The widths a view sets for columns the actor may see, or, given `seen` false, for those they may
// not.
function widthsSeen(
  actor: Actor,
  table: Table,
  widths: Record<string, number> | undefined,
  seen: boolean,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(widths ?? {}).filter(
      ([key]) => seesColumn(actor, table, key) === seen,
    ),
  );
}

// The view as a reader is sent it: without filters, sorts, breakdowns, and groupings on columns
// deleted since it was saved, nor the order, hidden columns, or widths of columns the reader may not
// see. None of those reveals a value, so a view keeps them for columns others may not see, and for
// any the table no longer has. Every reader is sent the unit and decimal places each column is shown
// in.
function sentTo(
  actor: Actor,
  table: Table,
  definition: ViewDefinition,
): ViewDefinition {
  const known = (key: string) => knows(table, key);
  const filters = Object.entries(definition.filters ?? {}).filter(
    ([key]) => known(key) || key === draftFilterKey,
  );
  const sort = (definition.sort ?? []).filter((level) =>
    known(level.replace(/^-/, "")),
  );
  const grouped = (grouping: string | undefined) =>
    grouping !== undefined && groups(table, grouping) ? grouping : undefined;
  const seen = (key: string) => seesColumn(actor, table, key);
  return stored({
    search: definition.search,
    show: definition.show,
    filters: filters.length === 0 ? undefined : Object.fromEntries(filters),
    sort: sort.length === 0 ? undefined : sort,
    breakdown: definition.breakdown?.filter(known),
    grouping: grouped(definition.grouping),
    thenBy: grouped(definition.thenBy),
    frozen: definition.frozen,
    order: definition.order?.filter(seen),
    hidden: definition.hidden?.filter(seen),
    widths:
      definition.widths && widthsSeen(actor, table, definition.widths, true),
    units: definition.units,
    places: definition.places,
    retired: definition.retired,
    choices: definition.choices,
  });
}

function toListedView(row: ViewRow, actor: Actor, table: Table): ListedView {
  const definition = definitionOf(row);
  const missing = missingFor(actor, table, definition);
  if (!usable(missing)) return { id: row.id, name: row.name, missing };
  return {
    id: row.id,
    name: row.name,
    scope: viewScopeSchema.parse(row.scope),
    definition: sentTo(actor, table, definition),
    canChange: mayChange(actor, table.name, row.createdBy, row.scope),
    canShare: mayShare(actor, table.name, row.createdBy),
  };
}

// The saved views of a table the actor may see, by name, with their own personal views they may no
// longer use.
export async function readViews(
  reader: Reader,
  actor: Actor,
  name: ViewTable,
): Promise<ListedView[]> {
  requireOpens(actor, name);
  const table = await readTable(reader, name);
  const rows = await reader
    .select()
    .from(savedViews)
    .where(
      and(
        eq(savedViews.tableName, name),
        or(
          eq(savedViews.scope, "shared"),
          eq(savedViews.createdBy, actor.user.id),
        ),
      ),
    )
    .orderBy(asc(sql`lower(${savedViews.name})`), asc(savedViews.id));
  return rows
    .filter(
      (row) =>
        isOwnPersonal(actor, row) || sees(actor, table, definitionOf(row)),
    )
    .map((row) => toListedView(row, actor, table));
}

// Refuses a view that filters, sorts, breaks down, or groups at either level by a column the actor
// may not see, or that the table does not have, or whose groupings need data they may not see, or
// with choices its page doesn't offer, and returns the most sensitive class it uses. A view may filter on drafts too,
// which is General, since each user is sent only the drafts they may see, but not sort or break down
// by them.
function requireSeen(
  actor: Actor,
  table: Table,
  definition: ViewDefinition,
): Tier {
  const unknown = (key: string) => !knows(table, key);
  const filters = Object.keys(definition.filters ?? {});
  const sort = (definition.sort ?? []).map((level) => level.replace(/^-/, ""));
  if (
    filters.some((key) => unknown(key) && key !== draftFilterKey) ||
    sort.some(unknown) ||
    (definition.breakdown ?? []).some(unknown) ||
    viewGroupings(definition).some((grouping) => !groups(table, grouping)) ||
    !sees(actor, table, definition)
  ) {
    throw new BadRequestError(hiddenColumns);
  }
  const choices = viewChoiceSchemas[table.name];
  if (
    definition.choices !== undefined &&
    !choices.safeParse(definition.choices).success
  ) {
    throw new BadRequestError(unknownChoices);
  }
  return mostSensitive(usedTiers(actor, table, definition));
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
  name: ViewTable,
  request: SavedViewRequest,
): Promise<Saved<ListedView>> {
  requireOpens(actor, name);
  if (request.scope === "shared" && !makesSharedViews(actor, name)) {
    throw new ForbiddenError(notSharedViewMaker);
  }
  const row: ViewRow = {
    id: randomUUID(),
    tableName: name,
    name: request.name,
    scope: request.scope,
    definition: stored(request.definition),
    createdBy: actor.user.id,
  };
  return refusingDuplicates(duplicateView, () =>
    database.transaction(async (transaction) => {
      const table = await readTable(transaction, name);
      const tier = requireSeen(actor, table, request.definition);
      await transaction.insert(savedViews).values(row);
      const changeSetId = await recordChanges(
        transaction,
        actor,
        viewChanges(row.id, "created", undefined, row, tier),
      );
      return { result: toListedView(row, actor, table), changeSetId };
    }),
  );
}

// The view, locked for a change, with its table, once the actor is known to see and may change it.
// Its maker may rename or delete their own personal view they may no longer use, and nothing else.
async function lockView(
  transaction: Transaction,
  actor: Actor,
  name: ViewTable,
  id: string,
): Promise<{ row: ViewRow; table: Table; usable: boolean }> {
  requireOpens(actor, name);
  const [row] = await transaction
    .select()
    .from(savedViews)
    .where(and(eq(savedViews.id, id), eq(savedViews.tableName, name)))
    .for("update");
  const table = await readTable(transaction, name);
  if (row === undefined || isOthersPersonal(actor, row)) {
    throw new NotFoundError(noView);
  }
  const seen = sees(actor, table, definitionOf(row));
  if (!seen && !isOwnPersonal(actor, row)) throw new NotFoundError(noView);
  if (!mayChange(actor, name, row.createdBy, row.scope)) {
    throw new ForbiddenError(notYours);
  }
  return { row, table, usable: seen };
}

// Renames a view, saves a new view over it, shares it or takes it back, or any of these.
export async function updateView(
  database: Database,
  actor: Actor,
  name: ViewTable,
  id: string,
  change: SavedViewChange,
): Promise<Saved<ListedView>> {
  return refusingDuplicates(duplicateView, () =>
    database.transaction(async (transaction) => {
      const {
        row: before,
        table,
        usable: canApply,
      } = await lockView(transaction, actor, name, id);
      if (
        !canApply &&
        (change.definition !== undefined || change.scope !== undefined)
      ) {
        throw new NotFoundError(noView);
      }
      if (
        change.scope !== undefined &&
        change.scope !== before.scope &&
        !mayShare(actor, name, before.createdBy)
      ) {
        throw new ForbiddenError(notSharer);
      }
      // The actor was not sent the order, hidden columns, or widths of columns they may not see, so
      // keeps those already set.
      const keepingUnseen = (row: ViewRow, definition: ViewDefinition) => {
        const kept = definitionOf(row);
        const unseen = (key: string) => !seesColumn(actor, table, key);
        const widths = {
          ...widthsSeen(actor, table, kept.widths, false),
          ...definition.widths,
        };
        const hidden = [
          ...new Set([
            ...(kept.hidden ?? []).filter(unseen),
            ...(definition.hidden ?? []),
          ]),
        ];
        return {
          ...definition,
          order:
            definition.order &&
            inPlacesOf(
              (kept.order ?? []).filter(
                (key) =>
                  definition.order?.includes(key) === true || unseen(key),
              ),
              definition.order,
            ),
          hidden: hidden.length === 0 ? undefined : hidden,
          widths: Object.keys(widths).length === 0 ? undefined : widths,
        };
      };
      const after: ViewRow = {
        ...before,
        ...(change.name === undefined ? {} : { name: change.name }),
        ...(change.scope === undefined ? {} : { scope: change.scope }),
        ...(change.definition === undefined
          ? {}
          : { definition: stored(keepingUnseen(before, change.definition)) }),
      };
      const tier = mostSensitive([
        mostSensitive(usedTiers(actor, table, definitionOf(before))),
        change.definition === undefined
          ? "general"
          : requireSeen(actor, table, change.definition),
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
      return { result: toListedView(after, actor, table), changeSetId };
    }),
  );
}

export async function deleteView(
  database: Database,
  actor: Actor,
  name: ViewTable,
  id: string,
): Promise<string | null> {
  return database.transaction(async (transaction) => {
    const { row, table } = await lockView(transaction, actor, name, id);
    await transaction.delete(savedViews).where(eq(savedViews.id, id));
    return recordChanges(
      transaction,
      actor,
      viewChanges(
        id,
        "deleted",
        row,
        undefined,
        mostSensitive(usedTiers(actor, table, definitionOf(row))),
      ),
    );
  });
}

// A view's table and the most sensitive class it uses now, as it is and as a change set held it, so
// undoing a change to a view on a column whose list has since become more sensitive needs that class.
export interface ViewNow {
  // Unknown for a view on a table Fathom no longer keeps views of, which nobody opens.
  table: ViewTable | undefined;
  tier: Tier;
}

export async function viewNow(
  transaction: Transaction,
  actor: Actor,
  id: string,
  held: readonly unknown[],
): Promise<ViewNow> {
  // The view asked for is always found.
  return (await viewsNow(transaction, actor, new Map([[id, held]]))).get(
    id,
  ) as ViewNow;
}

// The same for several views at once, by identifier, as the change history needs. A view's table
// never changes, so a deleted view's is the one its history recorded.
export async function viewsNow(
  reader: Reader,
  actor: Actor,
  held: ReadonlyMap<string, readonly unknown[]>,
): Promise<Map<string, ViewNow>> {
  const ids = [...held.keys()];
  const current = new Map<string, Pick<ViewRow, "tableName" | "definition">>();
  for (const chunk of inChunks(ids)) {
    const rows = await reader
      .select({
        id: savedViews.id,
        tableName: savedViews.tableName,
        definition: savedViews.definition,
      })
      .from(savedViews)
      .where(inArray(savedViews.id, chunk));
    for (const row of rows) current.set(row.id, row);
    const recorded = await reader
      .select({
        recordId: changes.recordId,
        value: sql<unknown>`coalesce(${changes.newValue}, ${changes.oldValue})`,
      })
      .from(changes)
      .where(
        and(
          eq(changes.recordType, "saved-view"),
          eq(changes.field, "tableName"),
          inArray(changes.recordId, chunk),
        ),
      );
    for (const { recordId, value } of recorded) {
      if (!current.has(recordId)) {
        current.set(recordId, { tableName: String(value), definition: null });
      }
    }
  }
  const tables = new Map<ViewTable, Table>();
  const result = new Map<string, ViewNow>();
  for (const [id, definitions] of held) {
    const known = viewTableSchema.safeParse(current.get(id)?.tableName);
    if (!known.success) {
      result.set(id, { table: undefined, tier: "confidential" });
      continue;
    }
    const name = known.data;
    const table = tables.get(name) ?? (await readTable(reader, name));
    tables.set(name, table);
    result.set(id, {
      table: name,
      tier: mostSensitive(
        [current.get(id)?.definition, ...definitions].flatMap((definition) => {
          const read = viewDefinitionSchema.safeParse(definition);
          return read.success ? usedTiers(actor, table, read.data) : [];
        }),
      ),
    });
  }
  return result;
}

// Whether the actor sees a change to a view: they open its page and see every class it has used.
export const seesViewHistory = (
  actor: Actor,
  view: ViewNow,
  tiers: readonly Tier[],
) =>
  opensTable(actor, view.table) &&
  tiers.every((tier) => seesClass(actor.permissions, tier));

// Whether the actor opens any table's views, so the change history looks for changes to them.
export const opensAnyViews = (actor: Actor) =>
  viewTableSchema.options.some((name) => opensTable(actor, name));

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

// Refuses to undo a change to a view unless the actor still opens its page and may change it: they
// made it, or it is shared and they may share views on its table. A view the undo puts back is
// checked against who made it and how it was kept. Undoing also needs what the undo does to the
// view's scope: sharing it or taking it back as for doing so directly, and putting back a deleted
// shared view as for saving one.
export async function requireViewUndo(
  transaction: Transaction,
  actor: Actor,
  id: string,
  name: ViewTable | undefined,
  old: ReadonlyMap<string, unknown>,
): Promise<void> {
  if (name === undefined || !opensTable(actor, name)) {
    throw new ForbiddenError();
  }
  const [row] = await transaction
    .select({ createdBy: savedViews.createdBy, scope: savedViews.scope })
    .from(savedViews)
    .where(eq(savedViews.id, id));
  // A view its maker has since taken back: the undo is refused as changed since.
  if (row !== undefined && isOthersPersonal(actor, row)) return;
  const createdBy = row?.createdBy ?? old.get("createdBy");
  if (
    typeof createdBy !== "string" ||
    !mayChange(actor, name, createdBy, String(row?.scope ?? old.get("scope")))
  ) {
    throw new ForbiddenError(notYours);
  }
  const scopeBack = old.get("scope");
  if (row === undefined) {
    if (scopeBack === "shared" && !makesSharedViews(actor, name)) {
      throw new ForbiddenError(notSharedViewMaker);
    }
  } else if (
    typeof scopeBack === "string" &&
    !mayShare(actor, name, createdBy)
  ) {
    throw new ForbiddenError(notSharer);
  }
}
