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

// How Metrics and the count above a table call rows of people and planned hires together, and how
// many of each some rows are, such as "150 people and 6 planned hires".
export function peopleAndHires<Row>(isPlanned: (row: Row) => boolean): {
  noun: string;
  counted: (rows: readonly Row[]) => string;
} {
  return {
    noun: "people and planned hires",
    counted: (rows) => {
      const { people, hires } = kindsOf(rows, isPlanned);
      return [
        ...(people > 0 || hires === 0
          ? [`${count(people)} ${peopleNoun(people)}`]
          : []),
        ...(hires > 0 ? [`${count(hires)} ${hiresNoun(hires)}`] : []),
      ].join(" and ");
    },
  };
}

const peopleNoun = (total: number) => (total === 1 ? "person" : "people");
const hiresNoun = (total: number) =>
  total === 1 ? "planned hire" : "planned hires";

const kindsOf = <Row>(
  rows: readonly Row[],
  isPlanned: (row: Row) => boolean,
) => {
  const hires = rows.filter(isPlanned).length;
  return { people: rows.length - hires, hires };
};

// How many people and planned hires a month counts, month first: "Nov 2026: 14 people, 1 planned
// hire", or, while something narrows the rows, how many of each are shown, "Nov 2026: 6 of 14
// people". A kind none of is counted, or none shown, is left out, but people are named when
// nothing else is.
export function monthCount<Row>(
  month: string,
  isPlanned: (row: Row) => boolean,
  all: readonly Row[],
  shown?: readonly Row[],
): string {
  const total = kindsOf(all, isPlanned);
  const seen = kindsOf(shown ?? all, isPlanned);
  const part = (kept: number, of: number, noun: string) =>
    shown === undefined
      ? `${count(of)} ${noun}`
      : `${count(kept)} of ${count(of)} ${noun}`;
  const parts = [
    ...(seen.people > 0 || seen.hires === 0
      ? [part(seen.people, total.people, peopleNoun(total.people))]
      : []),
    ...(seen.hires > 0
      ? [part(seen.hires, total.hires, hiresNoun(total.hires))]
      : []),
  ];
  return `${month}: ${parts.join(", ")}`;
}
