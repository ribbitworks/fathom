// SPDX-License-Identifier: Apache-2.0

// The colours a release or a team can be chosen to be shown in, named as the theme names them. The
// accent colour, sea, which a release with none is shown in, is left out so that no two choices
// look alike.

import { z } from "zod";

export const paletteColours = [
  "indigo",
  "violet",
  "grape",
  "pink",
  "red",
  "orange",
  "yellow",
  "lime",
  "green",
  "teal",
] as const;

export const paletteColourSchema = z.enum(paletteColours);

export type PaletteColour = z.infer<typeof paletteColourSchema>;

// A colour chosen for a feature team or a feature, or null for none. It is not part of any draft, so
// it changes at once.
export const colourChangeSchema = z.object({
  colour: paletteColourSchema.nullable(),
});

// A stored colour, or null for one the palette no longer has, which shows as having none.
export const knownColour = (value: unknown): PaletteColour | null =>
  paletteColourSchema.nullable().catch(null).parse(value);

// The colour a record is shown in: its own, or, while it has none, the one it takes from the record
// it belongs to, such as a feature's from its feature team.
export const shownColourOf = (
  own: PaletteColour | null,
  inherited: PaletteColour | null,
): PaletteColour | null => own ?? inherited;
