// SPDX-License-Identifier: Apache-2.0

// Moves focus to a control once the page has drawn the result of a change, so the control exists by
// then, and focus is never left behind on something that has gone. Given several, it focuses the
// first that is drawn, waiting a few frames for one that is drawn later.

// How many frames to wait for the control, which a change made through the address, such as
// opening a panel, may draw a little after the change itself.
const framesToWait = 10;

function soon(
  find: () => HTMLElement | undefined,
  act: (element: HTMLElement) => void,
) {
  let framesLeft = framesToWait;
  // A key pressed or a click since, such as on another control, is the person moving on: waiting
  // gives way. Focus a menu hands back by itself as it closes is not.
  let movedOn = false;
  const moveOn = () => {
    movedOn = true;
  };
  const listen = { capture: true } as const;
  document.addEventListener("keydown", moveOn, listen);
  document.addEventListener("pointerdown", moveOn, listen);
  const done = () => {
    document.removeEventListener("keydown", moveOn, listen);
    document.removeEventListener("pointerdown", moveOn, listen);
  };
  const attempt = () => {
    const element = find();
    if (element !== undefined) {
      done();
      act(element);
    } else if (framesLeft > 0 && !movedOn) {
      framesLeft -= 1;
      requestAnimationFrame(attempt);
    } else done();
  };
  setTimeout(attempt, 0);
}

const firstOf = (ids: readonly string[]) => () =>
  ids
    .map((id) => document.getElementById(id))
    .find((found) => found !== null) ?? undefined;

const focus = (element: HTMLElement) => {
  element.focus();
};

export function focusSoon(...ids: string[]): void {
  soon(firstOf(ids), focus);
}

// Focuses the first control found once drawn, for one known by more than its identifier.
export function focusFoundSoon(find: () => HTMLElement | undefined): void {
  soon(find, focus);
}

// Focuses a field opened to change its value, with its text selected, so typing replaces it.
export function selectSoon(id: string): void {
  soon(firstOf([id]), (element) => {
    element.focus();
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      element.select();
    }
  });
}

// Focuses the first field a refused save marked, once drawn, so the person can put it right
// rather than being left on the button that saves.
export function focusRefusedSoon(form: HTMLElement): void {
  focusFoundSoon(
    () => form.querySelector<HTMLElement>('[aria-invalid="true"]') ?? undefined,
  );
}

// How long a page may take to draw before focusing a control on it stops waiting for it.
const pageDrawnWithin = 3000;

const typesText = (event: KeyboardEvent) =>
  event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;

// Holds the characters typed from now on, for a control on a page being opened, so typing straight
// on, such as a new page's first row, isn't lost while the page is saved and drawn. Given the
// control's identifier, it focuses the control once drawn and gives it the characters held; stopped,
// it lets them go. Unlike focusSoon, its wait doesn't give way to keys pressed, since those keys are
// its point.
export function holdKeys() {
  const held: string[] = [];
  // Set while a held key is given, so it isn't held again.
  let giving = false;
  const hold = (event: KeyboardEvent) => {
    if (giving || !typesText(event)) return;
    event.preventDefault();
    event.stopPropagation();
    held.push(event.key);
  };
  const listen = { capture: true } as const;
  document.addEventListener("keydown", hold, listen);
  const stop = () => {
    document.removeEventListener("keydown", hold, listen);
  };
  // One a frame, as keys typed fast reach a cell, each after the cell has taken the one before; keys
  // typed meanwhile are held behind them, keeping their order, until none is left.
  const giveEach = (control: HTMLElement) => {
    const key = held.shift();
    if (key === undefined) {
      stop();
      return;
    }
    giving = true;
    control.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
    );
    giving = false;
    requestAnimationFrame(() => {
      giveEach(control);
    });
  };
  const giveTo = (id: string) => {
    const startedAt = performance.now();
    const attempt = () => {
      const control = document.getElementById(id);
      if (control === null && performance.now() - startedAt < pageDrawnWithin) {
        requestAnimationFrame(attempt);
        return;
      }
      if (control === null) {
        stop();
        return;
      }
      control.focus();
      giveEach(control);
    };
    requestAnimationFrame(attempt);
  };
  return { giveTo, stop };
}
