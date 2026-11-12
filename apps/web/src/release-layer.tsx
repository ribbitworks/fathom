// SPDX-License-Identifier: Apache-2.0

// The release layer a timeline may show: a row for each release stream, with a lane of its cycles
// drawn at their real lengths above a lane of its releases, each a span across its cycles marked
// on the day it ships.

import classes from "./pages.module.css";
import { releaseColourStyle } from "./releases.ts";
import { draftWords } from "./status-mark.tsx";
import {
  fits,
  type Px,
  type ReleaseLayerRow,
  type TimelineRow,
} from "./timeline.ts";

type ReleaseLayout = ReleaseLayerRow["releases"][number];

// A release's span across its cycles, with a marker on the day it ships and, when that is not the
// end of its last cycle, a line from that end to the marker.
function ReleaseSpan({ span, px }: { span: ReleaseLayout; px: Px }) {
  const { release, at, days, shipsAt } = span;
  const end = at + days;
  const left = Math.min(at, shipsAt);
  const from = (day: number) => px(day - left);
  const draft =
    release.draft === undefined ? "" : `, ${draftWords(release.draft)}`;
  const words = `${release.name}${draft}: ${span.cycleWords}, ships ${span.shipsOn}`;
  return (
    <li
      className={classes.timelineReleaseSlot}
      style={{
        ...releaseColourStyle(release.colour),
        left: px(left),
        width: px(Math.max(end, shipsAt) - left),
      }}
      title={words}
    >
      <span
        className={[
          classes.timelineRelease,
          release.draft === undefined ? "" : classes.timelineReleaseDraft,
        ].join(" ")}
        style={{ left: from(at), width: px(days) }}
        aria-hidden
      >
        {fits(release.name, px.of(days)) && release.name}
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
  row: { stream, cycles, releases },
  px,
}: {
  row: ReleaseLayerRow;
  px: Px;
}) {
  return (
    <>
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
        className={classes.timelineLane}
        aria-label={`Releases of ${stream.name}`}
      >
        {releases.map((span) => (
          <ReleaseSpan key={span.release.id} span={span} px={px} />
        ))}
      </ul>
    </>
  );
}

export const releaseLayerRows = (
  layer: readonly ReleaseLayerRow[],
): TimelineRow[] =>
  layer.map((row) => ({
    id: row.stream.id,
    label: row.stream.name,
    lanes: (px) => <ReleaseLanes row={row} px={px} />,
  }));
