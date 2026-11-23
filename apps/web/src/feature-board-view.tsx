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
  isCurrent,
  shownParts,
} from "./feature-board.ts";
import { cardId, FeatureCard, LiveCard } from "./feature-card.tsx";
import classes from "./feature-board-view.module.css";
import pages from "./pages.module.css";
import type { ShownRows } from "./record-table.ts";
import {
  daysBetween,
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
import { TimelineStrip } from "./timeline-strip.tsx";

// How wide a column is at the least, and the rows' labels, in pixels.
const columnWidth = 200;
const rowLabelWidth = 160;

// What the board shows, kept in the page's address: the stream whose cycles are its columns, or none
// for months, the cycle or month it starts from, and the parts of the cards hidden.
export interface BoardPlace {
  stream?: string | undefined;
  from?: string | undefined;
  hide?: CardPart[] | undefined;
}

const stripWords = {
  cycles: { group: "Cycles", previous: "Previous cycle", next: "Next cycle" },
  months: { group: "Months", previous: "Previous month", next: "Next month" },
};

// The choice of months among the Columns menu's choices, which no stream's identifier is.
const monthsChoice = "months";

// The streams offered: those not retired as they are live, since a stream drafted to be retired
// stays until the draft is approved, and the one shown, even once retired.
const offeredStreams = (
  streams: readonly ReleaseStream[],
  retired: ReadonlySet<string>,
  shown: ReleaseStream | undefined,
) => streams.filter(({ id }) => !retired.has(id) || id === shown?.id);

export function FeatureBoard({
  shown: { records, panelOpen, groupOf, groupsReversed, draftOf, liveOf },
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
  // The month or cycle chosen in the strip, or stepped to, which stays selected while it is the first
  // shown.
  const [chosen, setChosen] = useState<string>();
  const [focused, setFocused] = useState<string>();
  const grouped = groupOf !== undefined;
  // While a side panel is open, such as a feature's details or Metrics, the board keeps the width it
  // had, scrolling sideways under the panel rather than dropping columns and narrowing the rest at
  // once; once it closes, it keeps it until the panel has gone and the board's own width changes.
  const [held, setHeld] = useState<{ width: number; closedAt?: number }>();
  if (panelOpen && held === undefined && width > 0) {
    setHeld({ width });
  } else if (panelOpen && held?.closedAt !== undefined) {
    setHeld({ width: held.width });
  } else if (!panelOpen && held !== undefined) {
    if (held.closedAt === undefined) setHeld({ ...held, closedAt: width });
    else if (width !== held.closedAt) setHeld(undefined);
  }
  const boardWidth = held?.width ?? width;
  const room = boardWidth - (grouped ? rowLabelWidth : 0);
  const fits = Math.max(1, Math.floor(room / columnWidth) - 1);
  const { periods, start, columns, columnOf, moves } = boardLayout({
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
    setChosen(startsOn);
    onPlace({ ...place, from: startsOn });
  };
  const previous = periods.slice(0, start).at(-1);
  // The next month or cycle, while a later one is still out of view.
  const next =
    start + fits < periods.length ? periods.at(start + 1) : undefined;
  const menus = (
    <>
      <AppMenu position="bottom-start">
        <AppMenu.Target>
          <Button variant="default">
            {boardMenuWords.columns}:{" "}
            {stream === undefined
              ? boardMenuWords.months
              : cyclesOf(stream.name)}
          </Button>
        </AppMenu.Target>
        <AppMenu.Dropdown>
          <MenuChoices
            label={boardMenuWords.columns}
            choices={[
              { value: monthsChoice, label: boardMenuWords.months },
              ...offeredStreams(shownStreams, retired, stream).map(
                ({ id, name }) => {
                  const own = streams.find((one) => one.id === id);
                  return {
                    value: id,
                    label: (
                      <DraftedItem
                        draft={markedDraft(own?.draft, own?.retired)}
                        heldBy={own?.heldBy}
                      >
                        {cyclesOf(name)}
                      </DraftedItem>
                    ),
                  };
                },
              ),
            ]}
            chosen={stream?.id ?? monthsChoice}
            onChoose={(next) => {
              setChosen(undefined);
              onPlace({
                ...place,
                stream: next === monthsChoice ? undefined : next,
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
          words={stream === undefined ? stripWords.months : stripWords.cycles}
          before={menus}
          periods={periods.map((cycle, index) => ({
            key: cycle.startsOn,
            onChoose: () => {
              stepTo(cycle);
            },
            label: cycle.name,
            short: cycle.name,
            weight: daysBetween(cycle.startsOn, cycle.endsOn) + 1,
            inView: index >= start && index < start + fits,
            selected: chosen === cycle.startsOn && index === start,
            current: isCurrent(cycle, today),
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
            setChosen(undefined);
            onPlace({ ...place, from: undefined });
          }}
        />
      )}
      <Paper withBorder className={[classes.panel, pages.scrollBars].join(" ")}>
        <div
          className={classes.grid}
          style={{
            gridTemplateColumns: `${grouped ? `${String(rowLabelWidth)}px ` : ""}repeat(${String(columns.length)}, ${
              held === undefined
                ? `minmax(${String(columnWidth)}px, 1fr)`
                : `${String(Math.max(columnWidth, room / columns.length))}px`
            })`,
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
                {row.label}
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

// The rows: the groups the records are in, in their order, or one row holding them all.
function rowsOf(
  records: readonly Feature[],
  groupOf: ((record: Feature) => RowGroups) | undefined,
  groupsReversed: boolean,
): { key: string; label: string; records: Feature[] }[] {
  if (groupOf === undefined) {
    return [{ key: "all", label: "", records: [...records] }];
  }
  const rows = new Map<
    string,
    { key: string; label: string; rank: number; records: Feature[] }
  >();
  for (const record of records) {
    for (const { key, label, rank } of groupOf(record)) {
      const row = rows.get(key) ?? { key, label, rank, records: [] };
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
