// SPDX-License-Identifier: Apache-2.0

// Tests for how menus name shortcut keys.

import { describe, expect, it } from "vitest";
import { shortcutsFor } from "./list-panel.tsx";

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
