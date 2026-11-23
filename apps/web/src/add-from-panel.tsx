// SPDX-License-Identifier: Apache-2.0

// Adding a record from a picker of the plan's records, in a New form stacked under the picker's
// panel, and linking it to the record the picker was for.

import type { Feature, Project, ProjectPlan, Proposal } from "@fathom/shared";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { newRecordQuestion } from "./discard-question.tsx";
import { pendingId } from "./grid-drafts.ts";
import { NewPlanRecordPanel } from "./new-plan-record-panel.tsx";
import type { FormValues } from "./new-record-panel.tsx";
import type { NoteOpening } from "./note-editing.tsx";
import { type PlanChange, wordsOf } from "./plan-table.tsx";
import {
  operationsOf,
  type PlanRecord,
  type PlanRecordKind,
  projectPlanQuery,
  type TableChoices,
} from "./projects.ts";
import {
  customerTable,
  projectTable,
  proposalTable,
} from "./project-grids.tsx";
import type { Column, RecordActions, RecordTable } from "./record-table.ts";
import type { SidePanel } from "./side-panel.tsx";
import type { View } from "./table-view.ts";

// The kinds of record a picker may add.
type LinkedKind = "customer" | "project" | "proposal";

const tabOf = {
  customer: "customers",
  project: "projects",
  proposal: "proposals",
} as const satisfies Record<LinkedKind, string>;

// How a record added from a picker is linked: after it is added, as a draft of the record the
// picker was for, or within its own draft, which names that record.
type LinkedBy = "after" | "within";

// A picker that may add a record: its column's key, the kind it adds, what the form opens with, given
// what was typed and the record the picker is for, and how the new record is linked.
interface AddingPicker {
  key: string;
  kind: LinkedKind;
  opening: (typed: string, id: string) => FormValues;
  linkedBy: LinkedBy;
}

const customersPicker: AddingPicker = {
  key: "customerIds",
  kind: "customer",
  opening: (typed) => ({ name: typed }),
  linkedBy: "after",
};

// A project or proposal added from a feature opens naming the feature.
const featureNamer = (
  key: string,
  kind: "project" | "proposal",
): AddingPicker => ({
  key,
  kind,
  opening: (typed, id) => ({ name: typed, featureIds: [id] }),
  linkedBy: "within",
});

const pickersOf: Readonly<Record<PlanRecordKind, readonly AddingPicker[]>> = {
  project: [customersPicker],
  proposal: [customersPicker],
  feature: [
    customersPicker,
    featureNamer("projectIds", "project"),
    featureNamer("proposalIds", "proposal"),
  ],
  customer: [],
  milestone: [],
};

export type Adds = NonNullable<Column<never, PlanChange>["adds"]>;

// The New option of each column that offers one, by the column's key.
export type AddsByKey = ReadonlyMap<string, Adds>;

// Columns with the New option of those that offer one.
export const withAdding = <Rec extends PlanRecord>(
  columns: readonly Column<Rec, PlanChange>[],
  adds: AddsByKey,
): Column<Rec, PlanChange>[] =>
  columns.map((column) => {
    const one = adds.get(column.key);
    return one === undefined ? column : { ...column, adds: one };
  });

// A table whose columns offer New where the adds name them.
export const addingTo = <Rec extends PlanRecord, Request>(
  table: RecordTable<Rec, PlanChange, Request>,
  adds: AddsByKey,
): RecordTable<Rec, PlanChange, Request> =>
  adds.size === 0
    ? table
    : {
        ...table,
        columnsFor: (...given) => withAdding(table.columnsFor(...given), adds),
      };

interface Linking {
  kind: LinkedKind;
  linkedBy: LinkedBy;
  values: FormValues;
  // What the form opened with, which leaving it unchanged discards without asking.
  opened: FormValues;
  saving: boolean;
  // The record the picker was for, by its kind and identifier.
  type: PlanRecordKind;
  id: string;
  back: () => void;
}

const oneOf = (kind: LinkedKind): string =>
  // The kind is always one of the fixed kinds.
  // eslint-disable-next-line security/detect-object-injection
  wordsOf(tabOf[kind]).one;

// A record that holds customers: a project, a proposal or a feature.
type CustomerHolder = Project | Proposal | Feature;

