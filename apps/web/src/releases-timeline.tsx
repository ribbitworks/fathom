// SPDX-License-Identifier: Apache-2.0

// The Releases page's timeline: every current release stream on one time axis, each with its cycles
// drawn at their real lengths and its releases as spans across their cycles, each marked on the
// day it ships, with today marked across them all. It shows the streams as their drafts make them,
// and only shows; changes are made in the stream's panel.

import type { ReleaseStream } from "@fathom/shared";
import {
  ActionIcon,
  Button,
  Group,
  Paper,
  SegmentedControl,
  Text,
} from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import {
  type CSSProperties,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import classes from "./pages.module.css";
import { Icon } from "./icons.tsx";
import {
  type AxisScale,
  axisScale,
  labelPadding,
  labelWidth,
  type TimelineLayout,
  timelineAxis,
  timelineLayout,
} from "./timeline.ts";
import { daysBetween } from "./releases.ts";
import { draftWords } from "./status-mark.tsx";

type Preset = "all" | "year" | "half" | "quarter" | "month" | "week" | "days";

// Each zoom offered, with how many days it shows across the view, so a wider screen shows each day
// wider, and how its axis is cut, naming its own period above the next smaller one. All shows the
// whole timeline, cut as finely as its names fit.
const presets: readonly {
  value: Preset;
  label: string;
  shows: number;
  scale?: AxisScale;
}[] = [
  { value: "all", label: "All", shows: Infinity },
  { value: "year", label: "Year", shows: 3 * 365, scale: "halves" },
  { value: "half", label: "6 months", shows: 2 * 365, scale: "quarters" },
  { value: "quarter", label: "Quarter", shows: 365, scale: "months" },
  { value: "month", label: "Month", shows: 180, scale: "weeks" },
  { value: "week", label: "Week", shows: 42, scale: "weeks" },
  { value: "days", label: "Days", shows: 14, scale: "days" },
];

const yearPreset = presets.find(
  ({ value }) => value === "year",
) as (typeof presets)[number];

// Zooming in or out shows a third less, or half as much again; never less than two weeks.
const zoomStep = 1.5;
const leastShown = 14;

// The zoom kept: an offered zoom, or how many days the view shows after zooming in or out.
type Zoom = Preset | number;

// The offered zoom kept, Year when the zoom kept is not one, or none after zooming in or out.
const presetOf = (zoom: Zoom) =>
  typeof zoom === "number"
    ? undefined
    : (presets.find(({ value }) => value === zoom) ?? yearPreset);

// How many days the view shows at a zoom, no more than the whole timeline.
const shownDays = (zoom: Zoom, days: number): number =>
  Math.min(presetOf(zoom)?.shows ?? Math.max(zoom as number, leastShown), days);

// The least room for the tracks, so a narrow screen still shows a few weeks.
const leastRoom = 320;

// A name too long for its cycle, release or period is left out rather than cut short, as hovering
// shows it.
const fits = (
  label: string,
  width: number,
  padding: number = labelPadding.block,
) => width >= labelWidth(label, padding);

// The stream names' column, which the tracks scroll under.
const namesWidth = 140;

interface Px {
  (days: number): string;
  of: (days: number) => number;
  // The pixels a day takes, unrounded.
  day: number;
}

// Rounded, since days at a fraction of a pixel each leave errors such as 62.99999999999999px.
function pxAt(dayWidth: number): Px {
  const of = (days: number) => Math.round(days * dayWidth * 100) / 100;
  return Object.assign((days: number) => `${String(of(days))}px`, {
    of,
    day: dayWidth,
  });
}

type ReleaseLayout = TimelineLayout["rows"][number]["releases"][number];

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
      style={{ left: px(left), width: px(Math.max(end, shipsAt) - left) }}
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

// A day held halfway across the view while the zoom or the view's width changes, counted from
// 1970-01-01, so it stays put when the timeline's first day moves.
type Anchor = number;

const epochDay = (day: string) => daysBetween("1970-01-01", day);

// Today goes a sixth of the way across, so the cycle just ended stays in sight.
const todayShare = 1 / 6;

export function ReleasesTimeline({
  streams,
  today,
}: {
  streams: readonly ReleaseStream[];
  today: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useLocalStorage<Zoom>({
    key: "fathom-releases-timeline-zoom",
    defaultValue: "year",
    // Read before the view is first drawn, so it opens at the zoom kept, not at Year first.
    getInitialValueInEffect: false,
  });
  // The tracks' width in the view, known once the view is drawn.
  const [room, setRoom] = useState<number>();
  // None while today is held a sixth of the way across, until the reader scrolls.
  const anchor = useRef<Anchor>(undefined);
  // Where the timeline last scrolled the view itself, so only the reader's scrolling moves the
  // anchor.
  const scrolledTo = useRef<number>(undefined);
  const layout = useMemo(
    () => timelineLayout(streams, today),
    [streams, today],
  );
  const days = layout?.days;
  const todayAt = layout?.today;
  const shows = days === undefined ? undefined : shownDays(zoom, days);
  const dayWidth =
    room === undefined || shows === undefined ? undefined : room / shows;
  const shown = days !== undefined;
  useLayoutEffect(() => {
    const view = scroller.current;
    if (view === null) return;
    const measure = () => {
      setRoom(Math.max(leastRoom, view.clientWidth - namesWidth));
    };
    measure();
    const watching = new ResizeObserver(measure);
    watching.observe(view);
    return () => {
      watching.disconnect();
    };
  }, [shown]);
  // Opening the page shows today, not the first cycle, which may be years before.
  const place = (view: HTMLDivElement, width: number, roomNow: number) => {
    const { day, share } =
      anchor.current === undefined
        ? { day: todayAt as number, share: todayShare }
        : {
            day: anchor.current - epochDay((layout as TimelineLayout).from),
            share: 1 / 2,
          };
    view.scrollLeft = Math.max(0, day * width - roomNow * share);
    scrolledTo.current = view.scrollLeft;
  };
  useLayoutEffect(() => {
    const view = scroller.current;
    if (view === null || dayWidth === undefined) return;
    if (anchor.current === undefined && todayAt === undefined) return;
    place(view, dayWidth, room as number);
  });
  if (layout === undefined) return null;
  const placed =
    dayWidth === undefined ? undefined : { dayWidth, room: room as number };
  return (
    <section aria-labelledby="releases-timeline-title">
      <Group justify="space-between" mb="xs">
        <Text
          component="h2"
          id="releases-timeline-title"
          fz="md"
          fw={600}
          my={0}
        >
          Timeline
        </Text>
        <Group gap="xs">
          {todayAt !== undefined && placed && (
            <Button
              variant="default"
              size="compact-sm"
              onClick={() => {
                anchor.current = undefined;
                place(
                  scroller.current as HTMLDivElement,
                  placed.dayWidth,
                  placed.room,
                );
              }}
            >
              Today
            </Button>
          )}
          <ActionIcon.Group>
            <ActionIcon
              variant="default"
              aria-label="Zoom out"
              disabled={shows === days}
              onClick={() => {
                setZoom((shows as number) * zoomStep);
              }}
            >
              <Icon name="minus" size={14} />
            </ActionIcon>
            <ActionIcon
              variant="default"
              aria-label="Zoom in"
              disabled={shows === leastShown}
              onClick={() => {
                setZoom((shows as number) / zoomStep);
              }}
            >
              <Icon name="plus" size={14} />
            </ActionIcon>
          </ActionIcon.Group>
          {/* None is chosen, "", after zooming in or out; choosing one gives an offered zoom. */}
          <SegmentedControl<Preset | "">
            size="xs"
            aria-label="Zoom"
            value={presetOf(zoom)?.value ?? ""}
            onChange={(value) => {
              setZoom(value as Preset);
            }}
            data={presets.map(({ value, label }) => ({ value, label }))}
          />
        </Group>
      </Group>
      <Paper withBorder className={classes.tablePanel}>
        <div
          ref={scroller}
          className={classes.timelineScroll}
          // Focusable, so the keyboard scrolls it in every browser.
          tabIndex={0}
          role="group"
          aria-labelledby="releases-timeline-title"
          onScroll={
            placed &&
            (({ currentTarget: { scrollLeft } }) => {
              if (scrollLeft === scrolledTo.current) return;
              anchor.current =
                epochDay(layout.from) +
                (scrollLeft + placed.room / 2) / placed.dayWidth;
            })
          }
        >
          {placed && (
            <Tracks
              layout={layout}
              scale={presetOf(zoom)?.scale ?? axisScale(placed.dayWidth)}
              px={pxAt(placed.dayWidth)}
              today={today}
            />
          )}
        </div>
      </Paper>
    </section>
  );
}

// The axis, each stream's cycles and releases, and today's line, at a scale.
function Tracks({
  layout,
  scale,
  px,
  today,
}: {
  layout: TimelineLayout;
  scale: AxisScale;
  px: Px;
  today: string;
}) {
  const axis = useMemo(() => timelineAxis(layout, scale), [layout, scale]);
  // Weeks show their days as short marks along the bottom, when far enough apart to see, below the
  // weeks' full lines and spaced by the unrounded day so they never drift beside them.
  const dayMarks =
    scale === "weeks" && px.day >= 8
      ? {
          backgroundImage: `repeating-linear-gradient(to right, var(--mantine-color-default-border) 0 1px, transparent 1px ${String(px.day)}px)`,
          backgroundSize: "100% 5px",
          backgroundPosition: "left bottom",
          backgroundRepeat: "no-repeat",
        }
      : undefined;
  const width = { width: px(layout.days) };
  const tier = (ticks: typeof axis.ticks, style?: CSSProperties) => (
    <div className={classes.timelineTier} style={style}>
      {ticks.map(({ day, label, short, at, days }) => (
        <span
          key={day}
          className={classes.timelineTick}
          style={{ left: px(at), width: px(days) }}
        >
          {[label, short].find(
            (words) =>
              words !== undefined &&
              fits(words, px.of(days), labelPadding.axis),
          )}
        </span>
      ))}
    </div>
  );
  return (
    <div
      className={classes.timeline}
      style={{ "--timeline-label": `${String(namesWidth)}px` } as CSSProperties}
    >
      <div className={classes.timelineHead} aria-hidden>
        <div className={classes.timelineLabel} />
        <div className={classes.timelineTrack} style={width}>
          <div className={classes.timelineMarks} />
          {axis.above.length > 0 && tier(axis.above)}
          {tier(axis.ticks, dayMarks)}
        </div>
      </div>
      <ul className={classes.timelineRows} aria-label="Release streams">
        {layout.rows.map(({ stream, cycles, releases }) => (
          <li key={stream.id} className={classes.timelineRow}>
            <div className={classes.timelineLabel}>{stream.name}</div>
            <div className={classes.timelineTrack} style={width}>
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
            </div>
          </li>
        ))}
      </ul>
      {layout.today !== undefined && (
        <div
          className={classes.timelineToday}
          style={{ left: `calc(var(--timeline-label) + ${px(layout.today)})` }}
        >
          <span className={classes.timelineTodayLabel}>
            Today<span className={classes.visuallyHidden}>, {today}</span>
          </span>
        </div>
      )}
    </div>
  );
}
