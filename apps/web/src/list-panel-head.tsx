// SPDX-License-Identifier: Apache-2.0

// The head of a list's panel: the list's name and description, marked where drafts change them, and
// the buttons and menu that act on the whole list.

import type { List } from "@fathom/shared";
import { Button } from "@mantine/core";
import type { ReactNode } from "react";
import { type DraftSelection, noDrafts } from "./drafts.ts";
import { ListDraftMenu, type ListDraftActions } from "./list-drafts.tsx";
import { ListFacts } from "./list-facts.tsx";
import { liveLists, withRetiring } from "./lists.ts";
import { RecordKey } from "./record-key.tsx";
import { RightReasonLine, useTurnedOff, WithReason } from "./turned-off.tsx";
import { changedValue, recordMark } from "./draft-marks.ts";
import {
  DraftedItem,
  DraftedValue,
  LiveLine,
  MarkRow,
} from "./status-mark.tsx";

// What a list's panel shows of the list, each marked before it where a draft changes it.
const listFields = new Set(["name", "description"]);

export function ListHeading({
  list,
  original,
  children,
}: {
  list: List;
  // The list with every draft, which the marks are worked out from.
  original: List;
  children: ReactNode;
}) {
  return (
    // The list's own mark, unless its draft only changes its name or description, each marked
    // before it; a new order is marked on each choice it moves.
    <DraftedItem
      draft={
        original.draft === undefined ||
        recordMark(original.draft, listFields) === undefined
          ? undefined
          : withRetiring({ ...original, draft: original.draft })
      }
      heldBy={list.heldBy ?? list.orderHeldBy}
      facts={<ListFacts list={list} />}
    >
      <DraftedValue
        draft={original.draft}
        fields={["name"]}
        named="Name"
        dataClass={list.visibility}
      >
        {children}
      </DraftedValue>
    </DraftedItem>
  );
}

// Change class…, turned off, saying who, while someone else is changing the list.
function ChangeClass({
  heldBy,
  onMoveClass,
}: {
  heldBy: string | undefined;
  onMoveClass: () => void;
}) {
  const { control, line } = useTurnedOff(
    heldBy === undefined ? undefined : `${heldBy} is changing this list`,
    RightReasonLine,
  );
  return (
    <WithReason align="end">
      <Button
        variant="default"
        size="compact-sm"
        {...control}
        onClick={onMoveClass}
      >
        Change class…
      </Button>
      {line}
    </WithReason>
  );
}

export function ListActions({
  list,
  canEdit,
  mayEdit,
  decides,
  waits,
  draftActions,
  onEditList,
  onMoveClass,
}: {
  list: List;
  canEdit: boolean;
  mayEdit: boolean;
  decides: (selection: DraftSelection) => boolean;
  waits: (selection: DraftSelection) => boolean;
  draftActions: ListDraftActions;
  onEditList: () => void;
  onMoveClass?: (() => void) | undefined;
}) {
  return (
    <>
      {canEdit && (
        <Button variant="default" size="compact-sm" onClick={onEditList}>
          Edit list…
        </Button>
      )}
      {onMoveClass &&
        (mayEdit || list.draft?.action !== "created") &&
        list.draft?.action !== "deleted" && (
          <ChangeClass heldBy={list.heldBy} onMoveClass={onMoveClass} />
        )}
      {(list.draft ?? list.orderDraft) && (
        <ListDraftMenu
          list={list}
          orderWaits={waits({ ...noDrafts(), orders: [list.id] })}
          canEdit={mayEdit}
          canApprove={decides({ ...noDrafts(), lists: [list.id] })}
          canApproveOrder={decides({ ...noDrafts(), orders: [list.id] })}
          actions={draftActions}
        />
      )}
    </>
  );
}

export function ListSubtitle({
  list,
  original,
  showLive,
}: {
  list: List;
  original: List;
  showLive: boolean;
}) {
  // The list's description as it is live, which a list only drafted to be added has none of.
  const liveDescription = liveLists([original])[0]?.description ?? "";
  return (
    <>
      <div>
        <RecordKey record={{ kind: "list", keyNumber: list.keyNumber }} />
      </div>
      {list.description !== "" ||
      changedValue(original.draft, "description") !== undefined ? (
        <>
          <MarkRow>
            <DraftedValue
              draft={original.draft}
              fields={["description"]}
              named="Description"
              emptied={list.description === ""}
            >
              {list.description}
            </DraftedValue>
          </MarkRow>
          {showLive &&
            changedValue(list.draft, "description") !== undefined && (
              <LiveLine empty={liveDescription === ""}>
                {liveDescription}
              </LiveLine>
            )}
        </>
      ) : undefined}
    </>
  );
}
