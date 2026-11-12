// SPDX-License-Identifier: Apache-2.0

// The marks of a person and of a team's name on the org chart, on cards, in the finder and in the
// Teams panel alike, drawn through the shared marks so the Draft view decides them.

import type { ReactNode } from "react";
import { type ChartPerson, changeOf } from "./org-chart.ts";
import { DraftedItem } from "./status-mark.tsx";

// A person's name as the chart marks it, on their card and in the finder alike: a draft's dot when
// a draft moves them, or, shown live only, Live's while a draft waits, and the lock while someone
// else's unpublished changes hold them. A feature team's own card, while it has no lead, is named
// for the team, so it is marked as the team is.
export function PersonMarks({
  person,
  children,
}: {
  person: ChartPerson;
  children: ReactNode;
}) {
  if (person.teamCard === true) {
    return <TeamMarks person={person}>{children}</TeamMarks>;
  }
  return (
    <DraftedItem
      draft={
        person.moved !== undefined
          ? { ...changeOf(person.moved), moved: true }
          : person.added !== undefined
            ? { action: "created", ...person.added }
            : person.leaving && { action: "deleted", ...person.leaving }
      }
      heldBy={person.heldBy}
    >
      {children}
    </DraftedItem>
  );
}

// A team's name as the chart marks it: a draft's dot when a draft renames it, or, shown live only,
// Live's while a draft to rename it waits, and, for a feature team, the lock while someone else's
// unpublished changes hold it.
export function TeamMarks({
  person,
  plain = false,
  children,
}: {
  person: ChartPerson;
  // Whether the name is drawn without its marks, as where the card already marks the team.
  plain?: boolean;
  children: ReactNode;
}) {
  if (plain) return children;
  return (
    <DraftedItem
      draft={
        person.renamed === undefined
          ? undefined
          : changeOf(person.renamed.draft)
      }
      heldBy={person.teamHeldBy}
    >
      {children}
    </DraftedItem>
  );
}
