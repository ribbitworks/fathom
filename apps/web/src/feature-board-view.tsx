// SPDX-License-Identifier: Apache-2.0

// The Features Board: months or one schedule's cycles across, the view's grouping as its rows, and a
// card for each feature.

import {
  type Cycle,
  type Feature,
  type PlanChoices,
  type ReleaseStream,
  type CardPart,
} from "@fathom/shared";
import { Button, Group, Paper, Text } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { type KeyboardEvent, useState } from "react";
import { AppMenu, MenuChoices, MenuToggle } from "./app-menu.tsx";
import {
  type BoardColumn,
  boardLayout,
  cardOrder,
  boardMenuWords,
  cardPartLabels,
  cyclesOf,
  monthsOf,
  shownParts,
  wholeColumnWidth,
} from "./feature-board.ts";
import { ColouredName } from "./colour-swatch.tsx";
import { cardId, FeatureCard, LiveCard } from "./feature-card.tsx";
import classes from "./feature-board-view.module.css";
import pages from "./pages.module.css";
import type { ShownRows } from "./record-table.ts";
import {
  draftsById,
  liveStreams,
  markedDraft,
  shownColour,
  streamsShown,
} from "./releases.ts";
import {
  besideLive,
  DraftedItem,
  MarkedItem,
  MarkRow,
  useDraftView,
} from "./status-mark.tsx";
import { wasWords } from "./draft-marks.ts";
import { byGroupRank, type OtherPlace, type RowGroups } from "./row-groups.ts";
import { formatDay } from "./day-formats.ts";
import { TeamLabels } from "./team-labels.tsx";
import { quarterWords, TimelineStrip } from "./timeline-strip.tsx";

// How wide a column is at the least, and the rows' labels, in pixels.
const columnWidth = 200;
const rowLabelWidth = 160;

// What the board shows, kept in the page's address: the stream whose cycles are its columns, or none
// for months, with the schedule whose features alone show by months, or none for all, the cycle or
// month it starts from, and the parts of the cards hidden.
export interface BoardPlace {
  stream?: string | undefined;
  schedule?: string | undefined;
  from?: string | undefined;
  hide?: CardPart[] | undefined;
}

const cycleWords = {
  group: "Cycles",
  previous: "Previous cycle",
  next: "Next cycle",
};

// The choice of months of all schedules among the Columns menu's choices, which no stream's
// identifier is.
const monthsChoice = "months";

// The streams offered: those not retired as they are live, since a stream drafted to be retired
// stays until the draft is approved, and the one shown, even once retired.
const offeredStreams = (
  streams: readonly ReleaseStream[],
  retired: ReadonlySet<string>,
  shown: ReleaseStream | undefined,
) => streams.filter(({ id }) => !retired.has(id) || id === shown?.id);

