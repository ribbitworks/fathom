// SPDX-License-Identifier: Apache-2.0

// Tests for moving focus once the page has drawn: selecting a field's text only where it has text
// to select.

import { afterEach, describe, expect, it, vi } from "vitest";
import { selectSoon } from "./focus.ts";

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
