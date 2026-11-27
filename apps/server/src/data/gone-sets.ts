// SPDX-License-Identifier: Apache-2.0

// The private change sets a record gone leaves closed or replaced, judged by the change set read
// (`change_sets`) and the withdrawals of its maker's changes as records went. Part of the data access
// layer.

import { changeSets, type ChangeSetKind } from "@fathom/db";
import { type SQL, sql } from "drizzle-orm";
import { listedKinds } from "./change-set-kinds.ts";

const goneKind: ChangeSetKind = "gone";

// A withdrawal, as `gone`, of the change set's maker's changes, made after it.
const goneLater = sql`gone.kind = ${goneKind} AND gone.made_by = ${changeSets.madeBy} AND gone.made_at > ${changeSets.madeAt}`;

// The change set changed a record the withdrawal, as `gone`, took back.
const changedTaken = sql`EXISTS (SELECT 1 FROM fathom.changes AS own JOIN fathom.changes AS taken ON taken.record_type = own.record_type AND taken.record_id = own.record_id WHERE own.change_set_id = ${changeSets.id} AND taken.change_set_id = gone.id)`;

// The change set changed a record the withdrawal, as `gone`, didn't take back.
const changedKept = sql`EXISTS (SELECT 1 FROM fathom.changes AS own WHERE own.change_set_id = ${changeSets.id} AND NOT EXISTS (SELECT 1 FROM fathom.changes AS taken WHERE taken.change_set_id = gone.id AND taken.record_type = own.record_type AND taken.record_id = own.record_id))`;

// No discard of everything by the maker came between the change set and the withdrawal, as `gone`,
// so the change set was still open when it was made.
const openUntilGone = sql`NOT EXISTS (SELECT 1 FROM fathom.change_sets AS ending WHERE ending.made_by = gone.made_by AND ending.kind IN (${listedKinds(({ endsOpen }) => endsOpen)}) AND ending.made_at > ${changeSets.madeAt} AND ending.made_at < gone.made_at)`;

// Whether a change set of its maker's changed a record that a later withdrawal of theirs, as the
// record went, took back. A private one is then never published, since what it changed is gone.
export const closedByGone: SQL = sql`EXISTS (SELECT 1 FROM fathom.change_sets AS gone WHERE ${goneLater} AND ${changedTaken})`;

// Whether a private change set, open when a withdrawal of its maker's as a record went took back
// some of its changes but not all, was replaced then by two copies made at its time: one of the
// changes withdrawn, never published, and one of the rest, published as any. So nobody sees it.
export const replacedAsGone: SQL = sql`(${changeSets.private} AND ${changeSets.kind} IN (${listedKinds(({ publishedNext }) => publishedNext)}) AND EXISTS (SELECT 1 FROM fathom.change_sets AS gone WHERE ${goneLater} AND ${openUntilGone} AND ${changedTaken} AND ${changedKept}))`;
