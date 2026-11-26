// SPDX-License-Identifier: Apache-2.0

// Adding an activity from a record's details on a page that doesn't save the plan's records itself,
// such as a release's on Releases: the choices a new activity's fields offer, its saving, and the
// New activity form stacked under the details.

import type { ProjectPlan, ReleaseStream } from "@fathom/shared";
import { useQuery } from "@tanstack/react-query";
import { useAddFromPanel } from "./add-from-panel.tsx";
import type { Decision } from "./draft-decisions.ts";
import { effortConversionsQuery } from "./effort.ts";
import { planRecordActions } from "./plan-record-actions.ts";
import {
  planChoicesQuery,
  projectPlanQuery,
  tableChoices,
} from "./projects.ts";
import { useSaving } from "./saving.ts";

export function useActivityAdding({
  plan,
  streams,
  canAdd,
  blocked,
  onDecision,
}: {
  plan: ProjectPlan | undefined;
  streams: readonly ReleaseStream[];
  // Whether the role may add an activity here now, so the choices are worth reading.
  canAdd: boolean;
  // Whether the page has a dialog or question open, which an undo must not reach behind.
  blocked: boolean;
  // Shows a decision on a draft of the plan's records, as the page shows its own.
  onDecision: (decision: Decision) => void;
}) {
  const choicesQuery = useQuery({ ...planChoicesQuery, enabled: canAdd });
  const effortQuery = useQuery({ ...effortConversionsQuery, enabled: canAdd });
  const changes = useSaving<ProjectPlan>({
    queryKey: projectPlanQuery.queryKey,
    removed: "Someone else has removed this. The plan has been refreshed.",
    blocked,
  });
  // Only adding is asked of them here, so the role approves none of the plan's drafts.
  const { actionsFor } = planRecordActions({
    changes,
    plan,
    approves: [],
    onDecision,
  });
  // No picker here offers New, so the form opens only from Add activity.
  const linked = useAddFromPanel({ canAdd: false, actionsFor });
  const choices =
    plan === undefined || choicesQuery.data === undefined
      ? undefined
      : tableChoices(plan, choicesQuery.data, streams, effortQuery.data);
  return {
    // Whether New activity can open yet, its fields' choices read.
    ready: choices !== undefined,
    addActivity: linked.addActivity,
    question: linked.question,
    close: linked.close,
    saving: linked.saving,
    panel: (
      shown: Omit<Parameters<typeof linked.panel>[0], "plan" | "choices">,
    ) =>
      plan === undefined || choices === undefined
        ? undefined
        : linked.panel({ ...shown, plan, choices }),
  };
}
