// SPDX-License-Identifier: Apache-2.0

// Tests that dropping a dragged choice moves it. Dragging needs a browser's layout, which the
// simulated browser lacks, so the drop is made by calling the handler the panel gives the
// drag-and-drop library.

import type * as DragAndDrop from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { act, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { fictionalUser, renderApp, serverAnswers } from "./test-support.tsx";

const dropped = vi.hoisted(() => ({
  onDragEnd: undefined as ((result: DropResult) => void) | undefined,
}));

vi.mock("@hello-pangea/dnd", async (importOriginal) => {
  const actual = await importOriginal<typeof DragAndDrop>();
  return {
    ...actual,
    DragDropContext: (props: Parameters<typeof actual.DragDropContext>[0]) => {
      dropped.onDragEnd = props.onDragEnd as (result: DropResult) => void;
      return createElement(actual.DragDropContext, props);
    },
  };
});

const choice = (id: string, label: string) => ({
  id,
  label,
  description: "",
  retired: false,
});

async function openWithDrop() {
  const fetch = serverAnswers({
    "GET /api/session": () =>
      Response.json({
        ...fictionalUser,
        permissions: ["configuration:edit", "configuration:view"],
      }),
    "GET /api/lists": () =>
      Response.json({
        lists: [
          {
            id: "l1",
            keyNumber: 1,
            name: "Locations",
            description: "",
            visibility: "general",
            retired: false,
            choices: [choice("c1", "Kestrel Bay"), choice("c2", "Northmere")],
          },
        ],
      }),
    "PUT /api/lists/l1/choices/c1/position": () =>
      new Response(null, { status: 204 }),
  });
  renderApp("/lists/l1");
  await screen.findByRole("heading", { name: "Locations", level: 2 });
  const drop = (destination: number) => {
    act(() => {
      dropped.onDragEnd?.({
        draggableId: "c1",
        type: "DEFAULT",
        mode: "FLUID",
        reason: "DROP",
        combine: null,
        source: { index: 0, droppableId: "choices" },
        destination: { index: destination, droppableId: "choices" },
      });
    });
  };
  const moves = () =>
    fetch.mock.calls
      .filter(([url]) => url.endsWith("/position"))
      .map(([, init]) => init?.body);
  return { drop, moves };
}

describe("dropping a dragged choice", () => {
  it("moves it after the choice it lands below", async () => {
    const { drop, moves } = await openWithDrop();
    drop(1);
    await waitFor(() => {
      expect(moves()).toEqual([JSON.stringify({ after: "c2" })]);
    });
  });

  it("does nothing when it lands where it started", async () => {
    const { drop, moves } = await openWithDrop();
    drop(0);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(moves()).toEqual([]);
  });
});
