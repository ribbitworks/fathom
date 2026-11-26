// SPDX-License-Identifier: Apache-2.0

// The data access layer's interface to a person's own pages, their columns and rows, each read and
// change checked against the page's maker.

import type { Database } from "@fathom/db";
import type {
  ListedPrivatePage,
  PrivatePage,
  PrivatePageRequest,
  PrivateRowRequest,
} from "@fathom/shared";
import type { Actor } from "../access.ts";
import type { ChangeSetId, Saved } from "./changes.ts";
import { listPages, readPage } from "./private-page-reads.ts";
import * as pages from "./private-pages.ts";
import * as rows from "./private-rows.ts";

export interface PrivatePageAccess {
  list(actor: Actor): Promise<ListedPrivatePage[]>;
  read(actor: Actor, id: string): Promise<PrivatePage>;
  make(actor: Actor, request: PrivatePageRequest): Promise<Saved<PrivatePage>>;
  rename(actor: Actor, id: string, name: string): Promise<Saved<PrivatePage>>;
  move(actor: Actor, id: string, position: number): Promise<ChangeSetId>;
  remove(actor: Actor, id: string): Promise<ChangeSetId>;
  addRow(
    actor: Actor,
    id: string,
    request: PrivateRowRequest,
  ): Promise<Saved<PrivatePage>>;
  changeRow(
    actor: Actor,
    id: string,
    rowId: string,
    request: PrivateRowRequest,
  ): Promise<Saved<PrivatePage>>;
  removeRow(
    actor: Actor,
    id: string,
    rowId: string,
  ): Promise<Saved<PrivatePage>>;
}

export function createPrivatePageAccess(database: Database): PrivatePageAccess {
  return {
    list: async (actor) => listPages(database, actor),
    read: async (actor, id) => readPage(database, actor, id),
    make: async (actor, request) => pages.makePage(database, actor, request),
    rename: async (actor, id, name) =>
      pages.renamePage(database, actor, id, name),
    move: async (actor, id, position) =>
      pages.movePage(database, actor, id, position),
    remove: async (actor, id) => pages.removePage(database, actor, id),
    addRow: async (actor, id, request) =>
      rows.addRow(database, actor, id, request),
    changeRow: async (actor, id, rowId, request) =>
      rows.changeRow(database, actor, id, rowId, request),
    removeRow: async (actor, id, rowId) =>
      rows.removeRow(database, actor, id, rowId),
  };
}
