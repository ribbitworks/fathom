// SPDX-License-Identifier: Apache-2.0

// A project's or proposal's scope history, in its details: a row for each feature given or removed,
// a draft's first, marked Draft and dated when drafted, then each as approved, newest first,
// with the reason given for removing a feature from a proposal. A row is never removed.

import type {
  Feature,
  Project,
  Proposal,
  RecordDraft,
  Show,
} from "@fathom/shared";
import { Button, Group, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { LoadProblem } from "./load-problem.tsx";
import { livePlanRecords } from "./project-grids.tsx";
import { scopeHistoryQuery } from "./projects.ts";
import { RecordLink } from "./record-details.tsx";
import details from "./record-details.module.css";
import { DraftMark } from "./status-mark.tsx";
import { formatMomentDay } from "./table-view.ts";

type Scoped = Project | Proposal;

const reasonFor = (record: Scoped, featureId: string): string | null =>
  "removalReasons" in record
    ? (new Map(Object.entries(record.removalReasons)).get(featureId) ?? null)
    : null;

// One row of the history: a feature given or removed, dated when the change was drafted, by a draft
// still waiting or as approved.
interface ScopeRow {
  featureId: string;
  name: string | null;
  added: boolean;
  // The draft that makes the change, for a row a draft makes.
  draft?: RecordDraft;
  at: string | null;
  reason: string | null;
}

const rowWords = ({ added, at }: ScopeRow): string => {
  const what = added ? "Added" : "Removed";
  return at === null ? what : `${what} ${formatMomentDay(at)}`;
};

// The features a record's draft gives it and removes from it, each a row dated when the draft last
// changed, with the reason given for a removal from a proposal.
function draftedRows(record: Scoped): ScopeRow[] {
  const { draft } = record;
  if (draft === undefined) return [];
  const live = livePlanRecords([record]).at(0)?.featureIds ?? [];
  const row = (featureId: string, added: boolean): ScopeRow => ({
    featureId,
    name: null,
    added,
    draft,
    at: draft.madeAt,
    reason: added ? null : reasonFor(record, featureId),
  });
  return [
    ...record.featureIds
      .filter((id) => !live.includes(id))
      .map((featureId) => row(featureId, true)),
    ...live
      .filter((id) => !record.featureIds.includes(id))
      .map((featureId) => row(featureId, false)),
  ];
}

export function ScopeHistory({
  type,
  record,
  features,
  show,
  onShow,
  onChangeReason,
}: {
  type: "project" | "proposal";
  // As the plan holds it, with its draft.
  record: Scoped;
  features: readonly Feature[];
  show: Show;
  onShow: (featureId: string) => void;
  // Asks for a new reason for a draft removing a feature from a proposal, for those who may.
  onChangeReason?: ((featureId: string) => void) | undefined;
}) {
  const history = useQuery(scopeHistoryQuery(type, record.id));
  const nameOf = (featureId: string, name: string | null) => {
    const feature = features.find(({ id }) => id === featureId);
    return feature === undefined ? (
      (name ?? "A removed feature")
    ) : (
      <RecordLink
        name={feature.name}
        onShow={() => {
          onShow(featureId);
        }}
      />
    );
  };
  const approved = history.data?.changes;
  const rows: ScopeRow[] = [
    ...(show === "live" ? [] : draftedRows(record)),
    ...(approved ?? []),
  ];
  const changeable =
    onChangeReason !== undefined &&
    record.heldBy === undefined &&
    record.draft?.action !== "deleted";
  return (
    <section aria-labelledby="scope-history">
      <h3 className={details.heading} id="scope-history">
        Scope history
      </h3>
      {history.isError && (
        <LoadProblem
          what="the scope history"
          onRetry={() => {
            void history.refetch();
          }}
        />
      )}
      {approved !== undefined && rows.length === 0 && (
        <Text fz="sm" c="dimmed">
          No features yet
        </Text>
      )}
      <Stack gap={0}>
        {rows.map((row, index) => {
          const { draft } = row;
          return (
            <div
              key={`${row.featureId}-${String(index)}`}
              className={[details.row, details.itemRow].join(" ")}
            >
              <div>
                <Group gap="xs" wrap="nowrap">
                  {draft !== undefined && <DraftMark draft={draft} />}
                  <Text fz="sm">{nameOf(row.featureId, row.name)}</Text>
                </Group>
                <Text fz="xs" c="dimmed">
                  {rowWords(row)}
                </Text>
                {row.reason !== null && (
                  <Text fz="sm">Reason: {row.reason}</Text>
                )}
              </div>
              {draft !== undefined && !row.added && changeable && (
                <Button
                  variant="default"
                  size="compact-xs"
                  onClick={() => {
                    onChangeReason(row.featureId);
                  }}
                >
                  Change reason
                </Button>
              )}
            </div>
          );
        })}
      </Stack>
    </section>
  );
}
