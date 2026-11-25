// SPDX-License-Identifier: Apache-2.0

// A page's content with side panels beside it: their width and slide, the stack of panels open at
// once, and each panel's frame.

import { allOf } from "@fathom/shared";
import { ActionIcon, FocusTrap } from "@mantine/core";
import {
  useLocalStorage,
  useMediaQuery,
  usePrevious,
  useReducedMotion,
} from "@mantine/hooks";
import {
  createContext,
  type CSSProperties,
  Fragment,
  memo,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Icon } from "./icons.tsx";
import { ResizeEdge } from "./resize-edge.tsx";
import classes from "./side-panel.module.css";

// The panel's width in pixels: at first, and the least it and the content beside it may have.
export const panelWidths = { start: 640, least: 320, step: 32 } as const;

// The width to give the panel, kept between the least it may have and the most that leaves the
// content its least.
export function panelWidth(wanted: number, room: number): number {
  return Math.round(
    Math.max(panelWidths.least, Math.min(wanted, room - panelWidths.least)),
  );
}

export const useNarrow = () => useMediaQuery("(max-width: 48em)");

// A panel beside the content. Several open at once are stacked, the first at the top, each taking a
// share of the height that the edges between them move, kept for next time by the kind of panel, or
// as tall as what it holds, with no edge beside it.
export interface SidePanel {
  // The kind of panel, such as "metrics", by which its share of the height is kept.
  key: string;
  // The panel's id, which the edges that resize it control.
  id: string;
  // The panel's name in the names of those edges, such as "metrics".
  name: string;
  node: ReactNode;
  // As tall as what it holds, under another panel, leaving the rest to the panels beside it.
  fits?: boolean;
}

// The least share of the height a stacked panel may have, against the one beside it, in percent,
// and how far the arrow keys move the edge between them.
export const stackShares = { least: 20, step: 5 } as const;

const joined = (...names: (string | false | undefined)[]) =>
  names.filter((name) => typeof name === "string").join(" ");

// The panels' names in words, such as "Background and metrics", for the edges that resize them.
const namesOf = (panels: readonly SidePanel[]) =>
  allOf(panels.map(({ name }) => name));

// A panel under another may be maximized, on a screen wide enough to stack them.
export const maximizable = (
  keys: readonly string[],
  key: string,
  narrow: boolean,
): boolean => !narrow && keys.indexOf(key) > 0;

// Opening or closing any panel restores the stack, so a panel opened shows.
export const maximizedPanel = (
  keys: readonly string[],
  openBefore: readonly string[],
  asked: string | undefined,
  narrow: boolean,
): string | undefined =>
  asked !== undefined &&
  maximizable(keys, asked, narrow) &&
  keys.length === openBefore.length &&
  keys.every((key) => openBefore.includes(key))
    ? asked
    : undefined;

interface StackPlace {
  name: string;
  maximized: boolean;
  onToggle: () => void;
}

const StackPlaceContext = createContext<StackPlace | undefined>(undefined);

// How long a panel's motion may take before it is taken as ended, for a browser that never says it
// has, such as one that skips it.
export const motionLasts = 400;

// Ends a motion once it has had its time, if the browser has not said it ended, the time starting
// again whenever the motion's aim changes.
function useMotionEnds(moving: boolean, ended: () => void, aim?: unknown) {
  const end = useRef(ended);
  useLayoutEffect(() => {
    end.current = ended;
  });
  useEffect(() => {
    if (!moving) return;
    const timer = setTimeout(() => {
      end.current();
    }, motionLasts);
    return () => {
      clearTimeout(timer);
    };
  }, [moving, aim]);
}

