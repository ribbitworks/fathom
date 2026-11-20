// SPDX-License-Identifier: Apache-2.0

// The release layer a timeline may show: a row for each release stream, labelled with its name and
// its draft's marks and Ended once its last day has passed, holding what its form shows of its
// cycles, drawn at their real lengths, and its releases: each a span across its cycles with its
// Ships on diamond under it, and, beside live, a Live lane holding each release a draft moves in its
// old place; or each its diamond alone, on its cycles. The streams are shown as the Draft view
// around the timeline shows them, and each mark is given its record's own draft. Where the timeline
// asks, each release, cycle, diamond and schedule's name is a button, in the tab order, named as its
// tip reads, that opens its record.

import type { RecordDraft, ReleaseStream } from "@fathom/shared";
import { UnstyledButton } from "@mantine/core";
import { type ReactNode, useCallback, useMemo } from "react";
import { ColouredName, colouredNameChars } from "./colour-swatch.tsx";
import { isCurrent } from "./feature-board.ts";
import { cycleChoiceId } from "./projects.ts";
import classes from "./pages.module.css";
import {
  draftsById,
  liveStreams,
  markedDraft,
  releaseColourStyle,
  shownColour,
  streamsShown,
} from "./releases.ts";
import {
  besideLive,
  DraftedItem,
  draftedItemChars,
  draftMarkChars,
  EndedBox,
  MarkedItem,
  useDraftView,
  viewedDraft,
} from "./status-mark.tsx";
import { draftTip, liveWaitingWords } from "./draft-marks.ts";
import { TableTips, Tipped, tipAttribute } from "./table-tips.tsx";
import { formatDay } from "./table-view.ts";
import {
  charactersWidth,
  type DayRange,
  fits,
  type Px,
  releaseLayer,
  releaseLayerRange,
  type ReleaseLayerRow,
  type ReleaseSpan,
  type TimelineRow,
} from "./timeline.ts";

// A record a mark on the layer stands for, which the timeline opens where it asks: a cycle by its
// choice, as Features names it.
export type LayerRecord =
  | { kind: "release"; id: string }
  | { kind: "cycle"; id: string }
  | { kind: "schedule"; id: string };

type OpenMark = ((record: LayerRecord) => void) | undefined;

// A mark's words for assistive technology, and, where the timeline opens records, the button over
// the mark that opens it, named by them.
function MarkWords({
  words,
  onOpen,
}: {
  words: string;
  onOpen: (() => void) | undefined;
}) {
  const hidden = <span className={classes.visuallyHidden}>{words}</span>;
  return onOpen === undefined ? (
    hidden
  ) : (
    <UnstyledButton className={classes.timelineMark} onClick={onOpen}>
      {hidden}
    </UnstyledButton>
  );
}

// A bar's mark: its release's own draft, and who is changing it, or Live's, on a live copy of a
// release a draft moves.
type BarMark =
  | { live: false; draft: RecordDraft | undefined; heldBy: string | undefined }
  | { live: true };

// A release's bar across its cycles, named inside when the name fits, with its Ships on diamond
// under the bar: at the bar's end, or on the day it ships, joined to the bar's end by a dashed line.
function ReleaseBar({
  span,
  px,
  mark,
  onOpen,
}: {
  span: ReleaseSpan;
  px: Px;
  mark: BarMark;
  onOpen: OpenMark;
}) {
  const show = useDraftView();
  const { release, at, days, shipsAt } = span;
  const end = at + days;
  const left = Math.min(at, shipsAt);
  const from = (day: number) => px(day - left);
  const draft = mark.live ? undefined : markedDraft(mark.draft);
  const viewed = viewedDraft(draft, show);
  const removed =
    viewed.draft?.action === "deleted" && viewed.draft.state !== "rejected";
  const markRoom = mark.live
    ? draftMarkChars
    : draftedItemChars(draft, show, mark.heldBy);
  const name = fits(
    release.name,
    px.of(days),
    charactersWidth(markRoom + colouredNameChars),
  )
    ? release.name
    : undefined;
  // The name, after its colour's square, as every coloured name is.
  const label = (
    <ColouredName colour={shownColour(release.colour)}>{name}</ColouredName>
  );
  // The release, then each mark in a sentence of its own.
  const sentences = [
    `${release.name}: ${span.cycleWords}, ships ${span.shipsOn}`,
    ...(mark.live ? ["Live"] : []),
    ...(viewed.draft === undefined ? [] : [draftTip(viewed.draft)]),
    ...(draft !== undefined && viewed.live ? [liveWaitingWords(draft)] : []),
    ...(mark.live || mark.heldBy === undefined
      ? []
      : [`Being changed by ${mark.heldBy}`]),
  ];
  const words = sentences
    .map((sentence) => `${sentence.replace(/\.$/, "")}.`)
    .join(" ");
  return (
    <li
      className={classes.timelineReleaseSlot}
      style={{
        ...releaseColourStyle(release.colour),
        left: px(left),
        width: px(Math.max(end, shipsAt) - left),
      }}
      {...{ [tipAttribute]: words }}
    >
      <span
        className={[
          classes.timelineRelease,
          mark.live ? classes.timelineReleaseLive : "",
          removed ? classes.struck : "",
        ].join(" ")}
        style={{ left: from(at), width: px(days) }}
        aria-hidden
      >
        {/* Its marks show with its name or not at all, so none is left without what it marks; its
            tip still says them. */}
        {name !== undefined && (
          <span className={classes.timelineReleaseLabel}>
            {mark.live ? (
              <MarkedItem tone="live">{label}</MarkedItem>
            ) : (
              <DraftedItem draft={draft} heldBy={mark.heldBy}>
                {label}
              </DraftedItem>
            )}
          </span>
        )}
      </span>
      {shipsAt !== end && (
        <span
          className={classes.timelineShipsReach}
          style={{
            left: from(Math.min(end, shipsAt)),
            width: px(Math.abs(shipsAt - end)),
          }}
          aria-hidden
        />
      )}
      <span
        className={classes.timelineShips}
        style={{ left: from(shipsAt) }}
        aria-hidden
      />
      <MarkWords
        words={words}
        onOpen={
          onOpen &&
          (() => {
            onOpen({ kind: "release", id: release.id });
          })
        }
      />
    </li>
  );
}

