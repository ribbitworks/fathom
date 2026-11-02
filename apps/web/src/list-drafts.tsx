// SPDX-License-Identifier: Apache-2.0

// Drafts on the Lists page: the tint of a cell a draft changes, a draft shown before the server has
// saved it, and the bar that marks a list's draft, or the draft of its choices' order, with what can
// be done with it: discarding it or sending it for approval again, for those who may edit lists,
// and approving or rejecting it, for Approvers.

import type { Choice, List } from "@fathom/shared";
import { Button, Group } from "@mantine/core";
import { type DraftSelection, noDrafts } from "./drafts.ts";
import classes from "./pages.module.css";
import { count } from "./numbers.ts";
import { type DraftLike, DraftMark } from "./status-mark.tsx";

// What can be done with drafts on the Lists page; each names the draft it acts on.
export interface ListDraftActions {
  discard: (what: DraftOn) => void;
  resubmit: (what: DraftOn) => void;
  // Asks before approving or rejecting, naming any other drafts included.
  decide: (asking: "approve" | "reject", what: DraftOn) => void;
}

// A draft on the Lists page: a list's own, one of its choices', or that of its choices' order.
export type DraftOn =
  | { kind: "list"; list: List }
  | { kind: "choice"; list: List; choice: Choice }
  | { kind: "order"; list: List };

// The drafts a draft on the Lists page names, to approve or reject.
export function selectionOf(what: DraftOn): DraftSelection {
  return {
    ...noDrafts(),
    lists: what.kind === "list" ? [what.list.id] : [],
    choices: what.kind === "choice" ? [what.choice.id] : [],
    orders: what.kind === "order" ? [what.list.id] : [],
  };
}

// The name of a draft on the Lists page, as notifications say it.
export function draftName(what: DraftOn): string {
  if (what.kind === "choice") return what.choice.label;
  return what.kind === "order"
    ? `the order of ${what.list.name}`
    : what.list.name;
}

// The classes of a row with a draft: tinted, and struck through once a draft removes it.
export function draftRowClass(draft: { action: string } | undefined): string {
  if (draft === undefined) return "";
  return [
    classes.draftRow,
    draft.action === "deleted" ? classes.removedRow : "",
  ].join(" ");
}

// A list or choice as a change makes it before the server has saved it: its draft waits for
// approval, and changes the fields given, beside those it changed already, or removes it.
export function drafting<Record extends Choice | List>(
  record: Record,
  changed: readonly string[],
  action?: "deleted",
): Record {
  const draft = record.draft;
  return {
    ...record,
    draft: {
      action: action ?? draft?.action ?? "changed",
      changed:
        action === undefined
          ? [...new Set([...(draft?.changed ?? []), ...changed])]
          : [],
      live: draft?.live ?? {},
      state: "waiting",
      madeBy: draft?.madeBy ?? null,
      madeAt: draft?.madeAt ?? null,
    },
  };
}

// The choices a draft of a list's order moves, each with its place in the live order, counted from
// one: those outside the longest run of choices still in their live order, so moving one choice
// marks only that choice.
export function movedChoices(list: List): Map<string, number> {
  if (list.orderDraft === undefined) return new Map();
  return movedKeys(
    list.orderDraft.live,
    list.choices.map(({ id }) => id),
  );
}

// The records an order moves, by key, each with its place in the live order, counted from one:
// those outside the longest run still in their live order, so moving one marks only that one.
export function movedKeys(
  live: readonly string[],
  now: readonly string[],
): Map<string, number> {
  const moved = new Map<string, number>();
  const shown = now.filter((key) => live.includes(key));
  const places = shown.map((key) => live.indexOf(key));
  // For each, the longest run in live order that ends with it, and the one before it in that run;
  // orders are short, so each is compared with every one before it.
  const runs: { length: number; before: number }[] = [];
  places.forEach((place, at) => {
    let best = { length: 1, before: -1 };
    places.slice(0, at).forEach((earlier, from) => {
      const run = (runs.at(from) as { length: number }).length;
      if (earlier < place && run + 1 > best.length) {
        best = { length: run + 1, before: from };
      }
    });
    runs.push(best);
  });
  const kept = new Set<number>();
  let at = -1;
  let longest = 0;
  runs.forEach((run, index) => {
    if (run.length > longest) {
      longest = run.length;
      at = index;
    }
  });
  while (at !== -1) {
    kept.add(at);
    at = (runs.at(at) as { before: number }).before;
  }
  shown.forEach((key, index) => {
    if (!kept.has(index)) moved.set(key, live.indexOf(key) + 1);
  });
  return moved;
}

