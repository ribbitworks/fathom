// SPDX-License-Identifier: Apache-2.0

// Drafts of the fictional organization's lists, made through the server's data access layer as the
// personas who make and judge them would: the Engineering Operations Manager drafts adding a Skills
// list with two choices, renaming a site, adding Harbourside to Sites, removing a choice no one
// has, retiring a role on the team, removing the Certifications list and retiring Languages, which
// no column draws on, moving Harbourside to the top of Sites, the Co-op level, and the Manager
// position, and a new description for Positions; the Engineering Director rejects Harbourside, the
// Sites and Positions orders, and the Positions description; a second Engineering Operations
// Manager gives the renamed site a description, so one draft holds two people's changes, drafts
// renaming Roles on the team, and sends the Sites order for approval again, which then waits on
// Harbourside, still rejected. Drafts of People's columns follow, as seedColumnDrafts sets out,
// then a Skills column drawing on the Skills list and a person given Rust in it, as seedSkills sets
// out. Each persona publishes their changes before the next persona changes the same drafts and
// before the Engineering Director decides them. Each case a draft of a list, a choice, a column, or
// an order can be in is there to try. After them, the Engineering Operations Manager drafts adding
// an Equipment list with one choice and leaves it unpublished, so only they see it. Removing the
// seed data discards these drafts first. A development-only package, never included in the runtime
// image.

import { changes, type Database, drafts } from "@fathom/db";
import type { FictionalList, FictionalOrganization } from "@fathom/fixtures";
import { createDataAccess } from "@fathom/server/data";
import { and, eq, gt, inArray, max, sql } from "drizzle-orm";
import type { Actor } from "@fathom/server/access";
import { accountDomain } from "./accounts.ts";
import { actorOf, skilledFor } from "./drafts.ts";

const editorEmail = `engineering.operations.manager@${accountDomain}`;
const secondEditorEmail = `engineering.operations.manager.2@${accountDomain}`;
const approverEmail = `engineering.director@${accountDomain}`;

// The lists the seed drafts adding, published and not, which no fictional list is called.
export const draftedListName = "Skills";
export const unpublishedListName = "Equipment";
export const skillsColumnName = "Skills";

export const columnRejection =
  "Fictional reason: a previous site is not needed yet.";

export const listRejection =
  "Fictional reason: leave Positions and Sites as they are until both are reviewed.";

function listCalled(
  organization: FictionalOrganization,
  name: string,
): FictionalList {
  // The fictional organization always has the lists the seed drafts.
  return organization.lists.find((one) => one.name === name) as FictionalList;
}

const choiceCalled = (list: FictionalList, label: string) =>
  String(list.choices.find((choice) => choice.label === label)?.id);

// Whether the seed has drafted adding a list of the name since its lists were last added, as the
// change history says, so drafts approved, rejected, or discarded since are not made again, while
// removing and adding the seed data again makes them anew.
async function draftedBefore(
  database: Database,
  organization: FictionalOrganization,
  name = draftedListName,
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
        sql`${changes.newValue} #>> '{}' = ${name}`,
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
  const [rust] = (
    await data.lists.addChoices(editor, skills.id, [
      { label: "Rust", description: "" },
      { label: "TypeScript", description: "" },
    ])
  ).result;
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
  await data.unpublished.publish(editor);
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
  await data.unpublished.publish(second);
  const certifications = listCalled(organization, "Certifications");
  const languages = listCalled(organization, "Languages");
  await data.lists.delete(editor, certifications.id);
  await data.lists.setRetired(editor, languages.id, { retired: true });
  const [harbourside] = (
    await data.lists.addChoices(editor, sites.id, [
      { label: "Harbourside", description: "" },
    ])
  ).result;
  // At the top of Sites, so the order drafted uses Harbourside's draft.
  await data.lists.moveChoice(editor, sites.id, String(harbourside?.id), null);
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
  await data.unpublished.publish(editor);
  await data.drafts.reject(
    approver,
    {
      people: [],
      lists: [positions.id],
      choices: [String(harbourside?.id)],
      orders: [positions.id, sites.id],
    },
    listRejection,
  );
  // Sent again on its own, so it waits on Harbourside, which stays rejected.
  await data.lists.resubmitDraft(second, { kind: "order", listId: sites.id });
  await seedColumnDrafts(database, organization, editor, approver);
  await seedSkills(database, organization, editor, skills.id, String(rust?.id));
  return true;
}

const columnCalled = (organization: FictionalOrganization, name: string) =>
  String(organization.columns.find((column) => column.name === name)?.id);

