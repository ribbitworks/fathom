// SPDX-License-Identifier: Apache-2.0

// The Metrics panel beside a table: its rows counted, shared out and added up by one column's
// groups or two crossed.

import {
  CheckIcon,
  SegmentedControl,
  Select,
  Table,
  Text,
} from "@mantine/core";
import { useState } from "react";
import { inSentence } from "./draft-marks.ts";
import { MarkedItem } from "./status-mark.tsx";
import classes from "./metrics.module.css";
import { numberShown } from "./cell-kinds.tsx";
import { exportHeading } from "./exports.ts";
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
import { SidePanelFrame, useNarrow } from "./side-panel.tsx";
import { Tipped } from "./table-tips.tsx";
import type { TableColumn } from "./table-view.ts";

// Some rows and the columns to read them by.
export interface CountedRows<Row> {
  rows: readonly Row[];
  columns: readonly TableColumn<Row>[];
}

// A figure, with the live one beside it when it differs, after Live's green dot.
function Figure({ now, live }: { now: string; live: string | undefined }) {
  return (
    <>
      {now}
      {live !== undefined && live !== now && (
        <Text component="span" fz="xs" c="dimmed" className={classes.live}>
          <MarkedItem tone="live">{live}</MarkedItem>
        </Text>
      )}
    </>
  );
}

// A column's name ending in an s, but not in ss, is, or us, is taken as plural; Fathom keeps no
// plural for a column's name, so another reads as its choices.
const isPlural = (name: string) => /(?<![siu])s$/u.test(name);

function CountsInEach({ one, name }: { one: string; name: string }) {
  const named = inSentence(name);
  return (
    <Text fz="xs" c="dimmed" mt="xs">
      A {one} in several {isPlural(name) ? named : `${named} choices`} counts in
      each.
    </Text>
  );
}

type Measure = "count" | "share" | "sum";

// What a column added up is called in the panel, as in an export: its name, and its unit's code,
// such as Effort (PD).
const addedLabel = exportHeading;

// A total or an average as the column shows its numbers.
const amountShown = (column: TableColumn<never>, amount: number) =>
  column.sum?.shown?.(amount) ?? numberShown(column, amount);

