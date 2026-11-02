// SPDX-License-Identifier: Apache-2.0

// Drafts of the fictional organization's lists, made through the server's data access layer as the
// personas who make and judge them would: the Engineering Operations Manager drafts adding a Skills
// list with two choices, renaming a site, adding Harbourside to Sites, removing a choice no one
// has, retiring a role on the team, removing the Certifications list and retiring Languages, which
// no column draws on, moving the Co-op level and the Manager position, and a new description for
// Positions; the Engineering Director rejects Harbourside, the Positions order, and its
// description; a second Engineering Operations Manager gives the renamed site a description, so one
// draft holds two people's changes, and drafts renaming Roles on the team. Each case a draft of a
// list, a choice, or an order can be in is there to try. Removing the seed data discards the drafts
// of its lists first. A development-only package, never included in the runtime image.

import { changes, type Database, drafts } from "@fathom/db";
import type { FictionalList, FictionalOrganization } from "@fathom/fixtures";
import { createDataAccess } from "@fathom/server/data";
import { and, eq, gt, inArray, max, sql } from "drizzle-orm";
import { accountDomain } from "./accounts.ts";
import { actorOf } from "./drafts.ts";

const editorEmail = `engineering.operations.manager@${accountDomain}`;
const secondEditorEmail = `engineering.operations.manager.2@${accountDomain}`;
const approverEmail = `engineering.director@${accountDomain}`;

// The list the seed drafts adding, which no fictional list is called.
export const draftedListName = "Skills";

export const listRejection =
  "Fictional reason: keep the description until the positions are reviewed.";

function listCalled(
  organization: FictionalOrganization,
  name: string,
): FictionalList {
  // The fictional organization always has the lists the seed drafts.
  return organization.lists.find((one) => one.name === name) as FictionalList;
}

const choiceCalled = (list: FictionalList, label: string) =>
  String(list.choices.find((choice) => choice.label === label)?.id);

// Whether the seed has drafted its lists since they were last added, as the change history says,
// so drafts approved, rejected, or discarded since are not made again, while removing and adding the
// seed data again makes them anew.
async function draftedBefore(
  database: Database,
  organization: FictionalOrganization,
): Promise<boolean> {
  const [first] = organization.lists as [FictionalList];
  const [seeded] = await database
    .select({ id: max(changes.id) })
    .from(changes)
    .where(
      and(
        eq(changes.recordId, first.id),
        eq(changes.action, "created"),
        eq(changes.draft, false),
      ),
    );
  const found = await database
    .select({ one: sql`1` })
    .from(changes)
    .where(
      and(
        eq(changes.recordType, "list"),
        eq(changes.field, "name"),
        eq(changes.draft, true),
        sql`${changes.newValue} #>> '{}' = ${draftedListName}`,
        // The lists are always added before their drafts.
        gt(changes.id, (seeded as { id: number }).id),
      ),
    )
    .limit(1);
  return found.length > 0;
}