// The panels a stack shows: those open, and those just closed while others stay, which stay where
// they were, out of reach, while they shrink away. Those opened beside others are arriving while they
// grow into their place. Without motion, a panel comes and goes at once, as one as tall as what it
// holds always does, since its height can't be moved to.
function useStackChanges(
  panels: readonly SidePanel[],
  moves: boolean,
  // Those that come and go at once: a panel that may be as tall as what it holds, since its height
  // can't be slid to, even where it fills the column instead.
  movesAtOnce: (panel: SidePanel) => boolean,
) {
  const [leaving, setLeaving] = useState<
    readonly { panel: SidePanel; at: number }[]
  >([]);
  const [arriving, setArriving] = useState<readonly string[]>([]);
  const before = usePrevious(panels);
  const keys = panels.map(({ key }) => key);
  if (!moves && (leaving.length > 0 || arriving.length > 0)) {
    setLeaving([]);
    setArriving([]);
  }
  if (before !== undefined && moves) {
    const gone = before.filter(
      (panel) =>
        !keys.includes(panel.key) &&
        !movesAtOnce(panel) &&
        !leaving.some((gone) => gone.panel.key === panel.key),
    );
    if (gone.length > 0) {
      setLeaving([
        ...leaving,
        ...gone.map((panel) => ({ panel, at: before.indexOf(panel) })),
      ]);
    }
    const added = panels
      .filter(
        (panel) =>
          !before.some(({ key }) => key === panel.key) &&
          !movesAtOnce(panel) &&
          !arriving.includes(panel.key),
      )
      .map(({ key }) => key);
    if (added.length > 0) setArriving([...arriving, ...added]);
  }
  // A panel opened again while it shrinks away stays.
  if (leaving.some(({ panel }) => keys.includes(panel.key))) {
    setLeaving(leaving.filter(({ panel }) => !keys.includes(panel.key)));
  }
  useMotionEnds(leaving.length > 0 || arriving.length > 0, () => {
    setLeaving([]);
    setArriving([]);
  });
  const shown = [...panels];
  for (const { panel, at } of leaving) {
    shown.splice(Math.min(at, shown.length), 0, panel);
  }
  return {
    shown,
    isLeaving: (panel: SidePanel) => !keys.includes(panel.key),
    isArriving: (panel: SidePanel) => arriving.includes(panel.key),
    settled: (key: string) => {
      setLeaving((current) => current.filter(({ panel }) => panel.key !== key));
      setArriving((current) => current.filter((arrived) => arrived !== key));
    },
  };
}

// Each stacked panel's share of the height, kept for next time by the kind of panel, and moving the
// edge between two to share it differently, leaving each its least.
function useStackHeights(storageKey: string) {
  const [heights, setHeights] = useLocalStorage<Record<string, number>>({
    key: `${storageKey}-heights`,
    defaultValue: {},
  });
  const height = (panel: SidePanel) => heights[panel.key] ?? 1;
  // The share of the height of the panel above an edge, of it and the one below, in percent.
  const shareOf = (above: SidePanel, below: SidePanel) =>
    Math.round((100 * height(above)) / (height(above) + height(below)));
  const share = (above: SidePanel, below: SidePanel, wanted: number) => {
    const kept = Math.max(
      stackShares.least,
      Math.min(100 - stackShares.least, wanted),
    );
    const both = height(above) + height(below);
    setHeights((current) => ({
      ...current,
      [above.key]: (both * kept) / 100,
      [below.key]: (both * (100 - kept)) / 100,
    }));
  };
  return { height, shareOf, share };
}

// The keys of a stack's panels open now and as it was last drawn.
interface StackKeys {
  keys: readonly string[];
  before: readonly string[];
}

// Whether a panel asks to be as tall as what it holds.
const fits = (panel: SidePanel) => panel.fits === true;

// The panel a narrow screen shows of a stack, where only one fits: the one opened last, or, once it
// closes, the one in front before it. Of panels opened together, the top one is in front.
function useFrontPanel({ keys, before }: StackKeys): string | undefined {
  const [order, setOrder] = useState<readonly string[]>(() =>
    [...keys].reverse(),
  );
  const opened = keys.filter((key) => !before.includes(key)).reverse();
  const now = [
    ...keys.filter((key) => !order.includes(key) && !opened.includes(key)),
    ...order.filter((key) => keys.includes(key) && !opened.includes(key)),
    ...opened,
  ];
  if (now.join("\n") !== order.join("\n")) setOrder(now);
  return now.at(-1);
}

// The panel maximized in a stack, and its place for each panel under another; the stack folds the
// panels above it away, or unfolds them, with motion where the stack moves.
function useMaximized(
  { keys, before }: StackKeys,
  narrow: boolean,
  moves: boolean,
) {
  const [asked, setAsked] = useState<string>();
  const maximized = maximizedPanel(keys, before, asked, narrow);
  if (asked !== undefined && maximized === undefined) setAsked(undefined);
  const [folding, setFolding] = useState<{ to: string | undefined }>();
  const wasMaximized = usePrevious(maximized);
  if (
    moves &&
    wasMaximized !== maximized &&
    (folding === undefined || folding.to !== maximized)
  ) {
    setFolding({ to: maximized });
  }
  useMotionEnds(
    folding !== undefined,
    () => {
      setFolding(undefined);
    },
    folding,
  );
  const placeOf = (panel: SidePanel): StackPlace | undefined =>
    maximizable(keys, panel.key, narrow)
      ? {
          name: panel.name,
          maximized: maximized === panel.key,
          onToggle: () => {
            setAsked(maximized === panel.key ? undefined : panel.key);
          },
        }
      : undefined;
  return { maximized, folding: folding !== undefined, placeOf };
}

