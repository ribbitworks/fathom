// SPDX-License-Identifier: Apache-2.0

// Drafts on the Lists page: the tint of a row with a draft, a draft shown before the server has
// saved it, and the menu of a list's drafts, its own and that of its choices' order, with what can
// be done with each: discarding it or resubmitting it, for those who may edit lists, and approving
// or rejecting it, for Approvers.

import { allOf } from "@fathom/shared";
import type { Choice, List } from "@fathom/shared";
import { ActionIcon, Menu } from "@mantine/core";
import { useState } from "react";
import {
  HeldNote,
  MenuDraftLines,
  MenuTitle,
  UnpublishedNote,
  OtherApproverNote,
  WaitingNote,
} from "./draft-details.tsx";
import { decidable, type DraftSelection, noDrafts } from "./drafts.ts";
import { Icon } from "./icons.tsx";
import { makerNames } from "./names.ts";
import { withRetiring } from "./lists.ts";
import { closesOnBlankClick } from "./app-menu.tsx";
import classes from "./pages.module.css";
import type { DraftLike } from "./status-mark.tsx";

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

// The mark beside a list on the Lists page. A list drafted to be added or removed shows that
// draft's mark. Otherwise the mark says whether anything in it, the list itself, its choices, or
// their order, still waits for approval, as "Draft: reordered" when only the order does; it is red
// only once everything drafted in it was rejected. Drafts applied leaves rejected drafts out, as it
// shows them taken back.
export function listMark(
  list: List,
  leaveOutRejected = false,
): DraftLike | undefined {
  const counted = (draft: DraftLike | undefined): draft is DraftLike =>
    draft !== undefined && !(leaveOutRejected && draft.state === "rejected");
  const own = counted(list.draft) ? list.draft : undefined;
  if (own?.action === "created" || own?.action === "deleted") return own;
  if (own?.state === "waiting") {
    const retiring = withRetiring({ ...list, draft: own });
    if (retiring.retiring !== undefined) return retiring;
  }
  const found: (DraftLike | undefined)[] = [
    own,
    ...list.choices.map(({ draft }) => draft),
    list.orderDraft,
  ];
  const drafts = found.filter(counted);
  const waiting = drafts.filter(({ state }) => state === "waiting");
  if (waiting.length > 0) {
    return waiting.length === 1 && waiting[0] === list.orderDraft
      ? { state: "waiting" }
      : { action: "changed", state: "waiting" };
  }
  return drafts.length > 0 ? { state: "rejected" } : undefined;
}

