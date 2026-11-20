// SPDX-License-Identifier: Apache-2.0

// The facts and notes a list's panel shows about the list itself.

import type { BuiltInList, List } from "@fathom/shared";
import { FactBox } from "./status-mark.tsx";

// What a list Fathom builds in is for, shown under its choices; the organization's own description
// of it shows under its name, as for any list.
// Fathom filled the list in, so those who may change it are first told it is theirs to change.
export function builtInNote(key: BuiltInList, mayChange: boolean): string {
  const invitation = mayChange
    ? "These can be renamed, added to, or retired.\n"
    : "";
  switch (key) {
    case "hiring-states":
      return `${invitation}Proposed: the request to hire is not yet approved.\nOpen: the request to hire is approved.\nHired: everyone in People who hasn't left. A planned hire is hired when someone fills it.\nLeft: everyone in People whose end date has passed.\nKeep at least one choice for each.`;
    case "positions":
      return `${invitation}Every person and planned hire has one of these positions.\nKeep at least one.`;
    case "proposal-statuses":
      return `${invitation}Every proposal has one of these statuses.\nKeep at least one.`;
    case "feature-statuses":
      return `${invitation}Possible: the feature may come, and needs no feature team yet.\nPlanned: the feature is planned, and needs a feature team.\nIn progress: work has started, and the feature needs a feature team.\nDone: the feature is finished.\nCancelled: the feature won't be built.\nKeep at least one choice for each.`;
    case "feature-priorities":
      return `${invitation}How much a feature matters to the organization, apart from its status, highest first.\nKeep at least one.`;
    case "feature-sizes":
      return `${invitation}A feature's rough size, before it is estimated, smallest first.\nKeep at least one.`;
    case "feature-risks":
      return `${invitation}How much could go wrong in building a feature, lowest first.\nKeep at least one.`;
  }
}

// The facts about a list: whether Fathom builds it in, so it cannot be retired or removed.
export function ListFacts({ list }: { list: List }) {
  return list.builtIn && <FactBox>Built in</FactBox>;
}
