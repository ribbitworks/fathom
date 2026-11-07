// SPDX-License-Identifier: Apache-2.0

// The two kinds of row of the People table, people and planned hires: what changing or adding one
// holds, and what a row is called in menus, notices, and the drafts it names: by its name, or, for
// a planned hire with none, by its position and ID, such as "Software Engineer, TBD-7", or by its
// ID alone to those who cannot see positions.

import type {
  List,
  Person,
  PersonChange,
  PersonRequest,
  RowKind,
} from "@fathom/shared";

// A change to a row: a person's, or a planned hire's, which may also move it to another state.
export type RowChange = PersonChange & { stateId?: string };

// A request adding a row: a person, or a planned hire, which may be added in a state of its own.
export type RowRequest = PersonRequest & {
  kind?: RowKind;
  stateId?: string;
};

// A person's change or request, without what only a planned hire's holds.
export function personOnly<Row extends RowChange | RowRequest>(
  row: Row,
): Omit<Row, "stateId" | "kind"> {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => key !== "stateId" && key !== "kind"),
  ) as Omit<Row, "stateId" | "kind">;
}

export const isHire = (row: Pick<Person, "kind">) =>
  row.kind === "planned-hire";

export function rowName(row: Person, lists: readonly List[]): string {
  if (!isHire(row) || row.preferredName !== "") return row.preferredName;
  const position = lists
    .find(({ builtIn }) => builtIn === "positions")
    ?.choices.find(({ id }) => id === row.positionId)?.label;
  return position === undefined
    ? row.employeeId
    : `${position}, ${row.employeeId}`;
}

// What a notice calls the rows being added: people, planned hires, or both.
export function addedNames(requests: readonly RowRequest[]): string {
  const hires = requests.filter(isHire).length;
  if (hires === 0) return "the people";
  return hires === requests.length
    ? "the planned hires"
    : "the people and planned hires";
}