export function FeatureBoard({
  shown: {
    records: shownRecords,
    panelOpen,
    groupOf,
    groupsReversed,
    draftOf,
    liveOf,
  },
  streams,
  choices,
  place,
  onPlace,
  offeredParts,
  open,
  onOpen,
  today,
}: {
  shown: ShownRows<Feature>;
  streams: readonly ReleaseStream[];
  choices: PlanChoices;
  place: BoardPlace;
  onPlace: (place: BoardPlace) => void;
  offeredParts: readonly CardPart[];
  open: string | undefined;
  onOpen: (feature: Feature) => void;
  today: string;
}) {
  const show = useDraftView();
  const { ref, width } = useElementSize();
  const { ref: gridRef, width: gridWidth } = useElementSize();
  // The streams as the Draft view shows them, each release marked with its own draft.
  const shownStreams = streamsShown(streams, show);
  const releaseDrafts = draftsById(streams);
  const parts = shownParts(offeredParts, place.hide);
  const streamsLive = liveStreams(streams);
  const retired = new Set(
    streamsLive.filter((one) => one.retired).map(({ id }) => id),
  );
  // Months unless a stream is chosen, whose cycles are then the columns.
  const stream = shownStreams.find(({ id }) => id === place.stream);
  const schedule =
    stream === undefined
      ? shownStreams.find(({ id }) => id === place.schedule)
      : undefined;
  const records =
    schedule === undefined
      ? shownRecords
      : shownRecords.filter(
          ({ targetStreamId }) => targetStreamId === schedule.id,
        );
  const [focused, setFocused] = useState<string>();
  const grouped = groupOf !== undefined;
  // While a side panel is open, such as a feature's details or Metrics, the board keeps the width it
  // had, scrolling sideways under the panel rather than dropping columns and narrowing the rest at
  // once; once it closes, it keeps it until the panel has gone and the board's own width changes.
  const [held, setHeld] = useState<{
    width: number;
    gridWidth: number;
    closedAt?: number;
  }>();
  if (panelOpen && held === undefined && width > 0) {
    setHeld({ width, gridWidth });
  } else if (panelOpen && held?.closedAt !== undefined) {
    setHeld({ width: held.width, gridWidth: held.gridWidth });
  } else if (!panelOpen && held !== undefined) {
    if (held.closedAt === undefined) setHeld({ ...held, closedAt: width });
    else if (width !== held.closedAt) setHeld(undefined);
  }
  const boardWidth = held?.width ?? width;
  const room = boardWidth - (grouped ? rowLabelWidth : 0);
  const fits = Math.max(1, Math.floor(room / columnWidth) - 1);
  const { periods, strip, columns, columnOf, moves } = boardLayout({
    stream,
    live: besideLive(show)
      ? streamsLive.find(({ id }) => id === stream?.id)
      : undefined,
    // As drafted and as live, so a card a draft moves has its Live copy's column too.
    features: [
      ...records,
      ...records.flatMap((feature) => liveOf(feature) ?? []),
    ],
    today,
    fits,
    from: place.from,
  });
  const eachColumn = wholeColumnWidth({
    room: (held?.gridWidth ?? gridWidth) - (grouped ? rowLabelWidth : 0),
    columns: columns.length,
    lines: columns.length - (grouped ? 0 : 1),
    least: columnWidth,
  });
  const shownKeys = new Set(columns.map(({ key }) => key));
  const order = cardOrder(choices.priorities, choices.featureStatuses);
  // Only the features in the columns shown are counted and grouped, not those in other streams.
  const onBoard = records.filter((feature) => shownKeys.has(columnOf(feature)));
  const rows = rowsOf(onBoard, groupOf, groupsReversed).map((row) => ({
    ...row,
    cells: columns.map((column) => ({
      column,
      cards: row.records
        .filter((feature) => columnOf(feature) === column.key)
        .sort(order),
      moved: besideLive(show)
        ? row.records.flatMap((feature) => {
            const liveFeature = liveOf(feature);
            return liveFeature !== undefined &&
              columnOf(liveFeature) !== columnOf(feature) &&
              columnOf(liveFeature) === column.key
              ? [liveFeature]
              : [];
          })
        : [],
    })),
  }));
  // The cards in the order the keyboard reaches them: down each column, row by row.
  const placed = rows.flatMap((row, rowIndex) =>
    row.cells.flatMap((cell, columnIndex) =>
      cell.cards.map((feature, index) => ({
        id: copyOf(row.key, feature.id, grouped),
        feature: feature.id,
        rowIndex,
        columnIndex,
        index,
      })),
    ),
  );
  const tabStop =
    placed.find(({ id }) => id === focused) ??
    placed.find(({ feature }) => feature === open) ??
    placed[0];
  const move = (event: KeyboardEvent, from: (typeof placed)[number]) => {
    const target = keyTarget(event.key, from, placed, columns.length);
    if (target === undefined || event.altKey || event.metaKey) return;
    event.preventDefault();
    document.getElementById(cardId(target.id))?.focus();
  };
  const stepTo = ({ startsOn }: Cycle) => {
    onPlace({ ...place, from: startsOn });
  };
  const { previous, next } = strip;
  const offered = offeredStreams(shownStreams, retired, stream ?? schedule).map(
    ({ id, name }) => {
      const own = streams.find((one) => one.id === id);
      return {
        id,
        label: (
          <DraftedItem
            slot
            draft={markedDraft(own?.draft, own?.retired)}
            heldBy={own?.heldBy}
          >
            {name}
          </DraftedItem>
        ),
      };
    },
  );
  const menus = (
    <>
      <AppMenu position="bottom-start">
        <AppMenu.Target>
          <Button variant="default">
            {boardMenuWords.columns}:{" "}
            {stream !== undefined
              ? cyclesOf(stream.name)
              : schedule !== undefined
                ? monthsOf(schedule.name)
                : boardMenuWords.months}
          </Button>
        </AppMenu.Target>
        <AppMenu.Dropdown>
          <MenuChoices
            label={boardMenuWords.months}
            divided={false}
            choices={[
              {
                value: monthsChoice,
                label: (
                  <DraftedItem slot>{boardMenuWords.allSchedules}</DraftedItem>
                ),
              },
              ...offered.map(({ id, label }) => ({ value: id, label })),
            ]}
            chosen={
              stream === undefined ? (schedule?.id ?? monthsChoice) : undefined
            }
            onChoose={(next) => {
              onPlace({
                ...place,
                stream: undefined,
                schedule: next === monthsChoice ? undefined : next,
                from: stream === undefined ? place.from : undefined,
              });
            }}
          />
          <MenuChoices
            label={boardMenuWords.cycles}
            choices={offered.map(({ id, label }) => ({ value: id, label }))}
            chosen={stream?.id}
            onChoose={(next) => {
              onPlace({
                ...place,
                stream: next,
                schedule: undefined,
                from: undefined,
              });
            }}
          />
        </AppMenu.Dropdown>
      </AppMenu>
      <AppMenu position="bottom-start" closeOnItemClick={false}>
        <AppMenu.Target>
          <Button variant="default">{boardMenuWords.card}</Button>
        </AppMenu.Target>
        <AppMenu.Dropdown>
          {offeredParts.map((part) => (
            <MenuToggle
              key={part}
              // The part is always one of the fixed parts.
              // eslint-disable-next-line security/detect-object-injection
              label={cardPartLabels[part]}
              on={parts.has(part)}
              onToggle={(on) => {
                const hide = offeredParts.filter((one) =>
                  one === part ? !on : !parts.has(one),
                );
                onPlace({
                  ...place,
                  hide: hide.length === 0 ? undefined : hide,
                });
              }}
            />
          ))}
        </AppMenu.Dropdown>
      </AppMenu>
    </>
  );
  return (
    <div ref={ref} className={classes.board}>
      {periods.length === 0 ? (
        <Group gap="xs" mb="xs">
          {menus}
        </Group>
      ) : (
        <TimelineStrip
          words={stream === undefined ? quarterWords : cycleWords}
          before={menus}
          periods={strip.periods.map(({ first, ...period }) => ({
            ...period,
            onChoose: () => {
              stepTo(first);
            },
          }))}
          onPrevious={
            previous === undefined
              ? undefined
              : () => {
                  stepTo(previous);
                }
          }
          onNext={
            next === undefined
              ? undefined
              : () => {
                  stepTo(next);
                }
          }
          onToday={() => {
            onPlace({ ...place, from: undefined });
          }}
        />
      )}
      <Paper
        ref={gridRef}
        withBorder
        className={[classes.panel, pages.scrollBars].join(" ")}
      >
        <div
          className={classes.grid}
          style={{
            gridTemplateColumns: `${grouped ? `${String(rowLabelWidth)}px ` : ""}repeat(${String(columns.length)}, ${String(eachColumn)}px)`,
          }}
        >
          {grouped && <div className={classes.corner} />}
          {columns.map((column) => (
            <ColumnHeader
              key={column.key}
              column={column}
              draft={
                column.release &&
                markedDraft(releaseDrafts.get(column.release.id))
              }
            />
          ))}
          {rows.map((row, rowIndex) => [
            grouped && (
              <div key={`label-${row.key}`} className={classes.rowLabel}>
                <ColouredName colour={row.colour}>{row.label}</ColouredName>
                <Text component="span" fz="sm" c="dimmed" ml="xs">
                  {row.records.length}
                </Text>
              </div>
            ),
            ...row.cells.map((cell, columnIndex) => (
              <ul
                key={`${row.key}-${cell.column.key}`}
                className={classes.cell}
                data-later={
                  cell.column.kind === "later" ||
                  cell.column.kind === "noDate" ||
                  undefined
                }
                aria-label={[
                  columnName(cell.column),
                  ...(grouped ? [row.label] : []),
                ].join(", ")}
              >
                {cell.cards.map((feature, index) => {
                  const copy = copyOf(row.key, feature.id, grouped);
                  const at = {
                    id: copy,
                    feature: feature.id,
                    rowIndex,
                    columnIndex,
                    index,
                  };
                  return (
                    <li key={copy}>
                      <FeatureCard
                        id={copy}
                        feature={feature}
                        others={otherRows(groupOf, feature, row.key)}
                        draft={draftOf(feature)}
                        choices={choices}
                        parts={parts}
                        selected={feature.id === open}
                        moves={moves}
                        tabIndex={tabStop?.id === copy ? 0 : -1}
                        onFocus={() => {
                          setFocused(copy);
                        }}
                        onKeyDown={(event) => {
                          move(event, at);
                        }}
                        onOpen={() => {
                          onOpen(feature);
                        }}
                      />
                    </li>
                  );
                })}
                {cell.moved.map((feature) => (
                  <li key={`live-${feature.id}`}>
                    <LiveCard feature={feature} />
                  </li>
                ))}
              </ul>
            )),
          ])}
        </div>
        {onBoard.length === 0 && (
          <Text fz="sm" c="dimmed" className={classes.none}>
            No matching features
          </Text>
        )}
      </Paper>
    </div>
  );
}