export function useAddFromPanel({
  canAdd,
  actionsFor,
}: {
  // Whether the role may add the plan's records here, and a picker may offer New now.
  canAdd: boolean;
  actionsFor: <Rec extends PlanRecord, Request>(
    type: PlanRecordKind,
  ) => RecordActions<Rec, PlanChange, Request>;
}) {
  const client = useQueryClient();
  const [linking, setLinking] = useState<Linking>();
  // Each New starts its form afresh.
  const [forms, setForms] = useState(0);

  const addsOf = (
    { kind, opening, linkedBy }: AddingPicker,
    type: PlanRecordKind,
  ): Adds => ({
    one: oneOf(kind),
    onNew: (id, typed, back) => {
      const opened = opening(typed, id);
      setForms((count) => count + 1);
      setLinking({
        kind,
        linkedBy,
        values: opened,
        opened,
        saving: false,
        type,
        id,
        back,
      });
    },
  });

  // The New options of a kind of record's pickers, by their columns' keys, for a role that may add.
  const addsFor = (type: PlanRecordKind): AddsByKey =>
    new Map(
      canAdd
        ? // The type is always one of the fixed kinds.
          // eslint-disable-next-line security/detect-object-injection
          pickersOf[type].map((picker) => [picker.key, addsOf(picker, type)])
        : [],
    );

  const close = () => {
    setLinking(undefined);
  };

  const question =
    linking !== undefined &&
    JSON.stringify(linking.values) !== JSON.stringify(linking.opened)
      ? newRecordQuestion(oneOf(linking.kind))
      : undefined;

  // Links customers added to the record the picker was for, as a draft of it, as the plan holds it
  // with what was saved since the form opened, unless someone has removed it since.
  const linkCustomers = (current: Linking, added: readonly string[]) => {
    // The plan is loaded while its page shows.
    const plan = client.getQueryData(projectPlanQuery.queryKey) as ProjectPlan;
    // Only records that hold customers have a Customers picker.
    const holders = operationsOf(current.type).all(plan) as CustomerHolder[];
    for (const record of holders.filter(({ id }) => id === current.id)) {
      actionsFor(current.type).update(record, {
        customerIds: [...record.customerIds, ...added],
      });
    }
  };

  const linkOf: Readonly<
    Record<LinkedBy, (current: Linking, added: readonly string[]) => void>
  > = {
    after: linkCustomers,
    within: () => undefined,
  };

  // The form, stacked under the panel the picker is in, or beside the table when it was a cell's.
  const panel = ({
    plan,
    choices,
    narrow,
    notes,
    units,
    ask,
  }: {
    plan: ProjectPlan;
    choices: TableChoices;
    narrow: boolean;
    notes: NoteOpening;
    units: View["units"];
    ask: (
      question: { title: string; keep: string } | undefined,
      go: () => void,
    ) => void;
  }): SidePanel | undefined => {
    if (linking === undefined) return undefined;
    const current = linking;
    const one = oneOf(current.kind);
    const panelId = "linked-record-panel";
    function form<Rec extends PlanRecord, Request>(
      table: RecordTable<Rec, PlanChange, Request>,
      records: readonly Rec[],
    ) {
      const actions = actionsFor<Rec, Request>(current.kind);
      return (
        <NewPlanRecordPanel
          key={forms}
          title={`New ${one}`}
          table={table}
          records={records}
          values={current.values}
          saving={current.saving}
          narrow={narrow}
          panelId={panelId}
          notes={notes}
          units={units}
          onValue={(key, value) => {
            // The form shows only while a record is being added.
            setLinking((shown) => {
              const now = shown as Linking;
              return { ...now, values: { ...now.values, [key]: value } };
            });
          }}
          onAdd={(request, refused) => {
            setLinking({ ...current, saving: true });
            actions.add(
              [{ id: pendingId(), request }],
              (added) => {
                linkOf[current.linkedBy](current, added);
                setLinking(undefined);
                current.back();
              },
              () => {
                setLinking({ ...current, saving: false });
              },
              refused,
            );
          }}
          onCancel={() => {
            ask(question, () => {
              setLinking(undefined);
              current.back();
            });
          }}
        />
      );
    }
    const formOf: Readonly<Record<LinkedKind, () => ReactNode>> = {
      customer: () =>
        form(customerTable(choices, { seesFeatures: false }), plan.customers),
      project: () => form(projectTable(choices), plan.projects),
      proposal: () => form(proposalTable(choices), plan.proposals),
    };
    return {
      key: "linked",
      id: panelId,
      name: `new ${one}`,
      fits: true,
      node: formOf[current.kind](),
    };
  };

  return {
    addsFor,
    panel,
    question,
    close,
    saving: linking?.saving === true,
  };
}
