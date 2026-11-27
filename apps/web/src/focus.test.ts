// SPDX-License-Identifier: Apache-2.0

// Tests for moving focus once the page has drawn: waiting a few frames for a control drawn later,
// selecting a field's text only where it has text to select, and holding what is typed meanwhile.

import { afterEach, describe, expect, it, vi } from "vitest";
import { focusRefusedSoon, focusSoon, holdKeys, selectSoon } from "./focus.ts";

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

// About one frame, so a frame passes before the control is drawn.
const framesTime = 20;

describe("focusing a control a change draws", () => {
  it("waits for a control drawn a few frames after the change, such as a panel opened through the address", () => {
    vi.useFakeTimers();
    focusSoon("panel-title");
    vi.advanceTimersByTime(0);

    const title = document.createElement("h2");
    title.id = "panel-title";
    title.tabIndex = -1;
    document.body.append(title);
    vi.runAllTimers();

    expect(document.activeElement).toBe(title);
  });

  it("gives way to a click elsewhere while it waits", () => {
    vi.useFakeTimers();
    const elsewhere = document.createElement("input");
    document.body.append(elsewhere);
    focusSoon("panel-title");
    vi.advanceTimersByTime(0);

    elsewhere.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    elsewhere.focus();
    vi.advanceTimersByTime(framesTime);
    const title = document.createElement("h2");
    title.id = "panel-title";
    title.tabIndex = -1;
    document.body.append(title);
    vi.runAllTimers();

    expect(document.activeElement).toBe(elsewhere);
  });

  it("keeps waiting while focus moves by itself, such as back to a menu's button", () => {
    vi.useFakeTimers();
    const button = document.createElement("button");
    document.body.append(button);
    focusSoon("panel-title");
    vi.advanceTimersByTime(0);

    button.focus();
    vi.advanceTimersByTime(framesTime);
    const title = document.createElement("h2");
    title.id = "panel-title";
    title.tabIndex = -1;
    document.body.append(title);
    vi.runAllTimers();

    expect(document.activeElement).toBe(title);
  });

  it("stops waiting for a control that is never drawn", () => {
    vi.useFakeTimers();
    focusSoon("never-drawn");

    vi.runAllTimers();

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("focusing the field a save refused", () => {
  it("focuses the first field marked refused in the form, once drawn", () => {
    vi.useFakeTimers();
    const form = document.createElement("form");
    const fields = ["kept", "refused", "also refused"].map((name) => {
      const field = document.createElement("input");
      field.name = name;
      if (name !== "kept") field.setAttribute("aria-invalid", "true");
      return field;
    });
    form.append(...fields);
    document.body.append(form);

    focusRefusedSoon(form);
    vi.runAllTimers();

    expect(document.activeElement).toBe(fields[1]);
  });

  it("leaves focus where it was when no field is marked refused", () => {
    vi.useFakeTimers();
    const form = document.createElement("form");
    const button = document.createElement("button");
    form.append(document.createElement("input"), button);
    document.body.append(form);
    button.focus();

    focusRefusedSoon(form);
    vi.runAllTimers();

    expect(document.activeElement).toBe(button);
  });
});

describe("focusing a control on a page being opened, holding what is typed", () => {
  const press = (key: string, options: KeyboardEventInit = {}) =>
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, ...options }),
    );
  const frames = (count: number) =>
    vi.advanceTimersByTimeAsync(count * framesTime);

  it("gives the control the characters typed before it was drawn, and lets other keys go", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "performance"] });
    const held = holdKeys();
    press("A");
    press("s");
    press("Shift");
    press("k", { metaKey: true });
    held.giveTo("first-row");
    await frames(3);

    const row = document.createElement("div");
    row.id = "first-row";
    row.tabIndex = 0;
    const given: string[] = [];
    row.addEventListener("keydown", (event) => {
      given.push(event.key);
    });
    document.body.append(row);
    // A key typed while the held ones are being given comes after them
    press("k");
    await frames(5);

    expect(document.activeElement).toBe(row);
    expect(given).toEqual(["A", "s", "k"]);
  });

  it("stops holding keys once the page takes too long to draw", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "performance"] });
    holdKeys().giveTo("never-drawn");
    await vi.advanceTimersByTimeAsync(4000);
    const pressed = new KeyboardEvent("keydown", {
      key: "A",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(pressed);
    expect(pressed.defaultPrevented).toBe(false);
  });

  it("lets keys go once stopped, such as when the page can't be made", () => {
    holdKeys().stop();
    const pressed = new KeyboardEvent("keydown", {
      key: "A",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(pressed);
    expect(pressed.defaultPrevented).toBe(false);
  });
});
