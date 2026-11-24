// SPDX-License-Identifier: Apache-2.0

// Saving the changes made to feature teams: adding one, renaming it, choosing its lead, adding and
// removing members, removing it, discarding or resending its draft, and its colour. Each change
// saves as a draft, which can be undone.

import type { Refusal } from "./api.ts";
import type { FeatureTeams } from "@fathom/shared";
import type { FeatureTeamActions } from "./feature-team-panel.tsx";
import {
  createFeatureTeam,
  deleteFeatureTeam,
  discardFeatureTeamDraft,
  featureTeamsQuery,
  resubmitFeatureTeamDraft,
  setFeatureTeamColour,
  updateFeatureTeam,
} from "./feature-teams.ts";
import { useSaving } from "./saving.ts";

export function useFeatureTeamActions(
  // Shows the team just added.
  openTeam: (id: string) => void,
  // While another of the page's dialogs is open, which Cmd+Z leaves alone.
  blocked: boolean,
): FeatureTeamActions {
  const { save: saving, undoable } = useSaving<FeatureTeams>({
    queryKey: featureTeamsQuery.queryKey,
    removed:
      "Someone else has removed this feature team. The teams have been refreshed.",
    blocked,
  });
  const saveTeam = (
    save: () => Promise<string | null>,
    failure: string,
    onRefused?: (refusal: Refusal) => boolean,
  ) => {
    saving({
      next: (data) => data,
      save,
      failure,
      onRefused,
      onSaved: undoable,
    });
  };
  return {
    create: (request, refused) => {
      saveTeam(
        async () => {
          const { id, changeSetId } = await createFeatureTeam(request);
          openTeam(id);
          return changeSetId;
        },
        `Fathom could not add ${request.name}.`,
        refused,
      );
    },
    rename: (team, name) => {
      saveTeam(
        () => updateFeatureTeam(team.id, { name }),
        `Fathom could not rename ${team.name}.`,
      );
    },
    lead: (team, leadId, from) => {
      saveTeam(
        () =>
          updateFeatureTeam(team.id, {
            leadId,
            ...(from === undefined ? {} : { from }),
          }),
        `Fathom could not change the lead of ${team.name}.`,
      );
    },
    members: (team, { add, remove }, from) => {
      saveTeam(
        () =>
          updateFeatureTeam(team.id, {
            add,
            remove,
            ...(from === undefined ? {} : { from }),
          }),
        `Fathom could not change the members of ${team.name}.`,
      );
    },
    removeTeam: (team) => {
      saveTeam(
        () => deleteFeatureTeam(team.id),
        `Fathom could not remove ${team.name}.`,
      );
    },
    discard: (team) => {
      saveTeam(
        () => discardFeatureTeamDraft(team.id),
        `Fathom could not discard the draft of ${team.name}.`,
      );
    },
    resubmit: (team) => {
      saveTeam(
        () => resubmitFeatureTeamDraft(team.id),
        `Fathom could not send the draft of ${team.name} for approval again.`,
      );
    },
    colour: (team) => (colour) => setFeatureTeamColour(team.id, colour),
  };
}