// Drafts of the People table's columns: the first Engineering Operations Manager drafts adding a
// Previous site column, which the Engineering Director rejects, renaming Level to Grade, which the
// second makes required, so one draft holds two people's changes, removing Role on team, and moving
// Level before Site.
async function seedColumnDrafts(
  database: Database,
  organization: FictionalOrganization,
  editor: Actor,
  approver: Actor,
): Promise<void> {
  const data = createDataAccess(database);
  const sites = listCalled(organization, "Sites");
  const levels = listCalled(organization, "Levels");
  const level = columnCalled(organization, "Level");
  const { result: previousSite } = await data.people.createField(editor, {
    type: "choice",
    name: "Previous site",
    listId: sites.id,
    multiple: false,
    required: false,
  });
  await data.people.updateField(editor, level, {
    type: "choice",
    name: "Grade",
    listId: levels.id,
    multiple: false,
    required: false,
  });
  await data.unpublished.publish(editor);
  const second = await actorOf(database, secondEditorEmail);
  await data.people.updateField(second, level, {
    type: "choice",
    name: "Grade",
    listId: levels.id,
    multiple: false,
    required: true,
  });
  await data.unpublished.publish(second);
  await data.people.deleteField(
    editor,
    columnCalled(organization, "Role on team"),
  );
  await data.people.moveColumn(editor, level, "employeeId");
  await data.unpublished.publish(editor);
  await data.drafts.reject(
    approver,
    { columns: [previousSite.id] },
    columnRejection,
  );
}

// Drafts that use drafts of another kind: the Engineering Operations Manager drafts adding a Skills
// column drawing on the Skills list, and gives a person Rust in it, so approving the person approves
// the list, the column, and Rust with them.
async function seedSkills(
  database: Database,
  organization: FictionalOrganization,
  editor: Actor,
  listId: string,
  rustId: string,
): Promise<void> {
  const data = createDataAccess(database);
  const { result: column } = await data.people.createField(editor, {
    type: "choice",
    name: skillsColumnName,
    listId,
    multiple: true,
    required: false,
  });
  await data.people.update(editor, skilledFor(organization).id, {
    values: { [column.id]: [rustId] },
  });
  await data.unpublished.publish(editor);
}

// Drafts adding the Equipment list with one choice, as the Engineering Operations Manager, left
// unpublished, unless the seed has drafted it since its lists were last added. Returns whether it
// did.
export async function seedUnpublishedList(
  database: Database,
  organization: FictionalOrganization,
): Promise<boolean> {
  if (await draftedBefore(database, organization, unpublishedListName)) {
    return false;
  }
  const data = createDataAccess(database);
  const editor = await actorOf(database, editorEmail);
  const { result: equipment } = await data.lists.create(editor, {
    name: unpublishedListName,
    description: "What people are given to work with.",
    visibility: "general",
  });
  await data.lists.addChoices(editor, equipment.id, [
    { label: "Laptop", description: "" },
  ]);
  return true;
}

// Discards the drafts of the seed data's lists and columns, the column order's, and those of the list
// and column it drafted adding, those made by hand included, since removing the seed data removes
// the lists and columns they change, and returns how many.
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
  let discarded = await unseedColumnDrafts(database, organization, editor);
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
    // The lists the seed drafts adding, Equipment published or not, since a test can publish it.
    const seededAdding =
      draft.action === "created" &&
      [draftedListName, unpublishedListName].includes(
        String(draft.fields.name),
      );
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
  await data.unpublished.publish(editor);
  return discarded;
}

// Discards the drafts of the seed data's columns, of the column it drafted adding, and of the column
// order, and returns how many.
async function unseedColumnDrafts(
  database: Database,
  organization: FictionalOrganization,
  editor: Actor,
): Promise<number> {
  const data = createDataAccess(database);
  const columnIds = new Set(organization.columns.map(({ id }) => id));
  const found = await database
    .select({
      recordType: drafts.recordType,
      recordId: drafts.recordId,
      action: drafts.action,
      fields: drafts.fields,
    })
    .from(drafts)
    .where(inArray(drafts.recordType, ["field", "column-order"]));
  let discarded = 0;
  // The order first, since discarding a column can leave it changing nothing, which removes it.
  const ordered = [
    ...found.filter(({ recordType }) => recordType === "column-order"),
    ...found.filter(({ recordType }) => recordType === "field"),
  ];
  for (const draft of ordered) {
    const seeded =
      draft.recordType === "column-order" ||
      columnIds.has(draft.recordId) ||
      (draft.action === "created" &&
        ["Previous site", skillsColumnName].includes(
          String(draft.fields.name),
        ));
    if (!seeded) continue;
    await data.people.discardColumnDraft(
      editor,
      draft.recordType === "column-order"
        ? { kind: "order" }
        : { kind: "column", id: draft.recordId },
    );
    discarded += 1;
  }
  return discarded;
}