// Not drawn again while only the panels' width changes, as while their edge is dragged.
const PanelStack = memo(function PanelStack({
  panels,
  storageKey,
  moves,
  narrow,
}: {
  panels: readonly SidePanel[];
  storageKey: string;
  moves: boolean;
  narrow: boolean;
}) {
  const { height, shareOf, share } = useStackHeights(storageKey);
  const { shown, isLeaving, isArriving, settled } = useStackChanges(
    panels,
    moves,
    fits,
  );
  const keys = panels.map(({ key }) => key);
  const stackKeys = { keys, before: usePrevious(keys) ?? keys };
  const { maximized, folding, placeOf } = useMaximized(
    stackKeys,
    narrow,
    moves,
  );
  const front = useFrontPanel(stackKeys);
  const items = useRef(new Map<string, HTMLDivElement>());
  // Shares are kept as weights, scaled so the smallest open is 1: a flex item whose weights add up
  // to less than 1 takes only that part of the room, so a panel left alone after its neighbour
  // closed would stop short of the bottom.
  const smallest = Math.min(...shown.map(height));
  // Where each panel is drawn, by the time an edge beside it is moved.
  const box = (panel: SidePanel) =>
    (items.current.get(panel.key) as HTMLDivElement).getBoundingClientRect();
  // A panel is as tall as what it holds only under another, with none maximized; alone or
  // maximized, it fills the column as any panel does.
  // A narrow screen shows one panel, covering it.
  const fitted = (panel: SidePanel) =>
    fits(panel) &&
    !narrow &&
    keys.indexOf(panel.key) > 0 &&
    maximized === undefined;
  return (
    <div
      className={joined(
        classes.stack,
        folding && classes.stackFolding,
        panels.some(fitted) && classes.stackFitting,
      )}
      style={
        {
          "--stack-least": `${String(stackShares.least)}%`,
        } as CSSProperties
      }
    >
      {shown.map((panel, at) => {
        const above = shown[at - 1];
        const gone = isLeaving(panel);
        const hidden = maximized !== undefined && maximized !== panel.key;
        return (
          <Fragment key={panel.key}>
            {above !== undefined && (
              <div
                className={joined(
                  classes.stackEdge,
                  (gone ||
                    isLeaving(above) ||
                    isArriving(above) ||
                    isArriving(panel)) &&
                    classes.stackEdgeMoving,
                  (gone || isLeaving(above)) && classes.stackEdgeLeaving,
                  maximized !== undefined && classes.stackEdgeFolded,
                )}
                inert={gone || isLeaving(above) || maximized !== undefined}
              >
                {/* Beside a panel as tall as what it holds, the gap stays, with no height to move. */}
                {!fitted(above) && !fitted(panel) && (
                  <ResizeEdge
                    separator={{
                      vertical: false,
                      label: `Resize heights of ${namesOf([above, panel])}`,
                      controls: `${above.id} ${panel.id}`,
                      value: shareOf(above, panel),
                      least: stackShares.least,
                      most: 100 - stackShares.least,
                      onStep: (step) => {
                        share(
                          above,
                          panel,
                          shareOf(above, panel) + step * stackShares.step,
                        );
                      },
                    }}
                    className={classes.stackResizer}
                    onDrag={({ y }) => {
                      const top = box(above).top;
                      share(
                        above,
                        panel,
                        (100 * (y - top)) / (box(panel).bottom - top),
                      );
                    }}
                  />
                )}
              </div>
            )}
            <div
              ref={(element) => {
                if (element === null) items.current.delete(panel.key);
                else items.current.set(panel.key, element);
              }}
              className={joined(
                classes.stackItem,
                isArriving(panel) && classes.stackItemArriving,
                gone && classes.stackItemLeaving,
                hidden && classes.stackItemFolded,
                panel.key !== front && classes.stackItemBehind,
                fitted(panel) && classes.stackItemFitted,
              )}
              style={
                { "--stack-share": height(panel) / smallest } as CSSProperties
              }
              inert={gone || hidden}
              onTransitionEnd={(event) => {
                if (event.target === event.currentTarget) settled(panel.key);
              }}
              onTransitionCancel={(event) => {
                if (event.target === event.currentTarget) settled(panel.key);
              }}
            >
              <StackPlaceContext value={placeOf(panel)}>
                {panel.node}
              </StackPlaceContext>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
});

// The panels' slide: opening while they slide in, and those just closed, which stay, out of reach and
// as wide as they were, while they slide out. Panels already open as the page is drawn, or opened or
// closed without motion or on a narrow screen, do not slide.
function usePanelSlide(
  panel: ReactNode | false,
  width: number,
  slides: boolean,
) {
  const open = panel !== false;
  const [closing, setClosing] = useState<{ node: ReactNode; width: number }>();
  const [opening, setOpening] = useState(false);
  const previous = usePrevious(panel);
  const previousWidth = usePrevious(width);
  if (open && closing !== undefined) setClosing(undefined);
  if (!slides && (opening || closing !== undefined)) {
    setOpening(false);
    setClosing(undefined);
  }
  if (open && previous === false && slides && !opening) setOpening(true);
  if (!open && previous && slides && closing?.node !== previous) {
    // Panels shown before have had a width.
    setClosing({ node: previous, width: previousWidth as number });
  }
  const slid = () => {
    setOpening(false);
    setClosing(undefined);
  };
  useMotionEnds(opening || closing !== undefined, slid);
  return { shown: open ? panel : closing?.node, opening, closing, slid };
}

// The layout's width as if the page had no scroll bar, given the window's width and the page's
// beside any scroll bar, so the panels keep their width as the page's scroll bar comes and goes.
// While it shows, the content beside the panels may have that much less than its least.
export const roomWithoutScrollBar = (
  layoutWidth: number,
  windowWidth: number,
  pageWidth: number,
) => layoutWidth + Math.max(0, windowWidth - pageWidth);

const roomOf = (layout: HTMLDivElement) =>
  roomWithoutScrollBar(
    layout.getBoundingClientRect().width,
    window.innerWidth,
    document.documentElement.clientWidth,
  );

// The layout's width, so the panels leave the content its least however wide they were left.
function useRoom(layout: RefObject<HTMLDivElement | null>) {
  const [room, setRoom] = useState(0);
  useLayoutEffect(() => {
    const element = layout.current as HTMLDivElement;
    const measure = () => {
      setRoom(roomOf(element));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [layout]);
  return room;
}

export function WithSidePanel({
  panels,
  storageKey,
  children,
}: {
  // The panels open, top to bottom, or none while all are closed.
  panels: readonly SidePanel[];
  // Where the panels' width, and their shares of the height, are kept for next time. The width is
  // the same whichever panels are open.
  storageKey: string;
  children: ReactNode;
}) {
  const narrow = useNarrow();
  const reduceMotion = useReducedMotion();
  const layout = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useLocalStorage<number>({
    key: storageKey,
    defaultValue: panelWidths.start,
  });
  const shownWidth = panelWidth(width, useRoom(layout));
  const open = panels.length > 0;
  const moves = !reduceMotion && !narrow;
  const panel = open && (
    <PanelStack
      panels={panels}
      storageKey={storageKey}
      moves={moves}
      narrow={narrow}
    />
  );
  const { shown, opening, closing, slid } = usePanelSlide(
    panel,
    shownWidth,
    moves,
  );
  // While the panels slide, the content keeps the width it has once they are closed.
  const sliding = opening || closing !== undefined;
  const resize = (wanted: number) => {
    setWidth(panelWidth(wanted, roomOf(layout.current as HTMLDivElement)));
  };
  return (
    <div
      ref={layout}
      className={joined(classes.layout, sliding && classes.layoutSliding)}
      style={
        {
          "--side-panel-column": `${String(open && !narrow && !sliding ? shownWidth : 0)}px`,
          "--side-panel-shown": `${String(closing?.width ?? shownWidth)}px`,
        } as CSSProperties
      }
    >
      {children}
      {shown && (
        // Kept in place on a narrow screen too, where the panels cover the screen by their own
        // styles, so what they hold stays as it was when the window narrows or widens. Marked, so a
        // page that closes its panel on a click outside it leaves clicks on the edge be.
        <div
          className={joined(
            classes.panelPlace,
            narrow && classes.panelPlaceNarrow,
            sliding && classes.sliding,
            opening && classes.entering,
            closing !== undefined && classes.leaving,
          )}
          data-side-panel
          inert={!open}
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) slid();
          }}
        >
          {!narrow && (
            <ResizeEdge
              separator={{
                vertical: true,
                label: `Resize ${namesOf(panels)}`,
                controls: panels.map(({ id }) => id).join(" "),
                value: width,
                least: panelWidths.least,
                onStep: (step) => {
                  // Moving the edge left widens the panel.
                  resize(width - step * panelWidths.step);
                },
              }}
              className={classes.resizer}
              onDrag={({ x }) => {
                const right = (
                  layout.current as HTMLDivElement
                ).getBoundingClientRect().right;
                resize(right - x);
              }}
            />
          )}
          {shown}
        </div>
      )}
    </div>
  );
}

// The line under a panel's title, such as its record's key, placed by the panel's own layout.
export function PanelSubtitle({
  className,
  children,
}: {
  className: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className={[classes.subtitle, className].join(" ")}>{children}</div>
  );
}

// Whether a dropdown is open from an element, such as a select's choices or a menu: Mantine marks
// it, since its Esc closes the dropdown without stopping a dialog or panel around it hearing it.
const hasOpenDropdown = (target: EventTarget) =>
  target instanceof HTMLElement &&
  target.getAttribute("data-mantine-stop-propagation") === "true";

// A side panel's frame: its title, with any controls for the whole record beside it and a line
// under it, a close button unless it closes only by its own buttons, what it holds, scrolling, and
// a foot that stays in view, such as Save. What it holds scrolls in the frame, or in a box of
// `sidePanelScroll` right inside it, for the edge drawn above it once scrolled. Esc closes it too,
// unless something inside has used it already or it closes a dropdown. Under another panel, it
// offers Maximize. Covering the content on a narrow screen, it holds focus until it is closed.
export function SidePanelFrame({
  id,
  titleId,
  title,
  marked,
  actions,
  subtitle,
  narrow,
  close,
  foot,
  children,
}: {
  id: string;
  titleId: string;
  title: ReactNode;
  // The record's marks drawn around the title, such as a draft's dot and its facts, kept out of
  // the heading so it names the record alone.
  marked?: (heading: ReactNode) => ReactNode;
  actions?: ReactNode;
  subtitle?: ReactNode;
  narrow: boolean;
  // The close button's name, such as "Close metrics", what it does, and whether Esc does it too, as
  // it does unless said otherwise; none for a panel that closes only by its own buttons.
  close?: { label: string; onClose: () => void; byEscape?: boolean };
  foot?: ReactNode;
  children: ReactNode;
}) {
  const place = useContext(StackPlaceContext);
  const [scrolled, setScrolled] = useState(false);
  return (
    <FocusTrap active={narrow}>
      <section
        id={id}
        className={narrow ? classes.frameNarrow : classes.frame}
        aria-labelledby={titleId}
        {...(narrow ? { role: "dialog", "aria-modal": true } : {})}
        onKeyDown={(event) => {
          if (
            event.key !== "Escape" ||
            event.defaultPrevented ||
            hasOpenDropdown(event.target) ||
            close === undefined ||
            close.byEscape === false
          ) {
            return;
          }
          event.preventDefault();
          close.onClose();
        }}
      >
        <div className={classes.head}>
          {marked === undefined ? (
            <h2 id={titleId} className={classes.title} tabIndex={-1}>
              {title}
            </h2>
          ) : (
            <div className={classes.markedTitle}>
              {marked(
                <h2 id={titleId} className={classes.title} tabIndex={-1}>
                  {title}
                </h2>,
              )}
            </div>
          )}
          {actions !== undefined && (
            <div className={classes.actions}>{actions}</div>
          )}
          {place !== undefined && (
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={`${place.maximized ? "Restore" : "Maximize"} ${place.name}`}
              // Focus moves to the button, as not every browser gives it on a click, so it never stays
              // in a panel folding away.
              onClick={(event) => {
                event.currentTarget.focus();
                place.onToggle();
              }}
            >
              <Icon name={place.maximized ? "restore" : "maximize"} />
            </ActionIcon>
          )}
          {close !== undefined && (
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={close.label}
              onClick={close.onClose}
            >
              <Icon name="close" />
            </ActionIcon>
          )}
        </div>
        {subtitle !== undefined && (
          <PanelSubtitle className={classes.subtitlePlace}>
            {subtitle}
          </PanelSubtitle>
        )}
        <div
          className={classes.body}
          data-scrolled={scrolled || undefined}
          // A scroll does not bubble, so what scrolls inside is heard as it is captured. Only the
          // body and its scrolling box count, not a list in it or a table scrolled sideways.
          onScrollCapture={(event) => {
            const box = event.target;
            if (
              box instanceof HTMLElement &&
              (box === event.currentTarget ||
                (box.parentElement === event.currentTarget &&
                  box.classList.contains(String(classes.scroll))))
            ) {
              setScrolled(box.scrollTop > 0);
            }
          }}
        >
          {children}
        </div>
        {foot !== undefined && <div className={classes.foot}>{foot}</div>}
      </section>
    </FocusTrap>
  );
}

// Content beside a side panel that scrolls within its place, such as a list of records.
export const sidePanelScroll = classes.scroll;
