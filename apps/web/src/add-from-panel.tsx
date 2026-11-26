// SPDX-License-Identifier: Apache-2.0

// Adding a record in a New form stacked under a record's details: from a picker of the plan's
// records, linked to the record the picker was for, or an activity of a project or release, with it
// set.

import type { AddedColumns } from "./added-columns.ts";
import type { Feature, Project, ProjectPlan, Proposal } from "@fathom/shared";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import type { ActivityOwner } from "./activity-list.tsx";
import { activityTable } from "./activity-table.tsx";
import { newRecordQuestion } from "./discard-question.tsx";
import { differingKeys } from "./drafts.ts";
import { pendingId } from "./grid-drafts.ts";
import { NewPlanRecordPanel } from "./new-plan-record-panel.tsx";
import { entered, type FormValues } from "./new-record-panel.tsx";
import type { NoteOpening } from "./note-editing.tsx";
import { type PlanChange, wordsOf } from "./plan-table.tsx";
import { operationsOf } from "./plan-record-operations.ts";
import {
  type PlanRecord,
  type PlanRecordKind,
  projectPlanQuery,
  type TableChoices,
} from "./projects.ts";
import { type FeatureEdits, featureTable } from "./feature-table.tsx";
import {
  customerTable,
  projectTable,
  proposalTable,
} from "./project-grids.tsx";
import type {
  AddedTo,
  Column,
  RecordActions,
  RecordTable,
} from "./record-table.ts";
import type { SidePanel } from "./side-panel.tsx";
import type { View } from "./table-view.ts";

// The kinds of record a picker, or Add activity in a record's details, may add.
type LinkedKind = "customer" | "project" | "proposal" | "activity" | "feature";

const tabOf = {
  customer: "customers",
  project: "projects",
  proposal: "proposals",
  activity: "activities",
  feature: "features",
} as const satisfies Record<LinkedKind, string>;

// How a record added from a picker is linked: after it is added, as a draft of the record the
// picker was for; within its own draft, which names that record; or by filling the new row the
// picker was in.
type LinkedBy = "after" | "within" | "fill";

// A picker that may add a record: its column's key, the kind it adds, what the form opens with, given
// what was typed and the record the picker is for, and how the new record is linked.
// The columns a picker links its added records through.
type LinkKey = "customerIds" | "featureIds";

// The records a picker's column names, as the record holds them.
const linkedIn = (record: PlanRecord, key: LinkKey): readonly string[] =>
  key === "customerIds"
    ? (record as Project | Proposal | Feature).customerIds
    : (record as Project | Proposal).featureIds;

interface AddingPicker {
  key: LinkKey | "projectIds" | "proposalIds" | "projectId";
  kind: LinkedKind;
  opening: (typed: string, to: AddedTo) => FormValues;
  linkedBy: LinkedBy;
}

const named = (typed: string): FormValues => ({ name: typed });

// The saved record a picker is for, where only a saved record's picker adds.
const savedOf = (to: AddedTo): string => (to as { id: string }).id;

const customersPicker: AddingPicker = {
  key: "customerIds",
  kind: "customer",
  opening: named,
  linkedBy: "after",
};

// A project or proposal added from a feature opens naming the feature.
const featureNamer = (
  key: "projectIds" | "proposalIds",
  kind: "project" | "proposal",
): AddingPicker => ({
  key,
  kind,
  opening: (typed, to) => ({ name: typed, featureIds: [savedOf(to)] }),
  linkedBy: "within",
});

// A feature added from a proposal's Features, linked as a draft of the proposal that uses the
// feature's own draft, so the two are approved together.
const proposalFeaturesPicker: AddingPicker = {
  key: "featureIds",
  kind: "feature",
  opening: (typed) => ({ name: typed }),
  linkedBy: "after",
};

const pickersOf: Readonly<Record<PlanRecordKind, readonly AddingPicker[]>> = {
  project: [customersPicker],
  proposal: [customersPicker, proposalFeaturesPicker],
  feature: [
    customersPicker,
    featureNamer("projectIds", "project"),
    featureNamer("proposalIds", "proposal"),
  ],
  customer: [],
  // A saved milestone's project can't change, so only its new row adds one.
  milestone: [
    { key: "projectId", kind: "project", opening: named, linkedBy: "fill" },
  ],
  activity: [],
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
  // The picker's column, which the record added is linked through, when a picker opened the form.
  key?: AddingPicker["key"];
  linkedBy: LinkedBy;
  values: FormValues;
  // The form as it opens with nothing typed: a name typed into the picker counts as entered, what
  // the picker fills in itself does not.
  blank: FormValues;
  saving: boolean;
  // The kind of record the picker was for, and the record or new row it was in, or the activity's
  // own kind when it was opened from a record's details.
  type: PlanRecordKind;
  to: AddedTo;
  back: () => void;
}

