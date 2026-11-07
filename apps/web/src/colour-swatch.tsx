// SPDX-License-Identifier: Apache-2.0

// A small dot of a palette colour, beside the colour's name or what it colours, so it is never read
// out on its own.

import { ColorSwatch } from "@mantine/core";
import { colourVariable } from "./colours.ts";

export const Swatch = ({
  colour,
  size = 14,
}: {
  colour: string;
  size?: number;
}) => (
  <ColorSwatch
    component="span"
    color={colourVariable(colour, "filled")}
    size={size}
    withShadow={false}
    display="inline-block"
    style={{ flexShrink: 0 }}
    aria-hidden
  />
);
