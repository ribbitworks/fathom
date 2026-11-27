// SPDX-License-Identifier: Apache-2.0

// The Lists page's table of lists, on the shared table.

import {
  type Choice,
  classNames,
  type List,
  listLengths,
  type RecordKeyOf,
  type Show,
  type Tier,
  sameName,
} from "@fathom/shared";
import { Menu } from "@mantine/core";
import type { ReactNode } from "react";
import { type DraftLike } from "./draft-marks.ts";
import {
  latestDraft,
  type DraftSelection,
  draftTotal,
  noDrafts,
} from "./drafts.ts";
import { fieldColumn, withLiveCopies, wordsColumn } from "./grid-columns.tsx";
import { nameTaken } from "./list-dialog.tsx";
import { approvableIn, draftsWaitingIn } from "./list-changes.ts";
import { listMark } from "./list-drafts.tsx";
import {
  builtInFirst,
  draftedLists,
  isKind,
  type ListAction,
  listActions,
  listFacts,
  listKindName,
  liveLists,
  nameProblem,
  withRetiring,
} from "./lists.ts";
import { draftFieldsOf } from "./plan-table.tsx";
import {
  type Column,
  type GridDraft,
  type GridRecord,
  generalExport,
  readOnlyTableParts,
  type RecordTable,
  type RowGrouping,
} from "./record-table.ts";
import type { CellValue } from "./table-view.ts";
import { ClassName, FactBox } from "./status-mark.tsx";
import { LiveParts, Parts } from "./summary-row.tsx";

// What a row shows of its list, by column key, as a draft's live values hold it too.
interface ListValues {
  name: string;
  visibility: Tier;
  description: string;
  // The names of the choices offered, in the list's order.
  choices: string[];
  // Each column that uses the list, as its page and its name.
  usedBy: string[];
}

export interface ListRow extends GridRecord, ListValues {
  draft?: (GridDraft & { live: ListValues }) | undefined;
  // The list as the row shows it, and with every draft, whatever the view, which its marks are
  // worked out from.
  list: List;
  original: List;
  live: boolean;
}

export type ListChange = { name: string };

const textOf = (value: CellValue | undefined) =>
  typeof value === "string" ? value : "";

const offered = (choices: readonly Choice[]) =>
  choices.filter((choice) => !choice.retired);

const useName = ({ page, column }: { page: string; column: string }) =>
  `${page}: ${column}`;

function valuesOf(list: List): ListValues {
  return {
    name: list.name,
    visibility: list.visibility,
    description: list.description,
    choices: offered(list.choices).map(({ label }) => label),
    usedBy: (list.usedBy ?? []).map(useName),
  };
}

const counted =
  (leaveOutRejected: boolean) =>
  <Draft extends DraftLike>(draft: Draft | undefined): draft is Draft =>
    draft !== undefined && !(leaveOutRejected && draft.state === "rejected");

// The mark of a list's choices' drafts and its order's, before its choices.
const choicesMark = (original: List, leaveOutRejected: boolean) =>
  listMark({ ...original, draft: undefined }, leaveOutRejected);

// The row's draft, for its marks: the list's own, with its choices when their drafts change them, or,
// when only its choices or their order have drafts, one standing for those, credited to whoever
// changed them last. Beside the list's own, that one marks the choices, so they show their drafts'
// state, not the list's.
function rowDraft(
  original: List,
  live: ListValues,
  leaveOutRejected: boolean,
): Pick<ListRow, "draft" | "cellDrafts"> {
  const keeps = counted(leaveOutRejected);
  const parts = choicesMark(original, leaveOutRejected);
  if (parts === undefined) {
    return keeps(original.draft)
      ? {
          draft: {
            ...withRetiring({ ...original, draft: original.draft }),
            live,
          },
        }
      : {};
  }
  const drafts = [
    ...original.choices.map(({ draft }) => draft),
    original.orderDraft,
  ].filter(keeps);
  const last = latestDraft(drafts);
  const choices: NonNullable<ListRow["draft"]> = {
    action: "changed",
    state: parts.state,
    changed: ["choices"],
    madeBy: last?.madeBy ?? null,
    madeAs: last?.madeAs,
    unpublished: drafts.every(({ unpublished }) => unpublished === true),
    live,
  };
  if (!keeps(original.draft)) return { draft: choices };
  const own = withRetiring({ ...original, draft: original.draft });
  return {
    draft: { ...own, changed: [...own.changed, "choices"], live },
    cellDrafts: new Map([["choices", choices]]),
  };
}

