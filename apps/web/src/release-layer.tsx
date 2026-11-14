// SPDX-License-Identifier: Apache-2.0

// The release layer a timeline may show: a row for each release stream, labelled with its name and
// its draft's marks, with a lane of its cycles drawn at their real lengths above a lane of its
// releases, each a span across its cycles with its Ships on diamond under it, and, beside live, a
// Live lane holding each release a draft moves in its old place. The streams are shown as the
// Draft view around the timeline shows them, and each mark is given its record's own draft.

import type { RecordDraft, ReleaseStream } from "@fathom/shared";
import { useCallback, useMemo } from "react";
import classes from "./pages.module.css";
import {
  draftsById,
  liveStreams,
  markedDraft,
  releaseColourStyle,
  streamsShown,
} from "./releases.ts";
import {
  besideLive,
  DraftedItem,
  draftedItemChars,
  draftMarkChars,
  draftTip,
  liveWaitingWords,
  MarkedItem,
  useDraftView,
  viewedDraft,
} from "./status-mark.tsx";
import { TableTips, Tipped, tipAttribute } from "./table-tips.tsx";
import {
  charactersWidth,
  type DayRange,
  fits,
  labelPadding,
  type Px,
  releaseLayer,
  releaseLayerRange,
  type ReleaseLayerRow,
  type ReleaseSpan,
  type TimelineRow,
} from "./timeline.ts";

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
}: {
  span: ReleaseSpan;
  px: Px;
  mark: BarMark;
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
    labelPadding.block + charactersWidth(markRoom),
  )
    ? release.name
    : undefined;
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
        {mark.live ? (
          <MarkedItem tone="live">{name}</MarkedItem>
        ) : (
          <DraftedItem draft={draft} heldBy={mark.heldBy}>
            {name}
          </DraftedItem>
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
      <span className={classes.visuallyHidden}>{words}</span>
    </li>
  );
}

function ReleaseLanes({
  row: { stream, cycles, releases, live },
  markOf,
  px,
}: {
  row: ReleaseLayerRow;
  markOf: (id: string) => BarMark;
  px: Px;
}) {
  // One tooltip for the stream's releases, showing the tip of what is pointed at, so a draft's dot
  // shows its own tip alone, rather than with its release's.
  return (
    <TableTips>
      <ul
        className={classes.timelineLane}
        aria-label={`Cycles of ${stream.name}`}
      >
        {cycles.map((cycle) => (
          <li
            key={cycle.startsOn}
            className={classes.timelineCycle}
            style={{ left: px(cycle.at), width: px(cycle.days) }}
            title={`${cycle.name}: ${cycle.startsOn} to ${cycle.endsOn}`}
          >
            <span aria-hidden>
              {fits(cycle.name, px.of(cycle.days)) && cycle.name}
            </span>
            <span className={classes.visuallyHidden}>
              {cycle.name}, {cycle.startsOn} to {cycle.endsOn}
            </span>
          </li>
        ))}
      </ul>
      <ul
        className={[classes.timelineLane, classes.timelineReleaseLane].join(
          " ",
        )}
        aria-label={`Releases of ${stream.name}`}
      >
        {releases.map((span) => (
          <ReleaseBar
            key={span.release.id}
            span={span}
            px={px}
            mark={markOf(span.release.id)}
          />
        ))}
      </ul>
      {live.length > 0 && (
        <ul
          className={[classes.timelineLane, classes.timelineReleaseLane].join(
            " ",
          )}
          aria-label={`Releases of ${stream.name} as they are live`}
        >
          {live.map((span) => (
            <ReleaseBar
              key={span.release.id}
              span={span}
              px={px}
              mark={{ live: true }}
            />
          ))}
        </ul>
      )}
    </TableTips>
  );
}

// The release layer of every stream with its drafts, as the Draft view around it shows them: the
// days it covers, and its rows on a timeline starting on a day.
export function useReleaseLayer(releaseStreams: readonly ReleaseStream[]): {
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
          <DraftedItem
            draft={markedDraft(
              drafts.get(row.stream.id),
              retired.get(row.stream.id),
            )}
            heldBy={heldBy.get(row.stream.id)}
          >
            <Tipped tip={row.stream.name} className={classes.timelineLabelName}>
              {row.stream.name}
            </Tipped>
          </DraftedItem>
        ),
        lanes: (px) => <ReleaseLanes row={row} markOf={markOf} px={px} />,
      }));
    },
    [releaseStreams, shown, live],
  );
  return { range, rows };
}
