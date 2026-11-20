// SPDX-License-Identifier: Apache-2.0

// Labels naming feature teams, each in its team's colour, each offering its whole name as a tip to
// the table's one tooltip, in table-tips.tsx.

import type { PaletteColour } from "@fathom/shared";
import { colourVariable } from "./colours.ts";
import { DraftedPartItem, type DraftedPart } from "./status-mark.tsx";
import type { DraftLike } from "./draft-marks.ts";
import { tipAttribute } from "./table-tips.tsx";
import styles from "./team-labels.module.css";

// Whether a draft adds someone to a team or takes them off it, when it does either.
export type DraftedLabel = Exclude<DraftedPart, "changed">;

export function TeamLabels({
  teams,
}: {
  teams: readonly {
    id: string;
    name: string;
    colour: PaletteColour | null;
    drafted?: DraftedLabel | undefined;
    // The draft adding or removing the team, whose dot the label shows.
    draftedBy?: DraftLike | undefined;
    // Set on a team as it is live, where draftedBy changes it as drafted says, so it shows Live's
    // dot.
    live?: boolean | undefined;
  }[];
}) {
  return (
    <div className={styles.labels}>
      {teams.map(({ id, name, colour, drafted, draftedBy, live }) => (
        <span
          key={id}
          className={[
            styles.label,
            colour === null ? styles.labelNoColour : "",
          ].join(" ")}
          {...{ [tipAttribute]: name }}
          style={
            colour === null
              ? undefined
              : {
                  background: colourVariable(colour, "light"),
                  color: colourVariable(colour, "light-color"),
                }
          }
        >
          <DraftedPartItem draft={draftedBy} part={drafted} live={live}>
            {name}
          </DraftedPartItem>
        </span>
      ))}
    </div>
  );
}
