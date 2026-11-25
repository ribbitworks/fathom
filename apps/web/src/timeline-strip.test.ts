// SPDX-License-Identifier: Apache-2.0

// Tests for the strip as a rail: scrolling it so the periods in view show, given where each period
// is laid out, which the browser works out and these tests give.

import { afterEach, describe, expect, it } from "vitest";
import { roomAtEnd, showTinted } from "./timeline-strip.tsx";

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
  laidOut(strip, { clientWidth: width });
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

  it("puts a whole name at the start, as near centred as it can, the earlier where two are", () => {
    const strip = rail(240, [4]);
    showTinted(strip);
    // Centred, the rail would start at 150, a period's middle, as near 120 as 180; it takes 120.
    expect(strip.scrollLeft).toBe(120);
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

describe("room after the last period", () => {
  const roomOf = (strip: HTMLElement) =>
    strip.style.getPropertyValue("--strip-end");

  it("is just enough that the rail scrolled to its end starts with a whole name", () => {
    // Ten periods of 60 pixels in 250 run 350 over; the next start, 360, is 10 further.
    const strip = rail(250, []);
    roomAtEnd(strip);
    expect(roomOf(strip)).toBe("10px");
  });

  it("is none where the rail ends on a whole name, or doesn't scroll", () => {
    const ending = rail(240, []);
    roomAtEnd(ending);
    const fitting = rail(700, []);
    roomAtEnd(fitting);
    expect([roomOf(ending), roomOf(fitting)]).toEqual(["0px", "0px"]);
  });

  it("is none where the periods run only a pixel over, as rounding to whole pixels leaves them", () => {
    const strip = rail(599, []);
    roomAtEnd(strip);
    expect(roomOf(strip)).toBe("0px");
  });

  it("is none for a rail narrower than its last period, which no room can bring whole", () => {
    const strip = rail(40, []);
    roomAtEnd(strip);
    expect(roomOf(strip)).toBe("0px");
  });

  it("is none for a rail with no periods", () => {
    const strip = document.createElement("div");
    roomAtEnd(strip);
    expect(roomOf(strip)).toBe("0px");
  });
});
