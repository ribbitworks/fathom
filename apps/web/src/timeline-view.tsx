// SPDX-License-Identifier: Apache-2.0

// The timeline every view with time across it shares: a time axis, each day the same width at each
// zoom, with the view's rows under it, release streams' cycles and releases as a layer the view may
// show, today marked across them all, and a strip of quarters above it. It only shows; changes are
// made elsewhere.

import type { ReleaseStream } from "@fathom/shared";
import {
  ActionIcon,
  Group,
  Paper,
  SegmentedControl,
  Text,
} from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import classes from "./pages.module.css";
import { Icon } from "./icons.tsx";
import { useReleaseLayer } from "./release-layer.tsx";
import { daysBetween } from "./releases.ts";
import {
  type AxisScale,
  axisScale,
  dayRange,
  type DayRange,
  fits,
  labelPadding,
  type Px,
  pxAt,
  type TimelineFrame,
  timelineAxis,
  timelineFrame,
  timelineQuarters,
  type TimelineRow,
} from "./timeline.ts";
import { TimelineStrip } from "./timeline-strip.tsx";

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

// The rows' labels' column, which the tracks scroll under.
const namesWidth = 140;

// A day held halfway across the view while the zoom or the view's width changes, counted from
// 1970-01-01, so it stays put when the timeline's first day moves.
type Anchor = number;

const epochDay = (day: string) => daysBetween("1970-01-01", day);

// Today, and a quarter chosen in the strip, go a sixth of the way across, so what came just before
// stays in sight.
const todayShare = 1 / 6;

// Scrolling lands on whole pixels, so a quarter's start this close to a place is at it.
const edgeTolerance = 1;

const noStreams: readonly ReleaseStream[] = [];

// The day in the middle of the view, counted from 1970-01-01, when scrolled this far.
const middleDay = (
  frame: TimelineFrame,
  scrollLeft: number,
  { px, room }: { px: Px; room: number },
): Anchor => epochDay(frame.from) + (scrollLeft + room / 2) / px.day;

// The furthest the view scrolls, with the timeline's end at its right edge.
const furthestScroll = (
  frame: TimelineFrame,
  { px, room }: { px: Px; room: number },
) => Math.max(0, px.of(frame.days) - room);

// A group of rows, named for assistive technology, such as Release streams.
interface RowGroup {
  name: string;
  rows: readonly TimelineRow[];
}

