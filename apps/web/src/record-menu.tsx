// SPDX-License-Identifier: Apache-2.0

// A menu for a record shown outside a table, as on Releases and in a project's panel: what may be
// done to the record, given as its children, then its draft, with who made it and what may be done
// with it.

import type { Asking, DraftKind, RecordRef } from "@fathom/shared";
import { ActionIcon, Menu } from "@mantine/core";
import { type ReactNode, useState } from "react";
import { closesOnBlankClick } from "./app-menu.tsx";
import {
  HeldNote,
  MenuDraftLines,
  MenuTitle,
  UnpublishedNote,
} from "./draft-details.tsx";
import { decidable, noDrafts, waitsForRejected } from "./drafts.ts";
import { Icon } from "./icons.tsx";
import { DraftItems, madeVerb, makers } from "./list-drafts.tsx";
import type { RecordNode } from "./record-drafts.ts";

export interface RecordMenuActions {
  // The kinds of draft the user's role approves and rejects.
  approves: readonly DraftKind[];
  nodes: readonly RecordNode[];
  decide: (asking: Asking, ref: RecordRef) => void;
  resubmit: (ref: RecordRef) => void;
  discard: (ref: RecordRef) => void;
}

// A record's menu: what may be done to it, then its draft, with who made it and what may be done
// with it. An empty space keeps the column when it would offer nothing.
export function RecordMenu({
  id,
  title,
  node,
  canEditDraft,
  actions,
  children,
}: {
  id?: string;
  title: string;
  node: RecordNode;
  // Whether the user may discard or resubmit the record's draft.
  canEditDraft: boolean;
  actions: RecordMenuActions;
  children?: ReactNode;
}) {
  const [opened, setOpened] = useState(false);
  const { draft, heldBy, ref } = node;
  const act = (run: () => void) => () => {
    setOpened(false);
    run();
  };
  const waits =
    draft?.state === "waiting" &&
    waitsForRejected({ ...noDrafts(), records: [ref] }, [], {
      fields: [],
      records: actions.nodes,
    });
  if (children === undefined && draft === undefined) return <span />;
  return (
    <Menu
      opened={opened}
      onChange={setOpened}
      closeOnItemClick={false}
      position="bottom-end"
      width={260}
    >
      <Menu.Target>
        <ActionIcon
          // Menus give their buttons ids of their own, so the button is found by this instead.
          data-record-menu={id}
          variant="subtle"
          color="gray"
          aria-label={`Menu of ${title}`}
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
        <MenuTitle>{title}</MenuTitle>
        {children !== undefined && (
          <div
            onClickCapture={() => {
              setOpened(false);
            }}
          >
            {children}
          </div>
        )}
        {draft && (
          <>
            {children !== undefined && <Menu.Divider />}
            <MenuDraftLines
              draft={draft}
              lines={[[`${madeVerb(draft.action)} by ${makers(draft)}`]]}
              divider={false}
            />
            {heldBy !== undefined && <HeldNote by={heldBy} />}
            {draft.unpublished === true && <UnpublishedNote />}
            <DraftItems
              canEdit={canEditDraft && heldBy === undefined}
              canApprove={
                actions.approves.includes(ref.type) && decidable(node)
              }
              othersApprove={draft.needsOtherApprover === true}
              rejected={draft.state === "rejected"}
              waits={waits}
              onApprove={act(() => {
                actions.decide("approve", ref);
              })}
              onReject={act(() => {
                actions.decide("reject", ref);
              })}
              onResubmit={act(() => {
                actions.resubmit(ref);
              })}
              onDiscard={act(() => {
                actions.discard(ref);
              })}
            />
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