// A card's own identifier: its feature's, or, on a board in rows, where a feature has a card in the
// row of each of its values, its row's and its feature's, with no spaces, which an id can't hold,
// though some rows' keys, such as a release's, have one.
const copyOf = (rowKey: string, id: string, grouped: boolean) =>
  grouped ? `${rowKey.replaceAll(" ", "-")}-${id}` : id;

// The other rows a feature has a card in, named by its card's +1 mark.
const otherRows = (
  groupOf: ((record: Feature) => RowGroups) | undefined,
  feature: Feature,
  rowKey: string,
): OtherPlace[] =>
  (groupOf?.(feature) ?? [])
    .filter(({ key }) => key !== rowKey)
    .map((group) => ({ group }));

interface BoardRow {
  key: string;
  label: string;
  colour: string | null;
  records: Feature[];
}

// The rows: the groups the records are in, in their order, or one row holding them all.
function rowsOf(
  records: readonly Feature[],
  groupOf: ((record: Feature) => RowGroups) | undefined,
  groupsReversed: boolean,
): BoardRow[] {
  if (groupOf === undefined) {
    return [{ key: "all", label: "", colour: null, records: [...records] }];
  }
  const rows = new Map<string, BoardRow & { rank: number }>();
  for (const record of records) {
    for (const { key, label, rank, colour = null } of groupOf(record)) {
      const row = rows.get(key) ?? { key, label, colour, rank, records: [] };
      row.records.push(record);
      rows.set(key, row);
    }
  }
  return [...rows.values()].sort(byGroupRank(groupsReversed));
}

