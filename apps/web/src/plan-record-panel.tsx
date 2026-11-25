// SPDX-License-Identifier: Apache-2.0

// The side panel that shows a plan record's details beside its table, and the form that adds a
// milestone to a project or changes one.

import type {
  DraftKind,
  Milestone,
  MilestoneRequest,
  Project,
  ProjectPlan,
  Proposal,
  Show,
} from "@fathom/shared";
import { Stack } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { type SubmitEvent, useState } from "react";
import { cellKinds } from "./cell-kinds.tsx";
import { DialogActions } from "./dialog-actions.tsx";
import { featureColumnGroups, featureColumns } from "./feature-table.tsx";
import { focusRefusedSoon } from "./focus.ts";
import {
  livePlanRecords,
  noRecordProblem,
  type PlanChange,
} from "./plan-table.tsx";
import {
  customerColumnGroups,
  customerOwnColumns,
  milestoneColumns,
  projectColumns,
  projectDateColumns,
  proposalColumns,
} from "./project-grids.tsx";
import {
  addMilestone,
  changeMilestone,
  isProposal,
  type PlanRecord,
  type PlanRecordKind,
  type PlanTab,
  type TableChoices,
} from "./projects.ts";
import { ScopeHistory } from "./scope-history.tsx";
import { RecordPanel } from "./record-details.tsx";
import { newRecordProblems } from "./grid-saving.ts";
import type { Column, ColumnGroup } from "./record-table.ts";
import type { NoteOpening } from "./note-editing.tsx";
import { isMilestoneField, MilestoneField } from "./milestone-field.tsx";
import { noOthers } from "./new-plan-record-panel.tsx";
import {
  type Follow,
  type MilestoneMenu,
  onlyKind,
  PlanRecordDetails,
  ProjectExtras,
} from "./plan-record-details.tsx";
import type { RecordNode } from "./record-drafts.ts";
import { RecordKey } from "./record-key.tsx";
import type { SidePanel } from "./side-panel.tsx";
import type { CellValue, View } from "./table-view.ts";

export const panelId = "project-record-panel";
export const panelTitleId = "project-record-panel-title";

const milestoneFields = milestoneColumns([]).filter(isMilestoneField);

// The headed groups each kind's details show its columns in, or none for one shown in one list.
const columnGroupsOf: Record<
  PlanRecordKind,
  readonly ColumnGroup[] | undefined
> = {
  customer: customerColumnGroups,
  project: undefined,
  proposal: undefined,
  milestone: undefined,
  feature: featureColumnGroups,
};

// A milestone's name, date, and whether it is a delivery to customers, added to a project or
// changed, saved as a draft.

export function MilestoneForm({
  project,
  milestone,
  onCancel,
  onSaved,
}: {
  project: Project;
  milestone?: Milestone | undefined;
  onCancel: () => void;
  onSaved: (changeSetId: string | null) => void;
}) {
  const [values, setValues] = useState<Record<string, CellValue>>(() =>
    Object.fromEntries(
      milestoneFields.map((column) => [
        column.key,
        milestone === undefined
          ? cellKinds[column.kind].empty
          : column.value(milestone),
      ]),
    ),
  );
  const [submitted, setSubmitted] = useState(false);
  const mutation = useMutation({
    mutationFn: async (request: MilestoneRequest) =>
      (milestone === undefined
        ? await addMilestone(project.id, request)
        : await changeMilestone(milestone, request)
      ).changeSetId,
    onSuccess: onSaved,
  });
  const problems = newRecordProblems(
    milestoneFields,
    onlyKind,
    values,
    noRecordProblem,
    noOthers,
  );
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (problems.length > 0) {
      focusRefusedSoon(event.currentTarget);
      return;
    }
    mutation.mutate({
      name: values.name as string,
      date: values.date as string,
      customerDelivery: (values.customerDelivery as string[]).length > 0,
    });
  };
  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="md">
        {milestoneFields.map((column) => (
          <MilestoneField
            key={column.key}
            column={column}
            value={values[column.key] as CellValue}
            problem={
              submitted
                ? problems.find((one) => one.column === column.key)?.message
                : undefined
            }
            onChange={(value) => {
              setValues({ ...values, [column.key]: value });
            }}
          />
        ))}
        <DialogActions
          error={mutation.error}
          pending={mutation.isPending}
          label={milestone === undefined ? "Add milestone" : "Save"}
          onCancel={onCancel}
        />
      </Stack>
    </form>
  );
}

// The tabs whose records each page or tab shows the details of beside its table: Features shows the
// projects and proposals that name its features too, so the roadmap stays in view.
type DetailTab = Exclude<PlanTab, "milestones">;

export const detailTabs: Readonly<Record<PlanTab, readonly DetailTab[]>> = {
  projects: ["projects"],
  proposals: ["proposals"],
  customers: ["customers"],
  milestones: [],
  features: ["features", "projects", "proposals"],
};

