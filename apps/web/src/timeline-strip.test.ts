// SPDX-License-Identifier: Apache-2.0

// Tests for the strip as a rail: scrolling it so the periods in view show, given where each period
// is laid out, which the browser works out and these tests give.

import { afterEach, describe, expect, it } from "vitest";
import { showTinted } from "./timeline-strip.tsx";

afterEach(() => {
  document.body.replaceChildren();
});

const laidOut = (element: HTMLElement, sizes: Record<string, number>) => {
  for (const [name, value] of Object.entries(sizes)) {
    Object.defineProperty(element, name, { value, configurable: true });
  }
};

// A rail as wide as given, at the page's left edge, of periods each 60 pixels wide, those named
// tinted.
function rail(width: number, tinted: readonly number[]) {
  const strip = document.createElement("div");
  laidOut(strip, { clientWidth: width, offsetLeft: 0 });
  for (let at = 0; at < 10; at += 1) {
    const period = document.createElement("button");
    laidOut(period, { offsetLeft: at * 60, offsetWidth: 60 });
    if (tinted.includes(at)) period.dataset.inView = "true";
    strip.append(period);
  }
  document.body.append(strip);
  return strip;
}

describe("keeping the tinted periods in view", () => {
  it("centres the tinted periods when they fit", () => {
    const strip = rail(240, [4, 5]);
    showTinted(strip);
    // The tinted periods run from 240 to 360; 120 spare pixels go half before them.
    expect(strip.scrollLeft).toBe(180);
  });

  it("centres one tinted period", () => {
    const strip = rail(240, [4]);
    showTinted(strip);
    expect(strip.scrollLeft).toBe(150);
  });

  it("starts from the first tinted period when they don't all fit", () => {
    const strip = rail(100, [3, 4, 5]);
    showTinted(strip);
    expect(strip.scrollLeft).toBe(180);
  });

  it("leaves the rail where it is when no period is tinted", () => {
    const strip = rail(100, []);
    strip.scrollLeft = 50;
    showTinted(strip);
    expect(strip.scrollLeft).toBe(50);
  });
});
