// SPDX-License-Identifier: Apache-2.0

// A project's or proposal's scope history, in its details: a row for each feature given or removed,
// a draft's first, after its dot and dated when drafted, then each as approved, newest first,
// with the reason given for removing a feature from a proposal, which a pencil changes in place while
// the removal is a draft. A row is never removed.

import {
  type Feature,
  type Project,
  projectLengths,
  type Proposal,
  type RecordDraft,
  type Show,
} from "@fathom/shared";
import { ActionIcon, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { focusSoon } from "./focus.ts";
import { LoadProblem } from "./load-problem.tsx";
import { livePlanRecords } from "./plan-table.tsx";
import { scopeHistoryQuery } from "./projects.ts";
import { changeButton, opensOnClick, RecordLink } from "./record-details.tsx";
import details from "./record-details.module.css";
import { ValueField } from "./record-editing.tsx";
import { DraftedItem } from "./status-mark.tsx";
import { formatMomentDay } from "./day-formats.ts";

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

const fieldId = "scope-reason-field";

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
  // Saves the reason for a draft removing a feature from a proposal, for those who may change it.
  onChangeReason?:
    ((featureId: string, reason: string | null) => void) | undefined;
}) {
  const history = useQuery(scopeHistoryQuery(type, record.id));
  // Held with its record, so a box left open closes when another record's details are shown.
  const [editing, setEditing] = useState<{
    recordId: string;
    featureId: string;
    text: string;
  }>();
  const featureOf = (featureId: string) =>
    features.find(({ id }) => id === featureId);
  const nameOf = (featureId: string, name: string | null) => {
    const feature = featureOf(featureId);
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
  const changeId = (featureId: string) => `scope-reason-change-${featureId}`;
  // A drafted row carries no name of its own, so a feature gone from the plan reads as removed.
  const removalOf = (row: ScopeRow) =>
    `removing ${featureOf(row.featureId)?.name ?? "a removed feature"}`;
  const start = (row: ScopeRow) => {
    setEditing({
      recordId: record.id,
      featureId: row.featureId,
      text: row.reason ?? "",
    });
    focusSoon(fieldId);
  };
  const stop = (featureId: string) => {
    setEditing(undefined);
    focusSoon(changeId(featureId));
  };
  const finish = (row: ScopeRow, text: string) => {
    const reason = text.trim() === "" ? null : text.trim();
    if (reason !== row.reason) onChangeReason?.(row.featureId, reason);
  };
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
          None
        </Text>
      )}
      <Stack gap={0}>
        {rows.map((row, index) => {
          const { draft } = row;
          const canChange = draft !== undefined && !row.added && changeable;
          const open =
            canChange &&
            editing?.recordId === record.id &&
            editing.featureId === row.featureId;
          const opening =
            canChange && !open
              ? () => {
                  start(row);
                }
              : undefined;
          return (
            <div
              key={`${row.featureId}-${String(index)}`}
              className={[
                details.row,
                details.itemRow,
                opening === undefined ? "" : details.editable,
              ].join(" ")}
              onClick={opensOnClick(opening)}
            >
              <div>
                <Text fz="sm">
                  <DraftedItem draft={draft}>
                    {nameOf(row.featureId, row.name)}
                  </DraftedItem>
                </Text>
                <Text fz="xs" c="dimmed">
                  {rowWords(row)}
                </Text>
                {open ? (
                  <ValueField
                    id={fieldId}
                    label={`Reason for ${removalOf(row)}`}
                    clearLabel="Clear the reason"
                    text={editing.text}
                    maxLength={projectLengths.removalReason}
                    onText={(text) => {
                      setEditing({ ...editing, text });
                    }}
                    onEnter={() => {
                      finish(row, editing.text);
                      stop(row.featureId);
                    }}
                    onCancel={() => {
                      stop(row.featureId);
                    }}
                    onLeave={() => {
                      finish(row, editing.text);
                      setEditing(undefined);
                    }}
                  />
                ) : (
                  row.reason !== null && (
                    <Text fz="sm">Reason: {row.reason}</Text>
                  )
                )}
              </div>
              {opening !== undefined && (
                <ActionIcon
                  id={changeId(row.featureId)}
                  {...changeButton(`reason for ${removalOf(row)}`)}
                  onClick={opening}
                />
              )}
            </div>
          );
        })}
      </Stack>
    </section>
  );
}
