// SPDX-License-Identifier: Apache-2.0

// Saving the changes made to feature teams: adding one, renaming it, choosing its lead, adding and
// removing members, removing it, discarding or resending its draft, and its colour. Each change
// saves as a draft, which can be undone.

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
import { draftSaving, useSaving } from "./saving.ts";

export function useFeatureTeamActions(
  // Shows the team just added.
  openTeam: (id: string) => void,
  // While another of the page's dialogs is open, which Cmd+Z leaves alone.
  blocked: boolean,
): FeatureTeamActions {
  const changes = useSaving<FeatureTeams>({
    queryKey: featureTeamsQuery.queryKey,
    removed:
      "Someone else has removed this feature team. The teams have been refreshed.",
    blocked,
  });
  const { save: saving, undoable } = changes;
  const drafts = draftSaving(changes);
  const saveTeam = (save: () => Promise<string | null>, failure: string) => {
    saving({
      next: (data) => data,
      save,
      failure,
      onSaved: (changeSetId, before) => {
        undoable(changeSetId, before);
      },
    });
  };
  return {
    create: (request) => {
      saveTeam(async () => {
        const { id, changeSetId } = await createFeatureTeam(request);
        openTeam(id);
        return changeSetId;
      }, `Fathom could not add ${request.name}.`);
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
      drafts.discard({
        name: team.name,
        save: () => discardFeatureTeamDraft(team.id),
      });
    },
    resubmit: (team) => {
      drafts.resubmit({
        name: team.name,
        save: () => resubmitFeatureTeamDraft(team.id),
      });
    },
    colour: (team) => (colour) => setFeatureTeamColour(team.id, colour),
  };
}
