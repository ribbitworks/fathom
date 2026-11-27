// SPDX-License-Identifier: Apache-2.0

// The rules of each kind of change set, which every reader of the change history follows. Part of
// the data access layer.

import { type ChangeSetKind } from "@fathom/db";
import { type ChangeKind } from "@fathom/shared";
import { type SQL, sql } from "drizzle-orm";

interface KindRules {
  // Whether it changes drafts as its maker intends them, so is private until published.
  editing: boolean;
  // How the change history shows it.
  shownAs: ChangeKind;
  // Whether, while private, it is published with its maker's next publish.
  publishedNext: boolean;
  // Whether it ends its maker's earlier private change sets, which are then never published.
  endsOpen: boolean;
  // Why undoing it is refused, or null when it may be undone.
  undoRefused: string | null;
  // Whether it decides a draft, so starts again who changed it.
  resetsMakers: boolean;
  // Whether it changes a draft, so its maker counts as having changed it.
  changesDraft: boolean;
  // How undoing it, when allowed, works: by putting back what it changed, or, for drafts sent for
  // approval again unchanged, by rejecting them again.
  undoneBy: "puttingBack" | "rejectingAgain";
}

const decision =
  "Approving and rejecting drafts cannot be undone; change the draft or the data instead";

export const changeSetKinds: Record<ChangeSetKind, KindRules> = {
  edit: {
    editing: true,
    shownAs: "edit",
    publishedNext: true,
    endsOpen: false,
    undoRefused: null,
    resetsMakers: false,
    changesDraft: true,
    undoneBy: "puttingBack",
  },
  approval: {
    editing: false,
    shownAs: "approval",
    publishedNext: false,
    endsOpen: false,
    undoRefused: decision,
    resetsMakers: true,
    changesDraft: false,
    undoneBy: "puttingBack",
  },
  rejection: {
    editing: false,
    shownAs: "rejection",
    publishedNext: false,
    endsOpen: false,
    undoRefused: decision,
    resetsMakers: false,
    changesDraft: false,
    undoneBy: "puttingBack",
  },
  discard: {
    editing: true,
    shownAs: "discard",
    publishedNext: true,
    endsOpen: false,
    undoRefused: null,
    resetsMakers: true,
    changesDraft: true,
    undoneBy: "puttingBack",
  },
  resubmission: {
    editing: false,
    shownAs: "resubmission",
    publishedNext: false,
    endsOpen: false,
    undoRefused: null,
    resetsMakers: false,
    changesDraft: false,
    undoneBy: "rejectingAgain",
  },
  withdrawal: {
    editing: true,
    shownAs: "discard",
    publishedNext: false,
    endsOpen: true,
    undoRefused: null,
    resetsMakers: false,
    changesDraft: true,
    undoneBy: "puttingBack",
  },
  gone: {
    editing: true,
    shownAs: "discard",
    publishedNext: false,
    endsOpen: false,
    undoRefused:
      "Changes withdrawn because their record is gone can't be undone",
    resetsMakers: false,
    changesDraft: true,
    undoneBy: "puttingBack",
  },
  "given-up": {
    editing: true,
    shownAs: "edit",
    publishedNext: false,
    endsOpen: false,
    undoRefused:
      "Keeping another value on publishing can't be undone; change the draft instead",
    resetsMakers: false,
    changesDraft: true,
    undoneBy: "puttingBack",
  },
};

const known = (kind: string): kind is ChangeSetKind =>
  Object.hasOwn(changeSetKinds, kind);

// A kind as the history stores it; one the server no longer knows is saved changes.
export const storedKind = (kind: string): ChangeSetKind =>
  known(kind) ? kind : "edit";

export const rulesOf = (kind: string): KindRules =>
  changeSetKinds[storedKind(kind)];

const kinds = Object.keys(changeSetKinds).filter(known);

export const kindsWhere = (
  rule: (rules: KindRules) => boolean,
): ChangeSetKind[] =>
  // Each kind is one of the table's own keys.
  // eslint-disable-next-line security/detect-object-injection
  kinds.filter((kind) => rule(changeSetKinds[kind]));

// The kinds a rule picks, as a list for SQL's IN.
export const listedKinds = (rule: (rules: KindRules) => boolean): SQL =>
  sql.join(
    kindsWhere(rule).map((kind) => sql`${kind}`),
    sql`, `,
  );

// The kinds that start again who changed a draft, and those that neither change it nor start again,
// for the walk of who changed each draft.
export const makerKinds = {
  resets: new Set<string>(kindsWhere(({ resetsMakers }) => resetsMakers)),
  changesNothing: new Set<string>(
    kindsWhere(
      ({ resetsMakers, changesDraft }) => !resetsMakers && !changesDraft,
    ),
  ),
};
