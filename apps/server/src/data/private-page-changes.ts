// SPDX-License-Identifier: Apache-2.0

// Saving a change to a person's own page at once: checking and locking the page, recording the
// changes, and answering with the page as it then is. Part of the data access layer.

import { type Database, users } from "@fathom/db";
import type { PrivatePage } from "@fathom/shared";
import { eq } from "drizzle-orm";
import type { Actor } from "../access.ts";
import {
  type Change,
  changesBetween,
  recordChanges,
  type Saved,
  type Transaction,
} from "./changes.ts";
import {
  answeredPage,
  checkedPage,
  type PageOut,
  pageOut,
  type PageRow,
  pageRow,
} from "./private-page-reads.ts";

const pageFields = ["userId", "name", "position", "firstFieldId"] as const;

// A page as the change history records it.
export type PageVersion = Pick<PageRow, (typeof pageFields)[number]>;

export const pageChanges = (
  id: string,
  action: Change["action"],
  before: PageVersion | undefined,
  after: PageVersion | undefined,
) => changesBetween("private-page", id, action, before, after, pageFields);

// Waits for any other change to the order of the actor's pages, so two saved at once never take
// the same place, and never wait on each other's pages. No key update, since every save's change
// set names its maker by key; a stronger lock would hold those saves and could deadlock with them.
export async function lockPageOrder(
  transaction: Transaction,
  actor: Actor,
): Promise<void> {
  await transaction
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, actor.user.id))
    .for("no key update");
}

// A page its maker has just made, as they see it, in the transaction that made it.
export async function madePage(
  transaction: Transaction,
  actor: Actor,
  id: string,
): Promise<PageOut> {
  return pageOut(
    transaction,
    actor,
    await checkedPage(transaction, actor, id, false),
  );
}

// Saves a change to a page at once, once the actor may change it, recording the changes it makes,
// and answers with the page as it then is.
export async function changingPage(
  database: Database,
  actor: Actor,
  id: string,
  change: (transaction: Transaction, page: PageRow) => Promise<Change[]>,
): Promise<Saved<PrivatePage>> {
  const { out, changeSetId } = await database.transaction(
    async (transaction) => {
      const page = await checkedPage(transaction, actor, id, true);
      const changeSetId = await recordChanges(
        transaction,
        actor,
        await change(transaction, page),
      );
      // Locked above, so still there.
      const after = (await pageRow(transaction, id, false)) as PageRow;
      return { out: await pageOut(transaction, actor, after), changeSetId };
    },
  );
  return { result: await answeredPage(database, actor, out), changeSetId };
}

// Saves a change to a page at once, once the actor may change it, recording the changes it makes,
// for a change that answers nothing else, such as removing the page. A change to the order of the
// actor's pages takes its lock first.
export async function recordingPageChange(
  database: Database,
  actor: Actor,
  id: string,
  change: (transaction: Transaction, page: PageRow) => Promise<Change[]>,
  reorders: boolean,
): Promise<string | null> {
  return database.transaction(async (transaction) => {
    if (reorders) await lockPageOrder(transaction, actor);
    return recordChanges(
      transaction,
      actor,
      await change(
        transaction,
        await checkedPage(transaction, actor, id, true),
      ),
    );
  });
}
