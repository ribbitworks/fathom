// SPDX-License-Identifier: Apache-2.0

// The Features Board, the Roadmap's view of features: one release stream's cycles across, as many
// as fit, then Later, each headed with its release's name in its colour's box, the cycle and its
// dates; the rows the view's grouping puts the features under; and a card for each feature, showing
// what the Card menu chooses. The strip above it steps through the stream's cycles. Arrow keys move
// between the cards, and choosing one opens its details.

import {
  type Cycle,
  type Feature,
  needsStaffing,
  type PlanChoices,
  type ReleaseStream,
  type CardPart,
} from "@fathom/shared";
import { Button, Group, Paper, Text, UnstyledButton } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { type KeyboardEvent, useState } from "react";
import { AppMenu, MenuChoices, MenuToggle } from "./app-menu.tsx";
import {
  type BoardColumn,
  boardColumns,
  cardOrder,
  cardPartLabels,
  columnOf,
  firstShown,
  isCurrent,
  laterKey,
  movesCycle,
  riskStep,
  shownParts,
} from "./feature-board.ts";
import classes from "./feature-board-view.module.css";
import { draftRowClass } from "./list-drafts.tsx";
import { RiskMark, SizeMark } from "./planning-marks.tsx";
import type { RowGroup, ShownRows } from "./record-grid.tsx";
import {
  daysBetween,
  draftsById,
  liveStreams,
  markedDraft,
  streamsShown,
} from "./releases.ts";
import {
  besideLive,
  DraftedItem,
  DraftedValue,
  type DraftLike,
  MarkedItem,
  MarkRow,
  recordMark,
  useDraftView,
  wasWords,
} from "./status-mark.tsx";
import { formatDay, formatMonth } from "./table-view.ts";
import { TeamLabels } from "./team-labels.tsx";
import { TimelineStrip } from "./timeline-strip.tsx";

// How wide a column is at the least, and the rows' labels, in pixels.
const columnWidth = 200;
const rowLabelWidth = 160;

// What the board shows, kept in the page's address: the stream, the cycle it starts from, and the
// parts of the cards hidden.
export interface BoardPlace {
  stream?: string | undefined;
  from?: string | undefined;
  hide?: CardPart[] | undefined;
}

const stripWords = {
  group: "Cycles",
  previous: "Previous cycle",
  next: "Next cycle",
};

// The fields a card shows, so its own mark is left to drafts of what it doesn't show, such as a move.
const cardFields: ReadonlySet<string> = new Set([
  "name",
  "statusId",
  "priorityId",
  "sizeId",
  "riskId",
  "neededBy",
]);

// The streams offered: those not retired as they are live, since a stream drafted to be retired
// stays until the draft is approved, and the one shown, even once retired.
const offeredStreams = (
  streams: readonly ReleaseStream[],
  retired: ReadonlySet<string>,
  shown: ReleaseStream | undefined,
) => streams.filter(({ id }) => !retired.has(id) || id === shown?.id);

