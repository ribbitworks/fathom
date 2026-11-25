// SPDX-License-Identifier: Apache-2.0

// A record's row with its Live row under it, beside live, and the rows of summary tables, such as
// the Lists page's lists or the Releases page's streams: the row selected, retired, or tinted by its
// draft, its first cell with the record's marks and name, and the cell naming its parts, such as a
// list's choices, after the mark of their drafts.

import type { Tier } from "@fathom/shared";
import { Fragment, type ReactElement, type ReactNode } from "react";
import { draftRowClass } from "./list-drafts.tsx";
import { listClasses, recordTableClasses } from "./page-styles.ts";
import {
  DraftedItem,
  DraftedValue,
  LiveRowMarks,
  LiveValue,
  MarkedItem,
  RowMarks,
  useBesideLive,
} from "./status-mark.tsx";
import type { DraftLike } from "./draft-marks.ts";

// A record's row, tinted by its draft beside live, with, beside live, its Live row under it, where a
// draft changes it.
export function RowWithLive({
  className,
  liveClassName,
  tint,
  liveCells,
  rowProps,
  onOpen,
  children,
}: {
  // The row's own classes, and the Live row's, besides the Live tint.
  className: string | undefined;
  liveClassName: string | undefined;
  // The draft the row is tinted by, beside live, when it or anything in it has one.
  tint: { action: string; state?: string } | undefined;
  // The cells of the record's live row, where a draft changes it.
  liveCells?: ReactElement | undefined;
  // Attributes of the row, such as its role.
  rowProps?: Readonly<Record<string, string | undefined>>;
  onOpen?: () => void;
  children: ReactNode;
}) {
  const besideLive = useBesideLive();
  return (
    <>
      <div
        {...rowProps}
        className={[
          className,
          tint === undefined ? "" : draftRowClass(tint, besideLive),
        ].join(" ")}
        onClick={onOpen}
      >
        {children}
      </div>
      {besideLive && liveCells !== undefined && (
        <div
          {...(rowProps?.role === undefined ? {} : { role: rowProps.role })}
          aria-hidden="true"
          className={[liveClassName, recordTableClasses.listLiveRow].join(" ")}
        >
          {liveCells}
        </div>
      )}
    </>
  );
}

// A record's row in a summary table: selected, retired, or tinted by its draft beside live.
export function SummaryRow({
  selected,
  retired,
  tint,
  liveCells,
  rowProps,
  onOpen,
  children,
}: {
  selected: boolean;
  retired: boolean;
  tint: { action: string; state?: string } | undefined;
  liveCells?: ReactElement | undefined;
  // Attributes of the row, such as one telling a click on it from a click outside.
  rowProps?: Readonly<Record<`data-${string}`, string>>;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <RowWithLive
      className={[
        listClasses.listRow,
        selected ? listClasses.selectedRow : "",
        retired ? listClasses.listRowRetired : "",
      ].join(" ")}
      liveClassName={listClasses.listRow}
      tint={tint}
      liveCells={liveCells}
      rowProps={{
        role: "row",
        "aria-current": selected ? "true" : undefined,
        ...rowProps,
      }}
      onOpen={onOpen}
    >
      {children}
    </RowWithLive>
  );
}

// A summary row's first cell: the record's own marks in its slot, then its name, after its dot where
// its draft renames it.
export function SummaryName({
  mark,
  draft,
  heldBy,
  unpublished,
  dataClass,
  facts,
  children,
}: {
  // The record's own mark, as RowMarks takes it.
  mark: DraftLike | undefined;
  // The record's draft, whatever the view.
  draft: (DraftLike & { changed: readonly string[]; live: object }) | undefined;
  heldBy?: string | undefined;
  unpublished?: boolean | undefined;
  dataClass?: Tier | undefined;
  facts?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span role="cell" className={listClasses.listCellName}>
      <RowMarks
        mark={mark}
        heldBy={heldBy}
        unpublished={unpublished}
        facts={facts}
      >
        <DraftedValue
          draft={draft}
          fields={["name"]}
          named="Name"
          dataClass={dataClass}
        >
          {children}
        </DraftedValue>
      </RowMarks>
    </span>
  );
}

// The same cell in the record's Live row.
export function LiveSummaryName({
  marked,
  draft,
  children,
}: {
  // Whether the record's own mark is in the draft row's slot.
  marked: boolean;
  draft: (DraftLike & { changed: readonly string[]; live: object }) | undefined;
  children: ReactNode;
}) {
  return (
    <span role="cell" className={listClasses.listCellName}>
      <LiveRowMarks marked={marked}>
        <LiveValue draft={draft} fields={["name"]}>
          {children}
        </LiveValue>
      </LiveRowMarks>
    </span>
  );
}

// A part of a record, as its summary row names it, and whether a draft takes it away.
export interface SummaryPart {
  id: string;
  name: string;
  removed: boolean;
}

// A record's parts: how many, leaving out those a draft takes away, then their names, those struck
// through, after the mark of the parts' drafts; for a record with none, no count, as an empty cell
// is blank but for its mark.
export function Parts({
  mark,
  parts,
}: {
  mark: DraftLike | undefined;
  parts: readonly SummaryPart[];
}) {
  return (
    <DraftedItem draft={mark}>
      {parts.length > 0 && (
        <>
          <span className={listClasses.listCount}>
            ({parts.filter(({ removed }) => !removed).length})
          </span>{" "}
          {parts.map(({ id, name, removed }, index) => (
            <Fragment key={id}>
              {index > 0 && ", "}
              {removed ? (
                <span className={recordTableClasses.struck}>{name}</span>
              ) : (
                name
              )}
            </Fragment>
          ))}
        </>
      )}
    </DraftedItem>
  );
}

export function PartsCell(props: {
  mark: DraftLike | undefined;
  parts: readonly SummaryPart[];
}) {
  return (
    <span role="cell" className={listClasses.listCell}>
      <Parts {...props} />
    </span>
  );
}

// A record's parts as they are live, after Live's dot where drafts change them.
export function LiveParts({
  marked,
  names,
}: {
  marked: boolean;
  names: readonly string[];
}) {
  return (
    <MarkedItem tone={marked ? "live" : undefined}>
      {names.length > 0 && (
        <>
          <span className={listClasses.listCount}>({names.length})</span>{" "}
          {names.join(", ")}
        </>
      )}
    </MarkedItem>
  );
}

// The same cell in the record's live row.
export function LivePartsCell(props: {
  marked: boolean;
  names: readonly string[];
}) {
  return (
    <span role="cell" className={listClasses.listCell}>
      <LiveParts {...props} />
    </span>
  );
}