// Makes the seed's drafts of lists, unless it has made them before, and returns whether it did.
export async function seedListDrafts(
  database: Database,
  organization: FictionalOrganization,
): Promise<boolean> {
  if (await draftedBefore(database, organization)) return false;
  const data = createDataAccess(database);
  const editor = await actorOf(database, editorEmail);
  const approver = await actorOf(database, approverEmail);
  const sites = listCalled(organization, "Sites");
  const levels = listCalled(organization, "Levels");
  const positions = listCalled(organization, "Positions");
  const teamRoles = listCalled(organization, "Roles on the team");

  const { result: skills } = await data.lists.create(editor, {
    name: draftedListName,
    description: "What people are skilled in.",
    visibility: "general",
  });
  await data.lists.addChoices(editor, skills.id, [
    { label: "Rust", description: "" },
    { label: "TypeScript", description: "" },
  ]);
  await data.lists.updateChoice(
    editor,
    sites.id,
    choiceCalled(sites, "Northmere"),
    { label: "Northmere Labs", description: "" },
  );
  // No one is given Architect, so its removal can be drafted.
  await data.lists.deleteChoice(
    editor,
    positions.id,
    choiceCalled(positions, "Architect"),
  );
  await data.lists.moveChoice(
    editor,
    levels.id,
    choiceCalled(levels, "Co-op"),
    choiceCalled(levels, "M2"),
  );
  await data.lists.setChoiceRetired(
    editor,
    teamRoles.id,
    choiceCalled(teamRoles, "Design Authority"),
    { retired: true },
  );
  const second = await actorOf(database, secondEditorEmail);
  await data.lists.updateChoice(
    second,
    sites.id,
    choiceCalled(sites, "Northmere"),
    { label: "Northmere Labs", description: "The research site." },
  );
  await data.lists.update(second, teamRoles.id, {
    name: "Roles on teams",
    description: "",
    visibility: "general",
  });
  const certifications = listCalled(organization, "Certifications");
  const languages = listCalled(organization, "Languages");
  await data.lists.delete(editor, certifications.id);
  await data.lists.setRetired(editor, languages.id, { retired: true });
  const [harbourside] = (
    await data.lists.addChoices(editor, sites.id, [
      { label: "Harbourside", description: "" },
    ])
  ).result;
  await data.lists.moveChoice(
    editor,
    positions.id,
    choiceCalled(positions, "Manager"),
    null,
  );
  await data.lists.update(editor, positions.id, {
    name: positions.name,
    description: "The jobs people hold.",
    visibility: "general",
  });
  await data.drafts.reject(
    approver,
    {
      people: [],
      lists: [positions.id],
      choices: [String(harbourside?.id)],
      orders: [positions.id],
    },
    listRejection,
  );
  return true;
}

// Discards the drafts of the seed data's lists, and of the list it drafted adding, those made by
// hand included, since removing the seed data removes the lists they change, and returns how many.
export async function unseedListDrafts(
  database: Database,
  organization: FictionalOrganization,
): Promise<number> {
  const data = createDataAccess(database);
  const editor = await actorOf(database, editorEmail);
  const listIds = new Set(organization.lists.map(({ id }) => id));
  const choiceIds = new Set(
    organization.lists.flatMap(({ choices }) => choices.map(({ id }) => id)),
  );
  const found = await database
    .select({
      recordType: drafts.recordType,
      recordId: drafts.recordId,
      action: drafts.action,
      fields: drafts.fields,
    })
    .from(drafts)
    .where(inArray(drafts.recordType, ["list", "list-item", "choice-order"]));
  let discarded = 0;
  for (const draft of found) {
    if (draft.recordType === "choice-order" && listIds.has(draft.recordId)) {
      await data.lists.discardDraft(editor, {
        kind: "order",
        listId: draft.recordId,
      });
      discarded += 1;
    }
  }
  const listOf = new Map(
    organization.lists.flatMap((list) =>
      list.choices.map((choice) => [choice.id, list.id]),
    ),
  );
  for (const draft of found) {
    const drafted = draft.fields.listId;
    const listId =
      listOf.get(draft.recordId) ??
      (typeof drafted === "string" ? drafted : "");
    if (
      draft.recordType === "list-item" &&
      (choiceIds.has(draft.recordId) || listIds.has(listId))
    ) {
      await data.lists.discardDraft(editor, {
        kind: "choice",
        listId,
        choiceId: draft.recordId,
      });
      discarded += 1;
    }
  }
  for (const draft of found) {
    const seededAdding =
      draft.action === "created" && draft.fields.name === draftedListName;
    if (
      draft.recordType === "list" &&
      (listIds.has(draft.recordId) || seededAdding)
    ) {
      await data.lists.discardDraft(editor, {
        kind: "list",
        listId: draft.recordId,
      });
      discarded += 1;
    }
  }
  return discarded;
}
