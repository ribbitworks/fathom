// SPDX-License-Identifier: Apache-2.0

// A person's initials, for their avatar: the first letters of their first two names.

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => part !== "")
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}