// Each list's row, from every list with its drafts, as the Draft view shows it: with every draft
// beside live, as they will make it with them applied, leaving out rejected ones, and as it is with
// every draft under Live only, whose rows the table makes live itself. The lists Fathom builds in
// come first, then an organization's own, each in the order given.
export function listRows(lists: readonly List[], show: Show): ListRow[] {
  const leaveOutRejected = show === "drafts";
  return builtInFirst(lists).map((original) => {
    const [list = original] = leaveOutRejected ? draftedLists([original]) : [];
    const [live] = liveLists([original]);
    const values = valuesOf(list);
    return {
      id: original.id,
      ...values,
      heldBy: original.heldBy,
      ...rowDraft(
        original,
        live === undefined ? values : valuesOf(live),
        leaveOutRejected,
      ),
      list,
      original,
      live: false,
    };
  });
}

// Each row as its list is live, without drafts, leaving out one only drafted to be added.
const liveRows = (rows: readonly ListRow[]): ListRow[] =>
  rows.flatMap((row) =>
    liveLists([row.original]).map((list) => ({
      ...row,
      ...valuesOf(list),
      draft: undefined,
      cellDrafts: undefined,
      list,
      live: true,
    })),
  );

// A list's choices: how many, then their names, those a draft removes struck through, after the
// mark of their drafts, or, in its Live row, as they are live.
function ChoicesCell({ row }: { row: ListRow }) {
  const mark = choicesMark(row.original, false);
  if (row.live) {
    return <LiveParts marked={mark !== undefined} names={row.choices} />;
  }
  return (
    <Parts
      mark={mark}
      parts={offered(row.list.choices).map((choice) => ({
        id: choice.id,
        name: choice.label,
        removed: choice.draft?.action === "deleted",
      }))}
    />
  );
}

const kindGroups = {
  builtIn: { key: "built-in", label: listKindName("built-in"), rank: 0 },
  custom: { key: "custom", label: listKindName("custom"), rank: 1 },
};

const groupings: RowGrouping<ListRow>[] = [
  {
    key: "kind",
    label: "Kind",
    holds: "list",
    of: (row) => [
      isKind(row.list, "built-in") ? kindGroups.builtIn : kindGroups.custom,
    ],
  },
];

export const listColumnOrder = [
  "name",
  "visibility",
  "description",
  "choices",
  "usedBy",
];

// The table's columns, in its order, given the rows the table can show, whose classes, choices and
// columns their filters offer.
export function listColumns(
  records: readonly ListRow[],
): Column<ListRow, ListChange>[] {
  return [
    {
      ...fieldColumn<ListRow, ListChange>("name", "text", {
        label: "Name",
        required: true,
        multiple: false,
        choices: [],
        maxLength: listLengths.name,
      }),
      recordClass: (row) => row.visibility,
      facts: (row) =>
        listFacts(row.original).map((fact) => (
          <FactBox key={fact}>{fact}</FactBox>
        )),
      change: (value) => ({ name: textOf(value) }),
      breaksDown: false,
    },
    {
      ...wordsColumn<ListRow, ListChange>("visibility", "Class", records, {
        required: true,
        named: (tier) => classNames[tier as Tier],
      }),
      content: (row) => <ClassName dataClass={row.visibility} />,
    },
    {
      ...fieldColumn<ListRow, ListChange>("description", "text", {
        label: "Description",
        required: false,
        multiple: false,
        choices: [],
        readOnly: true,
        emptyLabel: "No description",
      }),
      breaksDown: false,
    },
    {
      ...wordsColumn<ListRow, ListChange>("choices", "Choices", records, {
        multiple: true,
      }),
      content: (row) => <ChoicesCell row={row} />,
      marksParts: true,
      breaksDown: false,
    },
    {
      ...wordsColumn<ListRow, ListChange>("usedBy", "Used by", records, {
        multiple: true,
      }),
      breaksDown: false,
    },
  ];
}

