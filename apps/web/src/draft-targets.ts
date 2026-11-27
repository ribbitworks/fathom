// SPDX-License-Identifier: Apache-2.0

// The record a draft is of, of any kind, as the Drafts page names it to select, discard or resubmit
// the draft through that kind's own requests.

import type { ColumnTable, RecordRef } from "@fathom/shared";
import { discardColumnDraft, resubmitColumnDraft } from "./column-requests.ts";
import { type DraftSelection, noDrafts } from "./drafts.ts";
import {
  discardFeatureTeamDraft,
  resubmitFeatureTeamDraft,
} from "./feature-teams.ts";
import { discardHireDraft, resubmitHireDraft } from "./hires.ts";
import {
  discardListDraft,
  type ListDraftTarget,
  resubmitListDraft,
} from "./lists.ts";
import { discardDraft, resubmitDraft } from "./people.ts";
import { discardRecordDraft, resubmitRecordDraft } from "./releases.ts";

export type DraftTarget =
  | { kind: "person" | "planned-hire" | "feature-team"; id: string }
  | ListDraftTarget
  | { kind: "column"; id: string; table: ColumnTable }
  | { kind: "record"; ref: RecordRef };

// The selection naming the target's draft alone, as deciding it sends.
export function targetSelection(target: DraftTarget): DraftSelection {
  const selection = noDrafts();
  switch (target.kind) {
    case "person":
      return { ...selection, people: [target.id] };
    case "planned-hire":
      return { ...selection, plannedHires: [target.id] };
    case "feature-team":
      return { ...selection, featureTeams: [target.id] };
    case "list":
      return { ...selection, lists: [target.listId] };
    case "choice":
      return { ...selection, choices: [target.choiceId] };
    case "order":
      return { ...selection, orders: [target.listId] };
    case "column":
      return { ...selection, columns: [target.id] };
    case "record":
      return { ...selection, records: [target.ref] };
  }
}

// Discards the target's draft, giving the change set it was saved in.
export function discardTarget(target: DraftTarget): Promise<string | null> {
  switch (target.kind) {
    case "person":
      return discardDraft(target.id);
    case "planned-hire":
      return discardHireDraft(target.id);
    case "feature-team":
      return discardFeatureTeamDraft(target.id);
    case "list":
    case "choice":
    case "order":
      return discardListDraft(target);
    case "column":
      return discardColumnDraft(target.id, target.table);
    case "record":
      return discardRecordDraft(target.ref);
  }
}

// Sends the target's rejected draft for approval again, unchanged.
export function resubmitTarget(target: DraftTarget): Promise<string | null> {
  switch (target.kind) {
    case "person":
      return resubmitDraft(target.id);
    case "planned-hire":
      return resubmitHireDraft(target.id);
    case "feature-team":
      return resubmitFeatureTeamDraft(target.id);
    case "list":
    case "choice":
    case "order":
      return resubmitListDraft(target);
    case "column":
      return resubmitColumnDraft(target.id, target.table);
    case "record":
      return resubmitRecordDraft(target.ref);
  }
}
