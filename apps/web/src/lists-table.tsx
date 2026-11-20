// SPDX-License-Identifier: Apache-2.0

// The Lists page's table of lists, each row marking its own draft and its choices' drafts.

import { type List, type Show } from "@fathom/shared";
import { Button, Paper } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { recordMark } from "./draft-marks.ts";
import { ListFacts } from "./list-facts.tsx";
import { listMark } from "./list-drafts.tsx";
import { builtInFirst, liveLists, retiredLive } from "./lists.ts";
import { count } from "./numbers.ts";
import classes from "./pages.module.css";
import { DraftedValue, LiveValue, useBesideLive } from "./status-mark.tsx";
import {
  LivePartsCell,
  LiveSummaryName,
  PartsCell,
  SummaryName,
  SummaryRow,
} from "./summary-row.tsx";

export const linkId = (list: { id: string }) => `list-link-${list.id}`;

// What a list's row shows of the list itself, each marked by its own dot where a draft changes it.
const listRowFields = new Set(["name", "description"]);

export function ListsTable({
  lists,
  selected,
  search: address,
  originalOf,
  onOpen,
}: {
  lists: List[];
  selected: string | undefined;
  // The page address's search, kept as lists are opened.
  search: { show?: Show; search?: string };
  // The list with every draft, whatever the view, which its marks are worked out from, so the Draft
  // view decides how they show.
  originalOf: (list: List) => List;
  onOpen: (list: List) => void;
}) {
  const [showRetired, setShowRetired] = useState(false);
  const showLive = useBesideLive();
  // Beside live, a list a draft retires or restores stays where it is live until approved, as one a
  // draft removes stays, struck through.
  const isRetired = (list: List) =>
    showLive ? retiredLive(list) : list.retired;
  const current = builtInFirst(lists.filter((list) => !isRetired(list)));
  const retired = builtInFirst(lists.filter(isRetired));
  // A choice drafted to be removed is struck through, as in the panel, and not counted.
  const removed = (choice: List["choices"][number]) =>
    choice.draft?.action === "deleted";
  const row = (list: List) => {
    const offered = list.choices.filter((choice) => !choice.retired);
    const original = originalOf(list);
    const mark = listMark(original);
    // The list as it is live, under a list whose draft, or whose choices' drafts, change it, as a
    // person's live row is under their draft row: every cell, so like is compared with like.
    const [live] = liveLists([list]);
    const liveOffered = (live?.choices ?? []).filter(
      (choice) => !choice.retired,
    );
    // The list's own draft, marked in the row's slot only where it changes what the row does not
    // show, such as retiring the list, and its choices' and order's drafts, marked before the
    // choices, so each mark is before what changed.
    const slotMark =
      recordMark(original.draft, listRowFields) === undefined
        ? undefined
        : listMark({
            ...original,
            orderDraft: undefined,
            choices: original.choices.map((choice) => ({
              ...choice,
              draft: undefined,
            })),
          });
    const choicesChanged = listMark({ ...original, draft: undefined });
    const choiceParts = offered.map((choice) => ({
      id: choice.id,
      name: choice.label,
      removed: removed(choice),
    }));
    return (
      <SummaryRow
        key={list.id}
        selected={list.id === selected}
        retired={list.retired}
        tint={
          mark === undefined ? undefined : (list.draft ?? { action: "changed" })
        }
        rowProps={{ "data-list-row": "" }}
        onOpen={() => {
          onOpen(list);
        }}
        liveCells={
          live !== undefined &&
          mark !== undefined &&
          list.draft?.action !== "deleted" ? (
            <>
              <LiveSummaryName
                marked={slotMark !== undefined}
                draft={list.draft}
              >
                {live.name}
              </LiveSummaryName>
              <span role="cell" className={classes.listCellDim}>
                <LiveValue
                  draft={list.draft}
                  fields={["description"]}
                  emptied={live.description === "" ? "Description" : undefined}
                >
                  {live.description}
                </LiveValue>
              </span>
              <LivePartsCell
                marked={choicesChanged !== undefined}
                names={liveOffered.map((choice) => choice.label)}
              />
            </>
          ) : undefined
        }
      >
        <SummaryName
          mark={
            slotMark && {
              ...slotMark,
              unpublished: original.draft?.unpublished,
            }
          }
          draft={original.draft}
          unpublished={mark === undefined && original.draft?.unpublished}
          heldBy={list.heldBy}
          dataClass={list.visibility}
          facts={<ListFacts list={list} />}
        >
          <Link
            id={linkId(list)}
            to="/lists/{-$listId}"
            params={{ listId: list.id }}
            search={address}
            className={classes.listLink}
          >
            {list.name}
          </Link>
        </SummaryName>
        <span role="cell" className={classes.listCellDim}>
          <DraftedValue
            draft={original.draft}
            fields={["description"]}
            named="Description"
            emptied={list.description === "" ? "Description" : undefined}
          >
            {list.description}
          </DraftedValue>
        </span>
        <PartsCell mark={choicesChanged} parts={choiceParts} />
      </SummaryRow>
    );
  };
  return (
    <Paper withBorder className={classes.tablePanel}>
      <div role="table" aria-label="Lists" className={classes.listTable}>
        <div role="row" className={classes.listHead}>
          <span role="columnheader">Name</span>
          <span role="columnheader">Description</span>
          <span role="columnheader">Choices</span>
        </div>
        {lists.length === 0 && (
          <div role="row" className={classes.listGroup}>
            <span role="cell" aria-colspan={3}>
              No matching lists
            </span>
          </div>
        )}
        {current.map(row)}
        {showRetired && (
          <>
            <div role="row" className={classes.listGroup}>
              <span role="cell" aria-colspan={3}>
                Retired
              </span>
            </div>
            {retired.map(row)}
          </>
        )}
      </div>
      {retired.length > 0 && (
        <div className={classes.listFoot}>
          <Button
            variant={showRetired ? "light" : "default"}
            color="gray"
            size="compact-sm"
            aria-pressed={showRetired}
            onClick={() => {
              setShowRetired(!showRetired);
            }}
          >
            {showRetired
              ? "Hide retired"
              : `Show retired (${count(retired.length)})`}
          </Button>
        </div>
      )}
    </Paper>
  );
}
