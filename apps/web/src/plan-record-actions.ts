// SPDX-License-Identifier: Apache-2.0

// What the plan's tables and details panels do to their records: add, change, remove, discard and
// resubmit them, and ask to decide their drafts.

import type {
  Asking,
  DecidedKind,
  Proposal,
  ProjectPlan,
} from "@fathom/shared";
import { allOf, withRemovalReason } from "@fathom/shared";
import type { CellChange } from "./cell-kinds.tsx";
import { type Decision, decisionFor } from "./draft-decisions.ts";
import { draftSentAgain, type DraftSelection } from "./drafts.ts";
import {
  adding,
  discarded,
  newestId,
  removing,
  withAdded,
  withRecord,
  withRecordChange,
} from "./plan-record-changes.ts";
import type { PlanChange } from "./plan-table.tsx";
import { noColumnActions } from "./project-grids.tsx";
import {
  changeRemovalReason,
  namesOf,
  planNodes,
  type PlanRecord,
  type PlanRecordKind,
} from "./projects.ts";
import { operationsOf } from "./plan-record-operations.ts";
import type { RecordActions } from "./record-table.ts";
import { discardRecordDraft, resubmitRecordDraft } from "./releases.ts";
import type { RecordSaving } from "./saving.ts";

export function planRecordActions({
  changes: { save, undoable, done },
  plan,
  approves,
  onDecision,
}: {
  changes: RecordSaving<ProjectPlan>;
  // The plan as last read, which each action reads only once the page has it.
  plan: ProjectPlan | undefined;
  // The kinds of draft the user's role approves and rejects.
  approves: readonly DecidedKind[];
  onDecision: (decision: Decision) => void;
}) {
  const decide = (asking: Asking, chosen: DraftSelection, all?: boolean) => {
    const shownPlan = plan as ProjectPlan;
    onDecision(
      decisionFor(
        asking,
        chosen,
        approves,
        shownPlan.featureColumns.lists,
        {
          fields: shownPlan.featureColumns.fields,
          records: planNodes(shownPlan),
        },
        all,
      ),
    );
  };

  const discard = (type: PlanRecordKind, record: PlanRecord) => {
    const gone = record.draft?.action === "created";
    save({
      next: (plan) => withRecord(plan, type, record.id, discarded),
      save: () => discardRecordDraft({ type, id: record.id }),
      failure: `Fathom could not discard the draft of ${record.name}.`,
      onSaved: (changeSetId, before) => {
        if (gone) {
          done(
            `Discarded the draft adding ${record.name}.`,
            changeSetId,
            before,
          );
        } else {
          undoable(changeSetId, before);
        }
      },
    });
  };

  const changeReason = (
    featureId: string,
    proposal: Proposal,
    removalReason: string | null,
  ) => {
    const features = namesOf((plan as ProjectPlan).features, [featureId]);
    save({
      next: (plan) =>
        withRecord(plan, "proposal", proposal.id, (shown) => ({
          ...shown,
          removalReasons: withRemovalReason(
            proposal.removalReasons,
            featureId,
            removalReason,
          ),
        })),
      save: async () =>
        (await changeRemovalReason(featureId, proposal.id, { removalReason }))
          .changeSetId,
      failure: `Fathom could not change the reason for removing ${allOf(features)} from ${proposal.name}. Try again in a moment.`,
      onSaved: undoable,
    });
  };

  const resubmit = (type: PlanRecordKind, record: PlanRecord) => {
    save({
      next: (plan) => withRecord(plan, type, record.id, draftSentAgain),
      save: () => resubmitRecordDraft({ type, id: record.id }),
      failure: `Fathom could not send the draft of ${record.name} for approval again.`,
      onSaved: undoable,
    });
  };

  function actionsFor<Rec extends PlanRecord, Request>(
    type: PlanRecordKind,
  ): RecordActions<Rec, PlanChange, Request> {
    return {
      add: (added, onAdded, onFailed, onRefused) => {
        save({
          next: (plan) =>
            withAdded(
              plan,
              type,
              added.map(({ id, request }) =>
                adding(type, id, request as CellChange),
              ),
            ),
          save: async () => {
            const ids: string[] = [];
            // Every record of the kind before these were added, so each new one is told apart.
            const known = operationsOf(type)
              .all(plan as ProjectPlan)
              .map(({ id }) => id);
            let changeSetId: string | null = null;
            // Each is its own request, one after another, so the change sets follow in order.
            for (const { request } of added) {
              const saved = await operationsOf(type).add(request);
              changeSetId = saved.changeSetId;
              ids.push(newestId(saved.plan, type, [...known, ...ids]));
            }
            onAdded(ids);
            return changeSetId;
          },
          failure: `Fathom could not add ${allOf(
            added.map(({ request }) => (request as { name: string }).name),
          )}. Try again in a moment.`,
          onFailed,
          onRefused,
          onSaved: undoable,
        });
      },
      update: (record, change) => {
        save({
          next: (plan) => withRecordChange(plan, type, record.id, change),
          save: async () =>
            (await operationsOf(type).change(record, change)).changeSetId,
          failure: `Fathom could not change ${record.name}.`,
          onSaved: undoable,
        });
      },
      decide,
      remove: (record) => {
        save({
          next: (plan) => withRecord(plan, type, record.id, removing),
          save: () => operationsOf(type).remove(record),
          failure: `Fathom could not remove ${record.name}.`,
          onSaved: undoable,
        });
      },
      discard: (record) => {
        discard(type, record);
      },
      resubmit: (record) => {
        resubmit(type, record);
      },
      ...noColumnActions,
    };
  }

  return { decide, discard, changeReason, resubmit, actionsFor };
}