export function MetricsPanel<Row>({
  one,
  noun,
  kinds,
  rows,
  live,
  offered,
  breakdown,
  onBreakdown,
  summable,
  sum,
  onSum,
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
  // The number columns that may be added up, and the key of the one that is, or empty for none.
  summable: readonly TableColumn<Row>[];
  sum: string;
  onSum: (key: string) => void;
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
  const added = summable.find((column) => column.key === sum);
  const liveAdded = live?.columns.find((column) => column.key === added?.key);
  const counts = countRows(rows, by, added);
  const liveCounts =
    live && liveBy.length === by.length
      ? countRows(live.rows, liveBy, liveAdded)
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
    groupsFor(
      column,
      (group) => {
        const pick = by.map((_, at) => (at === index ? group : undefined));
        return counts.of(pick) > 0 || (liveCounts?.of(pick) ?? 0) > 0;
      },
      new Set([...counts.seen(index), ...(liveCounts?.seen(index) ?? [])]),
    );

  // A total or an average shown, blank where no row has an amount, as an empty cell is.
  const amount = (summed: number | undefined) =>
    added === undefined || summed === undefined
      ? ""
      : amountShown(added, summed);

  // A live share is of the live rows. A total adds the amounts of the rows that have one, an average
  // is of those rows, and None counts the rest, blank when there are none.
  const figure = (
    pick: (string | undefined)[],
    measured: Measure | "average" | "none",
  ) => {
    const format = (of: Counts) => {
      const { total, valued } = of.summed(pick);
      switch (measured) {
        case "count":
          return count(of.of(pick));
        case "share":
          return share(of.of(pick), of.rows);
        case "sum":
          return amount(valued === 0 ? undefined : total);
        case "average":
          return amount(valued === 0 ? undefined : total / valued);
        case "none": {
          const missing = of.of(pick) - valued;
          return missing === 0 ? "" : count(missing);
        }
      }
    };
    return (
      <Figure now={format(counts)} live={liveCounts && format(liveCounts)} />
    );
  };
  const allLabel = `All ${kinds?.noun ?? noun}`;
  const measures: readonly (Measure | "average" | "none")[] =
    added === undefined
      ? ["count", "share"]
      : ["count", "share", "sum", "average", "none"];
  // A group's row of figures, or the whole's, under its name.
  const figuresRow = (group: string | undefined, label: string) => (
    <>
      <Table.Th scope="row" className={classes.groupName}>
        {label}
      </Table.Th>
      {measures.map((measured) => (
        <Table.Td key={measured} className={classes.number}>
          {figure([group], measured)}
        </Table.Td>
      ))}
    </>
  );

  const [first, second] = by;
  const picker = ({
    label,
    none,
    picked,
    choices,
    onPick,
    choiceLabel = ({ label: name }) => name,
  }: {
    label: string;
    none: string;
    picked: TableColumn<Row> | undefined;
    choices: typeof offered;
    onPick: (key: string | undefined) => void;
    choiceLabel?: (column: TableColumn<Row>) => string;
  }) => {
    const shown = picked === undefined ? none : choiceLabel(picked);
    return (
      // A drop-down list that opens on Enter, and cuts a long name short rather than widening the
      // panel, as the browser's own list does neither.
      <Select
        label={label}
        size="sm"
        title={shown}
        styles={{ input: { textOverflow: "ellipsis" } }}
        data={[
          { value: "", label: none },
          ...choices.map((column) => ({
            value: column.key,
            label: choiceLabel(column),
          })),
        ]}
        value={picked?.key ?? ""}
        onChange={(value) => {
          onPick(value || undefined);
        }}
        renderOption={({ option, checked }) => (
          <span className={classes.choice}>
            {checked === true && <CheckIcon className={classes.tick} />}
            <Tipped tip={option.label} className={classes.choiceName}>
              {option.label}
            </Tipped>
          </span>
        )}
      />
    );
  };

  let body;
  if (first === undefined) {
    body = undefined;
  } else if (second === undefined) {
    body = (
      <>
        <div className={classes.wide}>
          <Table className={classes.figures} tabularNums>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{first.label}</Table.Th>
                <Table.Th className={classes.number}>{capitalNoun}</Table.Th>
                <Table.Th className={classes.number}>Share</Table.Th>
                {added !== undefined && (
                  <>
                    <Table.Th className={classes.number}>
                      <Tipped
                        tip={addedLabel(added)}
                        className={classes.measuredName}
                      >
                        {addedLabel(added)}
                      </Tipped>
                    </Table.Th>
                    <Table.Th className={classes.number}>Average</Table.Th>
                    <Table.Th className={classes.number}>None</Table.Th>
                  </>
                )}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {groupsAt(first, 0).map((group) => (
                <Table.Tr key={group.id}>
                  {figuresRow(group.id, group.label)}
                </Table.Tr>
              ))}
            </Table.Tbody>
            <Table.Tfoot>
              <Table.Tr>{figuresRow(undefined, allLabel)}</Table.Tr>
            </Table.Tfoot>
          </Table>
        </div>
        {first.multiple && <CountsInEach one={one} name={first.label} />}
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
          value={measure === "sum" && added === undefined ? "count" : measure}
          onChange={(value) => {
            setMeasure(value as Measure);
          }}
          data={[
            { value: "count", label: "Count" },
            { value: "share", label: "Share" },
            ...(added === undefined
              ? []
              : [{ value: "sum", label: addedLabel(added) }]),
          ]}
        />
        <div className={classes.wide}>
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
                      {figure(
                        [row?.id, column?.id],
                        measure === "sum" && added === undefined
                          ? "count"
                          : measure,
                      )}
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
        {(first.multiple || second.multiple) && (
          <CountsInEach
            one={one}
            name={(first.multiple ? first : second).label}
          />
        )}
      </>
    );
  }

  return (
    <SidePanelFrame
      id={metricsPanelId}
      titleId={metricsTitleId}
      title="Metrics"
      narrow={narrow}
      close={{ label: "Close metrics", onClose }}
    >
      {/* The bar above the table announces how many rows are shown as they change. */}
      <Text fz="sm" c="dimmed" mb="sm">
        {rowsLabel(rows)}
        {live !== undefined && " with drafts"}
        {live !== undefined &&
          live.rows.length !== rows.length &&
          `, ${count(live.rows.length)} live`}
      </Text>
      <div className={classes.pickers}>
        {picker({
          label: "Break down by",
          none: "Choose a column",
          picked: first,
          choices: offered,
          onPick: (key) => {
            onBreakdown(
              key === undefined
                ? []
                : [key, ...by.slice(1).map((column) => column.key)].filter(
                    (picked, at, keys) => keys.indexOf(picked) === at,
                  ),
            );
          },
        })}
        {first !== undefined &&
          picker({
            label: "and by",
            none: "Nothing more",
            picked: second,
            choices: offered.filter((column) => column.key !== first.key),
            onPick: (key) => {
              onBreakdown(key === undefined ? [first.key] : [first.key, key]);
            },
          })}
        {first !== undefined &&
          summable.length > 0 &&
          picker({
            label: "Measure",
            none: "Nothing",
            picked: added,
            choices: summable,
            onPick: (key) => {
              onSum(key ?? "");
            },
            choiceLabel: addedLabel,
          })}
      </div>
      {body}
    </SidePanelFrame>
  );
}