interface CardPlace {
  id: string;
  feature: string;
  rowIndex: number;
  columnIndex: number;
  index: number;
}

// Where an arrow key goes from a card: up and down through the column, row after row, and across
// to the nearest card in the next column of its row that has one.
function keyTarget(
  key: string,
  from: CardPlace,
  placed: readonly CardPlace[],
  columns: number,
): CardPlace | undefined {
  const inColumn = placed
    .filter(({ columnIndex }) => columnIndex === from.columnIndex)
    .sort((a, b) => a.rowIndex - b.rowIndex || a.index - b.index);
  const at = inColumn.findIndex(({ id }) => id === from.id);
  if (key === "ArrowDown") return inColumn[at + 1];
  if (key === "ArrowUp") return at > 0 ? inColumn[at - 1] : undefined;
  if (key !== "ArrowLeft" && key !== "ArrowRight") return undefined;
  const step = key === "ArrowLeft" ? -1 : 1;
  for (
    let column = from.columnIndex + step;
    column >= 0 && column < columns;
    column += step
  ) {
    const across = placed.filter(
      (card) => card.columnIndex === column && card.rowIndex === from.rowIndex,
    );
    const nearest = across[Math.min(from.index, across.length - 1)];
    if (nearest !== undefined) return nearest;
  }
  return undefined;
}

// A month's and a cycle's column always have their period.
function columnName({ kind, cycle }: BoardColumn): string {
  switch (kind) {
    case "later":
      return "Later";
    case "noDate":
      return "No date";
    case "month":
      return (cycle as Cycle).name;
    case "cycle":
      return `Cycle ${(cycle as Cycle).name}`;
  }
}

function ColumnHeader({
  column,
  draft,
}: {
  column: BoardColumn;
  // The draft of the column's release, whatever the view.
  draft: ReturnType<typeof markedDraft>;
}) {
  const { cycle, release, liveRelease } = column;
  const liveName = draft?.live.name;
  const was =
    draft?.changed.includes("name") === true && typeof liveName === "string"
      ? wasWords(liveName, "Name")
      : undefined;
  return (
    <div
      className={classes.header}
      aria-current={column.current ? "date" : undefined}
    >
      <div className={classes.release}>
        {release !== undefined && (
          <MarkRow>
            <DraftedItem draft={draft} was={was} heldBy={release.heldBy}>
              <ReleaseBox release={release} />
            </DraftedItem>
          </MarkRow>
        )}
        {liveRelease !== undefined && (
          <MarkRow className={classes.liveRelease}>
            <MarkedItem tone="live">
              <ReleaseBox release={liveRelease} />
            </MarkedItem>
          </MarkRow>
        )}
      </div>
      <Text fw={600} size="sm">
        {columnName(column)}
      </Text>
      {column.kind === "cycle" && cycle !== undefined && (
        <Text size="xs" c="dimmed">
          {formatDay(cycle.startsOn)} to {formatDay(cycle.endsOn)}
        </Text>
      )}
    </div>
  );
}

// A release's name after its colour's square.
function ReleaseBox({
  release,
}: {
  release: ReleaseStream["releases"][number];
}) {
  return (
    <TeamLabels
      teams={[
        {
          id: release.id,
          name: release.name,
          colour: shownColour(release.colour),
        },
      ]}
    />
  );
}

// A card moved by a draft, as it is live, dimmed in its old place after Live's dot.
