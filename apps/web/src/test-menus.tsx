// SPDX-License-Identifier: Apache-2.0

// Helpers for the tests of a menu's items.

import { type ByRoleOptions, within } from "@testing-library/react";
import { expect } from "vitest";

// A menu's item turned off, described by the line saying why, and still reached by the arrow keys,
// which skip an item marked disabled.
export function turnedOffItem(
  menu: HTMLElement,
  name: NonNullable<ByRoleOptions["name"]>,
  reason: string,
): HTMLElement {
  const item = within(menu).getByRole("menuitem", {
    name,
    description: reason,
  });
  expect(item.getAttribute("aria-disabled")).toBe("true");
  expect(item.hasAttribute("data-disabled")).toBe(false);
  return item;
}