// The details of the record open beside the table, as the tab's table shows them, each value a
// draft changes with its live value under it, and a project's dates and milestones.
export function recordPanel({
  tab,
  plan,
  choices,
  open,
  narrow,
  show,
  units,
  editsKind,
  approves,
  seesFeatures,
  nodes,
  onClose,
  menu,
  showMilestones,
  follow,
  onChange,
  changeReason,
  notes,
}: {
  tab: PlanTab;
  plan: ProjectPlan;
  choices: TableChoices;
  open: string | undefined;
  narrow: boolean;
  show: Show;
  // The units and decimal places the table shows its columns in.
  units: Pick<View, "units" | "places">;
  // Whether the user may change a kind of record here.
  editsKind: (type: PlanRecordKind) => boolean;
  approves: readonly DraftKind[];
  // Whether the user's role sees features, which a scope history lists.
  seesFeatures: boolean;
  nodes: readonly RecordNode[];
  onClose: () => void;
  menu: MilestoneMenu;
  showMilestones: (project: Project) => void;
  follow: Follow;
  onChange: (
    type: PlanRecordKind,
    record: PlanRecord,
    change: PlanChange,
  ) => void;
  // Saves the reason for a draft removing a feature from a proposal.
  changeReason: (
    featureId: string,
    proposal: Proposal,
    reason: string | null,
  ) => void;
  notes: NoteOpening;
}): SidePanel | undefined {
  if (open === undefined) return undefined;
  const asShown = <Rec extends PlanRecord>(records: readonly Rec[]) =>
    show === "live" ? livePlanRecords(records) : records;
  const shownOf = (
    type: PlanRecordKind,
    records: readonly PlanRecord[],
    columns: () => readonly Column<never, PlanChange>[],
  ) => {
    const record = asShown(records).find(({ id }) => id === open);
    // The record's draft, whatever the view, which marks it and the values it changes, so the Draft
    // view decides how they show.
    const ownDraft = records.find(({ id }) => id === open)?.draft;
    return record === undefined
      ? undefined
      : { type, record, columns, ownDraft };
  };
  const shownFrom: Readonly<
    Record<DetailTab, () => ReturnType<typeof shownOf>>
  > = {
    projects: () =>
      shownOf("project", plan.projects, () =>
        projectColumns(choices).filter(
          ({ key }) => !projectDateColumns.some(([date]) => date === key),
        ),
      ),
    proposals: () =>
      shownOf("proposal", plan.proposals, () => proposalColumns(choices)),
    customers: () =>
      shownOf("customer", plan.customers, () => customerOwnColumns()),
    features: () =>
      shownOf("feature", plan.features, () =>
        featureColumns(choices, { editsCommitments: editsKind("project") }),
      ),
  };
  // The tab is always one of the fixed tabs.
  // eslint-disable-next-line security/detect-object-injection
  const found = detailTabs[tab]
    .map((one) =>
      // eslint-disable-next-line security/detect-object-injection
      shownFrom[one](),
    )
    .find((one) => one !== undefined);
  if (found === undefined) return undefined;
  const { type, record: shown, ownDraft } = found;
  const columns = found.columns();
  const canEdit = editsKind(type);
  // Projects and proposals, which name features, show their scope history to those who see them.
  const scope =
    "featureIds" in shown && seesFeatures ? (
      <ScopeHistory
        type={isProposal(shown) ? "proposal" : "project"}
        record={shown}
        features={asShown(plan.features)}
        show={show}
        onShow={(featureId) => {
          follow.showRecord("features", featureId);
        }}
        onChangeReason={
          isProposal(shown) && canEdit
            ? (featureId, reason) => {
                changeReason(featureId, shown, reason);
              }
            : undefined
        }
      />
    ) : null;
  const extra =
    type === "project" ? (
      <ProjectExtras
        project={shown as Project}
        show={show}
        canEdit={canEdit}
        approves={approves}
        nodes={nodes}
        menu={menu}
        showMilestones={showMilestones}
      />
    ) : null;
  return {
    key: "record",
    id: panelId,
    name: "details",
    node: (
      <RecordPanel
        id={panelId}
        titleId={panelTitleId}
        recordId={shown.id}
        title={shown.name}
        narrow={narrow}
        draft={ownDraft}
        heldBy={shown.heldBy}
        onClose={onClose}
        subtitle={
          <RecordKey record={{ kind: type, keyNumber: shown.keyNumber }} />
        }
      >
        <PlanRecordDetails
          // Each record's details start in the units the table shows.
          key={shown.id}
          columns={columns}
          units={units}
          record={shown}
          ownDraft={ownDraft}
          canEdit={canEdit}
          follow={follow}
          onChange={(change) => {
            onChange(type, shown, change);
          }}
          // The kind is always one of the fixed kinds.
          // eslint-disable-next-line security/detect-object-injection
          sections={columnGroupsOf[type]}
          notes={notes}
        />
        {extra}
        {scope}
      </RecordPanel>
    ),
  };
}
