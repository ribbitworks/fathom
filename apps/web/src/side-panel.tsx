// SPDX-License-Identifier: Apache-2.0

// A page's content with a side panel beside it, as Visual Design sets out for every side panel: the
// content narrows to make room rather than being covered, and the panel's edge beside it is
// dragged, or moved with the arrow keys, to resize it, with its width kept for next time. On a
// narrow screen the panel covers the screen instead, by its own styles.

import { useLocalStorage, useMediaQuery } from "@mantine/hooks";
import { type CSSProperties, type ReactNode, useRef } from "react";
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

export function WithSidePanel({
  panel,
  label,
  controls,
  storageKey,
  children,
}: {
  // The panel, or nothing while it is closed.
  panel: ReactNode;
  // The name of the edge that resizes the panel, such as "Resize metrics".
  label: string;
  // The id of the panel the edge resizes.
  controls: string;
  // Where the panel's width is kept for next time.
  storageKey: string;
  children: ReactNode;
}) {
  const narrow = useNarrow();
  const layout = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useLocalStorage<number>({
    key: storageKey,
    defaultValue: panelWidths.start,
  });
  const beside = Boolean(panel) && !narrow;
  // The layout's styles also keep the content its least width, however wide the panel was left.
  // The layout is drawn by the time its edge is moved.
  const box = () => (layout.current as HTMLDivElement).getBoundingClientRect();
  const resize = (wanted: number) => {
    setWidth(panelWidth(wanted, box().width));
  };
  return (
    <div
      ref={layout}
      className={
        beside ? [classes.layout, classes.layoutOpen].join(" ") : classes.layout
      }
      // The width the panel is dragged to.
      style={{ "--side-panel-width": `${String(width)}px` } as CSSProperties}
    >
      {children}
      {beside ? (
        // Marked, so a page that closes its panel on a click outside it leaves clicks on the edge
        // be.
        <div className={classes.panelPlace} data-side-panel>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={label}
            aria-controls={controls}
            aria-valuenow={width}
            aria-valuemin={panelWidths.least}
            tabIndex={0}
            className={classes.resizer}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
                return;
              }
              resize(box().right - event.clientX);
            }}
            onKeyDown={(event) => {
              const step = { ArrowLeft: 1, ArrowRight: -1 }[event.key];
              if (step === undefined) return;
              event.preventDefault();
              resize(width + step * panelWidths.step);
            }}
          />
          {panel}
        </div>
      ) : (
        panel
      )}
    </div>
  );
}

// Content beside a side panel that scrolls within its place, such as a list of records.
export const sidePanelScroll = classes.scroll;
