// SPDX-License-Identifier: Apache-2.0

// A part of a project in its details, such as a milestone or an activity: its name after its
// draft's dot, struck through once a draft removes it, a line under it, and its menu.

import type { Asking, DraftKind, RecordRef } from "@fathom/shared";
import { Text } from "@mantine/core";
import type { ReactNode } from "react";
import details from "./record-details.module.css";
import type { PlanRecord, PlanRecordKind } from "./projects.ts";
import { type RecordNode, recordNode } from "./record-drafts.ts";
import { RecordMenu } from "./record-menu.tsx";
import { DraftedItem, MarkRow } from "./status-mark.tsx";

// What a part's menu does with its draft, and removing it.
export interface PartMenu<Part> {
  decide: (asking: Asking, ref: RecordRef) => void;
  discard: (part: Part) => void;
  resubmit: (part: Part) => void;
  remove: (part: Part) => void;
}

// Whether a part may be changed or removed from its menu: not while someone else holds it, nor once a
// draft removes it.
export const changeablePart = (part: PlanRecord) =>
  part.heldBy === undefined && part.draft?.action !== "deleted";

export function PartRow<Part extends PlanRecord>({
  kind,
  part,
  name,
  line,
  canEdit,
  approves,
  nodes,
  menu,
  children,
}: {
  kind: PlanRecordKind;
  part: Part & { name: string };
  // The part's name as shown, such as a link to its details.
  name: ReactNode;
  // What shows under the name, if anything.
  line: ReactNode;
  canEdit: boolean;
  approves: readonly DraftKind[];
  nodes: readonly RecordNode[];
  menu: PartMenu<Part>;
  // The menu's own items, before its draft's.
  children: ReactNode;
}) {
  return (
    <div className={[details.row, details.itemRow].join(" ")}>
      <div>
        <MarkRow>
          <DraftedItem draft={part.draft} heldBy={part.heldBy}>
            <Text
              fz="sm"
              td={part.draft?.action === "deleted" ? "line-through" : undefined}
            >
              {name}
            </Text>
          </DraftedItem>
        </MarkRow>
        {line !== null && (
          <Text fz="xs" c="dimmed">
            {line}
          </Text>
        )}
      </div>
      <RecordMenu
        title={part.name}
        node={recordNode(kind, part, "")}
        canEditDraft={canEdit}
        actions={{
          approves,
          nodes,
          decide: menu.decide,
          resubmit: () => {
            menu.resubmit(part);
          },
          discard: () => {
            menu.discard(part);
          },
        }}
      >
        {children}
      </RecordMenu>
    </div>
  );
}
