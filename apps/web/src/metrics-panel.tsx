// SPDX-License-Identifier: Apache-2.0

// The Metrics panel beside a table: how many of the rows the view shows fall in each group of a
// column, or of two columns crossed, and what share of those rows each is. Only the columns the
// table has are offered, which are those the user may see. With drafts shown beside live, each
// figure counts the rows as their drafts show them, with the live figure beside it where it
// differs. Esc, from anywhere in the panel, or its close button closes it. Its edge beside the
// table is dragged, or moved with the arrow keys, to resize it, and the width is kept for next
// time.

import {
  ActionIcon,
  FocusTrap,
  NativeSelect,
  SegmentedControl,
  Table,
  Text,
} from "@mantine/core";
import { type ReactNode, useState } from "react";
import { Icon } from "./icons.tsx";
import classes from "./metrics.module.css";
import {
  type Counts,
  countRows,
  type Group,
  groupsFor,
  metricsPanelId,
  metricsTitleId,
  share,
} from "./metrics.ts";
import { count } from "./numbers.ts";
import { useNarrow, WithSidePanel } from "./side-panel.tsx";
import type { TableColumn } from "./table-view.ts";

// A table and the bar above it, with the Metrics panel beside them while it is open.
export function WithMetrics({
  panel,
  children,
}: {
  panel: ReactNode;
  children: ReactNode;
}) {
  return (
    <WithSidePanel
      panel={panel}
      label="Resize metrics"
      controls={metricsPanelId}
      storageKey="fathom-metrics-width"
    >
      {children}
    </WithSidePanel>
  );
}

// Some rows and the columns to read them by.
export interface CountedRows<Row> {
  rows: readonly Row[];
  columns: readonly TableColumn<Row>[];
}

// A figure, with the live one beside it when it differs.
function Figure({ now, live }: { now: string; live: string | undefined }) {
  return (
    <>
      {now}
      {live !== undefined && live !== now && (
        <Text component="span" fz="xs" c="dimmed" className={classes.live}>
          Live {live}
        </Text>
      )}
    </>
  );
}

type Measure = "count" | "share";