// A place in words, such as "3rd".
export function ordinal(place: number): string {
  const tens = place % 100;
  const units = place % 10;
  let suffix = "th";
  if (tens < 11 || tens > 13) {
    if (units === 1) suffix = "st";
    else if (units === 2) suffix = "nd";
    else if (units === 3) suffix = "rd";
  }
  return `${String(place)}${suffix}`;
}

// The mark beside a list on the Lists page: its own draft's, or, when only its choices or their
// order have drafts, one saying so, red if any of them was rejected.
export function listMark(list: List): DraftLike | undefined {
  if (list.draft !== undefined) return list.draft;
  const drafted = list.choices.flatMap(({ draft }) => (draft ? [draft] : []));
  if (drafted.length === 0 && list.orderDraft === undefined) return undefined;
  const rejected =
    list.orderDraft?.state === "rejected" ||
    drafted.some(({ state }) => state === "rejected");
  if (rejected) return { state: "rejected" };
  return drafted.length === 0
    ? { state: "waiting" }
    : { action: "changed", state: "waiting" };
}

// The bar that marks a list's draft, or the draft of its choices' order, as the People table's bar
// of drafts does: what the draft is, and why it was rejected, with what the user may do with it.
export function DraftBar({
  what,
  draft,
  summary,
  lines = [],
  canEdit,
  canApprove,
  actions,
}: {
  what: DraftOn;
  draft: DraftLike;
  // What the draft changes, in a few words, such as "1 choice moved".
  summary?: string;
  // What the draft changes, field by field, with who changed each, under the bar's mark.
  lines?: readonly string[];
  canEdit: boolean;
  canApprove: boolean;
  actions: ListDraftActions;
}) {
  const rejected = draft.state === "rejected";
  return (
    <Group
      justify="space-between"
      gap="xs"
      className={classes.listDraftBar}
      role="group"
      aria-label={what.kind === "order" ? "Draft of the order" : "Draft"}
    >
      <span className={classes.listDraftSummary}>
        <DraftMark draft={draft} />
        {summary !== undefined && (
          <span className={classes.listDraftWords}>{summary}</span>
        )}
        {rejected && draft.reason !== undefined && (
          <span className={classes.listDraftWords} aria-hidden="true">
            {draft.reason}
          </span>
        )}
        {lines.map((line) => (
          <span key={line} className={classes.listDraftLine}>
            {line}
          </span>
        ))}
      </span>
      <Group gap="xs">
        {canEdit && rejected && (
          <Button
            size="compact-sm"
            variant="default"
            onClick={() => {
              actions.resubmit(what);
            }}
          >
            Send again
          </Button>
        )}
        {canEdit && (
          <Button
            size="compact-sm"
            variant="default"
            onClick={() => {
              actions.discard(what);
            }}
          >
            Discard draft
          </Button>
        )}
        {canApprove && (
          <>
            <Button
              size="compact-sm"
              variant="default"
              onClick={() => {
                actions.decide("reject", what);
              }}
            >
              Reject…
            </Button>
            <Button
              size="compact-sm"
              onClick={() => {
                actions.decide("approve", what);
              }}
            >
              Approve
            </Button>
          </>
        )}
      </Group>
    </Group>
  );
}

// "1 choice moved", "3 choices moved".
export const movedWords = (moved: number) =>
  `${moved === 1 ? "1 choice" : `${count(moved)} choices`} moved`;
