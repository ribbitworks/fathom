// SPDX-License-Identifier: Apache-2.0

// Deciding drafts: which a decision approves or rejects, those it takes along, and those it leaves
// for another approver.

import {
  type Asking,
  type DraftKind,
  type List,
  type Person,
  draftsWhere,
} from "@fathom/shared";
import {
  type Columns,
  type DraftSelection,
  choicesOf,
  draftNames,
  draftTotal,
  heldBack,
  joined,
  noDrafts,
  usedDrafts,
  usingDrafts,
  without,
} from "./drafts.ts";

// The drafts to approve or reject once asked: those chosen, with any others the decision includes.
export interface Decision {
  asking: Asking;
  selection: DraftSelection;
  // The drafts chosen that the decision approves or rejects, named; none when it decides none.
  named: string[];
  // The other drafts included, named: those the chosen ones use, when approving, or those that use
  // the ones rejected.
  included?: string[];
  // How many drafts chosen are skipped, since they depend on a rejected draft.
  leftOut?: number;
  // The drafts chosen that are skipped, named, when approving all those waiting, since another
  // approver must approve them or a draft they use.
  othersLeft?: string[];
  // When every draft chosen depends on a rejected draft, so none can be approved yet.
  waiting?: true;
  // The drafts the approval would apply that this user changed, named, when their role does not let
  // them approve their own: another approver must approve them, so nothing is approved.
  othersApprove?: string[];
  // The drafts the decision covers whose areas this user's role does not approve, named: another
  // approver must decide them, so nothing is decided.
  beyondRole?: string[];
}

// The drafts in a selection that this user changed and may not approve themselves.
function needingOthers(
  selection: DraftSelection,
  lists: readonly List[],
  columns?: Columns,
): DraftSelection {
  const flagged = (draft?: { needsOtherApprover?: boolean | undefined }) =>
    draft?.needsOtherApprover === true;
  const people = columns?.people ?? [];
  return {
    ...noDrafts(),
    people: people
      .filter(
        ({ id, draft }) => selection.people.includes(id) && flagged(draft),
      )
      .map(({ id }) => id),
    plannedHires: people
      .filter(
        ({ id, draft }) =>
          selection.plannedHires.includes(id) && flagged(draft),
      )
      .map(({ id }) => id),
    featureTeams: (columns?.featureTeams ?? [])
      .filter(
        ({ id, draft }) =>
          selection.featureTeams.includes(id) && flagged(draft),
      )
      .map(({ id }) => id),
    lists: lists
      .filter(({ id, draft }) => selection.lists.includes(id) && flagged(draft))
      .map(({ id }) => id),
    choices: choicesOf(lists)
      .filter(
        ({ choice }) =>
          selection.choices.includes(choice.id) && flagged(choice.draft),
      )
      .map(({ choice }) => choice.id),
    orders: lists
      .filter(
        ({ id, orderDraft }) =>
          selection.orders.includes(id) && flagged(orderDraft),
      )
      .map(({ id }) => id),
    columns: (columns?.fields ?? [])
      .filter(
        ({ id, draft }) => selection.columns.includes(id) && flagged(draft),
      )
      .map(({ id }) => id),
    records: (columns?.records ?? [])
      .filter(
        ({ ref, draft }) =>
          selection.records.some(
            (one) => one.type === ref.type && one.id === ref.id,
          ) && flagged(draft),
      )
      .map(({ ref }) => ref),
  };
}

// Whether a person's draft holds what a fill drafts on them, rather than only changes of their own.
const partOfFill = (draft: Person["draft"]) =>
  draft?.action === "created" ||
  ["positionId", "managerId", "managerFrom", "isManager"].some(
    (field) => draft?.changed.includes(field) === true,
  );

// The other drafts of any fill those chosen are part of, which are decided with them: the hire, the
// person who fills it, and the planned hires it moves to them. The server decides them together.
function fillDrafts(
  selection: DraftSelection,
  columns?: Columns,
): DraftSelection {
  const people = columns?.people ?? [];
  const found = noDrafts();
  for (const hire of people) {
    if (typeof hire.filler !== "string") continue;
    const moved = people.filter(
      (one) =>
        one.kind === "planned-hire" &&
        one.manager?.id === hire.filler &&
        one.draft?.live.managerId === hire.id,
    );
    const hires = [hire.id, ...moved.map(({ id }) => id)];
    const filler = people.filter(
      ({ id, draft }) => id === hire.filler && partOfFill(draft),
    );
    if (
      !hires.some((id) => selection.plannedHires.includes(id)) &&
      !filler.some(({ id }) => selection.people.includes(id))
    ) {
      continue;
    }
    found.plannedHires.push(
      ...hires.filter((id) => !selection.plannedHires.includes(id)),
    );
    found.people.push(
      ...filler
        .map(({ id }) => id)
        .filter((id) => !selection.people.includes(id)),
    );
  }
  return found;
}