// Whether the form holds anything entered, as the page's own New form judges it, in the fields that
// differ from how it opens with nothing typed.
const enteredSinceBlank = ({ values, blank }: Linking) => {
  const changed = new Set(differingKeys(values, blank, Object.keys(values)));
  return entered({
    values: Object.fromEntries(
      Object.entries(values).filter(([key]) => changed.has(key)),
    ),
  });
};

const oneOf = (kind: LinkedKind): string =>
  // The kind is always one of the fixed kinds.
  // eslint-disable-next-line security/detect-object-injection
  wordsOf(tabOf[kind]).one;

export function useAddFromPanel({
  canAdd,
  canAddFeatures,
  actionsFor,
}: {
  // Whether the role may add the plan's records here, and a picker may offer New now.
  canAdd: boolean;
  // Whether it may add features too, which their own role gives.
  canAddFeatures: boolean;
  actionsFor: <Rec extends PlanRecord, Request>(
    type: PlanRecordKind,
  ) => RecordActions<Rec, PlanChange, Request>;
}) {
  const client = useQueryClient();
  const [linking, setLinking] = useState<Linking>();
  // Each New starts its form afresh.
  const [forms, setForms] = useState(0);

  const addsOf = (
    { key, kind, opening, linkedBy }: AddingPicker,
    type: PlanRecordKind,
  ): Adds => ({
    one: oneOf(kind),
    fillsNewRow: linkedBy === "fill",
    onNew: (to, typed, back) => {
      setForms((count) => count + 1);
      setLinking({
        kind,
        key,
        linkedBy,
        values: opening(typed, to),
        blank: opening("", to),
        saving: false,
        type,
        to,
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
          pickersOf[type]
            .filter(({ kind }) => kind !== "feature" || canAddFeatures)
            .map((picker) => [picker.key, addsOf(picker, type)])
        : [],
    );

  const close = () => {
    setLinking(undefined);
  };

  // New activity, with the project or release set, as Add activity in its details opens it; its own
  // draft names the record.
  const addActivity = (owner: ActivityOwner, id: string, back: () => void) => {
    const blank = { [owner]: [id] };
    setForms((count) => count + 1);
    setLinking({
      kind: "activity",
      linkedBy: "within",
      values: blank,
      blank,
      saving: false,
      type: "activity",
      to: { id },
      back,
    });
  };

  const question =
    linking !== undefined && enteredSinceBlank(linking)
      ? newRecordQuestion(oneOf(linking.kind))
      : undefined;

  // Links records added to the record the picker was for, through the picker's column, as a draft
  // of it, as the plan holds it with what was saved since the form opened, unless someone has
  // removed it since.
  const linkAfter = (current: Linking, added: readonly string[]) => {
    // The plan is loaded while its page shows.
    const plan = client.getQueryData(projectPlanQuery.queryKey) as ProjectPlan;
    const id = savedOf(current.to);
    for (const record of operationsOf(current.type)
      .all(plan)
      .filter((holder) => holder.id === id)) {
      // Only pickers that link after adding, through a column the record holds, come here.
      const key = current.key as LinkKey;
      actionsFor(current.type).update(record, {
        [key]: [...linkedIn(record, key), ...added],
      });
    }
  };

  const linkOf: Readonly<
    Record<LinkedBy, (current: Linking, added: readonly string[]) => void>
  > = {
    after: linkAfter,
    within: () => undefined,
    // Only a new row's picker fills it.
    fill: (current, added) => {
      (current.to as Extract<AddedTo, { fill: unknown }>).fill(added);
    },
  };

  // The form, stacked under the panel it was opened from, or beside the table when it was a cell's.
  const panel = ({
    plan,
    choices,
    featureEdits,
    narrow,
    notes,
    units,
    ask,
  }: {
    plan: ProjectPlan;
    choices: TableChoices;
    // What the role may change on a new feature or activity, as on Features.
    featureEdits: FeatureEdits;
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
      added?: AddedColumns,
    ) {
      const actions = actionsFor<Rec, Request>(current.kind);
      return (
        <NewPlanRecordPanel
          key={forms}
          title={`New ${one}`}
          table={table}
          records={records}
          {...(added === undefined ? {} : { added })}
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
      activity: () =>
        form(
          activityTable(choices, {
            editsFeatureTeams: featureEdits.editsFeatureTeams === true,
          }),
          plan.activities,
          plan.activityColumns,
        ),
      feature: () =>
        form(
          featureTable(choices, featureEdits),
          plan.features,
          plan.featureColumns,
        ),
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
    addActivity,
    panel,
    question,
    close,
    saving: linking?.saving === true,
  };
}
