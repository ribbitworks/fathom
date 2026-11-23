// SPDX-License-Identifier: Apache-2.0

// Tests for a feature's card on the Features Board against a simulated server: what it shows, its
// draft marks, and its menu.

import { fireEvent, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  size,
  openBoard,
  column,
  cardNames,
  card,
} from "./test-feature-board.tsx";

vi.mock("@mantine/hooks", async (importOriginal) =>
  (await import("./test-board-width.ts")).withBoardWidth(
    await importOriginal(),
  ),
);

// 2027-05-10 is in the second of the stream's quarters, 27.2.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-05-10T12:00:00Z"));
  size.width = 1000;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("a card", () => {
  it("shows its status, priority, size, risk and month needed by", async () => {
    await openBoard();
    const shown = card("Fictional Alpha");
    expect(shown.textContent).toContain("Planned · Critical priority");
    expect(
      within(shown).getByRole("img", { name: "Size M, 2 × S" }),
    ).toBeTruthy();
    expect(within(shown).getByRole("img", { name: "Risk High" })).toBeTruthy();
    expect(shown.textContent).toContain("Needed by Jun 2027");
  });

  it("is marked Not staffed when committed with no allocations", async () => {
    await openBoard();
    expect(card("Fictional Alpha").textContent).toContain("Not staffed");
    const words = within(card("Fictional Alpha")).getByText("Not staffed");
    expect(words.closest('[class*="warningKind"]')).toBeNull();
    expect(card("Fictional Beta").textContent).not.toContain("Not staffed");
    expect(card("Fictional Gamma").textContent).not.toContain("Not staffed");
  });

  it("shows a move with its box, and a dimmed copy where it is live", async () => {
    await openBoard();
    expect(card("Fictional Gamma").textContent).toContain("Moved");
    expect(
      within(column("Cycle 27.2")).getByText("Fictional Gamma"),
    ).toBeTruthy();
  });

  it("is where it is live, judged by live allocations, under Live only", async () => {
    await openBoard("/features?mode=board&show=live");
    expect(cardNames("Cycle 27.2")).toContain("Fictional Gamma");
    expect(card("Fictional Gamma").textContent).toContain("Not staffed");
  });

  it("leaves out the status's and priority's line when neither shows", async () => {
    await openBoard(
      `/features?mode=board&hide=${encodeURIComponent('["status"]')}`,
    );
    expect(card("Fictional Alpha").textContent).toContain("Critical priority");
    expect(card("Fictional Alpha").textContent).not.toContain("Planned");
    expect(card("Fictional Later").textContent).not.toContain("·");
  });

  it("shows only what the Card menu chooses, kept in the address", async () => {
    const history = await openBoard();
    await userEvent.click(screen.getByRole("button", { name: "Card" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Risk, chosen" }),
    );
    expect(screen.queryByRole("img", { name: /^Risk/ })).toBeNull();
    expect(decodeURIComponent(history.location.search)).toContain("risk");
    await userEvent.click(screen.getByRole("menuitem", { name: "Risk" }));
    expect(screen.getByRole("img", { name: "Risk High" })).toBeTruthy();
    expect(history.location.search).not.toContain("hide");
  });

  it("shows each card's key under its name until the Card menu turns it off", async () => {
    const history = await openBoard();
    expect(card("Fictional Alpha").textContent).toContain("#FEATURE-1");
    await userEvent.click(screen.getByRole("button", { name: "Card" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Key, chosen" }),
    );
    expect(card("Fictional Alpha").textContent).not.toContain("#FEATURE-");
    expect(decodeURIComponent(history.location.search)).toContain('"key"');
  });
});

describe("a card's menu", () => {
  const menuItems = async () =>
    (await screen.findAllByRole("menuitem")).map(
      ({ textContent }) => textContent,
    );

  it("opens from the ⋯ beside the card, titled with the feature, and shows its details", async () => {
    await openBoard();
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Fictional Beta" }),
    );
    expect(await menuItems()).toEqual(["Show details", "Copy link"]);
    expect(screen.getByRole("menu").textContent).toContain("Fictional Beta");
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Show details" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Fictional Beta" }),
    ).toBeTruthy();
  });

  it("opens from a right-click on the card, and copies the feature's link", async () => {
    const user = userEvent.setup();
    const history = await openBoard();
    await user.pointer({
      keys: "[MouseRight]",
      target: card("Fictional Alpha"),
    });
    await user.click(
      await screen.findByRole("menuitem", { name: "Copy link" }),
    );
    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}/go/feature/1`,
    );
    expect(history.location.search).not.toContain("open=");
  });

  it("offers no link, and shows no key, for a feature still being added", async () => {
    await openBoard(undefined, {
      answers: {
        "POST /api/features": () => new Promise<Response>(() => undefined),
      },
    });
    await userEvent.click(screen.getByRole("button", { name: "New feature" }));
    await userEvent.type(
      await screen.findByRole("textbox", { name: /^Name/ }),
      "Fictional Pending",
    );
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    const pending = await screen.findByRole("button", {
      name: (label) => label.startsWith("Fictional Pending"),
    });
    expect(pending.textContent).not.toContain("#FEATURE-");
    fireEvent.contextMenu(pending);
    expect(
      (await screen.findAllByRole("menuitem")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["Show details"]);
  });

  it("opens from Shift+F10 on the card, leaving its details closed", async () => {
    const history = await openBoard();
    card("Fictional Alpha").focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    expect(await menuItems()).toEqual(["Show details", "Copy link"]);
    expect(history.location.search).not.toContain("open=");
  });
});
