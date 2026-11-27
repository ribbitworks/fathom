// SPDX-License-Identifier: Apache-2.0

// Removes the fictional organization's people, lists, columns, positions, and feature teams from a
// development database, keeping what something added by hand still uses.

import {
  type Database,
  drafts,
  featureTeamLeads,
  fields,
  fieldValues,
  listItems,
  lists,
  people,
  plannedHires,
  privateChanges,
  projects,
  proposals,
  recordChanges,
  reportingLines,
  teams,
  valueField,
} from "@fathom/db";
import type { FictionalOrganization } from "@fathom/fixtures";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { removeFeatureTeams } from "./feature-teams.ts";
import { removeSeededHires } from "./hires.ts";
import { type SeededChange, valueTiers } from "./recorded.ts";
import {
  personalDetailFields,
  personFields,
  recorded,
  reportingOf,
} from "./seed-records.ts";

async function total(query: Promise<{ total: number }[]>): Promise<number> {
  return (await query).reduce((sum, row) => sum + row.total, 0);
}

// Removes what seeding added, and returns what it kept because something added by hand uses it.
export async function unseed(
  database: Database,
  organization: FictionalOrganization,
): Promise<string[]> {
  return database.transaction(async (transaction) => {
    const kept: string[] = [];
    const made: SeededChange[] = [];
    // The seeded people still there, and all their values, read at once, but for those whom people
    // added by hand report to, or have, and the managers above them. Whoever filled a seeded hire
    // goes with it, since no hire is left to say why they were added.
    const fillers = await transaction
      .select({ filledBy: plannedHires.filledBy })
      .from(plannedHires)
      .where(
        inArray(
          plannedHires.id,
          organization.hires.map(({ id }) => id),
        ),
      );
    const seededIds = [
      ...new Set([
        ...organization.people.map(({ id }) => id),
        ...fillers.flatMap(({ filledBy }) => filledBy ?? []),
      ]),
    ];
    const lines = await transaction
      .select()
      .from(reportingLines)
      .orderBy(reportingLines.fromDate);
    // The seeded hires go first, since they name people. People whom planned hires added by hand
    // name are kept like managers, with those above them.
    made.push(...(await removeSeededHires(transaction, organization)));
    made.push(...(await removeFeatureTeams(transaction, organization)));
    const managing = new Set<string>(
      (await transaction.select().from(plannedHires))
        .flatMap(({ managerId, filledBy }) => [managerId, filledBy])
        .filter((id): id is string => id !== null && seededIds.includes(id)),
    );
    // People who own a project or proposal left behind are kept too, with those above them.
    const owners = new Set(
      [
        ...(await transaction
          .select({ ownerId: projects.ownerId })
          .from(projects)),
        ...(await transaction
          .select({ ownerId: proposals.ownerId })
          .from(proposals)),
      ]
        .map(({ ownerId }) => ownerId)
        .filter((id): id is string => id !== null && seededIds.includes(id)),
    );
    for (const id of owners) managing.add(id);
    // People who lead a feature team left behind are kept too, with those above them.
    const leads = new Set(
      (
        await transaction
          .select({ leadId: featureTeamLeads.leadId })
          .from(featureTeamLeads)
      )
        .map(({ leadId }) => leadId)
        .filter((id): id is string => id !== null && seededIds.includes(id)),
    );
    for (const id of leads) managing.add(id);
    for (let grew = true; grew;) {
      grew = false;
      for (const line of lines) {
        const handled =
          !seededIds.includes(line.personId) || managing.has(line.personId);
        if (
          handled &&
          line.managerId !== null &&
          seededIds.includes(line.managerId) &&
          !managing.has(line.managerId)
        ) {
          managing.add(line.managerId);
          grew = true;
        }
      }
    }
    const present = (
      await transaction
        .select()
        .from(people)
        .where(inArray(people.id, seededIds))
    ).filter(({ id }) => !managing.has(id));
    const presentIds = present.map(({ id }) => id);
    if (managing.size > 0) {
      for (const row of await transaction
        .select({ id: people.id, preferredName: people.preferredName })
        .from(people)
        .where(inArray(people.id, [...managing]))) {
        let reason =
          "whom people or planned hires added by hand report to, or have";
        if (owners.has(row.id)) reason = "who owns a project or proposal kept";
        else if (leads.has(row.id)) reason = "who leads a feature team kept";
        kept.push(`${row.preferredName}, ${reason}`);
      }
    }
    const currentLine = new Map(lines.map((line) => [line.personId, line]));
    const tiers = valueTiers(organization);
    const teamNames = new Map(
      (await transaction.select().from(teams)).map(({ managerId, name }) => [
        managerId,
        name,
      ]),
    );
    const held = await transaction
      .select({
        personId: fieldValues.personId,
        fieldId: fieldValues.fieldId,
        choiceId: fieldValues.choiceId,
        linkAddress: fieldValues.linkAddress,
        linkText: fieldValues.linkText,
        note: fieldValues.note,
      })
      .from(fieldValues)
      .where(inArray(fieldValues.personId, presentIds));
    for (const row of present) {
      const byColumn = new Map<string, string[]>();
      const single: Record<string, { address: string; text: string } | string> =
        {};
      for (const { personId, fieldId, choiceId, note, ...link } of held) {
        if (personId !== row.id) continue;
        if (choiceId !== null) {
          byColumn.set(fieldId, [...(byColumn.get(fieldId) ?? []), choiceId]);
        } else if (note !== null) {
          single[valueField(fieldId)] = note;
        } else {
          single[valueField(fieldId)] = {
            address: String(link.linkAddress),
            text: String(link.linkText),
          };
        }
      }
      made.push(
        ...recorded(
          "person",
          row.id,
          "deleted",
          {
            ...personFields(
              { ...row, values: Object.fromEntries(byColumn), notes: {} },
              reportingOf(currentLine.get(row.id), teamNames.get(row.id)),
            ),
            ...single,
          },
          personalDetailFields,
          tiers,
        ),
      );
    }
    // Drafts made by hand that name a person removed as an owner go with them.
    for (const table of [drafts, privateChanges]) {
      await transaction
        .delete(table)
        .where(
          and(
            inArray(table.recordType, ["project", "proposal"]),
            inArray(sql`${table.fields}->>'ownerId'`, presentIds),
          ),
        );
    }
    await transaction
      .delete(reportingLines)
      .where(inArray(reportingLines.personId, presentIds));
    await transaction.delete(people).where(inArray(people.id, presentIds));
    for (const column of organization.columns) {
      const [row] = await transaction
        .select()
        .from(fields)
        .where(eq(fields.id, column.id));
      if (row === undefined) continue;
      const used = await total(
        transaction
          .select({ total: count() })
          .from(fieldValues)
          .where(eq(fieldValues.fieldId, column.id)),
      );
      const drafted = await total(
        transaction
          .select({ total: count() })
          .from(drafts)
          .where(
            and(
              eq(drafts.recordType, "person"),
              sql`${drafts.fields} ? ${`value:${column.id}`}::text`,
            ),
          ),
      );
      if (used + drafted > 0) {
        kept.push(
          `The ${row.name} column, which people added by hand have values in, live or in drafts`,
        );
        continue;
      }
      await transaction.delete(fields).where(eq(fields.id, column.id));
      const { id, ...settings } = row;
      made.push(...recorded("field", id, "deleted", settings));
    }
    for (const list of organization.lists) {
      const [row] = await transaction
        .select()
        .from(lists)
        .where(eq(lists.id, list.id));
      if (row === undefined) continue;
      const drawing = await total(
        transaction
          .select({ total: count() })
          .from(fields)
          .where(eq(fields.listId, list.id)),
      );
      const choices = await transaction
        .select()
        .from(listItems)
        .where(eq(listItems.listId, list.id));
      const seeded = list.choices.map(({ id }) => id);
      if (drawing > 0) {
        kept.push(`The ${row.name} list, which a column uses`);
        continue;
      }
      if (choices.some(({ id }) => !seeded.includes(id))) {
        kept.push(`The ${row.name} list, which has choices added by hand`);
        continue;
      }
      await transaction.delete(lists).where(eq(lists.id, list.id));
      made.push(
        ...recorded("list", row.id, "deleted", {
          name: row.name,
          description: row.description,
          visibility: row.visibility,
          retired: row.retired,
        }),
        ...choices.flatMap((choice) =>
          recorded("list-item", choice.id, "deleted", {
            listId: choice.listId,
            label: choice.label,
            description: choice.description,
            retired: choice.retired,
          }),
        ),
      );
    }
    // The seeded positions, unless people or planned hires added by hand have them, live or in
    // drafts.
    for (const choice of organization.positions) {
      const [row] = await transaction
        .select()
        .from(listItems)
        .where(eq(listItems.id, choice.id));
      if (row === undefined) continue;
      const used = await total(
        transaction
          .select({ total: count() })
          .from(people)
          .where(eq(people.positionId, choice.id)),
      );
      const hired = await total(
        transaction
          .select({ total: count() })
          .from(plannedHires)
          .where(eq(plannedHires.positionId, choice.id)),
      );
      const drafted = await total(
        transaction
          .select({ total: count() })
          .from(drafts)
          .where(sql`${drafts.fields}->>'positionId' = ${choice.id}`),
      );
      const unpublished = await total(
        transaction
          .select({ total: count() })
          .from(privateChanges)
          .where(sql`${privateChanges.fields}->>'positionId' = ${choice.id}`),
      );
      if (used + hired + drafted + unpublished > 0) {
        kept.push(
          `The ${row.label} position, which people or planned hires added by hand have, live or in drafts`,
        );
        continue;
      }
      await transaction.delete(listItems).where(eq(listItems.id, choice.id));
      made.push(
        ...recorded("list-item", row.id, "deleted", {
          listId: row.listId,
          label: row.label,
          description: row.description,
          retired: row.retired,
        }),
      );
    }
    // Made by Fathom itself.
    await recordChanges(transaction, null, made);
    return kept;
  });
}
