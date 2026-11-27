// SPDX-License-Identifier: Apache-2.0

// Tests of the tip that shows words cut short: only while they are cut, on pointing or keyboard
// focus.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCutTip } from "./cut-tip.ts";

function Account({ cut }: { cut: boolean }) {
  const { words, shown, target } = useCutTip();
  return (
    <button type="button" {...target}>
      <span
        ref={(element) => {
          if (element !== null) {
            Object.defineProperty(element, "scrollWidth", {
              value: cut ? 200 : 100,
            });
            Object.defineProperty(element, "clientWidth", { value: 100 });
          }
          words(element);
        }}
      >
        Fictional Account
      </span>
      {shown && <span role="tooltip">Fictional Account</span>}
    </button>
  );
}

const button = () => screen.getByRole("button");
// Found without the role queries, which read an element's own matches, given its own in the tests.
const tipShown = () => document.querySelector('[role="tooltip"]') !== null;

describe("a tip for words cut short", () => {
  it("shows while words cut short are pointed at", () => {
    render(<Account cut />);

    fireEvent.mouseEnter(button());
    const whilePointed = tipShown();
    fireEvent.mouseLeave(button());

    expect([whilePointed, tipShown()]).toEqual([true, false]);
  });

  it("shows nothing for words in full", () => {
    render(<Account cut={false} />);

    fireEvent.mouseEnter(button());

    expect(tipShown()).toBe(false);
  });

  it("shows on keyboard focus, and goes on leaving", () => {
    render(<Account cut />);

    const account = button();
    Object.defineProperty(account, "matches", {
      value: (selector: string) => selector === ":focus-visible",
    });
    fireEvent.focus(account);
    const whileFocused = tipShown();
    fireEvent.blur(account);

    expect([whileFocused, tipShown()]).toEqual([true, false]);
  });

  it("goes on Esc while it shows on focus, leaving focus where it was", () => {
    render(<Account cut />);

    const account = button();
    Object.defineProperty(account, "matches", {
      value: (selector: string) => selector === ":focus-visible",
    });
    fireEvent.focus(account);
    fireEvent.keyDown(account, { key: "Escape" });

    expect(tipShown()).toBe(false);
  });

  it("shows nothing on focus that isn't the keyboard's, such as a menu handing it back", () => {
    render(<Account cut />);

    const account = button();
    Object.defineProperty(account, "matches", { value: () => false });
    fireEvent.focus(account);

    expect(tipShown()).toBe(false);
  });
});
