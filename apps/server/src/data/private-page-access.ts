// SPDX-License-Identifier: Apache-2.0

// The data access layer's interface to a person's own pages, each read checked against the page's
// maker.

import type { Database } from "@fathom/db";
import type { ListedPrivatePage, PrivatePage } from "@fathom/shared";
import type { Actor } from "../access.ts";
import { listPages, readPage } from "./private-page-reads.ts";

export interface PrivatePageAccess {
  list(actor: Actor): Promise<ListedPrivatePage[]>;
  read(actor: Actor, id: string): Promise<PrivatePage>;
}

export function createPrivatePageAccess(database: Database): PrivatePageAccess {
  return {
    list: async (actor) => listPages(database, actor),
    read: async (actor, id) => readPage(database, actor, id),
  };
}
