// SPDX-License-Identifier: Apache-2.0

// Adding a record from a picker of the plan's records, in a New form stacked under the picker's
// panel, and linking it to the record the picker was for.

import type { Project, ProjectPlan, Proposal } from "@fathom/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { newRecordQuestion } from "./discard-question.tsx";
import { pendingId } from "./grid-drafts.ts";
import { NewPlanRecordPanel } from "./new-plan-record-panel.tsx";
import type { FormValues } from "./new-record-panel.tsx";
import type { NoteOpening } from "./note-editing.tsx";
import { type PlanChange, wordsOf } from "./plan-table.tsx";
import {
  type PlanRecord,
  type PlanRecordKind,
  projectPlanQuery,
} from "./projects.ts";
import { customerTable } from "./project-grids.tsx";
import type { Column, RecordActions, RecordTable } from "./record-table.ts";
import type { SidePanel } from "./side-panel.tsx";
import type { View } from "./table-view.ts";

// The records whose Customers picker may add a customer.
type CustomerHolder = "project" | "proposal";

const customerHolders: ReadonlySet<PlanRecordKind> = new Set<CustomerHolder>([
  "project",
  "proposal",
]);

const one = wordsOf("customers").one;

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
  typed: string;
  values: FormValues;
  saving: boolean;
  // The record the picker was for, by its kind and identifier.
  type: CustomerHolder;
  id: string;
  back: () => void;
}

const opening = (typed: string): FormValues => ({ name: typed });

// Whether anything differs from the name the form opened with, so leaving it asks first.
const changed = ({ typed, values }: Linking) =>
  JSON.stringify(values) !== JSON.stringify(opening(typed));

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

  const addsCustomer = (type: CustomerHolder): Adds => ({
    one,
    onNew: (id, typed, back) => {
      setForms((count) => count + 1);
      setLinking({
        typed,
        values: opening(typed),
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
      canAdd && customerHolders.has(type)
        ? [["customerIds", addsCustomer(type as CustomerHolder)]]
        : [],
    );

  const close = () => {
    setLinking(undefined);
  };

  const question =
    linking !== undefined && changed(linking)
      ? newRecordQuestion(one)
      : undefined;

  // Links the customers added to the record the picker was for, as a draft of it, as the plan holds
  // it with what was saved since the form opened, unless someone has removed it since.
  const link = (current: Linking, added: readonly string[]) => {
    // The plan is loaded while its page shows.
    const plan = client.getQueryData(projectPlanQuery.queryKey) as ProjectPlan;
    const holders: readonly (Project | Proposal)[] =
      current.type === "project" ? plan.projects : plan.proposals;
    for (const record of holders.filter(({ id }) => id === current.id)) {
      actionsFor(current.type).update(record, {
        customerIds: [...record.customerIds, ...added],
      });
    }
  };

  // The form, stacked under the panel the picker is in, or beside the table when it was a cell's.
  const panel = ({
    plan,
    narrow,
    notes,
    units,
    ask,
  }: {
    plan: ProjectPlan;
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
    const panelId = "linked-record-panel";
    const actions = actionsFor("customer");
    return {
      key: "linked",
      id: panelId,
      name: `new ${one}`,
      node: (
        <NewPlanRecordPanel
          key={forms}
          title={`New ${one}`}
          table={customerTable()}
          records={plan.customers}
          values={current.values}
          saving={current.saving}
          narrow={narrow}
          panelId={panelId}
          notes={notes}
          units={units}
          onValue={(key, value) => {
            // The form shows only while a customer is being added.
            setLinking((shown) => {
              const now = shown as Linking;
              return { ...now, values: { ...now.values, [key]: value } };
            });
          }}
          onAdd={(request) => {
            setLinking({ ...current, saving: true });
            actions.add(
              [{ id: pendingId(), request }],
              (added) => {
                link(current, added);
                setLinking(undefined);
                current.back();
              },
              () => {
                setLinking({ ...current, saving: false });
              },
            );
          }}
          onCancel={() => {
            ask(question, () => {
              setLinking(undefined);
              current.back();
            });
          }}
        />
      ),
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
