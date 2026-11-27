// SPDX-License-Identifier: Apache-2.0

// Tests for a table's value holding a choice a draft renames: its mark in each Draft view, and how
// it gives way to its record's own draft, with a made-up kind of record, gadgets.

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Gadget } from "./test-support.tsx";
import { emptyView } from "./table-view.ts";
import { colours, gadget, renderGadgets, waiting } from "./test-support.tsx";

// Colours, whose Teal a waiting draft by Fictional Editor renames Sea teal, and Coral.
const renamedColours = {
  ...colours,
  choices: [
    {
      id: "c1",
      label: "Sea teal",
      description: "",
      retired: false,
      draft: {
        ...waiting,
        madeAt: null,
        action: "changed" as const,
        changed: ["label"],
        changedBy: { label: "Fictional Editor" },
        live: { label: "Teal" },
      },
    },
    { id: "c2", label: "Coral", description: "", retired: false },
  ],
};
const teal = gadget("g1", { values: { f1: ["c1"] } });
const colourCell = () => screen.getAllByRole("gridcell")[2] as HTMLElement;
const show = (shown: "both" | "drafts" | "live") => ({
  ...emptyView,
  show: shown,
});

// A gadget whose own draft, in the state given, changed its colour from Teal to Coral.
const recoloured = (state: "waiting" | "rejected"): Gadget =>
  gadget("g1", {
    values: { f1: ["c2"] },
    draft: {
      ...waiting,
      state,
      action: "changed",
      changed: ["f1"],
      live: { values: { f1: ["c1"] }, links: {} },
    },
  });

describe("a value holding a choice a draft renames", () => {
  it("has the rename's dot, naming the choice as it is live and who renamed it, in a row with no draft", () => {
    renderGadgets({ gadgets: [teal], lists: [renamedColours] });

    expect(colourCell().textContent).toContain(
      "Sea teal, Draft: changed from “Teal”, by Fictional Editor",
    );
  });

  it("is semibold beside live, but not with the drafts applied", () => {
    const { unmount } = renderGadgets({
      gadgets: [teal],
      lists: [renamedColours],
    });
    const besideLive = colourCell().className.includes("changedValue");
    unmount();
    renderGadgets({
      gadgets: [teal],
      lists: [renamedColours],
      view: show("drafts"),
    });

    expect([
      besideLive,
      colourCell().className.includes("changedValue"),
    ]).toEqual([true, false]);
  });

  it("is tinted as a value another draft changes, in a row with a draft of its own", () => {
    renderGadgets({
      gadgets: [
        gadget("g1", {
          values: { f1: ["c1"] },
          draft: { ...waiting, action: "changed", changed: ["name"] },
        }),
      ],
      lists: [renamedColours],
    });

    expect(colourCell().className.includes("draftCell")).toBe(true);
  });

  it("is tinted as rejected in a row with a draft of its own, once the rename was rejected", () => {
    renderGadgets({
      gadgets: [
        gadget("g1", {
          values: { f1: ["c1"] },
          draft: { ...waiting, action: "changed", changed: ["name"] },
        }),
      ],
      lists: [
        {
          ...renamedColours,
          choices: renamedColours.choices.map((choice) =>
            choice.draft === undefined
              ? choice
              : { ...choice, draft: { ...choice.draft, state: "rejected" } },
          ),
        },
      ],
    });

    expect(colourCell().className.includes("rejectedCell")).toBe(true);
  });

  it("has Live's green dot, its tip naming the change waiting, under Live only", () => {
    renderGadgets({
      gadgets: [teal],
      lists: [renamedColours],
      view: show("live"),
    });

    expect(colourCell().textContent).toContain(
      "Teal, Live. A change is waiting for approval.",
    );
  });

  it("gives way to its record's own draft where that changes the value", () => {
    renderGadgets({
      gadgets: [recoloured("waiting")],
      lists: [renamedColours],
    });

    expect([
      colourCell().textContent.includes("Fictional Editor"),
      colourCell().textContent.includes("changed from “Teal”"),
    ]).toEqual([false, true]);
  });

  it("keeps its mark with the drafts applied when its record's own draft was rejected", () => {
    renderGadgets({
      gadgets: [recoloured("rejected")],
      lists: [renamedColours],
      view: show("drafts"),
    });

    expect(colourCell().textContent).toContain(
      "Sea teal, Draft: changed from “Teal”, by Fictional Editor",
    );
  });

  it("keeps Live's green dot under Live only when its record's own draft was rejected", () => {
    renderGadgets({
      gadgets: [recoloured("rejected")],
      lists: [renamedColours],
      view: show("live"),
    });

    expect(colourCell().textContent).toContain(
      "Teal, Live. A change is waiting for approval.",
    );
  });
});
