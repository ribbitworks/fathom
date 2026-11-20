// SPDX-License-Identifier: Apache-2.0

// Feature teams' names, one to a line, each after its colour's square, each offering its whole name
// as a tip to the table's one tooltip, in table-tips.tsx.

import { ColouredName } from "./colour-swatch.tsx";
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
    colour: string | null;
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
        <span key={id} className={styles.label} {...{ [tipAttribute]: name }}>
          <DraftedPartItem draft={draftedBy} part={drafted} live={live}>
            <ColouredName colour={colour}>{name}</ColouredName>
          </DraftedPartItem>
        </span>
      ))}
    </div>
  );
}
