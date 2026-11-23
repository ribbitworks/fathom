// SPDX-License-Identifier: Apache-2.0

// The Drafts page's table, on the shared table: a row for each draft the reader sees.

import {
  approvedAreaNames,
  eitherOf,
  approvePermissions,
  capitalized,
  type DraftKind,
  type DraftsTab,
  draftsTabSchema,
} from "@fathom/shared";
import { joined, noDrafts } from "./drafts.ts";
import type { Entry } from "./draft-entries.ts";
import { placeKey } from "./draft-places.ts";
import { PhraseList, phraseText } from "./phrase.tsx";
import { fieldColumn } from "./grid-columns.tsx";
import {
  type Column,
  type GridDraft,
  type GridRecord,
  readOnlyTableParts,
  type RecordTable,
} from "./record-table.ts";
import { byChoice } from "./choice-grouping.ts";
import { FactBox } from "./status-mark.tsx";
import type { View } from "./table-view.ts";
import { streamNames } from "./releases.ts";
import { dayOf } from "./today.ts";

export interface DraftRow extends GridRecord {
  draft: GridDraft & { live: object };
  record: string;
  change: string;
  changes: string;
  type: string;
  area: string;
  madeBy: string;
  drafted: string;
  reason: string;
  state: string;
  entry: Entry;
  // Why the draft can't be decided now, beyond whose it is, shown after its record.
  facts: string[];
}

// What each kind of record is called in the Type column.
const typeNames: Record<DraftKind, string> = {
  person: "Person",
  "planned-hire": "Planned hire",
  "feature-team": "Feature team",
  list: "List",
  "list-item": "Choice",
  "choice-order": "Order of choices",
  field: "Column",
  "release-stream": capitalized(streamNames.one),
  "cycle-pattern": "Cycles",
  release: "Release",
  feature: "Feature",
  customer: "Customer",
  proposal: "Proposal",
  project: "Project",
  milestone: "Milestone",
  allocation: "Allocation",
  "planning-settings": "Planning settings",
};

// The areas whose Approvers decide a kind's drafts, either being enough, in a sentence, such as
// "features and releases", or "the plan or configuration", and as the Area column names them.
export const areaWords = (kind: DraftKind): string =>
  eitherOf(
    // The kind, and each Approve permission that decides it, always come from the fixed lists.
    // eslint-disable-next-line security/detect-object-injection
    approvePermissions[kind].map(
      // eslint-disable-next-line security/detect-object-injection
      (permission) => approvedAreaNames[permission],
    ),
  );

export const areaOf = (kind: DraftKind): string => capitalized(areaWords(kind));

const changeNames = {
  created: "Added",
  changed: "Changed",
  deleted: "Removed",
  reordered: "Reordered",
} as const;

const stateNames = {
  waiting: "Waiting",
  rejected: "Rejected",
  unpublished: "Not published",
} as const;

export const waitsOnRejected = "Waits on a rejected draft";
export const needsAnotherApprover = "Needs another approver";

const choicesOf = (labels: readonly string[]) =>
  labels.map((label) => ({
    id: label,
    label,
    description: "",
    retired: false,
  }));

const stateOf = (one: Entry) =>
  one.unpublished ? stateNames.unpublished : stateNames[one.state];

// A row for each draft, the facts that hold it shown only to those who could otherwise decide it.
export function draftRows(
  entries: readonly Entry[],
  {
    waits,
    choosable,
    unseen,
  }: Record<"waits" | "choosable", (one: Entry) => boolean> & {
    unseen: (one: Entry) => string | undefined;
  },
): DraftRow[] {
  return entries.map((one) => ({
    id: one.key,
    draft: {
      // A new order changes the list it orders.
      action: one.action ?? "changed",
      changed: [],
      state: one.state,
      reason: one.reason,
      unpublished: one.unpublished,
      madeBy: one.who,
      needsOtherApprover: one.needsOtherApprover,
      live: {},
    },
    heldBy: one.heldBy,
    record: one.name,
    change:
      one.action === undefined
        ? changeNames.reordered
        : changeNames[one.action],
    changes: one.details.map(phraseText).join("; "),
    type: typeNames[one.kind],
    area: areaOf(one.kind),
    madeBy: one.who,
    drafted: one.madeAt === null ? "" : dayOf(one.madeAt),
    reason: one.reason ?? "",
    state: stateOf(one),
    entry: one,
    facts:
      one.state === "waiting" && !one.unpublished && choosable(one)
        ? [
            ...(waits(one) ? [waitsOnRejected] : []),
            ...(one.needsOtherApprover || unseen(one) !== undefined
              ? [needsAnotherApprover]
              : []),
          ]
        : [],
  }));
}

const inOrderSeen = (values: readonly string[]) => [...new Set(values)];

