// SPDX-License-Identifier: Apache-2.0

// The two kinds of row of the People table, people and planned hires: what changing or adding one
// holds, and what a row and the people on it are called.

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

// Which team someone is on, in words: its name, or whom they report to while it has none. Never
// "their manager's team": under a manager's name, that reads as the team they lead.
export const reportingWords = (
  teamName: string | null,
  managerName: string,
): string => teamName ?? `reports to ${managerName}`;

// What tells someone apart in a list of people to choose from: their position and the team they are
// on, leaving out either one not known.
export const aboutPerson = (
  position: string | null | undefined,
  team: string | undefined,
): string => [position, team].filter(Boolean).join(", ");

// The kinds of row, as a new row's request names them.
export const personKind = "person";
export const hireKind = "planned-hire";

// The keys of a person's built-in details held as text.
export type DetailKey =
  | "preferredName"
  | "employeeId"
  | "positionId"
  | "stateId"
  | "startDate"
  | "endDate"
  | "managerFrom"
  | "teamName"
  | "isManager";

export const detailKeys: readonly DetailKey[] = [
  "preferredName",
  "employeeId",
  "positionId",
  "stateId",
  "startDate",
  "endDate",
  "managerFrom",
  "teamName",
  "isManager",
];

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

export const plannedHireName = (hire: Person, lists: readonly List[]) =>
  `the planned hire ${rowName(hire, lists)}`;

// A row as a notice or menu names it, telling a planned hire from a person.
export const noticeName = (row: Person, lists: readonly List[]) =>
  isHire(row) ? plannedHireName(row, lists) : row.preferredName;

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

// How many people and planned hires some rows are, for Metrics and the count above a table, such as
// "150 people and 6 planned hires".
export function peopleAndHires<Row>(isPlanned: (row: Row) => boolean): {
  counted: (rows: readonly Row[]) => string;
} {
  return {
    counted: (rows) => {
      const counts = kindsOf(rows, isPlanned);
      return named(counts, counts)
        .map(
          (kind) => `${count(kind.of(counts))} ${kind.noun(kind.of(counts))}`,
        )
        .join(" and ");
    },
  };
}

interface Counts {
  people: number;
  hires: number;
}

// A kind of row: how many of it some counts hold, and what so many are called.
interface Kind {
  of: (counts: Counts) => number;
  noun: (total: number) => string;
}
const people: Kind = {
  of: (counts) => counts.people,
  noun: (total) => (total === 1 ? "person" : "people"),
};
const hires: Kind = {
  of: (counts) => counts.hires,
  noun: (total) => (total === 1 ? "planned hire" : "planned hires"),
};

const kindsOf = <Row>(
  rows: readonly Row[],
  isPlanned: (row: Row) => boolean,
): Counts => {
  const hires = rows.filter(isPlanned).length;
  return { people: rows.length - hires, hires };
};

// The kinds to name: those some rows are, and, when none is, the one there is any of in all,
// people when there are either or neither.
const named = (shown: Counts, all: Counts): Kind[] => {
  const kept = [people, hires].filter((kind) => kind.of(shown) > 0);
  if (kept.length > 0) return kept;
  return all.people === 0 && all.hires > 0 ? [hires] : [people];
};

// The month first, then how many of each kind it counts, or, while something narrows the rows, how
// many of each are shown out of all.
export function monthCount<Row>(
  month: string,
  isPlanned: (row: Row) => boolean,
  all: readonly Row[],
  shown?: readonly Row[],
): string {
  const total = kindsOf(all, isPlanned);
  const seen = shown === undefined ? total : kindsOf(shown, isPlanned);
  const parts = named(seen, total).map((kind) => {
    const of = `${count(kind.of(total))} ${kind.noun(kind.of(total))}`;
    return shown === undefined ? of : `${count(kind.of(seen))} of ${of}`;
  });
  return `${month}: ${parts.join(", ")}`;
}
