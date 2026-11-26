// SPDX-License-Identifier: Apache-2.0

// Tests for side panels: the slide, for people whose computer allows motion, where the panels'
// column widens as they open and narrows as they close, and a closed panel stays, out of reach,
// until its slide ends, or until a panel opens again (the other tests run with less motion, where a
// panel goes as soon as it closes); and panels stacked, sharing one width and the height between
// them, and a panel under another maximized; and a panel's frame, with its heading and Esc.

import { MantineProvider } from "@mantine/core";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  maximizable,
  maximizedPanel,
  motionLasts,
  type SidePanel,
  SidePanelFrame,
  sidePanelScroll,
  stackShares,
  WithSidePanel,
  roomWithoutScrollBar,
} from "./side-panel.tsx";
import { testTheme } from "./test-support.tsx";

// The window's width, narrow or not, told to whatever listens for it to change.
let narrow = false;
const listeners = new Set<(event: { matches: boolean }) => void>();
const narrowQuery = "(max-width: 48em)";

beforeEach(() => {
  narrow = false;
  listeners.clear();
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        get matches() {
          return query === narrowQuery && narrow;
        },
        media: query,
        onchange: null,
        addEventListener: (
          _type: string,
          listener: (event: { matches: boolean }) => void,
        ) => {
          if (query === narrowQuery) listeners.add(listener);
        },
        removeEventListener: (
          _type: string,
          listener: (event: { matches: boolean }) => void,
        ) => {
          listeners.delete(listener);
        },
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
});

const narrowTo = (narrowed: boolean) => {
  narrow = narrowed;
  act(() => {
    for (const listener of listeners) listener({ matches: narrowed });
  });
};

afterEach(() => {
  vi.restoreAllMocks();
});

const layout = (panels: SidePanel[]) => (
  <MantineProvider theme={testTheme}>
    <WithSidePanel panels={panels} storageKey="fathom-test-panel-width">
      <p>Content</p>
    </WithSidePanel>
  </MantineProvider>
);

const one = (text: string, key = "one"): SidePanel => ({
  key,
  id: key,
  name: key,
  node: <p id={key}>{text}</p>,
});

// The simulated browser has no animation events, so React listens for the older, prefixed name.
const slideEnds = (element: Element) =>
  fireEvent(element, new Event("webkitAnimationEnd", { bubbles: true }));

const layoutOf = (element: Element) =>
  element.closest("[data-side-panel]")?.parentElement as HTMLElement;

const sliding = (element: Element) =>
  /sliding/u.test(
    (element.closest("[data-side-panel]") as HTMLElement).className,
  );

const place = () =>
  screen.getByText("Panel").closest("[data-side-panel]") as HTMLElement;

describe("a side panel", () => {
  it("stays out of reach while it slides out, and goes once its slide ends", () => {
    const { rerender } = render(layout([]));
    rerender(layout([one("Panel")]));
    expect(sliding(place())).toBe(true);
    expect(
      layoutOf(place()).style.getPropertyValue("--side-panel-column"),
    ).toBe("0px");
    slideEnds(place());
    expect(sliding(place())).toBe(false);
    expect(
      layoutOf(place()).style.getPropertyValue("--side-panel-column"),
    ).not.toBe("0px");
    expect(place().hasAttribute("inert")).toBe(false);
    rerender(layout([]));
    expect(place().hasAttribute("inert")).toBe(true);
    expect(sliding(place())).toBe(true);
    slideEnds(screen.getByText("Panel"));
    expect(screen.getByText("Panel")).toBeDefined();
    slideEnds(place());
    expect(screen.queryByText("Panel")).toBeNull();
  });

  it("opens again at once while it slides out", () => {
    const { rerender } = render(layout([one("Panel")]));
    rerender(layout([]));
    rerender(layout([one("Panel again")]));
    expect(screen.queryByText("Panel")).toBeNull();
    const shown = screen
      .getByText("Panel again")
      .closest("[data-side-panel]") as HTMLElement;
    expect(shown.hasAttribute("inert")).toBe(false);
    slideEnds(shown);
    expect(screen.getByText("Panel again")).toBeDefined();
  });

  it("keeps its width, and what each panel holds, as another opens above or below it and closes", () => {
    const { rerender } = render(layout([one("Below", "below")]));
    const below = screen.getByText("Below");
    const width = () =>
      layoutOf(below).style.getPropertyValue("--side-panel-column");
    const before = width();
    rerender(layout([one("Above", "above"), one("Below", "below")]));
    expect([width(), sliding(below), screen.getByText("Below")]).toEqual([
      before,
      false,
      below,
    ]);
    expect(
      screen
        .getByRole("separator", { name: "Resize above and below" })
        .getAttribute("aria-controls"),
    ).toBe("above below");
    rerender(layout([one("Below", "below")]));
    expect([width(), screen.getByText("Below")]).toEqual([before, below]);
  });
});