// The table's columns, its choices those the rows hold, in a steady order.
export function draftColumns(
  rows: readonly DraftRow[],
  tab: DraftsTab = "all",
): Column<DraftRow, never>[] {
  const column = (
    key: Exclude<keyof DraftRow, "entry" | "facts" | "draft" | "heldBy">,
    label: string,
    kind: "text" | "date" | "choice",
    choices: readonly string[] = [],
  ) =>
    fieldColumn<DraftRow, never>(key, kind, {
      label,
      required: kind !== "text",
      multiple: false,
      choices: choicesOf(choices),
    });
  const kindsShown = (pick: (kind: DraftKind) => string) =>
    inOrderSeen(
      (Object.keys(typeNames) as DraftKind[])
        .filter((kind) => rows.some(({ entry }) => entry.kind === kind))
        .map(pick),
    );
  return [
    {
      ...column("record", "Record", "text"),
      required: true,
      mark: ({ facts }) =>
        facts.length > 0 &&
        facts.map((fact) => <FactBox key={fact}>{fact}</FactBox>),
    },
    column("change", "Change", "choice", Object.values(changeNames)),
    column("state", "State", "choice", Object.values(stateNames)),
    {
      ...column("changes", "What changes", "text"),
      content: ({ entry }) => <PhraseList phrases={entry.details} light />,
      breaksDown: false,
    },
    column(
      "type",
      "Type",
      "choice",
      // The kind is always one of the fixed kinds.
      // eslint-disable-next-line security/detect-object-injection
      kindsShown((kind) => typeNames[kind]),
    ),
    column("area", "Area", "choice", kindsShown(areaOf)),
    // One's own changes are always one's own.
    ...(tab === "unpublished"
      ? []
      : [
          column(
            "madeBy",
            "Made by",
            "choice",
            inOrderSeen(rows.map(({ madeBy }) => madeBy)).sort((one, other) =>
              one.localeCompare(other),
            ),
          ),
        ]),
    // A draft with no time recorded has no day.
    {
      ...column("drafted", "Drafted", "date"),
      required: false,
      breaksDown: false,
    },
    { ...column("reason", "Reason", "text"), breaksDown: false },
  ];
}

export const draftColumnOrder = draftColumns([]).map(({ key }) => key);

const groupedBy = ["change", "type", "area", "madeBy", "state"];

export const draftsTabNames: Record<DraftsTab, string> = {
  decide: "To decide",
  unpublished: "Not published",
  all: "All drafts",
};

// The tabs a role sees, in order: To decide for a role that approves drafts, Not published for one
// that makes them, and All drafts for all; the first opens when the view names none.
export const tabsFor = (
  approves: readonly DraftKind[],
  makesDrafts: boolean,
): DraftsTab[] =>
  draftsTabSchema.options.filter(
    (tab) =>
      (tab !== "decide" || approves.length > 0) &&
      (tab !== "unpublished" || makesDrafts),
  );

// The tab a view shows, of those the role sees.
export function draftsTabOf(
  view: View,
  shown: readonly DraftsTab[],
): DraftsTab {
  const named = draftsTabSchema.safeParse(view.choices?.tab);
  return named.success && shown.includes(named.data)
    ? named.data
    : (shown[0] ?? "all");
}

// The view on a tab, keeping the rest of the view; the first tab is named by none.
export function viewOnTab(
  view: View,
  tab: DraftsTab,
  shown: readonly DraftsTab[],
): View {
  const others = Object.entries(view.choices ?? {}).filter(
    ([key]) => key !== "tab",
  );
  const kept = Object.fromEntries(
    tab === shown[0] ? others : [...others, ["tab", tab]],
  );
  return {
    ...view,
    choices: Object.keys(kept).length === 0 ? undefined : kept,
  };
}

// Whether a draft is on a tab: one the reader may decide now on To decide, one's own unpublished
// changes on Not published, and every published draft on All drafts.
export function isOnTab(
  tab: DraftsTab,
  row: DraftRow,
  decidesNow: (row: DraftRow) => boolean,
): boolean {
  if (tab === "unpublished") return row.entry.unpublished;
  if (row.entry.unpublished) return false;
  return tab === "all" || decidesNow(row);
}

// The drafts a set of rows names, all together.
export const selectionOf = (rows: readonly DraftRow[]) =>
  rows.reduce((all, { entry }) => joined(all, entry.selects), noDrafts());

// The table of drafts, read only, the rows' own drafts decided from their menus.
export function draftsTable({
  rows,
  decidable,
  tab = "all",
  onOpen,
}: {
  rows: readonly DraftRow[];
  // Whether a row's draft can be decided now: waiting, published, not held, and not waiting on a
  // rejected draft.
  decidable: (row: DraftRow) => boolean;
  tab?: DraftsTab;
  // Shows a draft's details beside the table.
  onOpen?: (row: DraftRow) => void;
}): RecordTable<DraftRow, never, undefined> {
  const columns = draftColumns(rows, tab);
  const byId = new Map(rows.map((row) => [row.id, row]));
  return {
    ...readOnlyTableParts,
    label: "Drafts",
    one: "draft",
    noun: "drafts",
    nameOf: (row) => row.record,
    nameColumn: "record",
    keyOf: ({ entry }) => placeKey(entry.place),
    columnsFor: () => columns,
    liveRecords: () => [],
    drafts: (ids) => selectionOf(ids.flatMap((id) => byId.get(id) ?? [])),
    decidable,
    ...(onOpen === undefined ? {} : { showDetails: onOpen }),
    slotMarksOnly: true,
    groupings: columns
      .filter(({ key }) => groupedBy.includes(key))
      .map((column) =>
        byChoice(column, column.key === "madeBy" ? { holds: "names" } : {}),
      ),
  };
}
