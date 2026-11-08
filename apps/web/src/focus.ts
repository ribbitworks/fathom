// SPDX-License-Identifier: Apache-2.0

// Moves focus to a control once the page has drawn the result of a change, so the control exists by
// then, and focus is never left behind on something that has gone. Given several, it focuses the
// first that is drawn.

export function focusSoon(...ids: string[]): void {
  setTimeout(() => {
    ids
      .map((id) => document.getElementById(id))
      .find((element) => element !== null)
      ?.focus();
  }, 0);
}
