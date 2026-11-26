// SPDX-License-Identifier: Apache-2.0

// Tests for a stack of side panels: maximizing a panel under another, the panel in front on a narrow
// screen, and a panel as tall as what it holds.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  maximizable,
  maximizedPanel,
  motionLasts,
  type SidePanel,
  SidePanelFrame,
  stackShares,
} from "./side-panel.tsx";

import { withWindowWidth, narrowTo, layout, one } from "./test-side-panels.tsx";

withWindowWidth();

describe("a panel that may be maximized", () => {
  it("is one under another", () => {
    expect(maximizable(["above", "below"], "below", false)).toBe(true);
  });

  it.each([
    ["the one at the top", ["above", "below"], "above", false],
    ["one not open", ["above", "below"], "beside", false],
    ["one on a narrow screen", ["above", "below"], "below", true],
  ])("isn't %s", (_case, keys, key, narrowed) => {
    expect(maximizable(keys, key, narrowed)).toBe(false);
  });
});

describe("the panel maximized", () => {
  const open = ["above", "below"];

  it("is the one asked for, while it stays under another", () => {
    expect(maximizedPanel(open, open, "below", false)).toBe("below");
  });

  it.each([
    ["nothing is asked for", open, open, undefined, false],
    ["another panel opens", [...open, "beside"], open, "below", false],
    ["it closes", ["above"], open, "below", false],
    ["the panel above it closes", ["below"], open, "below", false],
    ["the window narrows", open, open, "below", true],
    [
      "a third panel closes",
      ["above", "below"],
      ["above", "below", "beside"],
      "below",
      false,
    ],
  ])("is none once %s", (_case, keys, before, asked, narrowed) => {
    expect(maximizedPanel(keys, before, asked, narrowed)).toBeUndefined();
  });
});

describe("a panel under another, maximized", () => {
  const framed = (key: string): SidePanel => ({
    key,
    id: key,
    name: key,
    node: (
      <SidePanelFrame
        id={`${key}-frame`}
        titleId={`${key}-title`}
        title={key}
        narrow={false}
      >
        <p>{key} holds</p>
      </SidePanelFrame>
    ),
  });
  const placeOf = (key: string) =>
    (document.getElementById(`${key}-frame`) as HTMLElement)
      .parentElement as HTMLElement;

  const stack = () => placeOf("above").parentElement as HTMLElement;

  it("is offered under another panel, not at the top", () => {
    render(layout([framed("above"), framed("below")]));
    expect(
      screen.getByRole("button", { name: "Maximize below" }),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "Maximize above" })).toBeNull();
  });

  it("fills the column, maximized, though it fits what it holds, and fits it again restored", async () => {
    render(layout([framed("above"), { ...framed("below"), fits: true }]));
    expect(placeOf("below").className).toMatch(/stackItemFitted/u);
    await userEvent.click(
      screen.getByRole("button", { name: "Maximize below" }),
    );
    expect(placeOf("below").className).not.toMatch(/stackItemFitted/u);
    await userEvent.click(
      screen.getByRole("button", { name: "Restore below" }),
    );
    expect(placeOf("below").className).toMatch(/stackItemFitted/u);
  });

  it("folds away a panel fitting what it holds, as any panel above one maximized", async () => {
    render(
      layout([
        framed("above"),
        { ...framed("middle"), fits: true },
        framed("below"),
      ]),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Maximize below" }),
    );
    expect(placeOf("middle").className).toMatch(/stackItemFolded/u);
    expect(placeOf("middle").className).not.toMatch(/stackItemFitted/u);
    expect(stack().className).not.toMatch(/stackFitting/u);
  });

  it("folds away the panel above, kept as it was, and Restore unfolds it", async () => {
    render(layout([framed("above"), framed("below")]));
    const above = screen.getByText("above holds");
    await userEvent.click(
      screen.getByRole("button", { name: "Maximize below" }),
    );
    const restore = screen.getByRole("button", { name: "Restore below" });
    expect(document.activeElement).toBe(restore);
    expect(placeOf("above").className).toMatch(/stackItemFolded/u);
    expect(placeOf("above").hasAttribute("inert")).toBe(true);
    expect(
      screen.getByRole("separator", {
        name: "Resize heights of above and below",
      }).parentElement?.className,
    ).toMatch(/stackEdgeFolded/u);
    expect(screen.getByText("above holds")).toBe(above);
    await userEvent.click(restore);
    expect(placeOf("above").className).not.toMatch(/stackItemFolded/u);
    expect(placeOf("above").hasAttribute("inert")).toBe(false);
    expect(
      screen.getByRole("button", { name: "Maximize below" }),
    ).toBeDefined();
  });

  it("folds and unfolds with motion, which settles once it has had its time", () => {
    render(layout([framed("above"), framed("below")]));
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: "Maximize below" }));
      expect(stack().className).toMatch(/stackFolding/u);
      act(() => {
        vi.advanceTimersByTime(motionLasts);
      });
      expect(stack().className).not.toMatch(/stackFolding/u);
      fireEvent.click(screen.getByRole("button", { name: "Restore below" }));
      expect(stack().className).toMatch(/stackFolding/u);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives its motion its whole time again when pressed during it", () => {
    render(layout([framed("above"), framed("below")]));
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: "Maximize below" }));
      act(() => {
        vi.advanceTimersByTime(motionLasts - 100);
      });
      fireEvent.click(screen.getByRole("button", { name: "Restore below" }));
      act(() => {
        vi.advanceTimersByTime(motionLasts - 100);
      });
      expect(stack().className).toMatch(/stackFolding/u);
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(stack().className).not.toMatch(/stackFolding/u);
    } finally {
      vi.useRealTimers();
    }
  });

  it("takes focus when pressed, out of the panel folding away", () => {
    render(layout([framed("above"), framed("below")]));
    const maximize = screen.getByRole("button", { name: "Maximize below" });
    act(() => {
      (document.getElementById("above-title") as HTMLElement).focus();
    });
    fireEvent.click(maximize);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Restore below" }),
    );
  });

  it("is restored once another panel opens, so it shows", async () => {
    const { rerender } = render(layout([framed("above"), framed("below")]));
    await userEvent.click(
      screen.getByRole("button", { name: "Maximize below" }),
    );
    rerender(layout([framed("above"), framed("below"), framed("beside")]));
    expect(placeOf("above").className).not.toMatch(/stackItemFolded/u);
    expect(
      screen.getByRole("button", { name: "Maximize below" }),
    ).toBeDefined();
  });

  it("is no longer offered once the panel above it closes", async () => {
    const { rerender } = render(layout([framed("above"), framed("below")]));
    await userEvent.click(
      screen.getByRole("button", { name: "Maximize below" }),
    );
    rerender(layout([framed("below")]));
    expect(screen.queryByRole("button", { name: /below$/u })).toBeNull();
  });

  it("restores the stack once the window narrows, and stays restored as it widens", async () => {
    render(layout([framed("above"), framed("below")]));
    await userEvent.click(
      screen.getByRole("button", { name: "Maximize below" }),
    );
    narrowTo(true);
    narrowTo(false);
    expect(placeOf("above").className).not.toMatch(/stackItemFolded/u);
    expect(
      screen.getByRole("button", { name: "Maximize below" }),
    ).toBeDefined();
  });

  it("isn't offered on a narrow screen", () => {
    render(layout([framed("above"), framed("below")]));
    narrowTo(true);
    expect(screen.queryByRole("button", { name: "Maximize below" })).toBeNull();
  });
});

