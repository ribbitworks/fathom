// SPDX-License-Identifier: Apache-2.0

// Moves focus to a control once the page has drawn the result of a change, so the control exists by
// then, and focus is never left behind on something that has gone.

export function focusSoon(id: string): void {
  setTimeout(() => {
    document.getElementById(id)?.focus();
  }, 0);
}