describe("stacked panels", () => {
  const stacked = () =>
    render(layout([one("Above", "above"), one("Below", "below")]));
  const edge = () =>
    screen.getByRole("separator", {
      name: "Resize heights of above and below",
    });
  const grows = (text: string) =>
    (
      screen.getByText(text).parentElement as HTMLElement
    ).style.getPropertyValue("--stack-share");

  it("share the height by the edge between them, from the keyboard, and keep it for next time", async () => {
    localStorage.clear();
    const { unmount } = stacked();
    expect(edge().getAttribute("aria-controls")).toBe("above below");
    expect(edge().getAttribute("aria-valuenow")).toBe("50");
    act(() => {
      edge().focus();
    });
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(edge().getAttribute("aria-valuenow")).toBe(
      String(50 + 2 * stackShares.step),
    );
    await userEvent.keyboard("{ArrowUp}");
    expect(edge().getAttribute("aria-valuenow")).toBe(
      String(50 + stackShares.step),
    );
    unmount();
    stacked();
    expect(edge().getAttribute("aria-valuenow")).toBe(
      String(50 + stackShares.step),
    );
    expect(Number(grows("Above")) / Number(grows("Below"))).toBeCloseTo(
      (50 + stackShares.step) / (50 - stackShares.step),
    );
  });

  it("leave a panel alone, after the edge was moved and its neighbour closed, the whole height", async () => {
    // Given the edge moved, so the panel below keeps less than half
    localStorage.clear();
    const { rerender } = stacked();
    act(() => {
      edge().focus();
    });
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    // When the panel above closes and is gone
    rerender(layout([one("Below", "below")]));
    fireEvent.transitionEnd(
      screen.getByText("Above").parentElement as HTMLElement,
    );
    // Then the one left fills the column
    expect(Number(grows("Below"))).toBe(1);
  });

  it("share the height by dragging the edge, leaving each its least", () => {
    localStorage.clear();
    stacked();
    const box = (top: number, bottom: number) => ({ top, bottom }) as DOMRect;
    vi.spyOn(
      screen.getByText("Above").parentElement as HTMLElement,
      "getBoundingClientRect",
    ).mockReturnValue(box(0, 200));
    vi.spyOn(
      screen.getByText("Below").parentElement as HTMLElement,
      "getBoundingClientRect",
    ).mockReturnValue(box(200, 400));
    const separator = edge();
    separator.setPointerCapture = vi.fn();
    let captured = false;
    separator.hasPointerCapture = () => captured;
    fireEvent.pointerMove(separator, { clientY: 100 });
    expect(separator.getAttribute("aria-valuenow")).toBe("50");
    fireEvent.pointerDown(separator, { pointerId: 1 });
    captured = true;
    fireEvent.pointerMove(separator, { clientY: 280 });
    expect(separator.getAttribute("aria-valuenow")).toBe("70");
    fireEvent.pointerMove(separator, { clientY: 10 });
    expect(separator.getAttribute("aria-valuenow")).toBe(
      String(stackShares.least),
    );
  });

  it("shrink away a panel closed, out of reach, and grow one opened into its place", () => {
    const { rerender } = render(
      layout([one("Above", "above"), one("Below", "below")]),
    );
    const item = (text: string) =>
      screen.getByText(text).parentElement as HTMLElement;
    const above = screen.getByText("Above");
    rerender(layout([one("Below", "below")]));
    expect(item("Above").hasAttribute("inert")).toBe(true);
    expect(item("Above").className).toMatch(/stackItemLeaving/u);
    fireEvent.transitionEnd(above);
    expect(screen.getByText("Above")).toBe(above);
    fireEvent.transitionEnd(item("Above"));
    expect(screen.queryByText("Above")).toBeNull();
    rerender(layout([one("Above", "above"), one("Below", "below")]));
    expect(item("Above").className).toMatch(/stackItemArriving/u);
    expect(
      screen.getAllByRole("separator")[1]?.parentElement?.className,
    ).toMatch(/stackEdgeMoving/u);
    fireEvent.transitionEnd(item("Above"));
    expect(item("Above").className).not.toMatch(/stackItemArriving/u);
  });

  it("keeps a panel closed while it shrinks away, if it opens again", () => {
    const { rerender } = render(
      layout([one("Above", "above"), one("Below", "below")]),
    );
    const above = screen.getByText("Above");
    rerender(layout([one("Below", "below")]));
    rerender(layout([one("Above", "above"), one("Below", "below")]));
    expect(screen.getByText("Above")).toBe(above);
    expect((above.parentElement as HTMLElement).hasAttribute("inert")).toBe(
      false,
    );
  });

  it("keep what they hold as the window narrows and widens, with no edge to widen them while narrow", async () => {
    render(
      layout([
        {
          key: "above",
          id: "above",
          name: "above",
          node: <input aria-label="Written" />,
        },
        one("Below", "below"),
      ]),
    );
    const written = screen.getByRole("textbox", { name: "Written" });
    await userEvent.type(written, "Kept");
    narrowTo(true);
    expect(
      screen.queryByRole("separator", { name: "Resize above and below" }),
    ).toBeNull();
    expect(screen.getByRole("textbox", { name: "Written" })).toBe(written);
    narrowTo(false);
    expect(screen.getAllByRole("separator")).toHaveLength(2);
    expect((written as HTMLInputElement).value).toBe("Kept");
  });

  it("settle a panel's motion that the browser never ends, once it has had its time", () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        layout([one("Above", "above"), one("Below", "below")]),
      );
      rerender(layout([one("Below", "below")]));
      expect(screen.getByText("Above")).toBeDefined();
      act(() => {
        vi.advanceTimersByTime(motionLasts);
      });
      expect(screen.queryByText("Above")).toBeNull();
      rerender(layout([]));
      expect(screen.getByText("Below")).toBeDefined();
      act(() => {
        vi.advanceTimersByTime(motionLasts);
      });
      expect(screen.queryByText("Below")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stop sliding at once as the window narrows mid-slide", () => {
    const { rerender } = render(layout([]));
    rerender(layout([one("Panel")]));
    expect(sliding(place())).toBe(true);
    narrowTo(true);
    expect(sliding(place())).toBe(false);
  });

  it("settle at once as the window narrows mid-motion", () => {
    const { rerender } = render(
      layout([one("Above", "above"), one("Below", "below")]),
    );
    rerender(layout([one("Below", "below")]));
    expect(screen.getByText("Above")).toBeDefined();
    narrowTo(true);
    expect(screen.queryByText("Above")).toBeNull();
  });

  it("settle a panel whose growing the browser cancels", () => {
    const { rerender } = render(layout([one("Below", "below")]));
    rerender(layout([one("Above", "above"), one("Below", "below")]));
    const item = screen.getByText("Above").parentElement as HTMLElement;
    fireEvent(
      screen.getByText("Above"),
      new Event("transitioncancel", { bubbles: true }),
    );
    expect(item.className).toMatch(/stackItemArriving/u);
    fireEvent(item, new Event("transitioncancel", { bubbles: true }));
    expect(item.className).not.toMatch(/stackItemArriving/u);
  });
});

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

