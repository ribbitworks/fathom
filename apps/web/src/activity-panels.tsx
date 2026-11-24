// SPDX-License-Identifier: Apache-2.0

// A project's activities on Projects: their menu in the project's details, and the panels under the
// project's details, an activity's details, at its own address, or the form that adds one.

import type { ProjectPlan, Show } from "@fathom/shared";
import { activityTable, activityWords } from "./project-grids.tsx";
import { entered, type FormValues } from "./new-record-panel.tsx";
import { NewPlanRecordPanel } from "./new-plan-record-panel.tsx";
import { useState } from "react";
import type { useDiscardQuestion } from "./discard-question.tsx";
import { focusSoon } from "./focus.ts";
import { noDrafts } from "./drafts.ts";
import { pendingId } from "./grid-drafts.ts";
import {
  afterNote,
  type NoteEditing,
  type NoteOpening,
} from "./note-editing.tsx";
import {
  activityLinkId,
  type ActivityMenu,
  addActivityId,
} from "./project-activities.tsx";
import type { DraftOf, RecordActions } from "./record-table.ts";
import { type Follow, PlanRecordDetails } from "./plan-record-details.tsx";
import {
  type Identified,
  livePlanRecords,
  type PlanChange,
} from "./plan-table.tsx";
import {
  type ActivityAdding,
  planRecordKey,
  projectActivities,
  type ProjectActivity,
  type TableChoices,
} from "./projects.ts";
import { RecordPanel } from "./record-details.tsx";
import { RecordKey } from "./record-key.tsx";
import type { SidePanel } from "./side-panel.tsx";
import type { CellValue, View } from "./table-view.ts";

export const activityPanelId = "activity-panel";
export const activityPanelTitleId = "activity-panel-title";

type Ask = ReturnType<typeof useDiscardQuestion>["ask"];

// An activity's details, under its project's, as the Draft view shows it.
export function activityPanel({
  plan,
  choices,
  project,
  open,
  narrow,
  show,
  units,
  canEdit,
  follow,
  notes,
  onChange,
  onClose,
}: {
  plan: ProjectPlan;
  choices: TableChoices;
  // The project whose details it is shown under.
  project: string | undefined;
  open: string | undefined;
  narrow: boolean;
  show: Show;
  units: Pick<View, "units" | "places">;
  canEdit: boolean;
  follow: Follow;
  notes: NoteOpening;
  onChange: (activity: ProjectActivity, change: PlanChange) => void;
  // Given the activity whose details close.
  onClose: (activity: string) => void;
}): SidePanel | undefined {
  if (open === undefined) return undefined;
  const all = projectActivities(plan);
  const shown = (show === "live" ? livePlanRecords(all) : all).find(
    ({ id, projectId }) => id === open && projectId === project,
  );
  if (shown === undefined) return undefined;
  const ownDraft = all.find(({ id }) => id === open)?.draft;
  const identified = new Map<string, Identified>(
    plan.projects.map((project) => [project.id, project]),
  );
  return {
    key: "activity",
    id: activityPanelId,
    name: "activity",
    node: (
      <RecordPanel
        id={activityPanelId}
        titleId={activityPanelTitleId}
        recordId={shown.id}
        title={shown.name}
        narrow={narrow}
        draft={ownDraft}
        heldBy={shown.heldBy}
        onClose={() => {
          onClose(shown.id);
        }}
        subtitle={
          <RecordKey record={planRecordKey("project-activity", shown)} />
        }
      >
        <PlanRecordDetails
          key={shown.id}
          columns={activityTable(
            plan.projects,
            choices.effortConversions,
          ).columnsFor([], [], [], [])}
          units={units}
          record={shown}
          ownDraft={ownDraft}
          canEdit={canEdit && show !== "live"}
          identified={identified}
          follow={follow}
          onChange={(change) => {
            onChange(shown, change);
          }}
          notes={notes}
        />
      </RecordPanel>
    ),
  };
}

// The form adding an activity to a project, which it starts with.
export function newActivityPanel({
  plan,
  choices,
  values,
  saving,
  narrow,
  units,
  notes,
  forms,
  onValue,
  onAdd,
  onCancel,
}: {
  plan: ProjectPlan;
  choices: TableChoices;
  values: FormValues;
  saving: boolean;
  narrow: boolean;
  units: View["units"];
  notes: NoteOpening;
  // Each form is drawn afresh, with none of a discarded one's fields.
  forms: number;
  onValue: (key: string, value: CellValue) => void;
  onAdd: (request: ActivityAdding) => void;
  onCancel: () => void;
}): SidePanel {
  return {
    key: "activity",
    id: activityPanelId,
    name: "activity",
    node: (
      <NewPlanRecordPanel
        key={forms}
        title={`New ${activityWords.one}`}
        table={activityTable(plan.projects, choices.effortConversions)}
        records={projectActivities(plan)}
        values={values}
        saving={saving}
        narrow={narrow}
        panelId={activityPanelId}
        notes={notes}
        units={units}
        onValue={onValue}
        onAdd={onAdd}
        onCancel={onCancel}
      />
    ),
  };
}