// The menu of a list's drafts, beside its name in the panel, laid out as a record's menu on the
// People page: a short section for the list's own draft and one for a new order of its choices,
// each with its mark, who made it, any reason it was rejected, and what the user may do with it.
export function ListDraftMenu({
  list,
  orderWaits,
  canEdit,
  canApprove,
  actions,
}: {
  list: List;
  // Whether the new order waits for a rejected draft it depends on, so cannot be approved yet.
  orderWaits: boolean;
  canEdit: boolean;
  canApprove: boolean;
  actions: ListDraftActions;
}) {
  const [opened, setOpened] = useState(false);
  const { draft, orderDraft } = list;
  const act = (run: () => void) => () => {
    setOpened(false);
    run();
  };
  const on = { kind: "list" as const, list };
  const order = { kind: "order" as const, list };
  return (
    <Menu
      opened={opened}
      onChange={setOpened}
      closeOnItemClick={false}
      position="bottom-end"
      hideDetached={false}
      width={260}
    >
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={`Drafts of ${list.name}`}
        >
          <Icon name="more" />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown
        onClick={closesOnBlankClick(() => {
          setOpened(false);
        })}
        // Esc closes the menu alone, not the panel around it too.
        onKeyDown={(event) => {
          if (event.key === "Escape") event.preventDefault();
        }}
      >
        <MenuTitle>{list.name}</MenuTitle>
        {draft && (
          <>
            <MenuDraftLines
              draft={withRetiring({ ...list, draft })}
              lines={[[`${madeVerb(draft.action)} by ${makers(draft)}`]]}
              divider={false}
            />
            {list.heldBy !== undefined && <HeldNote by={list.heldBy} />}
            {draft.unpublished === true && <UnpublishedNote />}
            <DraftItems
              canEdit={canEdit && list.heldBy === undefined}
              canApprove={canApprove && decidable(list)}
              othersApprove={draft.needsOtherApprover === true}
              rejected={draft.state === "rejected"}
              onApprove={act(() => {
                actions.decide("approve", on);
              })}
              onReject={act(() => {
                actions.decide("reject", on);
              })}
              onResubmit={act(() => {
                actions.resubmit(on);
              })}
              onDiscard={act(() => {
                actions.discard(on);
              })}
            />
          </>
        )}
        {orderDraft && (
          <>
            {draft && <Menu.Divider />}
            <MenuDraftLines
              draft={orderDraft}
              lines={[[`Reordered by ${makers(orderDraft)}`]]}
              divider={false}
            />
            {list.orderHeldBy !== undefined && (
              <HeldNote by={list.orderHeldBy} />
            )}
            {orderDraft.unpublished === true && <UnpublishedNote />}
            <DraftItems
              canEdit={canEdit && list.orderHeldBy === undefined}
              canApprove={
                canApprove &&
                decidable({ draft: orderDraft, heldBy: list.orderHeldBy })
              }
              othersApprove={orderDraft.needsOtherApprover === true}
              rejected={orderDraft.state === "rejected"}
              waits={orderWaits}
              discard="Discard new order"
              onApprove={act(() => {
                actions.decide("approve", order);
              })}
              onReject={act(() => {
                actions.decide("reject", order);
              })}
              onResubmit={act(() => {
                actions.resubmit(order);
              })}
              onDiscard={act(() => {
                actions.discard(order);
              })}
            />
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}

export const madeVerb = (action: "created" | "changed" | "deleted") => {
  if (action === "created") return "Added";
  return action === "deleted" ? "Removed" : "Changed";
};

// Everyone who changed a draft, since several people's changes to one record make one draft.
export const makers = (draft: Parameters<typeof makerNames>[0]) =>
  allOf(makerNames(draft));

// What may be done with one draft, in a menu: deciding it, for Approvers, unless it waits for a
// rejected draft it depends on, and resubmitting it once rejected, or discarding it, for those who
// may edit lists.
export function DraftItems({
  canEdit,
  canApprove,
  rejected,
  waits = false,
  othersApprove = false,
  discard = "Discard draft",
  onApprove,
  onReject,
  onResubmit,
  onDiscard,
}: {
  canEdit: boolean;
  canApprove: boolean;
  rejected: boolean;
  waits?: boolean;
  // Changed by this account, whose role does not let it approve its own drafts.
  othersApprove?: boolean;
  discard?: string;
  onApprove: () => void;
  onReject: () => void;
  onResubmit: () => void;
  onDiscard: () => void;
}) {
  const shown = (canApprove && !rejected) || canEdit;
  return (
    <>
      {shown && <Menu.Divider />}
      {/* A rejected draft is back with its makers, until they resubmit it. */}
      {canApprove && !rejected && (
        <>
          <Menu.Item disabled={waits || othersApprove} onClick={onApprove}>
            Approve…
          </Menu.Item>
          {waits && <WaitingNote />}
          {othersApprove && !waits && <OtherApproverNote />}
          <Menu.Item onClick={onReject}>Reject…</Menu.Item>
        </>
      )}
      {canEdit && rejected && (
        <Menu.Item onClick={onResubmit}>Resubmit</Menu.Item>
      )}
      {canEdit && <Menu.Item onClick={onDiscard}>{discard}</Menu.Item>}
    </>
  );
}
