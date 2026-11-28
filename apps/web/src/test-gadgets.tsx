// SPDX-License-Identifier: Apache-2.0

// A made-up kind of record, gadgets, for the shared table's own tests: their columns, records,
// table, actions, and the shared table drawn with them.

import type { DecidedKind, Field, List } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { type RenderResult, render } from "@testing-library/react";
import { drawnFields } from "./added-columns.ts";
import { noDrafts } from "./drafts.ts";
import { cellColumn, fieldColumn, inOrder } from "./grid-columns.tsx";
import { liveRecordsOf } from "./live-records.ts";
import { RecordGrid } from "./record-grid.tsx";
import type {
  CellRecord,
  Column,
  RecordActions,
  RecordTable,
} from "./record-table.ts";
import type { RowTicks } from "./row-ticks.tsx";
import { type View, emptyView } from "./table-view.ts";
import { noop, noopActions, testTheme } from "./test-support.tsx";

export interface Gadget extends CellRecord {
  name: string;
  code: string;
}

// A type, not an interface, as the server's changes are, so it holds any detail by its key.
export type GadgetChange = {
  name?: string;
  code?: string;
  values?: Record<string, string[]> | undefined;
};

export const colour: Field = {
  id: "f1",
  keyNumber: 1,
  name: "Colour",
  type: "choice" as const,
  listId: "l1",
  visibility: null,
  multiple: false,
  required: false,
};
// A gadget's web link column.
export const site: Field = {
  id: "f2",
  keyNumber: 1,
  name: "Site",
  type: "link",
  listId: null,
  visibility: "general",
  multiple: false,
  required: false,
};
export const colours: List = {
  id: "l1",
  keyNumber: 1,
  name: "Colours",
  description: "",
  visibility: "general",
  retired: false,
  choices: [{ id: "c1", label: "Teal", description: "", retired: false }],
};

export const gadgetColumns = (
  fields: readonly Field[],
  lists: readonly List[],
  order: readonly string[],
): Column<Gadget, GadgetChange>[] =>
  inOrder(
    [
      fieldColumn<Gadget, GadgetChange>("name", "text", {
        label: "Name",
        required: true,
        choices: [],
        multiple: false,
        maxLength: 10,
      }),
      fieldColumn<Gadget, GadgetChange>("code", "text", {
        label: "Code",
        required: false,
        choices: [],
        multiple: false,
      }),
      ...drawnFields(fields).map((field) =>
        cellColumn<Gadget, GadgetChange>(field.id, field.type, {
          label: field.name,
          required: field.required,
          field,
          choices: lists.find(({ id }) => id === field.listId)?.choices ?? [],
          multiple: field.multiple,
        }),
      ),
    ],
    order,
  );

export const liveGadgets = (gadgets: readonly Gadget[]) =>
  liveRecordsOf(gadgets, ["name", "code"]);

export const gadget = (id: string, more: Partial<Gadget> = {}): Gadget => ({
  id,
  name: `Gadget ${id}`,
  code: id.toUpperCase(),
  values: {},
  links: {},
  ...more,
});

export function gadgetTable(
  recordProblem: RecordTable<
    Gadget,
    GadgetChange,
    GadgetChange
  >["recordProblem"] = noop,
): RecordTable<Gadget, GadgetChange, GadgetChange> {
  return {
    label: "Gadgets",
    one: "gadget",
    noun: "gadgets",
    newRowLabel: () => "New gadget",
    removeLabel: () => "Remove gadget",
    nameOf: (one) => one.name,
    nameColumn: "name",
    columnsFor: gadgetColumns,
    liveRecords: liveGadgets,
    draftFields: () => [],
    recordProblem,
    request: (changes) => Object.assign({}, ...changes) as GadgetChange,
    drafts: (ids) => ({ ...noDrafts(), lists: ids }),
  };
}

// The shared table's actions for gadgets, doing nothing but those given.
export const actions = (
  more: Partial<RecordActions<Gadget, GadgetChange, GadgetChange>> = {},
): RecordActions<Gadget, GadgetChange, GadgetChange> => noopActions(more);

export function renderGadgets({
  gadgets,
  table = gadgetTable(),
  given = actions(),
  view = emptyView,
  onView = noop,
  approves = [],
  canEditColumns = false,
  fields = [colour],
  order = [],
  ticks,
  lists = [colours],
}: {
  gadgets: Gadget[];
  fields?: Field[];
  lists?: List[];
  table?: RecordTable<Gadget, GadgetChange, GadgetChange>;
  given?: RecordActions<Gadget, GadgetChange, GadgetChange>;
  view?: View;
  onView?: (view: View) => void;
  approves?: readonly DecidedKind[];
  canEditColumns?: boolean;
  order?: string[];
  ticks?: RowTicks<Gadget>;
}): RenderResult {
  return render(
    <MantineProvider theme={testTheme}>
      <RecordGrid
        records={gadgets}
        table={table}
        fields={fields}
        order={order}
        lists={lists}
        canEdit
        approves={approves}
        canEditColumns={canEditColumns}
        view={view}
        onView={onView}
        actions={given}
        ticks={ticks}
      />
    </MantineProvider>,
  );
}

export const nameThen = (next: Column<Gadget, GadgetChange>) => ({
  ...gadgetTable(),
  columnsFor: () => [...gadgetColumns([], [], []).slice(0, 1), next],
});
// Every kind but a choice is a gadget's own field, as a name is, rather than an added column's.
export const nextColumn = (
  kind: "choice" | "date" | "flag" | "link" | "text",
) => {
  const settings = {
    label: "Next",
    required: false,
    choices: [],
    multiple: false,
  };
  return kind === "choice"
    ? cellColumn<Gadget, GadgetChange>("next", kind, settings)
    : fieldColumn<Gadget, GadgetChange>("next", kind, settings);
};