// What the release layer shows on each stream's row: its releases over its cycles drawn faint, its
// cycles alone, with its end named, or its cycles named, the current one marked, with its releases'
// diamonds on them.
export type ReleaseLayerForm = "releases" | "schedules" | "cycles";

// Every other cycle is shaded apart from the one before, so each shows its own length unnamed.
const blockShades = [
  classes.timelineCycleBlock,
  classes.timelineCycleAlternate,
];
// A cycle's block: shaded apart from the one before, and faded once it has ended.
const blockClass = (index: number, cycle: { endsOn: string }, today: string) =>
  [
    blockShades[index % blockShades.length],
    cycle.endsOn < today ? classes.timelineCyclePast : undefined,
  ]
    .filter(Boolean)
    .join(" ");

// A cycle's block, with its name and days in its tip and for assistive technology, and, where asked,
// its name inside where it fits, marked as current while it holds today.
function CycleBlock({
  cycle,
  index,
  px,
  today,
  named,
  streamId,
  onOpen,
}: {
  cycle: ReleaseLayerRow["cycles"][number];
  index: number;
  px: Px;
  today: string;
  named: boolean;
  streamId: string;
  onOpen: OpenMark;
}) {
  const days = `${formatDay(cycle.startsOn)} to ${formatDay(cycle.endsOn)}`;
  const current = named && isCurrent(cycle, today);
  return (
    <li
      className={[classes.timelineCycle, blockClass(index, cycle, today)].join(
        " ",
      )}
      style={{ left: px(cycle.at), width: px(cycle.days) }}
      aria-current={current ? "date" : undefined}
      {...{
        [tipAttribute]: `${cycle.name}: ${days}${current ? ", current" : ""}`,
      }}
    >
      {named && fits(cycle.name, px.of(cycle.days)) && (
        <span className={classes.timelineCycleName} aria-hidden>
          {cycle.name}
        </span>
      )}
      <MarkWords
        words={`${cycle.name}, ${days}${current ? ", current" : ""}`}
        onOpen={
          onOpen &&
          (() => {
            onOpen({
              kind: "cycle",
              id: cycleChoiceId(streamId, cycle.startsOn),
            });
          })
        }
      />
    </li>
  );
}

// A release's Ships on diamond alone, on its schedule's cycles.
function ShipsMark({
  span,
  px,
  onOpen,
}: {
  span: ReleaseSpan;
  px: Px;
  onOpen: OpenMark;
}) {
  const words = `${span.release.name} ships ${formatDay(span.shipsOn)}`;
  return (
    <li
      className={classes.timelineShips}
      style={{
        ...releaseColourStyle(span.release.colour),
        left: px(span.shipsAt),
      }}
      {...{ [tipAttribute]: words }}
    >
      <MarkWords
        words={words}
        onOpen={
          onOpen &&
          (() => {
            onOpen({ kind: "release", id: span.release.id });
          })
        }
      />
    </li>
  );
}