describe("the room beside the panels", () => {
  it("is the same whether the page's scroll bar shows or not", () => {
    const withoutBar = roomWithoutScrollBar(1000, 1000, 1000);

    const withBar = roomWithoutScrollBar(985, 1000, 985);

    expect(withBar).toBe(withoutBar);
  });
});

describe("a side panel's frame", () => {
  const frame = (
    props: Partial<Parameters<typeof SidePanelFrame>[0]> = {},
    onClose = vi.fn(),
  ) => {
    render(
      <MantineProvider theme={testTheme}>
        <SidePanelFrame
          id="frame"
          titleId="frame-title"
          title="Sites"
          narrow={false}
          close={{ label: "Close sites", onClose }}
          {...props}
        >
          <button type="button">Inside</button>
        </SidePanelFrame>
      </MantineProvider>,
    );
    return onClose;
  };
  const follows = (first: Element, second: Element) =>
    (first.compareDocumentPosition(second) &
      Node.DOCUMENT_POSITION_FOLLOWING) !==
    0;

  it("puts its actions between the title and the close button", () => {
    frame({ actions: <button type="button">Edit sites</button> });

    const title = screen.getByRole("heading", { name: "Sites" });
    const action = screen.getByRole("button", { name: "Edit sites" });
    const close = screen.getByRole("button", { name: "Close sites" });

    expect(title.contains(action)).toBe(false);
    expect(follows(title, action)).toBe(true);
    expect(follows(action, close)).toBe(true);
  });

  it("puts its subtitle under the title, outside it and before what it holds", () => {
    frame({ subtitle: "Where people work" });

    const title = screen.getByRole("heading", { name: "Sites" });
    const subtitle = screen.getByText("Where people work");

    expect(title.contains(subtitle)).toBe(false);
    expect(follows(title, subtitle)).toBe(true);
    expect(
      follows(subtitle, screen.getByRole("button", { name: "Inside" })),
    ).toBe(true);
  });

  describe("the edge above what it holds", () => {
    const holding = (held: ReactNode) => {
      render(
        <MantineProvider theme={testTheme}>
          <SidePanelFrame
            id="frame"
            titleId="frame-title"
            title="Sites"
            subtitle="Where people work"
            narrow={false}
          >
            {held}
          </SidePanelFrame>
        </MantineProvider>,
      );
      return document.querySelector("#frame-title")?.closest("section")
        ?.lastElementChild as HTMLElement;
    };
    const scroll = (box: Element, top: number, left = 0) => {
      box.scrollTop = top;
      box.scrollLeft = left;
      fireEvent.scroll(box);
    };
    const edged = (body: HTMLElement) => body.hasAttribute("data-scrolled");

    it("shows while its scrolling box is scrolled, and goes once it is back at the top", () => {
      // Given a panel holding its rows in a scrolling box
      const body = holding(
        <div className={sidePanelScroll} data-testid="held" />,
      );
      const held = screen.getByTestId("held");
      expect(edged(body)).toBe(false);

      // When the box is scrolled down and back to the top
      scroll(held, 40);
      const whileScrolled = edged(body);
      scroll(held, 0);

      // Then the edge shows only while it was scrolled
      expect(whileScrolled).toBe(true);
      expect(edged(body)).toBe(false);
    });

    it("shows while the frame itself is scrolled", () => {
      // Given a panel whose rows sit in the frame
      const body = holding(<p>Rows</p>);

      // When the frame is scrolled down
      scroll(body, 40);

      // Then the edge shows
      expect(edged(body)).toBe(true);
    });

    it("stays as it is while a list or table inside scrolls", () => {
      // Given a scrolled panel holding a list in its box and a table of its own
      const body = holding(
        <>
          <div className={sidePanelScroll} data-testid="held">
            <div data-testid="list" />
          </div>
          <div data-testid="table" />
        </>,
      );
      scroll(screen.getByTestId("held"), 40);

      // When the list scrolls back to its top and the table sideways
      scroll(screen.getByTestId("list"), 0);
      scroll(screen.getByTestId("table"), 0, 30);

      // Then the edge still shows
      expect(edged(body)).toBe(true);
    });
  });

  it("draws a title's marks around its heading, leaving the heading named by the title alone", () => {
    frame({
      marked: (heading) => (
        <>
          <span>Draft</span>
          {heading}
          <span>Built in</span>
        </>
      ),
    });

    const title = screen.getByRole("heading", { name: "Sites" });

    expect(follows(screen.getByText("Draft"), title)).toBe(true);
    expect(follows(title, screen.getByText("Built in"))).toBe(true);
    expect(
      follows(
        screen.getByText("Built in"),
        screen.getByRole("button", { name: "Close sites" }),
      ),
    ).toBe(true);
  });

  it("closes with Esc from inside it", async () => {
    const onClose = frame();
    screen.getByRole("button", { name: "Inside" }).focus();

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("stays open on an Esc that closes a dropdown inside it", () => {
    const onClose = vi.fn();
    render(
      <MantineProvider theme={testTheme}>
        <SidePanelFrame
          id="frame"
          titleId="frame-title"
          title="Sites"
          narrow={false}
          close={{ label: "Close sites", onClose }}
        >
          <input aria-label="Site" data-mantine-stop-propagation="true" />
        </SidePanelFrame>
      </MantineProvider>,
    );

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Site" }), {
      key: "Escape",
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes with Esc pressed on a non-HTML element inside it, such as a drawing", () => {
    const onClose = vi.fn();
    render(
      <MantineProvider theme={testTheme}>
        <SidePanelFrame
          id="frame"
          titleId="frame-title"
          title="Sites"
          narrow={false}
          close={{ label: "Close sites", onClose }}
        >
          <svg data-testid="drawing" />
        </SidePanelFrame>
      </MantineProvider>,
    );

    fireEvent.keyDown(screen.getByTestId("drawing"), { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("stays open on an Esc that something inside it has used", async () => {
    const onClose = vi.fn();
    render(
      <MantineProvider theme={testTheme}>
        <SidePanelFrame
          id="frame"
          titleId="frame-title"
          title="Sites"
          narrow={false}
          close={{ label: "Close sites", onClose }}
        >
          <div
            onKeyDown={(event) => {
              event.preventDefault();
            }}
          >
            <button type="button">Inside</button>
          </div>
        </SidePanelFrame>
      </MantineProvider>,
    );
    screen.getByRole("button", { name: "Inside" }).focus();

    await userEvent.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
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
