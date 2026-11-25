// SPDX-License-Identifier: Apache-2.0

// Where a list's choices go when they are dragged or moved.

import type { Choice } from "@fathom/shared";
import type { DropResult } from "@hello-pangea/dnd";
import { listClasses } from "./page-styles.ts";
import { movedItem } from "./table-view.ts";

// The choice a moved one should follow, or null for the top, once it moves from one place in the
// list to another.
export function followingAfterMove(
  items: readonly { id: string }[],
  from: number,
  to: number,
): string | null {
  return movedItem(items, from, to).slice(0, to).at(-1)?.id ?? null;
}

// The move a drop asks for, if the choice was dropped somewhere new.
export function droppedMove(
  offered: readonly Choice[],
  result: Pick<DropResult, "source" | "destination">,
): { choice: Choice; after: string | null } | undefined {
  const from = result.source.index;
  const to = result.destination?.index ?? from;
  const [choice] = offered.slice(from, from + 1);
  if (to === from || choice === undefined) return undefined;
  return { choice, after: followingAfterMove(offered, from, to) };
}

// A row's classes, lifted while it is being dragged.
export function liftedWhileDragging(base: string, dragging: boolean): string {
  return dragging ? `${base} ${String(listClasses.choiceLifted)}` : base;
}
