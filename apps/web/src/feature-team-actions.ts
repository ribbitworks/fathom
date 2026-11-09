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
import { useSaving } from "./saving.ts";

export function useFeatureTeamActions(
  // Shows the team just added.
  openTeam: (id: string) => void,
): FeatureTeamActions {
  const {
    save: saving,
    undoable,
    done,
  } = useSaving<FeatureTeams>({
    queryKey: featureTeamsQuery.queryKey,
    removed:
      "Someone else has removed this feature team. The teams have been refreshed.",
    blocked: false,
  });
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
    create: (name) => {
      saveTeam(async () => {
        const { id, changeSetId } = await createFeatureTeam({
          name,
          leadId: null,
          members: [],
        });
        openTeam(id);
        return changeSetId;
      }, `Fathom could not add ${name}.`);
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
    add: (team, personId, from) => {
      saveTeam(
        () =>
          updateFeatureTeam(team.id, {
            add: [personId],
            ...(from === undefined ? {} : { from }),
          }),
        `Fathom could not add a member to ${team.name}.`,
      );
    },
    remove: (team, personId, from) => {
      saveTeam(
        () =>
          updateFeatureTeam(team.id, {
            remove: [personId],
            ...(from === undefined ? {} : { from }),
          }),
        `Fathom could not remove a member from ${team.name}.`,
      );
    },
    moveChanges: (team, from, onFailed) => {
      saving({
        next: (data) => data,
        onFailed,
        save: () => updateFeatureTeam(team.id, { from }),
        failure: `Fathom could not change the date of ${team.name}.`,
        onSaved: (changeSetId, before) => {
          done("Date changed", changeSetId, before);
        },
      });
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