export function FeatureBoard({
  shown: { records, panelOpen, groupOf, draftOf, liveOf },
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
  const stream =
    shownStreams.find(({ id }) => id === place.stream) ??
    shownStreams.find(({ id }) => !retired.has(id));
  // The cycle chosen in the strip, or stepped to, which stays selected while it is the first shown.
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
  const cycles = stream?.cycles ?? [];
  const start = firstShown(cycles, fits, today, place.from);
  const columns =
    stream === undefined
      ? [{ key: laterKey, current: false }]
      : boardColumns(
          stream,
          start,
          fits,
          today,
          besideLive(show)
            ? streamsLive.find(({ id }) => id === stream.id)
            : undefined,
        );
  const shownKeys = new Set(columns.map(({ key }) => key));
  const order = cardOrder(choices.priorities, choices.featureStatuses);
  // Only the features in the columns shown are counted and grouped, not those in other streams.
  const onBoard = records.filter((feature) => shownKeys.has(columnOf(feature)));
  const rows = rowsOf(onBoard, groupOf).map((row) => ({
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
              movesCycle(feature) &&
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
        id: feature.id,
        rowIndex,
        columnIndex,
        index,
      })),
    ),
  );
  const tabStop =
    placed.find(({ id }) => id === focused) ??
    placed.find(({ id }) => id === open) ??
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
  const previous = cycles.slice(0, start).at(-1);
  // The next cycle, while a later one is still out of view.
  const next = start + fits < cycles.length ? cycles.at(start + 1) : undefined;
  const menus = (
    <>
      <AppMenu position="bottom-start">
        <AppMenu.Target>
          <Button variant="default">Stream: {stream?.name ?? "None"}</Button>
        </AppMenu.Target>
        <AppMenu.Dropdown>
          <MenuChoices
            label="Release stream"
            choices={offeredStreams(shownStreams, retired, stream).map(
              ({ id, name }) => {
                const own = streams.find((one) => one.id === id);
                return {
                  value: id,
                  label: (
                    <DraftedItem
                      draft={markedDraft(own?.draft, own?.retired)}
                      heldBy={own?.heldBy}
                    >
                      {name}
                    </DraftedItem>
                  ),
                };
              },
            )}
            chosen={stream?.id}
            onChoose={(next) => {
              setChosen(undefined);
              onPlace({ ...place, stream: next, from: undefined });
            }}
          />
        </AppMenu.Dropdown>
      </AppMenu>
      <AppMenu position="bottom-start" closeOnItemClick={false}>
        <AppMenu.Target>
          <Button variant="default">Card</Button>
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
      {stream === undefined || cycles.length === 0 ? (
        <Group gap="xs" mb="xs">
          {menus}
        </Group>
      ) : (
        <TimelineStrip
          words={stripWords}
          before={menus}
          periods={cycles.map((cycle, index) => ({
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
      <Paper withBorder className={classes.panel}>
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
                data-later={cell.column.key === laterKey || undefined}
                aria-label={[
                  columnName(cell.column),
                  ...(grouped ? [row.label] : []),
                ].join(", ")}
              >
                {cell.cards.map((feature, index) => {
                  const at = {
                    id: feature.id,
                    rowIndex,
                    columnIndex,
                    index,
                  };
                  return (
                    <li key={feature.id}>
                      <FeatureCard
                        feature={feature}
                        draft={draftOf(feature)}
                        choices={choices}
                        parts={parts}
                        selected={feature.id === open}
                        tabIndex={
                          tabStop?.rowIndex === rowIndex &&
                          tabStop.columnIndex === columnIndex &&
                          tabStop.index === index
                            ? 0
                            : -1
                        }
                        onFocus={() => {
                          setFocused(feature.id);
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

export const cardId = (id: string) => `card-${id}`;

// The rows: the groups the records are in, in their order, or one row holding them all.
function rowsOf(
  records: readonly Feature[],
  groupOf: ((record: Feature) => RowGroup) | undefined,
): { key: string; label: string; records: Feature[] }[] {
  if (groupOf === undefined) {
    return [{ key: "all", label: "", records: [...records] }];
  }
  const rows = new Map<
    string,
    { key: string; label: string; records: Feature[] }
  >();
  for (const record of records) {
    const { key, label } = groupOf(record);
    const row = rows.get(key) ?? { key, label, records: [] };
    row.records.push(record);
    rows.set(key, row);
  }
  return [...rows.values()];
}

interface CardPlace {
  id: string;
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

const columnName = (column: BoardColumn) =>
  column.cycle === undefined ? "Later" : `Cycle ${column.cycle.name}`;

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
      {cycle !== undefined && (
        <Text size="xs" c="dimmed">
          {formatDay(cycle.startsOn)} to {formatDay(cycle.endsOn)}
        </Text>
      )}
    </div>
  );
}

function FeatureCard({
  feature,
  draft,
  choices,
  parts,
  selected,
  tabIndex,
  onFocus,
  onKeyDown,
  onOpen,
}: {
  feature: Feature;
  // The feature's draft, whatever the view.
  draft: Feature["draft"];
  choices: PlanChoices;
  parts: ReadonlySet<CardPart>;
  selected: boolean;
  tabIndex: number;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
  onOpen: () => void;
}) {
  const show = useDraftView();
  const status = choices.featureStatuses.find(
    ({ id }) => id === feature.statusId,
  );
  const priority = choices.priorities.find(
    ({ id }) => id === feature.priorityId,
  );
  const size = choices.sizes.find(({ id }) => id === feature.sizeId);
  const risk = riskStep(choices.risks, feature.riskId);
  // Its own mark, for a draft of what it doesn't show, such as a move, which a box says.
  const marked = recordMark(draft, cardFields);
  const own: DraftLike | undefined = marked && {
    ...marked,
    moved: movesCycle({ draft: marked }),
  };
  const value = (fields: string[], named: string) => ({
    draft,
    fields,
    named,
  });
  const notStaffed =
    parts.has("staffed") &&
    needsStaffing(
      status?.meaning,
      show === "live" ? feature.staffedLive : feature.staffed,
    );
  return (
    <UnstyledButton
      id={cardId(feature.id)}
      component="div"
      role="button"
      className={[
        classes.card,
        draftRowClass(draft, besideLive(show)),
        selected ? classes.selected : "",
      ].join(" ")}
      tabIndex={tabIndex}
      aria-current={selected || undefined}
      onFocus={onFocus}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        } else onKeyDown(event);
      }}
      onClick={onOpen}
    >
      <Text component="span" fw={500} size="sm" className={classes.line}>
        <DraftedItem draft={own} heldBy={feature.heldBy}>
          <DraftedValue {...value(["name"], "Name")}>
            {feature.name}
          </DraftedValue>
        </DraftedItem>
      </Text>
      {(parts.has("status") || (parts.has("priority") && priority)) && (
        <Text component="span" size="xs" className={classes.words}>
          {parts.has("status") && status !== undefined && (
            <DraftedValue {...value(["statusId"], "Status")}>
              <span
                className={
                  status.meaning === "possible" ? classes.possible : undefined
                }
              >
                {status.name}
              </span>
            </DraftedValue>
          )}
          {parts.has("status") && parts.has("priority") && priority && " · "}
          {parts.has("priority") && priority !== undefined && (
            <DraftedValue {...value(["priorityId"], "Priority")}>
              {priority.name} priority
            </DraftedValue>
          )}
        </Text>
      )}
      {parts.has("size") && size !== undefined && (
        <span className={classes.line}>
          <DraftedValue {...value(["sizeId"], "Size")}>
            <SizeMark name={size.name} weight={size.weight} />
          </DraftedValue>
        </span>
      )}
      {parts.has("risk") && risk !== undefined && (
        <span className={classes.line}>
          <DraftedValue {...value(["riskId"], "Risk")}>
            <RiskMark {...risk} />
          </DraftedValue>
        </span>
      )}
      {parts.has("neededBy") && feature.neededBy !== null && (
        <Text component="span" size="xs" className={classes.line}>
          <DraftedValue {...value(["neededBy"], "Needed by")}>
            Needed by {formatMonth(feature.neededBy)}
          </DraftedValue>
        </Text>
      )}
      {notStaffed && (
        <span className={classes.line}>
          <MarkedItem
            tone="warning"
            words="Not staffed"
            spoken="it's planned or in progress, with nobody allocated to it"
          />
        </span>
      )}
    </UnstyledButton>
  );
}

// A release's name in its colour's box.
function ReleaseBox({
  release,
}: {
  release: ReleaseStream["releases"][number];
}) {
  return (
    <TeamLabels
      teams={[{ id: release.id, name: release.name, colour: release.colour }]}
    />
  );
}

// A card moved by a draft, as it is live, dimmed in its old place after Live's dot.
function LiveCard({ feature }: { feature: Feature }) {
  return (
    <div className={[classes.card, classes.liveCard].join(" ")}>
      <Text component="span" size="sm" className={classes.line}>
        <MarkedItem tone="live">{feature.name}</MarkedItem>
      </Text>
    </div>
  );
}
