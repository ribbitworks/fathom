// SPDX-License-Identifier: Apache-2.0

// The groups a table's rows are shown under, and each row's place among them.

// The group a row is in: the groups follow in order of rank, and each is headed with its label.
export interface RowGroup {
  key: string;
  label: string;
  rank: number;
  // The colour of what the group is for, such as a team, drawn as its square before the label.
  colour?: string | null | undefined;
}

// What a grouping's groups are, which names the two orders they can run in.
export type GroupsHold = "time" | "names" | "list";

// A way the rows can be grouped, as the Group by menu offers it.
export interface GroupingChoice {
  key: string;
  label: string;
  holds: GroupsHold;
}

// The rank of the group for none, after every other group.
export const rankOfNone = Number.MAX_SAFE_INTEGER;

// Groups in order of rank, the group for none last, or reversed, the group for none first, since
// it ranks last.
export const byGroupRank =
  (reversed: boolean) =>
  (first: Pick<RowGroup, "rank">, second: Pick<RowGroup, "rank">): number =>
    reversed ? second.rank - first.rank : first.rank - second.rank;

// Where a row stands among the groups while its rows aren't grouped.
const inOneList: Pick<RowGroup, "rank"> = { rank: 0 };

export type RowGroups = readonly [RowGroup, ...RowGroup[]];

// A row's key under a group, since a record has a row under each group it's in.
export const groupedRowId = (groupKey: string, id: string) =>
  `${groupKey} ${id}`;

// A record's row under each group it's in, and under each of the groups of the second grouping it's
// in within it, with the other places it's in, each as the groups it differs in, or its one row
// while the rows aren't grouped.
export interface PlacedRow<Rec> {
  record: Rec;
  key: string;
  group?: RowGroup;
  subgroup?: RowGroup;
  others?: readonly OtherPlace[];
}

// Another place a row's record is in: the groups it differs in from the row's, one or both.
export interface OtherPlace {
  group?: RowGroup;
  subgroup?: RowGroup;
}

export function placedRows<Rec>(
  records: readonly Rec[],
  groupsOf: ((record: Rec) => RowGroups) | undefined,
  idOf: (record: Rec) => string,
  subgroupsOf?: (record: Rec) => RowGroups,
): PlacedRow<Rec>[] {
  return records.flatMap((record) => {
    const id = idOf(record);
    if (groupsOf === undefined) return [{ record, key: id }];
    const places = groupsOf(record).flatMap((group) =>
      subgroupsOf === undefined
        ? [{ group, key: group.key }]
        : subgroupsOf(record).map((subgroup) => ({
            group,
            subgroup,
            key: groupedRowId(group.key, subgroup.key),
          })),
    );
    return places.map((place) => ({
      record,
      ...place,
      key: groupedRowId(place.key, id),
      others: places
        .filter((other) => other !== place)
        .map((other) => apart(place, other)),
    }));
  });
}

interface RowPlace {
  group: RowGroup;
  subgroup?: RowGroup;
}

const apart = (place: RowPlace, { group, subgroup }: RowPlace): OtherPlace => ({
  ...(group.key === place.group.key ? {} : { group }),
  ...(subgroup === undefined || subgroup.key === place.subgroup?.key
    ? {}
    : { subgroup }),
});

// Each record the rows are of, once, in the rows' order.
export const recordsOf = <Rec>(rows: readonly PlacedRow<Rec>[]): Rec[] => [
  ...new Set(rows.map(({ record }) => record)),
];

// The rows of the records shown, by their groups' rank, reversed if asked, then their second
// groups', and within a group in the order the records are shown.
export function rowsInOrder<Rec>(
  rows: readonly PlacedRow<Rec>[],
  shown: readonly Rec[],
  groupsReversed = false,
): PlacedRow<Rec>[] {
  const place = new Map(shown.map((record, index) => [record, index]));
  const placeOf = (row: PlacedRow<Rec>) => Number(place.get(row.record));
  const groupOrder = byGroupRank(groupsReversed);
  const subgroupOrder = byGroupRank(false);
  return rows
    .filter(({ record }) => place.has(record))
    .sort(
      (a, b) =>
        groupOrder(a.group ?? inOneList, b.group ?? inOneList) ||
        subgroupOrder(a.subgroup ?? inOneList, b.subgroup ?? inOneList) ||
        placeOf(a) - placeOf(b),
    );
}