// Each draft in the selection on its own.
const eachDraft = (selection: DraftSelection): DraftSelection[] =>
  (Object.keys(selection) as (keyof DraftSelection)[]).flatMap((kind) =>
    // The kind is one of the selection's own keys.
    // eslint-disable-next-line security/detect-object-injection
    selection[kind].map((one): DraftSelection => ({
      ...noDrafts(),
      [kind]: [one],
    })),
  );

// The drafts approving the selection takes along, however far: those it uses, the rest of any fill,
// and in turn those they use, as the server gathers them.
function takenAlong(
  selection: DraftSelection,
  lists: readonly List[],
  columns?: Columns,
): DraftSelection {
  const more = joined(
    selection,
    joined(
      usedDrafts(selection, lists, columns),
      fillDrafts(selection, columns),
    ),
  );
  return draftTotal(more) === draftTotal(selection)
    ? selection
    : takenAlong(more, lists, columns);
}

// The drafts in the selection another approver must approve: those whose kind the user's role does
// not approve, those the user changed and may not approve themselves, and those taking either along,
// which can't be approved without them.
function othersToApprove(
  selection: DraftSelection,
  approves: readonly DraftKind[],
  lists: readonly List[],
  columns?: Columns,
): DraftSelection {
  return eachDraft(selection)
    .filter((one) => {
      const whole = takenAlong(one, lists, columns);
      return (
        draftTotal(draftsWhere(whole, (kind) => !approves.includes(kind))) +
          draftTotal(needingOthers(whole, lists, columns)) >
        0
      );
    })
    .reduce(joined, noDrafts());
}

// A decision on the drafts chosen, by a user who approves drafts of the kinds given: approving
// includes the drafts they depend on, and skips any that depend on a rejected draft; rejecting
// includes the drafts that depend on them. Approving all those waiting also skips those another
// approver must approve, unless every one is, when it names them as approving them one by one does.
export function decisionFor(
  asking: Asking,
  chosen: DraftSelection,
  approves: readonly DraftKind[],
  lists: readonly List[],
  columns?: Columns,
  all = false,
): Decision {
  const fields = columns?.fields ?? [];
  const names = (decided: DraftSelection) =>
    draftNames(
      decided,
      lists,
      fields,
      columns?.people,
      columns?.records,
      columns?.featureTeams,
    );
  const beyond = (selection: DraftSelection) =>
    draftsWhere(selection, (kind) => !approves.includes(kind));
  if (asking === "reject") {
    const dependents = joined(
      usingDrafts(chosen, lists, columns),
      fillDrafts(chosen, columns),
    );
    const selection = joined(chosen, dependents);
    const outside = beyond(selection);
    if (draftTotal(outside) > 0) {
      return { asking, selection, named: [], beyondRole: names(outside) };
    }
    return {
      asking,
      selection,
      named: names(chosen),
      ...(draftTotal(dependents) > 0 ? { included: names(dependents) } : {}),
    };
  }
  const held = heldBack(chosen, lists, columns);
  const ready = without(chosen, held);
  if (draftTotal(ready) === 0)
    return { asking, selection: chosen, named: [], waiting: true };
  const left = all
    ? othersToApprove(ready, approves, lists, columns)
    : noDrafts();
  const kept = without(ready, left);
  const skips = draftTotal(left) > 0 && draftTotal(kept) > 0;
  const approved = skips ? kept : ready;
  const used = joined(
    usedDrafts(approved, lists, columns),
    fillDrafts(approved, columns),
  );
  const selection = joined(approved, used);
  const outside = beyond(selection);
  if (draftTotal(outside) > 0) {
    return { asking, selection, named: [], beyondRole: names(outside) };
  }
  const mine = needingOthers(selection, lists, columns);
  if (draftTotal(mine) > 0) {
    return { asking, selection, named: [], othersApprove: names(mine) };
  }
  return {
    asking,
    selection,
    named: names(approved),
    ...(draftTotal(used) > 0 ? { included: names(used) } : {}),
    ...(draftTotal(held) > 0 ? { leftOut: draftTotal(held) } : {}),
    ...(skips ? { othersLeft: names(left) } : {}),
  };
}

// Whether approving drafts takes along any another approver must approve, as the drafts they use
// of a kind the role doesn't approve, such as the new column a feature fills.
export function needsOtherApproval(
  selection: DraftSelection,
  approves: readonly DraftKind[],
  lists: readonly List[],
  columns?: Columns,
): boolean {
  const decision = decisionFor("approve", selection, approves, lists, columns);
  return (
    decision.beyondRole !== undefined || decision.othersApprove !== undefined
  );
}
