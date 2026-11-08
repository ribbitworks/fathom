// SPDX-License-Identifier: Apache-2.0

// Tests for the edge dragged to resize what is beside it: ending a drag only once one has started,
// with or without being told, and a pointer-only edge hidden from assistive technology. Side panels'
// separators are tested in side-panel.test.tsx, and columns' edges in record-grid.test.tsx.

import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResizeEdge } from "./resize-edge.tsx";

// The edge as a browser holds it: captured from a press until it is let go.
function grabbable(edge: HTMLElement) {
  let captured = false;
  edge.setPointerCapture = () => {
    captured = true;
  };
  edge.hasPointerCapture = () => captured;
  edge.releasePointerCapture = () => {
    captured = false;
  };
  return edge;
}

describe("an edge dragged to resize", () => {
  it("ends a drag only once one has started", () => {
    const onEnd = vi.fn();
    const { container } = render(
      <ResizeEdge className={undefined} onDrag={vi.fn()} onEnd={onEnd} />,
    );
    const edge = grabbable(container.firstElementChild as HTMLElement);
    fireEvent.pointerUp(edge, { pointerId: 1 });
    expect(onEnd).not.toHaveBeenCalled();
    fireEvent.pointerDown(edge, { pointerId: 1 });
    fireEvent.pointerUp(edge, { pointerId: 1 });
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("lets a drag end without being told, and hides a pointer-only edge from assistive technology", () => {
    const onDrag = vi.fn();
    const { container } = render(
      <ResizeEdge className={undefined} onDrag={onDrag} />,
    );
    const edge = grabbable(container.firstElementChild as HTMLElement);
    expect(edge.getAttribute("aria-hidden")).toBe("true");
    expect(edge.hasAttribute("tabindex")).toBe(false);
    fireEvent.pointerDown(edge, { pointerId: 1 });
    fireEvent.pointerMove(edge, { pointerId: 1, clientX: 40, clientY: 8 });
    fireEvent.pointerUp(edge, { pointerId: 1 });
    fireEvent.doubleClick(edge);
    expect(onDrag).toHaveBeenCalledWith({ x: 40, y: 8 });
  });
});
