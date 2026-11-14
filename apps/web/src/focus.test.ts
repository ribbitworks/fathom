// SPDX-License-Identifier: Apache-2.0

// Tests for moving focus once the page has drawn: waiting a few frames for a control drawn later,
// and selecting a field's text only where it has text to select.

import { afterEach, describe, expect, it, vi } from "vitest";
import { focusSoon, selectSoon } from "./focus.ts";

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("focusing a field opened to change its value", () => {
  it("focuses what is not a text field, selecting nothing", () => {
    vi.useFakeTimers();
    const picker = document.createElement("div");
    picker.id = "picker";
    picker.tabIndex = 0;
    document.body.append(picker);

    selectSoon("picker");
    vi.runAllTimers();

    expect(document.activeElement).toBe(picker);
  });
});

describe("focusing a control a change draws", () => {
  it("waits for a control drawn a few frames after the change, such as a panel opened through the address", () => {
    vi.useFakeTimers();
    focusSoon("panel-title");
    vi.advanceTimersByTime(0);

    const title = document.createElement("h2");
    title.id = "panel-title";
    title.tabIndex = -1;
    document.body.append(title);
    vi.runAllTimers();

    expect(document.activeElement).toBe(title);
  });

  it("stops waiting for a control that is never drawn", () => {
    vi.useFakeTimers();
    focusSoon("never-drawn");

    vi.runAllTimers();

    expect(vi.getTimerCount()).toBe(0);
  });
});