function ReleaseLanes({
  row: { stream, cycles, end, releases, live },
  form,
  markOf,
  px,
  today,
  onOpen,
}: {
  row: ReleaseLayerRow;
  form: ReleaseLayerForm;
  markOf: (id: string) => BarMark;
  px: Px;
  today: string;
  onOpen: OpenMark;
}): ReactNode {
  // The stream's end line, named with its last day where asked.
  const endLine = (named: boolean) =>
    end !== undefined && (
      <li
        className={classes.timelineStreamEnd}
        style={{ left: px(end.at) }}
        aria-hidden={!named}
      >
        {named && (
          <span className={classes.timelineStreamEndLabel}>
            Ends {formatDay(end.day)}
          </span>
        )}
      </li>
    );
  const bars = releases.map((span) => (
    <ReleaseBar
      key={span.release.id}
      span={span}
      px={px}
      mark={markOf(span.release.id)}
      onOpen={onOpen}
    />
  ));
  const releaseLaneClass = [
    classes.timelineLane,
    classes.timelineReleaseLane,
  ].join(" ");
  const liveLane = live.length > 0 && (
    <ul
      className={releaseLaneClass}
      aria-label={`Releases of ${stream.name} as they are live`}
    >
      {live.map((span) => (
        <ReleaseBar
          key={span.release.id}
          span={span}
          px={px}
          mark={{ live: true }}
          onOpen={onOpen}
        />
      ))}
    </ul>
  );
  switch (form) {
    case "releases":
      return (
        <TableTips>
          <ul
            className={releaseLaneClass}
            aria-label={`Releases of ${stream.name}`}
          >
            {cycles.map((cycle, index) => (
              <li
                key={cycle.startsOn}
                className={[
                  classes.timelineCycleFaint,
                  blockClass(index, cycle, today),
                ].join(" ")}
                style={{ left: px(cycle.at), width: px(cycle.days) }}
                aria-hidden
              />
            ))}
            {endLine(false)}
            {bars}
          </ul>
          {liveLane}
        </TableTips>
      );
    case "schedules":
      return (
        <TableTips>
          <ul
            className={classes.timelineLane}
            aria-label={`Cycles of ${stream.name}`}
          >
            {cycles.map((cycle, index) => (
              <CycleBlock
                key={cycle.startsOn}
                cycle={cycle}
                index={index}
                px={px}
                today={today}
                named={false}
                streamId={stream.id}
                onOpen={onOpen}
              />
            ))}
            {endLine(true)}
          </ul>
        </TableTips>
      );
    case "cycles":
      return (
        <TableTips>
          <ul
            className={[classes.timelineLane, classes.timelineCycleLane].join(
              " ",
            )}
            aria-label={`Cycles of ${stream.name}`}
          >
            {cycles.map((cycle, index) => (
              <CycleBlock
                key={cycle.startsOn}
                cycle={cycle}
                index={index}
                px={px}
                today={today}
                named
                streamId={stream.id}
                onOpen={onOpen}
              />
            ))}
            {endLine(false)}
            {releases.map((span) => (
              <ShipsMark
                key={span.release.id}
                span={span}
                px={px}
                onOpen={onOpen}
              />
            ))}
          </ul>
        </TableTips>
      );
  }
}

// The release layer of every stream with its drafts, as the Draft view around it shows them, in the
// form given: the days it covers, and its rows on a timeline starting on a day.
export function useReleaseLayer(
  releaseStreams: readonly ReleaseStream[],
  today: string,
  form: ReleaseLayerForm,
  onOpen?: OpenMark,
): {
  range: DayRange | undefined;
  rows: (from: string) => TimelineRow[];
} {
  const show = useDraftView();
  const shown = useMemo(
    () => streamsShown(releaseStreams, show),
    [releaseStreams, show],
  );
  const live = useMemo(
    () => (besideLive(show) ? liveStreams(releaseStreams) : undefined),
    [releaseStreams, show],
  );
  const range = useMemo(
    () => releaseLayerRange([...shown, ...(live ?? [])]),
    [shown, live],
  );
  const rows = useCallback(
    (from: string): TimelineRow[] => {
      const drafts = draftsById(releaseStreams);
      const records = releaseStreams.flatMap((stream) => [
        stream,
        ...stream.releases,
      ]);
      const heldBy = new Map(records.map(({ id, heldBy }) => [id, heldBy]));
      const retired = new Map(
        releaseStreams.map((stream) => [stream.id, stream.retired]),
      );
      const markOf = (id: string): BarMark => ({
        live: false,
        draft: drafts.get(id),
        heldBy: heldBy.get(id),
      });
      return releaseLayer(shown, from, live).map((row) => ({
        id: row.stream.id,
        label: (
          <>
            <DraftedItem
              draft={markedDraft(
                drafts.get(row.stream.id),
                retired.get(row.stream.id),
              )}
              heldBy={heldBy.get(row.stream.id)}
            >
              <Tipped
                tip={row.stream.name}
                className={classes.timelineLabelName}
              >
                {onOpen === undefined ? (
                  row.stream.name
                ) : (
                  <UnstyledButton
                    className={classes.timelineLabelButton}
                    onClick={() => {
                      onOpen({ kind: "schedule", id: row.stream.id });
                    }}
                  >
                    {row.stream.name}
                  </UnstyledButton>
                )}
              </Tipped>
            </DraftedItem>
            <EndedBox stream={row.stream} day={today} />
          </>
        ),
        lanes: (px) => (
          <ReleaseLanes
            row={row}
            form={form}
            markOf={markOf}
            px={px}
            today={today}
            onOpen={onOpen}
          />
        ),
      }));
    },
    [releaseStreams, shown, live, today, form, onOpen],
  );
  return { range, rows };
}
