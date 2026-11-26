// SPDX-License-Identifier: Apache-2.0

// What deciding each draft needs, read for the shared rule of who decides it, and refusing a role
// that may not. Part of the data access layer.

import {
  areaWords,
  type Asking,
  type ColumnTable,
  columnTableOf,
  type Decided,
  decidersOf,
  decides,
  type DraftKind,
  draftKinds,
  holdsAny,
  tableKinds,
} from "@fathom/shared";
import type { Reader } from "@fathom/db";
import type { Actor } from "../access.ts";
import { ForbiddenError } from "../errors.ts";
import { readColumnsState } from "./column-state.ts";
import { tablesMadeWith } from "./lists-made-with.ts";

// The drafts given, by key, each as deciding it needs: its kind, with a column's table, and the table
// of the column a list or choice was made with.
export async function readDecided(
  reader: Reader,
  keys: readonly string[],
): Promise<Map<string, Decided>> {
  const asked = draftKinds.flatMap((kind) =>
    keys
      .filter((key) => key.startsWith(`${kind} `))
      .map((key) => ({ key, kind, id: key.slice(kind.length + 1) })),
  );
  const idsOf = (kind: DraftKind) =>
    asked.filter((one) => one.kind === kind).map(({ id }) => id);
  const state = tableKinds.some((kind) => idsOf(kind).length > 0)
    ? await readColumnsState(reader)
    : undefined;
  const tables: Partial<Record<DraftKind, ReadonlyMap<string, ColumnTable>>> =
    state === undefined
      ? {}
      : {
          field: new Map(
            idsOf("field").map((id) => [
              id,
              columnTableOf(
                state.fields.get(id)?.tableName ??
                  state.fieldDrafts.get(id)?.fields.tableName,
              ),
            ]),
          ),
          list: await tablesMadeWith(
            reader,
            state.lists,
            "list",
            idsOf("list"),
          ),
          "list-item": await tablesMadeWith(
            reader,
            state.lists,
            "list-item",
            idsOf("list-item"),
          ),
        };
  return new Map(
    asked.map(({ key, kind, id }) => [
      key,
      // The kind is always one of the fixed list.
      // eslint-disable-next-line security/detect-object-injection
      { kind, table: tables[kind]?.get(id) },
    ]),
  );
}

// Refuses deciding drafts the actor's role does not decide, naming the areas that do; one whose
// Approve it holds without the sight deciding it needs is refused as any request lacking a permission.
export function refuseBeyondRole(
  actor: Actor,
  decided: Iterable<Decided>,
  asking: Asking,
): void {
  for (const one of decided) {
    if (!holdsAny(actor.permissions, decidersOf(one))) {
      throw new ForbiddenError(
        `This role can't ${asking} drafts of ${areaWords(one)}`,
      );
    }
    if (!decides(actor.permissions, one)) throw new ForbiddenError();
  }
}
