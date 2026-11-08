// SPDX-License-Identifier: Apache-2.0

// Tests for the side panel's helpers: where a dropped or moved choice ends up, how pasted lines
// become choices, and how menus name shortcut keys. Real dragging needs a browser's layout, so the drop is tested through the move it
// asks for.

import type { Choice, List } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  droppedMove,
  followingAfterMove,
  lastKept,
  liftedWhileDragging,
  pastedChoices,
  shortcutsFor,
} from "./list-panel.tsx";

const choice = (id: string): Choice => ({
  id,
  label: `Fictional ${id}`,
  description: "",
  retired: false,
});
const choices = ["a", "b", "c"].map(choice);

describe("where a moved choice ends up", () => {
  it.each([
    [0, 2, "c"],
    [2, 0, null],
    [2, 1, "a"],
    [0, 1, "b"],
  ])("from place %i to place %i follows %s", (from, to, after) => {
    expect(followingAfterMove(choices, from, to)).toBe(after);
  });
});

describe("dropping a dragged choice", () => {
  const at = (index: number) => ({ index, droppableId: "choices" });

  it("moves a choice dropped somewhere new", () => {
    expect(droppedMove(choices, { source: at(2), destination: at(0) })).toEqual(
      { choice: choices[2], after: null },
    );
  });

  it.each([
    ["where it started", at(1)],
    ["outside the list", null],
  ])("moves nothing when dropped %s", (_case, destination) => {
    expect(droppedMove(choices, { source: at(1), destination })).toBe(
      undefined,
    );
  });

  it("moves nothing when the choice has gone", () => {
    expect(droppedMove(choices, { source: at(5), destination: at(0) })).toBe(
      undefined,
    );
  });
});

describe("a dragged row", () => {
  it("is lifted only while it is being dragged", () => {
    expect(liftedWhileDragging("row", false)).toBe("row");
    expect(liftedWhileDragging("row", true)).not.toBe("row");
  });
});

describe("pasting lines", () => {
  it("makes a choice of each non-empty line, with a description after a tab", () => {
    expect(
      pastedChoices("Kestrel Bay\tHead office.\r\n\n  Northmere \nAsh\tA\tB"),
    ).toEqual([
      { label: "Kestrel Bay", description: "Head office." },
      { label: "Northmere", description: "" },
      { label: "Ash", description: "A B" },
    ]);
  });
});

describe("shortcuts shown in menus", () => {
  it("name the keys as Macs do on a Mac", () => {
    expect(shortcutsFor("Mozilla/5.0 (Macintosh; Intel Mac OS X)")).toEqual({
      edit: "↵",
      up: "⌥↑",
      down: "⌥↓",
      left: "⌥←",
      right: "⌥→",
      wider: "⇧⌥→",
      narrower: "⇧⌥←",
      retire: "R",
      remove: "⌫",
    });
  });

  it("name the keys in words elsewhere", () => {
    expect(shortcutsFor("Mozilla/5.0 (Windows NT 10.0)")).toEqual({
      edit: "Enter",
      up: "Alt+↑",
      down: "Alt+↓",
      left: "Alt+←",
      right: "Alt+→",
      wider: "Shift+Alt+→",
      narrower: "Shift+Alt+←",
      retire: "R",
      remove: "Del",
    });
  });
});

describe("the last choice a built-in list keeps", () => {
  const states = (...meant: Choice[]): List => ({
    id: "l1",
    name: "Fictional States",
    description: "",
    visibility: "confidential",
    retired: false,
    builtIn: "hiring-states",
    choices: meant,
  });
  const proposed = { ...choice("p"), meaning: "proposed" as const };
  const open = { ...choice("o"), meaning: "open" as const };
  const approved = { ...choice("a"), meaning: "open" as const };

  it("is the only one offered with its meaning", () => {
    const list = states(proposed, open, approved);
    expect(lastKept(list, proposed)).toBe("proposed");
    expect(lastKept(list, open)).toBeUndefined();
  });

  it("leaves out others that are retired or drafted to be removed", () => {
    const removed = {
      ...approved,
      draft: {
        action: "deleted" as const,
        changed: [],
        live: {},
        state: "waiting" as const,
        madeBy: null,
        madeAt: null,
      },
    };
    expect(lastKept(states(open, removed), open)).toBe("open");
    expect(lastKept(states(open, { ...approved, retired: true }), open)).toBe(
      "open",
    );
  });

  it("is never a retired choice, nor one in a list without meanings", () => {
    expect(
      lastKept(states({ ...open, retired: true }), {
        ...open,
        retired: true,
      }),
    ).toBeUndefined();
    const plain = choice("x");
    expect(
      lastKept({ ...states(plain), builtIn: null }, plain),
    ).toBeUndefined();
  });

  it("is the last offered choice in Positions", () => {
    const positions = (...held: Choice[]): List => ({
      ...states(...held),
      visibility: "general",
      builtIn: "positions",
    });
    const employee = choice("e");
    const manager = choice("m");
    expect(lastKept(positions(employee, manager), employee)).toBeUndefined();
    expect(
      lastKept(positions(employee, { ...manager, retired: true }), employee),
    ).toBe("any");
  });
});
