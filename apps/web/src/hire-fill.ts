// SPDX-License-Identifier: Apache-2.0

// The rules for filling a planned hire as People can tell them: which hires can be filled, who can
// fill one, and what the form holds. The server checks each again, along with those People cannot
// tell, such as a person who has not started the hire they filled before.

import { type HireFill, type List, type Person } from "@fathom/shared";
import { isHire, stateMeaning } from "./people-rows.ts";
import { heldBack } from "./grid-drafts.ts";
import type { CellValue } from "./table-view.ts";

// A fill being entered in a planned hire's details panel: the hire, whether a new or an existing
// person fills it, the values entered by column, and whether it is being saved.
export interface HireFilling {
  hireId: string;
  by: HireFill["by"];
  values: Record<string, CellValue>;
  saving?: boolean;
}

export const newFilling = (hire: Pick<Person, "id">): HireFilling => ({
  hireId: hire.id,
  by: "new person",
  values: {},
});

export const fillQuestion = {
  title: "Stop filling this planned hire?",
  keep: "Keep filling",
};

// Whether a planned hire can be filled as its row stands: approved, not already being filled,
// and no draft adding it, removing it, changing its manager, or rejected.
export function canFill(hire: Person, lists: readonly List[]): boolean {
  if (
    !isHire(hire) ||
    hire.filler !== undefined ||
    heldBack(hire) ||
    hire.draft?.action === "created" ||
    hire.draft?.state === "rejected" ||
    hire.draft?.changed.includes("managerId") === true
  ) {
    return false;
  }
  return stateMeaning(lists, hire.stateId) === "open";
}

// Who may be chosen to fill a hire: people with no draft of their own, who have not left, are not
// filling another hire in a draft, and are not the manager chosen, who cannot report to themself.
export function fillCandidates(
  people: readonly Person[],
  managerId: string | undefined,
  day: string,
): Person[] {
  const filling = new Set(people.map(({ filler }) => filler));
  return people.filter(
    (one) =>
      !isHire(one) &&
      one.draft === undefined &&
      !heldBack(one) &&
      !filling.has(one.id) &&
      one.id !== managerId &&
      !(typeof one.endDate === "string" && one.endDate < day),
  );
}

// Whether a hire reports to a planned manager, whom a person cannot report to.
export const underPlannedManager = (
  hire: Person,
  people: readonly Person[],
): boolean => people.some((one) => one.id === hire.manager?.id && isHire(one));

// Whether someone chosen to fill a hire would change manager.
export const wouldMove = (
  person: Person | undefined,
  managerId: string | undefined,
): boolean =>
  person !== undefined &&
  managerId !== undefined &&
  person.manager?.id !== managerId;

// What a fill says about the manager, when it is not the hire's own.
export const managerChange = (
  hire: Person,
  managerId: string | undefined,
): { managerId?: string | null } =>
  managerId === hire.manager?.id ? {} : { managerId: managerId ?? null };
