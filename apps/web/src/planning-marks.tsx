// SPDX-License-Identifier: Apache-2.0

// A feature's Size and Risk marks, the same wherever they show, as UI Conventions set out. Size is
// the word and a block for each S it weighs, light to dark blue-grey by position, four blocks
// filling the space given; Risk is the word and a segment for each step of its list, green to red
// by the list's order, filled up to its own. Each value shows on hover and is read aloud.

import { decimal } from "./numbers.ts";
import classes from "./planning-marks.module.css";
import { Tipped } from "./table-tips.tsx";

// The most S the mark draws, which fills the space given.
const sizeBlocks = 4;

// Each block's span, in halves of a block, so half an S shows as half a block.
function blockSpans(weight: number): number[] {
  const halves = Math.round(Math.min(weight, sizeBlocks) * 2);
  return Array.from({ length: Math.ceil(halves / 2) }, (_, block) =>
    Math.min(2, halves - block * 2),
  );
}

export const sizeWords = (name: string, weight: number | null): string =>
  weight === null ? name : `${name}, ${decimal(weight)} × S`;

export function SizeMark({
  name,
  weight,
}: {
  name: string;
  weight: number | null;
}) {
  const words = sizeWords(name, weight);
  return (
    <Tipped tip={words} className={classes.mark}>
      <span className={classes.word} aria-hidden="true">
        Size
      </span>
      <span
        className={classes.sizeBlocks}
        role="img"
        aria-label={`Size ${words}`}
      >
        {blockSpans(weight ?? 0).map((span, block) => (
          <span
            key={block}
            className={classes.sizeBlock}
            data-shade={block + 1}
            style={{ gridColumn: `span ${String(span)}` }}
          />
        ))}
      </span>
    </Tipped>
  );
}

// The shade of each step of a list of a length, green to red: the first green, the last red, and
// those between yellow, then orange.
function stepShade(step: number, steps: number): string {
  if (step === 0) return "low";
  if (step === steps - 1) return "high";
  return step < (steps - 1) / 2 ? "lowMiddle" : "highMiddle";
}

export function RiskMark({
  name,
  step,
  steps,
}: {
  name: string;
  // Its place in its list, from 0, and how many places the list has.
  step: number;
  steps: number;
}) {
  return (
    <Tipped tip={name} className={classes.mark}>
      <span className={classes.word} aria-hidden="true">
        Risk
      </span>
      <span
        className={classes.riskSegments}
        role="img"
        aria-label={`Risk ${name}`}
        style={{ gridTemplateColumns: `repeat(${String(steps)}, 1fr)` }}
      >
        {Array.from({ length: step + 1 }, (_, place) => (
          <span
            key={place}
            className={classes.riskSegment}
            data-shade={stepShade(place, steps)}
          />
        ))}
      </span>
    </Tipped>
  );
}
