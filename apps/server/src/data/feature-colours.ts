// SPDX-License-Identifier: Apache-2.0

// A feature's own colour, chosen by those who change feature teams, as a team's colour is. It is no
// part of any draft, so it changes at once, and only once the feature is approved. Part of the data
// access layer.

import { type Database, features } from "@fathom/db";
import type { PaletteColour } from "@fathom/shared";
import { and, eq, isNull } from "drizzle-orm";
import type { Actor } from "../access.ts";
import { ForbiddenError, NotFoundError } from "../errors.ts";
import { changesTeams } from "./feature-teams.ts";

// Those who change feature teams choose features' colours, of the features they see.
export const coloursFeatures = (actor: Actor): boolean =>
  changesTeams(actor) && actor.permissions.includes("features:view");

export function requireColouring(actor: Actor): void {
  if (!coloursFeatures(actor)) throw new ForbiddenError();
}

// Sets a feature's colour, or takes it away so the feature shows its team's.
export async function setFeatureColour(
  database: Database,
  actor: Actor,
  id: string,
  colour: PaletteColour | null,
): Promise<void> {
  requireColouring(actor);
  const changed = await database
    .update(features)
    .set({ colour })
    .where(and(eq(features.id, id), isNull(features.generalForProjectId)))
    .returning({ id: features.id });
  if (changed.length === 0) {
    throw new NotFoundError(
      "This feature is not approved yet, so it cannot have a colour",
    );
  }
}