export function MetricsPanel<Row>({
  one,
  noun,
  kinds,
  rows,
  live,
  offered,
  breakdown,
  onBreakdown,
  onClose,
}: {
  // What the rows are, one and several, such as "person" and "people".
  one: string;
  noun: string;
  // For rows of several kinds, what they are called together, such as "people and planned hires",
  // and how many of each a count holds, such as "150 people and 6 planned hires".
  kinds?:
    { noun: string; counted: (rows: readonly Row[]) => string } | undefined;
  // The rows the view shows, as the table shows them, leaving out any drafted to be removed.
  rows: readonly Row[];
  // With drafts shown beside live, the same rows as they are live, and the columns as they are
  // live; a column without a live copy has no live figures.
  live?: CountedRows<Row> | undefined;
  // The columns rows may be broken down by.
  offered: readonly TableColumn<Row>[];
  breakdown: readonly string[];
  onBreakdown: (keys: string[]) => void;
  onClose: () => void;
}) {
  const narrow = useNarrow();
  const [measure, setMeasure] = useState<Measure>("count");
  const by = breakdown.flatMap((key) =>
    offered.filter((column) => column.key === key),
  );
  const liveBy = by.flatMap((column) =>
    (live?.columns ?? []).filter(({ key }) => key === column.key),
  );
  const counts = countRows(rows, by);
  const liveCounts =
    live && liveBy.length === by.length
      ? countRows(live.rows, liveBy)
      : undefined;
  const rowsLabel = (counted: readonly Row[]) =>
    kinds?.counted(counted) ??
    `${count(counted.length)} ${counted.length === 1 ? one : noun}`;
  const capitalNoun =
    kinds === undefined
      ? noun.charAt(0).toUpperCase() + noun.slice(1)
      : "Count";

  // The groups of one of the columns broken down by, at its place among them.
  const groupsAt = (column: TableColumn<Row>, index: number): Group[] =>
    groupsFor(column, (group) => {
      const pick = by.map((_, at) => (at === index ? group : undefined));
      return counts.of(pick) > 0 || (liveCounts?.of(pick) ?? 0) > 0;
    });

  // A live share is of the live rows.
  const figure = (pick: (string | undefined)[], measured: Measure) => {
    const format = (of: Counts) =>
      measured === "count" ? count(of.of(pick)) : share(of.of(pick), of.rows);
    return (
      <Figure now={format(counts)} live={liveCounts && format(liveCounts)} />
    );
  };

  const [first, second] = by;
  const picker = (
    label: string,
    none: string,
    picked: TableColumn<Row> | undefined,
    choices: typeof offered,
    onPick: (key: string | undefined) => void,
  ) => (
    <NativeSelect
      label={label}
      size="sm"
      data={[
        { value: "", label: none },
        ...choices.map((column) => ({
          value: column.key,
          label: column.label,
        })),
      ]}
      value={picked?.key ?? ""}
      onChange={(event) => {
        onPick(event.currentTarget.value || undefined);
      }}
    />
  );

  let body;
  if (first === undefined) {
    body = (
      <Text fz="sm" c="dimmed">
        Choose a column to count {kinds?.noun ?? noun} by its values.
      </Text>
    );
  } else if (second === undefined) {
    body = (
      <>
        <Table className={classes.figures} tabularNums>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{first.label}</Table.Th>
              <Table.Th className={classes.number}>{capitalNoun}</Table.Th>
              <Table.Th className={classes.number}>Share</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {groupsAt(first, 0).map((group) => (
              <Table.Tr key={group.id}>
                <Table.Th scope="row" className={classes.groupName}>
                  {group.label}
                </Table.Th>
                <Table.Td className={classes.number}>
                  {figure([group.id], "count")}
                </Table.Td>
                <Table.Td className={classes.number}>
                  {figure([group.id], "share")}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {first.multiple && (
          <Text fz="xs" c="dimmed" mt="xs">
            A {one} may hold several choices of {first.label}, so shares can add
            up to more than 100%.
          </Text>
        )}
      </>
    );
  } else {
    const columnsGroups = groupsAt(second, 1);
    body = (
      <>
        <SegmentedControl
          size="xs"
          mb="sm"
          aria-label="Show figures as"
          value={measure}
          onChange={(value) => {
            setMeasure(value);
          }}
          data={[
            { value: "count", label: "Count" },
            { value: "share", label: "Share" },
          ]}
        />
        <div className={classes.crossed}>
          <Table className={classes.figures} tabularNums>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>
                  {first.label} by {second.label}
                </Table.Th>
                {columnsGroups.map((group) => (
                  <Table.Th key={group.id} className={classes.number}>
                    {group.label}
                  </Table.Th>
                ))}
                <Table.Th className={classes.number}>All</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {[...groupsAt(first, 0), undefined].map((row) => (
                <Table.Tr key={row?.id ?? "all"}>
                  <Table.Th scope="row" className={classes.groupName}>
                    {row?.label ?? "All"}
                  </Table.Th>
                  {[...columnsGroups, undefined].map((column) => (
                    <Table.Td
                      key={column?.id ?? "all"}
                      className={classes.number}
                    >
                      {figure([row?.id, column?.id], measure)}
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
        {(first.multiple || second.multiple) && (
          <Text fz="xs" c="dimmed" mt="xs">
            A {one} may hold several choices of{" "}
            {first.multiple ? first.label : second.label}, so figures can add up
            to more than their total.
          </Text>
        )}
      </>
    );
  }

  return (
    <FocusTrap active={narrow}>
      <section
        id={metricsPanelId}
        className={narrow ? classes.panelNarrow : classes.panel}
        aria-labelledby={metricsTitleId}
        // Covering the table on a narrow screen, it holds focus until it is closed.
        {...(narrow ? { role: "dialog", "aria-modal": true } : {})}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || event.defaultPrevented) return;
          event.preventDefault();
          onClose();
        }}
      >
        <div className={classes.head}>
          <h2 id={metricsTitleId} className={classes.title} tabIndex={-1}>
            Metrics
          </h2>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Close metrics"
            onClick={onClose}
          >
            <Icon name="close" />
          </ActionIcon>
        </div>
        <div className={classes.body}>
          {/* The bar above the table announces how many rows are shown as they change. */}
          <Text fz="sm" c="dimmed" mb="sm">
            {rowsLabel(rows)}
            {live !== undefined && " with drafts"}
            {live !== undefined &&
              live.rows.length !== rows.length &&
              `, ${count(live.rows.length)} live`}
          </Text>
          <div className={classes.pickers}>
            {picker(
              "Break down by",
              "Choose a column",
              first,
              offered,
              (key) => {
                onBreakdown(
                  key === undefined
                    ? []
                    : [key, ...by.slice(1).map((column) => column.key)].filter(
                        (picked, at, keys) => keys.indexOf(picked) === at,
                      ),
                );
              },
            )}
            {first !== undefined &&
              picker(
                "and by",
                "Nothing more",
                second,
                offered.filter((column) => column.key !== first.key),
                (key) => {
                  onBreakdown(
                    key === undefined ? [first.key] : [first.key, key],
                  );
                },
              )}
          </div>
          {body}
        </div>
      </section>
    </FocusTrap>
  );
}
