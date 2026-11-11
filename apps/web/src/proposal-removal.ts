// SPDX-License-Identifier: Apache-2.0

// What a change to a feature's proposals, or to a proposal's features, removes from proposals, so a
// reason can be asked for first. A feature is removed from a proposal only when the proposal names it
// as shown, the change leaves it out, and the live proposal names it: a feature only a draft added,
// or one a draft already removed, is not removed again.

import {
  featureNamerKeys,
  type ProjectPlan,
  type Proposal,
} from "@fathom/shared";
import type { CellChange } from "./cell-kinds.tsx";
import { livePlanRecords } from "./project-grids.tsx";
import { isFeature, isProposal, namesOf, type PlanRecord } from "./projects.ts";

// The features removed, and the proposals they are removed from, each by name.
export interface ProposalRemoval {
  features: string[];
  proposals: string[];
}

const pickedIn = (change: Record<string, unknown>, key: string) => {
  const picked = new Map(Object.entries(change)).get(key);
  return Array.isArray(picked) ? picked.map(String) : undefined;
};

const removes = (proposal: Proposal, featureId: string, kept: boolean) =>
  !kept &&
  proposal.featureIds.includes(featureId) &&
  livePlanRecords([proposal]).some(({ featureIds }) =>
    featureIds.includes(featureId),
  );

// A removal that removes something, or none.
const removing = (removal: ProposalRemoval): ProposalRemoval | undefined =>
  removal.features.length === 0 || removal.proposals.length === 0
    ? undefined
    : removal;

export function proposalRemovalOf(
  plan: ProjectPlan,
  record: PlanRecord,
  change: CellChange & Record<string, unknown>,
): ProposalRemoval | undefined {
  if (isFeature(record)) {
    const kept = pickedIn(change, featureNamerKeys.proposal);
    if (kept === undefined) return undefined;
    return removing({
      features: [record.name],
      proposals: plan.proposals
        .filter((proposal) =>
          removes(proposal, record.id, kept.includes(proposal.id)),
        )
        .map(({ name }) => name),
    });
  }
  if (isProposal(record)) {
    const kept = pickedIn(change, "featureIds");
    if (kept === undefined) return undefined;
    return removing({
      features: namesOf(
        plan.features,
        record.featureIds.filter((id) =>
          removes(record, id, kept.includes(id)),
        ),
      ),
      proposals: [record.name],
    });
  }
  return undefined;
}
