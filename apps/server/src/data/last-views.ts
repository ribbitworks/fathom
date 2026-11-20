// SPDX-License-Identifier: Apache-2.0

// The view each account last showed on each page with a Views menu, in the data access layer:
// reading and saving it, checked as a saved view is.

import { type Database, lastViews, type Reader, savedViews } from "@fathom/db";
import {
  draftFilterKey,
  type LastView,
  lastViewModes,
  type LastViews,
  type LastViewRequest,
  viewChoiceSchemas,
  type ViewDefinition,
  viewDefinitionSchema,
  type ViewPage,
  viewPageOf,
  viewPageSchema,
  viewTableSchema,
} from "@fathom/shared";
import { and, eq, or } from "drizzle-orm";
import type { Actor } from "../access.ts";
import { BadRequestError } from "../errors.ts";
import {
  opensTable,
  readTable,
  requireOpens,
  requireSeen,
  seesColumn,
  seesGrouping,
  sentTo,
  type Table,
} from "./views.ts";

const otherPage = "Choose a table of this page";
const unknownMode = "Choose a mode this page has";

// A view with only the filters, sorts, breakdowns and groupings on what the actor may see.
function seenParts(
  actor: Actor,
  table: Table,
  definition: ViewDefinition,
): ViewDefinition {
  const seen = (key: string) => seesColumn(actor, table, key);
  const grouped = (grouping: string | undefined) =>
    grouping !== undefined && seesGrouping(actor, table, grouping)
      ? grouping
      : undefined;
  const filters = Object.entries(definition.filters ?? {}).filter(
    ([key]) => key === draftFilterKey || seen(key),
  );
  const grouping = grouped(definition.grouping);
  return {
    ...definition,
    filters: filters.length === 0 ? undefined : Object.fromEntries(filters),
    sort: definition.sort?.filter((level) => seen(level.replace(/^-/, ""))),
    breakdown: definition.breakdown?.filter(seen),
    grouping,
    thenBy: grouping === undefined ? undefined : grouped(definition.thenBy),
    groupsReversed:
      grouping === undefined ? undefined : definition.groupsReversed,
  };
}

const modeOf = (page: ViewPage, mode: string | null | undefined) =>
  // The page is always one of the fixed pages.
  // eslint-disable-next-line security/detect-object-injection
  lastViewModes[page]?.safeParse(mode).data;

interface LastViewRow {
  last: typeof lastViews.$inferSelect;
  // The saved view it started from, when one is named and still exists.
  saved: { scope: string; createdBy: string } | null;
}

// Whether the actor may still apply a saved view: a shared one, or their own.
const mayApply = (actor: Actor, saved: LastViewRow["saved"]) =>
  saved !== null &&
  (saved.scope === "shared" || saved.createdBy === actor.user.id);

// A last view as the actor is sent it, or none once their role no longer opens the table it shows.
// A row this version can't read, such as one from a page since removed, is not sent either.
async function sentLastView(
  reader: Reader,
  actor: Actor,
  { last, saved }: LastViewRow,
): Promise<[ViewPage, LastView] | undefined> {
  const page = viewPageSchema.safeParse(last.page).data;
  const name = viewTableSchema.safeParse(last.tableName).data;
  const stored = viewDefinitionSchema.safeParse(last.definition).data;
  if (
    page === undefined ||
    name === undefined ||
    stored === undefined ||
    // The table is always one of the fixed tables.
    // eslint-disable-next-line security/detect-object-injection
    viewPageOf[name] !== page ||
    !opensTable(actor, name)
  ) {
    return undefined;
  }
  const table = await readTable(reader, name);
  const { choices, ...definition } = sentTo(
    actor,
    table,
    seenParts(actor, table, stored),
  );
  const mode = modeOf(page, last.mode);
  // The choices are dropped once the page no longer offers them.
  // eslint-disable-next-line security/detect-object-injection
  const choicesKept = viewChoiceSchemas[name].safeParse(choices).success;
  return [
    page,
    {
      table: name,
      definition:
        choices === undefined || !choicesKept
          ? definition
          : { ...definition, choices },
      ...(last.savedViewId === null || !mayApply(actor, saved)
        ? {}
        : { view: last.savedViewId }),
      ...(mode === undefined ? {} : { mode }),
    },
  ];
}

// The actor's last view of each page their role opens, read once when they sign in. Each page has
// tables of its own, so each table is read at most once.
export async function readLastViews(
  reader: Reader,
  actor: Actor,
): Promise<LastViews> {
  const rows = await reader
    .select({
      last: lastViews,
      saved: { scope: savedViews.scope, createdBy: savedViews.createdBy },
    })
    .from(lastViews)
    .leftJoin(savedViews, eq(savedViews.id, lastViews.savedViewId))
    .where(eq(lastViews.userId, actor.user.id));
  const sent = await Promise.all(
    rows.map((row) => sentLastView(reader, actor, row)),
  );
  return Object.fromEntries(sent.filter((each) => each !== undefined));
}

// Saves the view last shown, refusing one the actor's role couldn't save as a view, or a table or
// mode the page doesn't have. A saved view the actor may no longer see is not kept with it.
export async function saveLastView(
  database: Database,
  actor: Actor,
  page: ViewPage,
  request: LastViewRequest,
): Promise<void> {
  requireOpens(actor, request.table);
  if (viewPageOf[request.table] !== page) throw new BadRequestError(otherPage);
  if (request.mode !== undefined && modeOf(page, request.mode) === undefined) {
    throw new BadRequestError(unknownMode);
  }
  requireSeen(
    actor,
    await readTable(database, request.table),
    request.definition,
  );
  const [saved] =
    request.view === undefined
      ? []
      : await database
          .select({ id: savedViews.id })
          .from(savedViews)
          .where(
            and(
              eq(savedViews.id, request.view),
              eq(savedViews.tableName, request.table),
              or(
                eq(savedViews.scope, "shared"),
                eq(savedViews.createdBy, actor.user.id),
              ),
            ),
          );
  const values = {
    tableName: request.table,
    definition: request.definition,
    savedViewId: saved?.id ?? null,
    mode: request.mode ?? null,
  };
  await database
    .insert(lastViews)
    .values({ userId: actor.user.id, page, ...values })
    .onConflictDoUpdate({
      target: [lastViews.userId, lastViews.page],
      set: values,
    });
}
