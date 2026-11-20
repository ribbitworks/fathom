// SPDX-License-Identifier: Apache-2.0

// A draft's details beside the Drafts table.

import { Button, Group, Stack, Text } from "@mantine/core";
import { useEffect } from "react";
import { heldWords, unpublishedWords, waitingWords } from "./draft-details.tsx";
import type { ReactNode } from "react";
import type { NamedDraft } from "./draft-entries.ts";
import { placeKey } from "./draft-places.ts";
import { areaWords, type DraftRow } from "./drafts-table.tsx";
import { focusSoon } from "./focus.ts";
import { PhraseList } from "./phrase.tsx";
import type { Column } from "./record-table.ts";
import {
  type RecordLinkItem,
  RecordLinkList,
  RecordSection,
  Row,
} from "./record-details.tsx";
import { KeyedName, RecordKey } from "./record-key.tsx";
import { SidePanelFrame, sidePanelScroll } from "./side-panel.tsx";
import { DraftedItem, FactBox } from "./status-mark.tsx";

export const draftPanelId = "draft-panel";
const titleId = "draft-panel-title";

// The row naming the other drafts a decision takes with it.
const relatedColumn = (count: number) => ({
  key: "related",
  label: count === 1 ? "Draft" : "Drafts",
  kind: "text" as const,
  multiple: false,
  choices: [],
  required: false,
});

// The row naming the user's own changes published and discarded only with this one.
const linkedColumn = (count: number) => ({
  ...relatedColumn(count),
  key: "linked",
  label: count === 1 ? "Change" : "Changes",
});

// One of one's own changes linked to another, which opens its own details.
export type LinkedDraft = Omit<RecordLinkItem, "name"> & NamedDraft;

// What may be done with a draft from its details: deciding it, for a role that may now.
export interface DraftActions {
  approve: () => void;
  reject: () => void;
}

// Why a draft can't be decided by this account now, if it can't, with no decision offered: why
// nothing can be done yet. With one, a draft this account changed already reads Needs another
// approver in its details, so nothing more is said.
function whyNot(
  row: DraftRow,
  {
    decides,
    approves,
    waits,
  }: Record<"decides" | "approves" | "waits", boolean>,
): string | undefined {
  const { entry } = row;
  if (decides) return undefined;
  if (entry.unpublished) return unpublishedWords;
  if (entry.heldBy !== undefined) return heldWords(entry.heldBy);
  if (entry.state === "rejected") {
    return `Back with ${entry.who} to change and resubmit.`;
  }
  if (!approves) return `This role doesn't approve ${areaWords(entry.kind)}.`;
  return waits ? waitingWords : undefined;
}

export function DraftPanel({
  row,
  columns,
  related,
  linked = [],
  actions,
  approves,
  waits,
  narrow,
  recordLink,
  onClose,
}: {
  row: DraftRow;
  columns: readonly Column<DraftRow, never>[];
  // The other drafts deciding this one would take with it, named: those approved with it while it
  // waits, or those waiting on it once rejected.
  related: readonly NamedDraft[];
  // For one's own unpublished change, the others of one's own it is published and discarded with.
  linked?: readonly LinkedDraft[];
  // Present while this role may decide the draft now.
  actions: DraftActions | undefined;
  // Whether this role decides drafts of the draft's kind.
  approves: boolean;
  // Whether it waits for a rejected draft it depends on to be resubmitted.
  waits: boolean;
  narrow: boolean;
  // The link to its record on its own page, for a role that opens that page.
  recordLink: ReactNode;
  onClose: () => void;
}) {
  const { entry } = row;
  const key = placeKey(entry.place);
  // Opening a draft puts focus on its record's name in the panel.
  useEffect(() => {
    focusSoon(titleId);
  }, [row.id]);
  const why = whyNot(row, {
    decides: actions !== undefined,
    approves,
    waits,
  });
  return (
    <SidePanelFrame
      id={draftPanelId}
      titleId={titleId}
      title={
        <span>
          <DraftedItem draft={row.draft} heldBy={row.heldBy}>
            {row.record}
          </DraftedItem>
          {row.facts.map((fact) => (
            <span key={fact}>
              {" "}
              <FactBox>{fact}</FactBox>
            </span>
          ))}
        </span>
      }
      {...(key === undefined ? {} : { subtitle: <RecordKey record={key} /> })}
      narrow={narrow}
      close={{ label: "Close details", onClose }}
    >
      <div className={sidePanelScroll}>
        <Stack gap="lg">
          <RecordSection id="draft-details" title="Details">
            {columns
              .filter(({ key }) => key !== "record")
              .map((column) => (
                <Row key={column.key} column={column} value={column.value(row)}>
                  {column.key === "changes" && entry.details.length > 0 ? (
                    <Text>
                      <PhraseList phrases={entry.details} />
                    </Text>
                  ) : undefined}
                </Row>
              ))}
          </RecordSection>
          {related.length > 0 && (
            <RecordSection
              id="draft-related"
              title={
                entry.state === "rejected"
                  ? "Waiting on it"
                  : "Approved with it"
              }
            >
              <Row
                column={relatedColumn(related.length)}
                value={related.map(({ name }) => name).join(", ")}
              >
                <Stack gap={0}>
                  {related.map(({ name, key: relatedKey }) => (
                    <Text key={name}>
                      <KeyedName record={relatedKey} name={name} />
                    </Text>
                  ))}
                </Stack>
              </Row>
            </RecordSection>
          )}
          {linked.length > 0 && (
            <RecordSection id="draft-linked" title="Linked to">
              <Row
                column={linkedColumn(linked.length)}
                value={linked.map(({ name }) => name).join(", ")}
              >
                <RecordLinkList
                  links={linked.map(({ id, name, key: linkedKey, onShow }) => ({
                    id,
                    name: <KeyedName record={linkedKey} name={name} />,
                    onShow,
                  }))}
                />
              </Row>
            </RecordSection>
          )}
          <Stack gap="xs" align="flex-start">
            {actions !== undefined && (
              <Group gap="xs">
                <Button
                  disabled={entry.needsOtherApprover}
                  onClick={actions.approve}
                >
                  Approve…
                </Button>
                <Button variant="default" onClick={actions.reject}>
                  Reject…
                </Button>
              </Group>
            )}
            {why !== undefined && (
              <Text fz="sm" c="dimmed">
                {why}
              </Text>
            )}
            {recordLink}
          </Stack>
        </Stack>
      </div>
    </SidePanelFrame>
  );
}
