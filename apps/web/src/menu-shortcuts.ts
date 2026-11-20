// SPDX-License-Identifier: Apache-2.0

// The keyboard shortcuts shown in menus, such as each choice's or each column's, as Macs and other
// computers name the keys.

export function shortcutsFor(userAgent: string) {
  const mac = /Mac|iPhone|iPad/.test(userAgent);
  return {
    edit: mac ? "↵" : "Enter",
    up: mac ? "⌥↑" : "Alt+↑",
    down: mac ? "⌥↓" : "Alt+↓",
    left: mac ? "⌥←" : "Alt+←",
    right: mac ? "⌥→" : "Alt+→",
    wider: mac ? "⇧⌥→" : "Shift+Alt+→",
    narrower: mac ? "⇧⌥←" : "Shift+Alt+←",
    retire: "R",
    remove: mac ? "⌫" : "Del",
  };
}
