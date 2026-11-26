// SPDX-License-Identifier: Apache-2.0

// Discarding a user's private changes, all at once or those chosen, recording what takes each
// record back. Part of the data access layer.

import { type Database } from "@fathom/db";
import { type DraftsRequest } from "@fathom/shared";
import { type Actor } from "../access.ts";
import { draftKeys } from "./draft-makers.ts";
import { lockDrafts } from "./drafts.ts";
import { changeKey } from "./unpublished-uses.ts";
import { readGoing, requireDrafting } from "./private-versions.ts";
import { withdraw } from "./private-withdrawals.ts";

// Discards the actor's unpublished drafts a request chooses, with those that use them, or every one
// when it chooses none, recording the changes that takes back, and returns how many records'
// changes it discarded. Discarding them all ends every change set they were saved in, so none is
// ever published. Discarding some is recorded as discarding each record's draft is: a discard where
// no published draft is left, which no longer credits who changed it, and an edit back to the
// published draft otherwise, both published with the user's next changes.
export async function discardUnpublished(
  database: Database,
  actor: Actor,
  chosen?: DraftsRequest,
): Promise<number> {
  requireDrafting(actor);
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const userId = actor.user.id;
    const { versions, rows } = await readGoing(
      transaction,
      userId,
      chosen,
      "discard",
    );
    if (rows.length === 0) return 0;
    const maker = { userId, roleId: actor.roleId };
    if (chosen === undefined) {
      await withdraw(
        transaction,
        maker,
        versions,
        [{ kind: "withdrawal", rows }],
        actor.dataClasses,
      );
      return rows.length;
    }
    const published = await draftKeys(transaction, rows);
    await withdraw(
      transaction,
      maker,
      versions,
      [
        {
          kind: "discard",
          rows: rows.filter((row) => !published.has(changeKey(row))),
        },
        {
          kind: "edit",
          rows: rows.filter((row) => published.has(changeKey(row))),
        },
      ],
      actor.dataClasses,
    );
    return rows.length;
  });
}