// The form adding an activity, while one is: the project it is added to, and what is entered.
export interface ActivityForm {
  projectId: string;
  values: FormValues;
  saving?: boolean;
}

// The form adding an activity, kept by the page while it draws the panel: what is entered, whether
// anything is, so leaving asks first, and a count that draws each new form afresh.
export function useActivityForm() {
  const [form, onForm] = useState<ActivityForm>();
  const [forms, setForms] = useState(0);
  return {
    form,
    onForm,
    forms,
    onNewForm: () => {
      setForms((count) => count + 1);
    },
    saving: form?.saving === true,
    entered: form !== undefined && entered(form),
  };
}

export type ActivityFormState = ReturnType<typeof useActivityForm>;

// A project's activities as Projects shows them: the menu each has in its project's details, and
// the panels under its project's details, the activity's or the form adding one.
export function projectActivityPanels({
  plan,
  choices,
  narrow,
  view,
  notes,
  ask,
  leave,
  actions,
  adding: { form, onForm, forms, onNewForm },
  project,
  open,
  onOpen,
  follow,
}: {
  plan: ProjectPlan;
  choices: TableChoices;
  narrow: boolean;
  view: Pick<View, "show" | "units" | "places">;
  notes: NoteEditing;
  ask: Ask;
  // Runs once anything unsaved has been kept or discarded, as the page asks.
  leave: (go: () => void) => void;
  actions: RecordActions<ProjectActivity, PlanChange, ActivityAdding>;
  // The form adding an activity on this tab, if any.
  adding: Pick<ActivityFormState, "onForm" | "forms" | "onNewForm"> & {
    form: ActivityForm | undefined;
  };
  // The project whose details are open.
  project: string | undefined;
  open: string | undefined;
  onOpen: (id: string | undefined) => void;
  follow: Follow;
}): { menu: ActivityMenu; panels: () => SidePanel[] } {
  const menu: ActivityMenu = {
    decide: (asking, ref) => {
      actions.decide(asking, { ...noDrafts(), records: [ref] });
    },
    // The menu offers these only for an activity with a draft.
    discard: (activity) => {
      actions.discard(activity, activity.draft as DraftOf<ProjectActivity>);
    },
    resubmit: (activity) => {
      actions.resubmit(activity, activity.draft as DraftOf<ProjectActivity>);
    },
    remove: actions.remove,
    open: (activity) => {
      leave(() => {
        onOpen(activity.id);
      });
    },
    add: (project) => {
      leave(() => {
        onOpen(undefined);
        onNewForm();
        onForm({ projectId: project.id, values: {} });
      });
    },
  };
  const panels = (): SidePanel[] => {
    if (form !== undefined) {
      return [
        newActivityPanel({
          plan,
          choices,
          values: { ...form.values, projectId: [form.projectId] },
          saving: form.saving === true,
          narrow,
          units: view.units,
          notes,
          forms,
          onValue: (key, value) => {
            onForm(
              (current) =>
                current && {
                  ...current,
                  values: { ...current.values, [key]: value },
                },
            );
          },
          onAdd: (request) => {
            afterNote(notes, ask, () => {
              const pending = { ...form, saving: true };
              onForm(pending);
              actions.add(
                [{ id: pendingId(), request }],
                ([saved]) => {
                  onForm(undefined);
                  onOpen(saved);
                },
                () => {
                  onForm({ ...pending, saving: false });
                },
              );
            });
          },
          onCancel: () => {
            leave(() => {
              focusSoon(addActivityId);
            });
          },
        }),
      ];
    }
    const shown = activityPanel({
      plan,
      choices,
      project,
      open,
      narrow,
      show: view.show,
      units: view,
      canEdit: plan.canEdit,
      follow,
      notes,
      onChange: (activity, change) => {
        actions.update(activity, change);
      },
      onClose: (closed) => {
        onOpen(undefined);
        focusSoon(activityLinkId(closed));
      },
    });
    return shown === undefined ? [] : [shown];
  };
  return { menu, panels };
}