// Made once, so the table's Key column is made again only when the lists change.
const listKeyOf = (row: ListRow): RecordKeyOf => ({
  kind: "list",
  keyNumber: row.list.keyNumber,
});

// The table of lists, whose names change in their rows; the rest of a list changes in its panel or
// its dialog. A row's menu decides its list's draft with its choices' and its order's.
export function listTable({
  lists,
  shown,
  unchangeable,
  onOpen,
  menuItems,
}: {
  // Every list, with its drafts, whatever the view.
  lists: readonly List[];
  // The lists the table's rows are of, which a list's new name is checked against with every other.
  shown: readonly List[];
  // The lists the role may not change, by identifier.
  unchangeable: ReadonlyMap<string, string>;
  onOpen: (list: List) => void;
  // What else a list's menu offers, such as retiring it.
  menuItems: (row: ListRow) => ReactNode;
}): RecordTable<ListRow, ListChange, undefined> {
  const describedColumns = (row: ListRow) => listColumns(withLiveCopies([row]));
  const chosen = (ids: readonly string[]) =>
    lists.filter(({ id }) => ids.includes(id) && !unchangeable.has(id));
  const drafts = (ids: string[]): DraftSelection =>
    ids.length === 0 ? noDrafts() : draftsWaitingIn(chosen(ids)).selection;
  const hidden = lists.filter(
    (list) => !shown.some(({ id }) => id === list.id),
  );
  return {
    label: "Lists",
    exported: generalExport,
    one: "list",
    noun: "lists",
    groupings,
    ...readOnlyTableParts,
    recordProblem: (values, others) => {
      const name = textOf(values.name);
      const problem = nameProblem(
        name,
        listLengths.name,
        others().some((other) => sameName(textOf(other.name), name)) ||
          hidden.some((other) => sameName(other.name, name)),
        nameTaken("list"),
      );
      return problem === undefined
        ? undefined
        : { message: problem, column: "name" };
    },
    removeLabel: () => actionLabels.remove,
    removable: (row) => listActions(row.list).includes("remove"),
    ownDraft: (row) => (row.list.draft === undefined ? undefined : row.draft),
    menuDecides: (row) => ({ approved: approvableIn(chosen([row.id])) }),
    menuItems,
    nameOf: (row) => row.name,
    nameColumn: "name",
    showDetails: (row) => {
      onOpen(row.list);
    },
    readOnlyRecord: (row) => unchangeable.has(row.id),
    keyOf: listKeyOf,
    columnsFor: (_fields, _lists, _order, records) => listColumns(records),
    liveRecords: liveRows,
    draftFields: (row, draft) =>
      draftFieldsOf(describedColumns(row), row, draft),
    drafts,
    decidable: (row) => draftTotal(drafts([row.id])) > 0,
  };
}

// What retiring or restoring a list from its menu does: each drafts the list's change of state.
const retiringActions: Record<
  Exclude<ListAction, "remove">,
  (list: List, onRetire: (list: List) => void) => void
> = {
  retire: (list, onRetire) => {
    onRetire(list);
  },
  restore: (list, onRetire) => {
    onRetire(list);
  },
};

const actionLabels: Record<ListAction, string> = {
  retire: "Retire",
  restore: "Restore",
  remove: "Remove list",
};

// What a list's menu offers besides its drafts, its link and removing it: retiring or restoring it.
export function ListItems({
  list,
  onRetire,
}: {
  list: List;
  onRetire: (list: List) => void;
}) {
  return listActions(list)
    .filter(
      (action): action is Exclude<ListAction, "remove"> => action !== "remove",
    )
    .map((action) => (
      <Menu.Item
        key={action}
        onClick={() => {
          // The action is always one of those named above.
          // eslint-disable-next-line security/detect-object-injection
          retiringActions[action](list, onRetire);
        }}
      >
        {
          // The action is always one of those named above.
          // eslint-disable-next-line security/detect-object-injection
          actionLabels[action]
        }
      </Menu.Item>
    ));
}
