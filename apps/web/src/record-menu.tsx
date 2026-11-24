// SPDX-License-Identifier: Apache-2.0

// A menu for a record shown outside a table, as on Releases and in a project's panel: what may be
// done to the record, given as its children, then its draft, with who made it and what may be done
// with it.

import type { Asking, DraftKind, RecordRef } from "@fathom/shared";
import { Menu } from "@mantine/core";
import type { ReactNode } from "react";
import {
  HeldNote,
  MenuDraftLines,
  MenuTitle,
  UnpublishedNote,
} from "./draft-details.tsx";
import { decidable, noDrafts, waitsForRejected } from "./drafts.ts";
import { DraftItems, madeVerb, makers } from "./list-drafts.tsx";
import type { Phrase } from "./phrase.tsx";
import type { RecordNode } from "./record-drafts.ts";
import { PanelMoreMenu } from "./panel-menu.tsx";
import { actionsFor } from "./row-controls.tsx";

export interface RecordMenuActions {
  // The kinds of draft the user's role approves and rejects.
  approves: readonly DraftKind[];
  nodes: readonly RecordNode[];
  decide: (asking: Asking, ref: RecordRef) => void;
  resubmit: (ref: RecordRef) => void;
  discard: (ref: RecordRef) => void;
  // How the user's own unpublished draft is published, where it can be.
  publish?: ((ref: RecordRef) => void) | undefined;
}

// A record's menu: what may be done to it, then its draft, with who made it and what may be done
// with it. An empty space keeps the column when it would offer nothing.
export function RecordMenu({
  title,
  node,
  canEditDraft,
  actions,
  lines,
  children,
}: {
  title: string;
  node: RecordNode;
  // What the draft changes, where saying who made it is not enough.
  lines?: readonly Phrase[];
  // Whether the user may discard or resubmit the record's draft.
  canEditDraft: boolean;
  actions: RecordMenuActions;
  children?: ReactNode;
}) {
  const { draft, heldBy, ref } = node;
  const { publish } = actions;
  const waits =
    draft?.state === "waiting" &&
    waitsForRejected({ ...noDrafts(), records: [ref] }, [], {
      fields: [],
      records: actions.nodes,
    });
  if (children === undefined && draft === undefined) return <span />;
  return (
    <PanelMoreMenu label={actionsFor(title)}>
      <MenuTitle>{title}</MenuTitle>
      {children}
      {draft && (
        <>
          {children !== undefined && <Menu.Divider />}
          <MenuDraftLines
            draft={draft}
            lines={lines ?? [[`${madeVerb(draft.action)} by ${makers(draft)}`]]}
            divider={false}
          />
          {heldBy !== undefined && <HeldNote by={heldBy} />}
          {draft.unpublished === true && <UnpublishedNote />}
          <DraftItems
            canEdit={canEditDraft && heldBy === undefined}
            canApprove={actions.approves.includes(ref.type) && decidable(node)}
            othersApprove={draft.needsOtherApprover === true}
            rejected={draft.state === "rejected"}
            waits={waits}
            onApprove={() => {
              actions.decide("approve", ref);
            }}
            onReject={() => {
              actions.decide("reject", ref);
            }}
            onPublish={
              publish !== undefined && draft.unpublished === true
                ? () => {
                    publish(ref);
                  }
                : undefined
            }
            onResubmit={() => {
              actions.resubmit(ref);
            }}
            onDiscard={() => {
              actions.discard(ref);
            }}
          />
        </>
      )}
    </PanelMoreMenu>
  );
}
