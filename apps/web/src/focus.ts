// SPDX-License-Identifier: Apache-2.0

// Moves focus to a control once the page has drawn the result of a change, so the control exists by
// then, and focus is never left behind on something that has gone. Given several, it focuses the
// first that is drawn, waiting a few frames for one that is drawn later.

// How many frames to wait for the control, which a change made through the address, such as
// opening a panel, may draw a little after the change itself.
const framesToWait = 10;

function soon(ids: readonly string[], act: (element: HTMLElement) => void) {
  let framesLeft = framesToWait;
  const focusedAtFirst = document.activeElement;
  // Focus put somewhere since, such as by a click elsewhere, stays where it is: waiting gives way.
  const movedSince = () =>
    document.activeElement !== focusedAtFirst &&
    document.activeElement !== document.body;
  const attempt = () => {
    const element = ids
      .map((id) => document.getElementById(id))
      .find((found) => found !== null);
    if (element !== undefined) act(element);
    else if (framesLeft > 0 && !movedSince()) {
      framesLeft -= 1;
      requestAnimationFrame(attempt);
    }
  };
  setTimeout(attempt, 0);
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
