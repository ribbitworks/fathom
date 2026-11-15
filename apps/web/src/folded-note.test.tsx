// SPDX-License-Identifier: Apache-2.0

// Tests for a note folded in a panel: a note that fits shows in full with no link; a long one shows
// Show more, named for the note, which opens the note's own panel where there is one, and elsewhere
// shows it in full in place, with Show less to fold it again.

import { MantineProvider } from "@mantine/core";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FoldedNote } from "./folded-note.tsx";
import { testTheme } from "./test-support.tsx";

const note = "## Fictional handbook\n\nA long paragraph.";

// The simulated browser lays nothing out, so the note is told how tall it is, as a browser would.
function laidOut(height: number) {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      private readonly told: (entries: ResizeObserverEntry[]) => void;
      constructor(told: (entries: ResizeObserverEntry[]) => void) {
        this.told = told;
      }
      observe() {
        this.told([
          {
            borderBoxSize: [{ inlineSize: 300, blockSize: height }],
            contentRect: { x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0 },
          } as unknown as ResizeObserverEntry,
        ]);
      }
      unobserve() {}
      disconnect() {}
    },
  );
}

const shown = (onOpen?: () => void) =>
  render(
    <MantineProvider theme={testTheme}>
      <FoldedNote name="Onboarding" note={note} onOpen={onOpen} />
    </MantineProvider>,
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a folded note", () => {
  it("shows a note that fits in full, with no link", async () => {
    laidOut(100);
    shown(vi.fn());
    expect(await screen.findByText("Fictional handbook")).toBeDefined();
    expect(screen.queryByRole("button", { name: /^Show more/u })).toBeNull();
  });

  it("opens a long note in its own panel from Show more, named for the note, folded still", async () => {
    // Given
    laidOut(600);
    const onOpen = vi.fn();
    shown(onOpen);
    // When
    await userEvent.click(
      await screen.findByRole("button", { name: "Show more of Onboarding" }),
    );
    // Then
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Show more of Onboarding" }),
    ).toBeDefined();
  });

  it("shows a long note in full in place where it has no panel, and folds it again", async () => {
    laidOut(600);
    shown();
    await userEvent.click(
      await screen.findByRole("button", { name: "Show more of Onboarding" }),
    );
    const less = await screen.findByRole("button", {
      name: "Show less of Onboarding",
    });
    expect(less.getAttribute("aria-expanded")).toBe("true");
    await userEvent.click(less);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Show more of Onboarding" }),
      ).toBeDefined();
    });
  });
});
