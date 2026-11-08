// SPDX-License-Identifier: Apache-2.0

// The two kinds of row of the People table, people and planned hires: what changing or adding one
// holds, and what a row is called in menus, notices, and the drafts it names: by its name, or, for
// a planned hire with none, by its position and ID, such as "Software Engineer, TBD-7", or by its
// ID alone to those who cannot see positions.

import {
  hireCalled,
  type List,
  type Person,
  type PersonChange,
  type PersonRequest,
  type RowKind,
} from "@fathom/shared";

// A change to a row: a person's, or a planned hire's.
export type RowChange = PersonChange;

// A request adding a row: a person, or a planned hire, either of which may be given a state.
export type RowRequest = PersonRequest & { kind?: RowKind };

// A person's change or request, without the kind of row it was made in.
export function personOnly<Row extends RowChange | RowRequest>(
  row: Row,
): Omit<Row, "kind"> {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => key !== "kind"),
  ) as Omit<Row, "kind">;
}

export const isHire = (row: Pick<Person, "kind">) =>
  row.kind === "planned-hire";

export const positionLabel = (
  lists: readonly List[],
  positionId: string | null | undefined,
): string | undefined =>
  lists
    .find(({ builtIn }) => builtIn === "positions")
    ?.choices.find(({ id }) => id === positionId)?.label;

export function rowName(row: Person, lists: readonly List[]): string {
  if (!isHire(row) || row.preferredName !== "") return row.preferredName;
  return hireCalled(null, row.employeeId, positionLabel(lists, row.positionId));
}

// What a notice calls the rows being added: a person, a planned hire, people, planned hires, or
// both.
export function addedNames(requests: readonly RowRequest[]): string {
  const hires = requests.filter(isHire).length;
  if (requests.length === 1) {
    return hires === 1 ? "the planned hire" : "the person";
  }
  if (hires === 0) return "the people";
  return hires === requests.length
    ? "the planned hires"
    : "the people and planned hires";
}
