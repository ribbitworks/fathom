// SPDX-License-Identifier: Apache-2.0

// A small square of a palette colour, beside the colour's name or what it colours, so it is never
// read out on its own. It is square, with rounded corners, so it is never taken for a mark's dot,
// which is round.

import { ColorSwatch } from "@mantine/core";
import type { CSSProperties, ReactNode } from "react";
import { colourVariable } from "./colours.ts";
import marks from "./status-mark.module.css";

// A swatch's corners: about a fifth of its size, and at least 2px, so a small one still reads as
// rounded rather than as a dot.
const swatchRadius = (size: number) => Math.max(2, Math.round(size / 5));

// The size of a team's colour, beside its name in panels and on cards.
export const teamSwatchSize = 11;

// About how many characters a coloured name's square takes, with the gap after it.
export const colouredNameChars = 3;

export const Swatch = ({
  colour,
  size = 14,
  shown,
  alone = false,
}: {
  colour: string;
  size?: number;
  // The colour as drawn, where it is not the palette colour's filled shade, such as text's.
  shown?: string | undefined;
  // Alone where its place centres it, such as a menu item's icon, with no text to be centred on.
  alone?: boolean;
}) => {
  const swatch = (
    <ColorSwatch
      component="span"
      color={shown ?? colourVariable(colour, "filled")}
      size={size}
      radius={swatchRadius(size)}
      withShadow={false}
      display="inline-block"
      data-colour={colour}
      {...(alone ? { "aria-hidden": true } : {})}
    />
  );
  if (alone) return swatch;
  return (
    // Centred on its text's capitals, as every mark is.
    <span
      className={[marks.swatchPlace, marks.swatchSpaced].join(" ")}
      style={{ "--mark-size": `${String(size)}px` } as CSSProperties}
      aria-hidden
    >
      {swatch}
    </span>
  );
};

// A name in its colour, as tables, panels and timelines show a team or release that has one: its
// colour's square before it, centred on its text, in the line that holds it, such as a cell's after
// a draft's dot.
export function ColouredName({
  colour,
  children,
}: {
  colour: string | null;
  children: ReactNode;
}) {
  return (
    <>
      {colour !== null && <Swatch colour={colour} size={teamSwatchSize} />}
      {children}
    </>
  );
}
