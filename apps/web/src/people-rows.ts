// SPDX-License-Identifier: Apache-2.0

// The two kinds of row of the People table, people and planned hires: what changing or adding one
// holds, and what a row is called in menus, notices, and the drafts it names: by its name, or, for
// a planned hire with none, by its position and ID, such as "Software Engineer, TBD-7", or by its
// ID alone to those who cannot see positions; and how someone is told apart from others with the
// same name, by their position and the team they are on or whom they report to.

import { count } from "./numbers.ts";
import {
  hireCalled,
  type List,
  type Person,
  type PersonChange,
  type PersonRequest,
  type RecordKeyOf,
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

// The key of someone's row in People or card on the Org chart: a planned hire's, a feature team's
// own card's, which stands for the team while it has no lead, or a person's.
export const personKeyOf = ({
  keyNumber,
  hire,
  team = false,
}: {
  keyNumber: number;
  hire: boolean;
  team?: boolean;
}): RecordKeyOf => ({
  kind: team ? "team" : hire ? "hire" : "person",
  keyNumber,
});

export const positionLabel = (
  lists: readonly List[],
  positionId: string | null | undefined,
): string | undefined =>
  lists
    .find(({ builtIn }) => builtIn === "positions")
    ?.choices.find(({ id }) => id === positionId)?.label;

// Which team someone is on, in words: its name, or whom they report to while it has none, never
// "their manager's team", which reads as if that manager leads it.
export const reportingWords = (
  teamName: string | null | undefined,
  managerName: string,
): string => teamName ?? `reports to ${managerName}`;

// What tells someone apart in a list of people to choose from: their position and the team they are
// on, leaving out either one not known.
export const aboutPerson = (
  position: string | null | undefined,
  team: string | undefined,
): string => [position, team].filter(Boolean).join(", ");

export const stateMeaning = (
  lists: readonly List[],
  stateId: string | null | undefined,
): string | null | undefined =>
  lists
    .find(({ builtIn }) => builtIn === "hiring-states")
    ?.choices.find(({ id }) => id === stateId)?.meaning;

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

// How Metrics and the count above a table call rows of people and planned hires together, and how
// many of each some rows are, such as "150 people and 6 planned hires".
export function peopleAndHires<Row>(isPlanned: (row: Row) => boolean): {
  noun: string;
  counted: (rows: readonly Row[]) => string;
} {
  return {
    noun: "people and planned hires",
    counted: (rows) => {
      const hires = rows.filter(isPlanned).length;
      const people = rows.length - hires;
      return [
        ...(people > 0 || hires === 0
          ? [`${count(people)} ${people === 1 ? "person" : "people"}`]
          : []),
        ...(hires > 0
          ? [
              `${count(hires)} ${hires === 1 ? "planned hire" : "planned hires"}`,
            ]
          : []),
      ].join(" and ");
    },
  };
}
