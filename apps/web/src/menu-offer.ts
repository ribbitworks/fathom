// SPDX-License-Identifier: Apache-2.0

// Which of a record's draft items its menu offers, the same in its row on a table and in its
// details panel.

import type { GridDraft } from "./record-table.ts";

// Where a record's menu opens: its row on a table, or its details panel.
export type MenuPlace = "row" | "panel";

interface PlaceRules {
  showsDetails: boolean;
  backToTable: boolean;
}

// What a record's menu does where it opens: whether it offers the record's details, and whether
// focus goes back to the table once an item changes the record, rather than staying where it was.
const placeRules: Record<MenuPlace, PlaceRules> = {
  row: { showsDetails: true, backToTable: true },
  panel: { showsDetails: false, backToTable: false },
};

export const menuPlace = (place: MenuPlace): PlaceRules =>
  // The key is one of MenuPlace's, never input.
  // eslint-disable-next-line security/detect-object-injection
  placeRules[place];

export interface RecordMenuFacts {
  // The draft the menu discards, resubmits or publishes: the record's own, if it has one.
  ownDraft: Pick<GridDraft, "state" | "unpublished"> | undefined;
  // Whether the user's own unpublished change takes back the record's published draft, so the
  // record shows them none.
  takenBack: boolean;
  // What the record's draft as shown does, if it has one, which decides whether it can be removed.
  shownAction: GridDraft["action"] | undefined;
  // Whether the user may change the record from its table now, with nobody else holding it.
  changes: boolean;
  // Whether the user may discard or resubmit its own draft, on a table whose records are changed
  // elsewhere.
  editsOwnDraft: boolean;
  // Whether the user's role approves or rejects its draft now.
  decides: boolean;
  // Whether the user's changes can be published from here.
  publishes: boolean;
}

export interface RecordMenuOffer {
  decide: boolean;
  publish: boolean;
  resubmit: boolean;
  discard: boolean;
  remove: boolean;
}

// A rejected draft is back with its makers, who resubmit or discard it; their own unpublished one
// is theirs to publish or discard, and their taking back of a published one theirs to publish; and
// a record neither added nor removed by its draft may be removed by those who change it.
export function recordMenuOffer({
  ownDraft,
  takenBack,
  shownAction,
  changes,
  editsOwnDraft,
  decides,
  publishes,
}: RecordMenuFacts): RecordMenuOffer {
  const ownDrafts = changes || editsOwnDraft;
  return {
    decide: decides,
    publish:
      ownDrafts &&
      publishes &&
      (ownDraft === undefined ? takenBack : ownDraft.unpublished === true),
    resubmit: ownDrafts && ownDraft?.state === "rejected",
    discard: ownDrafts && ownDraft !== undefined,
    remove: changes && shownAction !== "created" && shownAction !== "deleted",
  };
}

// Whether the menu offers anything to do with the record's own draft, or removing the record.
export const offersOwn = ({
  publish,
  resubmit,
  discard,
  remove,
}: RecordMenuOffer): boolean => publish || resubmit || discard || remove;

// Whether the menu offers anything to do with the record's draft, or removing the record.
export const offersAny = (offer: RecordMenuOffer): boolean =>
  offer.decide || offersOwn(offer);
