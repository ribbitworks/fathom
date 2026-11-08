// SPDX-License-Identifier: Apache-2.0

// An edge dragged to resize what is beside it, such as a side panel or a table's column. A
// separator edge is also focused and moved by the arrow keys along it, as side panels' are. A
// pointer-only edge is left to other controls for the keyboard, as a column's is to its header and
// menu, and may be double-clicked to put the size back.

import { type ReactNode, useRef } from "react";

// What a drag reports: where the pointer is, across and down the page.
export interface DragPoint {
  x: number;
  y: number;
}

interface Dragging {
  // Called as a drag starts, with the edge and where it was pressed, ends, and moves, and, for a
  // double click, to put the size back.
  onStart?: (edge: HTMLElement, at: DragPoint) => void;
  onDrag: (at: DragPoint) => void;
  onEnd?: () => void;
  onReset?: () => void;
}

// A separator: named and focusable, and moved by the arrow keys once focused.
interface Separator {
  // Whether the edge stands between things side by side, rather than one above the other.
  vertical: boolean;
  label: string;
  controls: string;
  value: number;
  least: number;
  most?: number;
  // A key moved the edge one step: 1 toward the end of the page, across or down, or -1 back.
  onStep: (step: number) => void;
}

export function ResizeEdge({
  separator,
  className,
  onStart,
  onDrag,
  onEnd,
  onReset,
}: Dragging & {
  // Without a separator, the edge is for the pointer only, hidden from assistive technology.
  separator?: Separator;
  className: string | undefined;
}): ReactNode {
  const steps: Record<string, number> = separator?.vertical
    ? { ArrowLeft: -1, ArrowRight: 1 }
    : { ArrowUp: -1, ArrowDown: 1 };
  // Whether a press on the edge is dragging it, until the pointer is let go or the browser takes it.
  const dragging = useRef(false);
  const end = () => {
    if (!dragging.current) return;
    dragging.current = false;
    onEnd?.();
  };
  return (
    <div
      {...(separator === undefined
        ? { "aria-hidden": true }
        : {
            role: "separator",
            "aria-orientation": separator.vertical ? "vertical" : "horizontal",
            "aria-label": separator.label,
            "aria-controls": separator.controls,
            "aria-valuenow": separator.value,
            "aria-valuemin": separator.least,
            "aria-valuemax": separator.most,
            tabIndex: 0,
            onKeyDown: (event) => {
              const step = steps[event.key];
              if (step === undefined) return;
              event.preventDefault();
              separator.onStep(step);
            },
          })}
      className={className}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragging.current = true;
        onStart?.(event.currentTarget, { x: event.clientX, y: event.clientY });
      }}
      onPointerMove={(event) => {
        if (dragging.current) onDrag({ x: event.clientX, y: event.clientY });
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onClick={(event) => {
        event.stopPropagation();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onReset?.();
      }}
    />
  );
}
