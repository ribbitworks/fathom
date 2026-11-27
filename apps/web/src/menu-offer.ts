// SPDX-License-Identifier: Apache-2.0

// Which draft items a menu offers: a record's, the same in its row on a table and in its details
// panel, and a list's.

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
  ownDraft:
    Pick<GridDraft, "state" | "unpublished" | "changedByUser"> | undefined;
  // What the record's draft as shown does, if it has one, which decides whether it can be removed.
  shownAction: GridDraft["action"] | undefined;
  // Whether the user may change the record from its table now, with nobody else holding it.
  changes: boolean;
  // Whether the record can ever be removed, unlike, say, a list built into Fathom.
  removable: boolean;
  // Whether the user may discard or resubmit its own draft, on a table whose records are changed
  // elsewhere.
  editsOwnDraft: boolean;
  // Whether the user may discard its draft without having changed it, as any role that changes
  // cycles may a draft of a schedule's cycles.
  discardsUnchanged: boolean;
  // Whether the user's role approves or rejects its draft now.
  decides: boolean;
  // Whether the user's changes can be published from here.
  publishes: boolean;
}

// What a menu offers to do with one draft: deciding it, and publishing, resubmitting or discarding
// it. A record's menu on a table and a list's menu both offer it by this rule.
export interface DraftOffer {
  decide: boolean;
  publish: boolean;
  resubmit: boolean;
  discard: boolean;
}

export interface DraftOfferFacts {
  hasDraft: boolean;
  rejected: boolean;
  // Whether the draft is the user's own, not yet published.
  unpublished: boolean;
  // Whether the user may publish, resubmit or discard it.
  editsDraft: boolean;
  // Whether the user changed it since it was last approved or discarded, so may discard it.
  changedByUser: boolean;
  // Whether the user's role approves or rejects it now.
  decides: boolean;
  // Whether the user's changes can be published from here.
  publishes: boolean;
}

// A rejected draft is back with its makers to resubmit, and their own unpublished one is theirs to
// publish. Only those who changed a draft discard it, since others who disagree reject it.
export const draftOffer = ({
  hasDraft,
  rejected,
  unpublished,
  editsDraft,
  changedByUser,
  decides,
  publishes,
}: DraftOfferFacts): DraftOffer => {
  const ownDraft = editsDraft && hasDraft;
  return {
    decide: decides,
    publish: ownDraft && publishes && unpublished,
    resubmit: ownDraft && rejected,
    discard: ownDraft && changedByUser,
  };
};

export interface RecordMenuOffer extends DraftOffer {
  remove: boolean;
}

// A record's own draft is offered as any draft is, and a record neither added nor removed by its
// draft may be removed by those who change it, where it can ever be removed.
export function recordMenuOffer({
  ownDraft,
  shownAction,
  changes,
  removable,
  editsOwnDraft,
  discardsUnchanged,
  decides,
  publishes,
}: RecordMenuFacts): RecordMenuOffer {
  return {
    ...draftOffer({
      hasDraft: ownDraft !== undefined,
      rejected: ownDraft?.state === "rejected",
      unpublished: ownDraft?.unpublished === true,
      editsDraft: changes || editsOwnDraft,
      changedByUser: ownDraft?.changedByUser === true || discardsUnchanged,
      decides,
      publishes,
    }),
    remove:
      changes &&
      removable &&
      shownAction !== "created" &&
      shownAction !== "deleted",
  };
}

// Whether the menu offers anything to do with the record's own draft, or removing the record.
export const offersOwn = ({
  publish,
  resubmit,
  discard,
  remove,
}: RecordMenuOffer): boolean => publish || resubmit || discard || remove;

// Whether a menu offers anything to do with a draft.
export const offersDraft = ({
  decide,
  publish,
  resubmit,
  discard,
}: DraftOffer): boolean => decide || publish || resubmit || discard;

// Whether the menu offers anything to do with the record's draft, or removing the record.
export const offersAny = (offer: RecordMenuOffer): boolean =>
  offersDraft(offer) || offer.remove;