describe("the panel in front, which a narrow screen shows", () => {
  const behind = (text: string) =>
    /stackItemBehind/u.test(
      (screen.getByText(text).parentElement as HTMLElement).className,
    );
  const details = one("Details", "details");
  const form = one("Form", "form");

  it("is the one opened last, then, once it closes, the one in front before it", () => {
    const { rerender } = render(layout([details]));
    rerender(layout([details, form]));
    rerender(layout([one("Note", "note"), details, form]));
    expect(["Note", "Details", "Form"].map(behind)).toEqual([
      false,
      true,
      true,
    ]);
    rerender(layout([details, form]));
    expect(["Details", "Form"].map(behind)).toEqual([true, false]);
  });

  it("is the top one of those opened together, as the page is drawn or later", () => {
    const { rerender } = render(layout([details, form]));
    expect(["Details", "Form"].map(behind)).toEqual([false, true]);
    rerender(layout([]));
    rerender(layout([details, form]));
    expect(["Details", "Form"].map(behind)).toEqual([false, true]);
  });
});

describe("a panel as tall as what it holds", () => {
  const fitted = (text: string) =>
    /stackItemFitted/u.test(
      (screen.getByText(text).parentElement as HTMLElement).className,
    );
  const details = one("Details", "details");
  const form = { ...one("Form", "form"), fits: true };

  it("fits what it holds above another too, keeping at most half the column", () => {
    render(layout([form, details]));
    expect(["Form", "Details"].map(fitted)).toEqual([true, false]);
    expect(
      (screen.getByText("Form").parentElement as HTMLElement).className,
    ).toMatch(/stackItemFittedTop/u);
  });

  it("fits what it holds under another, with no edge beside it to move", () => {
    render(layout([details, form, one("Note", "note")]));
    expect(["Details", "Form", "Note"].map(fitted)).toEqual([
      false,
      true,
      false,
    ]);
    expect(
      (screen.getByText("Form").parentElement as HTMLElement).className,
    ).not.toMatch(/stackItemFittedTop/u);
    expect(
      screen.queryAllByRole("separator", { name: /^Resize heights .*form/u }),
    ).toEqual([]);
    // The gap between them stays.
    const stack = (screen.getByText("Form").parentElement as HTMLElement)
      .parentElement as HTMLElement;
    expect(
      [...stack.children].filter(({ className }) =>
        /stackEdge/u.test(className),
      ),
    ).toHaveLength(2);
    expect(stack.className).toMatch(/stackFitting/u);
    expect(stack.style.getPropertyValue("--stack-least")).toBe(
      `${String(stackShares.least)}%`,
    );
  });

  it("fills the column alone, or on a narrow screen, as any panel does", () => {
    const { rerender } = render(layout([form]));
    expect(fitted("Form")).toBe(false);
    rerender(layout([details, form]));
    narrowTo(true);
    expect(fitted("Form")).toBe(false);
  });

  it("comes and goes at once, its height being nothing to slide to", () => {
    const { rerender } = render(layout([details]));
    rerender(layout([details, form]));
    expect(
      (screen.getByText("Form").parentElement as HTMLElement).className,
    ).not.toMatch(/stackItemArriving/u);
    rerender(layout([details]));
    expect(screen.queryByText("Form")).toBeNull();
  });
});
