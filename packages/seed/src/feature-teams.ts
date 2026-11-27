// SPDX-License-Identifier: Apache-2.0

// Adds and removes the fictional organization's feature teams, with their members and leads, for the
// seed data generator.

import {
  type Database,
  drafts,
  featureTeamLeads,
  featureTeamMemberships,
  featureTeams,
  privateChanges,
} from "@fathom/db";
import type { FictionalOrganization } from "@fathom/fixtures";
import { eq, inArray } from "drizzle-orm";
import type { SeededChange } from "./recorded.ts";
import { recorded } from "./seed-records.ts";

// Adds the fictional feature teams, with every record of their members joining and leaving, and
// returns the changes that record them, with members as they are on the reference date.
export async function addFeatureTeams(
  transaction: Pick<Database, "insert">,
  organization: FictionalOrganization,
): Promise<SeededChange[]> {
  const made: SeededChange[] = [];
  for (const team of organization.featureTeams) {
    const { memberships, leadId, formerLead, ...row } = team;
    // A team left in place, such as when only another was removed by hand, keeps its own records.
    const inserted = await transaction
      .insert(featureTeams)
      .values(row)
      .onConflictDoNothing({ target: featureTeams.id })
      .returning({ id: featureTeams.id });
    if (inserted.length === 0) continue;
    await transaction
      .insert(featureTeamMemberships)
      .values(memberships.map((one) => ({ teamId: team.id, ...one })));
    // A team's lead has led it since they first joined it, or since its former lead, who had led it
    // since they joined, handed over.
    const joinedOn = (personId: string | null) =>
      memberships
        .filter((one) => one.member && one.personId === personId)
        .map(({ fromDate }) => fromDate)
        .sort()[0];
    const leads = [
      ...(formerLead === undefined
        ? []
        : [
            {
              leadId: formerLead.personId,
              fromDate: joinedOn(formerLead.personId),
            },
          ]),
      { leadId, fromDate: formerLead?.until ?? joinedOn(leadId) },
    ].filter(
      (lead): lead is { leadId: string | null; fromDate: string } =>
        lead.fromDate !== undefined,
    );
    for (const lead of leads) {
      await transaction
        .insert(featureTeamLeads)
        .values({ teamId: team.id, ...lead });
    }
    const latest = new Map(
      [...memberships]
        .filter(({ fromDate }) => fromDate <= organization.referenceDate)
        .sort((a, b) => a.fromDate.localeCompare(b.fromDate))
        .map(({ personId, member }) => [personId, member]),
    );
    made.push(
      ...recorded("feature-team", team.id, "created", {
        name: team.name,
        leadId: team.leadId,
        members: [...latest]
          .filter(([, member]) => member)
          .map(([personId]) => personId)
          .sort(),
      }),
    );
  }
  return made;
}

// Removes the seeded feature teams, with every record of their members, and returns the changes
// that record them going. Every draft of a feature team goes first, published or not, since drafts
// made by hand may name seeded people.
export async function removeFeatureTeams(
  transaction: Pick<Database, "delete">,
  organization: FictionalOrganization,
): Promise<SeededChange[]> {
  const ids = organization.featureTeams.map(({ id }) => id);
  for (const table of [drafts, privateChanges]) {
    await transaction.delete(table).where(eq(table.recordType, "feature-team"));
  }
  const removed = await transaction
    .delete(featureTeams)
    .where(inArray(featureTeams.id, ids))
    .returning();
  return removed.flatMap((team) =>
    recorded("feature-team", team.id, "deleted", {
      name: team.name,
      leadId:
        organization.featureTeams.find(({ id }) => id === team.id)?.leadId ??
        null,
    }),
  );
}
