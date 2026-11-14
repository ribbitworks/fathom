// SPDX-License-Identifier: Apache-2.0

// Moves focus to a control once the page has drawn the result of a change, so the control exists by
// then, and focus is never left behind on something that has gone. Given several, it focuses the
// first that is drawn.

function soon(ids: readonly string[], act: (element: HTMLElement) => void) {
  setTimeout(() => {
    const element = ids
      .map((id) => document.getElementById(id))
      .find((found) => found !== null);
    if (element !== undefined) act(element);
  }, 0);
}

export function focusSoon(...ids: string[]): void {
  soon(ids, (element) => {
    element.focus();
  });
}

// Focuses a field opened to change its value, with its text selected, so typing replaces it.
export function selectSoon(id: string): void {
  soon([id], (element) => {
    element.focus();
    if (element instanceof HTMLInputElement) element.select();
  });
}