export function TimelineView({
  title,
  zoomKey,
  today,
  releaseStreams = noStreams,
  rows,
}: {
  title: string;
  // Where the zoom is kept in the browser.
  zoomKey: string;
  today: string;
  // The release streams whose cycles and releases are shown first, as a layer, each with its
  // drafts, shown as the Draft view around the timeline shows them.
  releaseStreams?: readonly ReleaseStream[];
  // The view's own rows, under the release layer, with the days they cover.
  rows?: (RowGroup & { range: DayRange }) | undefined;
}) {
  const titleId = useId();
  const scroller = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useLocalStorage<Zoom>({
    key: zoomKey,
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
  const { range: layerRange, rows: layerRows } =
    useReleaseLayer(releaseStreams);
  // The frame is built from days alone, so a view handing over equal streams or rows anew on each
  // render doesn't rebuild the axis, the quarters and the strip.
  const frame = useMemo(
    () =>
      timelineFrame(
        [
          dayRange(layerRange?.first, layerRange?.last),
          dayRange(rows?.range.first, rows?.range.last),
        ].filter((range) => range !== undefined),
        today,
      ),
    [
      layerRange?.first,
      layerRange?.last,
      rows?.range.first,
      rows?.range.last,
      today,
    ],
  );
  const groups = useMemo(() => {
    if (frame === undefined) return [];
    const releaseRows = layerRows(frame.from);
    return [
      ...(releaseRows.length > 0
        ? [{ name: "Release streams", rows: releaseRows }]
        : []),
      ...(rows === undefined ? [] : [rows]),
    ];
  }, [frame, layerRows, rows]);
  const days = frame?.days;
  const todayAt = frame?.today;
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
            day: anchor.current - epochDay((frame as TimelineFrame).from),
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
  const viewElement = useCallback(() => scroller.current as HTMLDivElement, []);
  const px = useMemo(
    () => (dayWidth === undefined ? undefined : pxAt(dayWidth)),
    [dayWidth],
  );
  if (frame === undefined) return null;
  const placed = px === undefined ? undefined : { px, room: room as number };
  // Scrolls the day given a sixth of the way across, as far as the timeline goes, and holds the day
  // then in the middle while zooming.
  const scrollToDay = (at: number, placed: { px: Px; room: number }) => {
    const view = scroller.current as HTMLDivElement;
    view.scrollLeft = Math.min(
      furthestScroll(frame, placed),
      Math.max(0, at * placed.px.day - placed.room * todayShare),
    );
    scrolledTo.current = view.scrollLeft;
    anchor.current = middleDay(frame, view.scrollLeft, placed);
  };
  return (
    <section aria-labelledby={titleId} className={classes.timelineSection}>
      <Group justify="space-between" mb="xs">
        <Text component="h2" id={titleId} fz="md" fw={600} my={0}>
          {title}
        </Text>
        <Group gap="xs">
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
      {placed && (
        <QuarterStrip
          frame={frame}
          view={viewElement}
          px={placed.px}
          room={placed.room}
          onScrollTo={(at) => {
            scrollToDay(at, placed);
          }}
          onToday={
            todayAt === undefined
              ? undefined
              : () => {
                  anchor.current = undefined;
                  place(
                    scroller.current as HTMLDivElement,
                    placed.px.day,
                    placed.room,
                  );
                }
          }
        />
      )}
      <Paper withBorder className={classes.timelinePanel}>
        <div
          ref={scroller}
          className={classes.timelineScroll}
          // Focusable, so the keyboard scrolls it in every browser.
          tabIndex={0}
          role="group"
          aria-labelledby={titleId}
          onScroll={
            placed &&
            (({ currentTarget: { scrollLeft } }) => {
              if (scrollLeft === scrolledTo.current) return;
              anchor.current = middleDay(frame, scrollLeft, placed);
            })
          }
        >
          {placed && (
            <Tracks
              frame={frame}
              groups={groups}
              scale={presetOf(zoom)?.scale ?? axisScale(placed.px.day)}
              px={placed.px}
              today={today}
            />
          )}
        </div>
      </Paper>
    </section>
  );
}

const quarterWords = {
  group: "Quarters",
  previous: "Previous quarter",
  next: "Next quarter",
};

// The strip of the timeline's quarters, following the view as it scrolls: a quarter chosen, or
// reached by an arrow, is scrolled a sixth of the way across.
function QuarterStrip({
  frame,
  view,
  px,
  room,
  onScrollTo,
  onToday,
}: {
  frame: TimelineFrame;
  // The view the strip follows, there whenever the strip is.
  view: () => HTMLDivElement;
  px: Px;
  room: number;
  onScrollTo: (at: number) => void;
  onToday: (() => void) | undefined;
}) {
  const quarters = useMemo(() => timelineQuarters(frame), [frame]);
  // Where the view is scrolled to, read from it, since the view also scrolls itself.
  const [left, setLeft] = useState(0);
  // After the timeline places the view, which it does after the strip is drawn, and as it scrolls.
  useEffect(() => {
    const scrolled = view();
    const follow = () => {
      setLeft(scrolled.scrollLeft);
    };
    follow();
    scrolled.addEventListener("scroll", follow);
    return () => {
      scrolled.removeEventListener("scroll", follow);
    };
  }, [view, frame, px, room]);
  const scrollTo = (at: number) => {
    onScrollTo(at);
    setLeft(view().scrollLeft);
  };
  const right = left + room;
  const furthest = furthestScroll(frame, { px, room });
  // Where a quarter chosen lands, a sixth of the way across, which the arrows step from.
  const mark = left + room * todayShare;
  // The last quarter's start before the mark, or the timeline's start, and the next after it, or
  // the timeline's end.
  const previousAt = quarters.reduce(
    (found, { at }) => (px.of(at) < mark - edgeTolerance ? at : found),
    0,
  );
  const nextAt = quarters.reduceRight(
    (found, { at }) => (px.of(at) > mark + edgeTolerance ? at : found),
    frame.days,
  );
  return (
    <TimelineStrip
      words={quarterWords}
      periods={quarters.map(({ day, label, short, at, days }) => ({
        key: day,
        onChoose: () => {
          scrollTo(at);
        },
        label,
        short,
        weight: days,
        inView: px.of(at) < right && px.of(at + days) > left,
        current:
          frame.today !== undefined &&
          frame.today >= at &&
          frame.today < at + days,
      }))}
      onPrevious={
        left <= edgeTolerance
          ? undefined
          : () => {
              scrollTo(previousAt);
            }
      }
      onNext={
        left >= furthest - edgeTolerance
          ? undefined
          : () => {
              scrollTo(nextAt);
            }
      }
      onToday={
        onToday &&
        (() => {
          onToday();
          setLeft(view().scrollLeft);
        })
      }
    />
  );
}

// The axis, each group's rows, and today's line, at a scale.
function Tracks({
  frame,
  groups,
  scale,
  px,
  today,
}: {
  frame: TimelineFrame;
  groups: readonly RowGroup[];
  scale: AxisScale;
  px: Px;
  today: string;
}) {
  const axis = useMemo(() => timelineAxis(frame, scale), [frame, scale]);
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
  const width = { width: px(frame.days) };
  const tier = (ticks: typeof axis.ticks, style?: CSSProperties) => (
    <div className={classes.timelineTier} style={style} aria-hidden>
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
      <div className={classes.timelineHead}>
        <div className={classes.timelineLabel} />
        <div className={classes.timelineTrack} style={width}>
          <div className={classes.timelineMarks} />
          {axis.above.length > 0 && tier(axis.above)}
          {tier(axis.ticks, dayMarks)}
          {frame.today !== undefined && (
            <div
              className={classes.timelineToday}
              style={{ left: px(frame.today) }}
            >
              <span className={classes.timelineTodayLabel}>
                Today<span className={classes.visuallyHidden}>, {today}</span>
              </span>
            </div>
          )}
        </div>
      </div>
      <div className={classes.timelineBody}>
        {groups.map(({ name, rows }) => (
          <ul key={name} className={classes.timelineRows} aria-label={name}>
            {rows.map(({ id, label, lanes }) => (
              <li key={id} className={classes.timelineRow}>
                <div className={classes.timelineLabel}>{label}</div>
                <div className={classes.timelineTrack} style={width}>
                  {lanes(px)}
                </div>
              </li>
            ))}
          </ul>
        ))}
        {frame.today !== undefined && (
          <div
            className={classes.timelineToday}
            style={{
              left: `calc(var(--timeline-label) + ${px(frame.today)})`,
            }}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
