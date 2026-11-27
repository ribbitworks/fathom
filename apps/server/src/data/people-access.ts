// SPDX-License-Identifier: Apache-2.0

// The data access layer's interface to people, planned hires and feature teams, each bound to a
// database.

import type { Database } from "@fathom/db";
import type {
  Field,
  FieldRequest,
  FeatureTeamChange,
  MemberTeamsChange,
  FeatureTeamRequest,
  FeatureTeams,
  HireChange,
  HireFill,
  HireRequest,
  Hires,
  MonthRange,
  OrgChart,
  PaletteColour,
  Person,
  PersonChange,
  PersonRequest,
  TeamMonths,
} from "@fathom/shared";
import { seesEmployment, seesField, type Timeline } from "@fathom/shared";
import { type Actor, requirePermission } from "../access.ts";
import { ForbiddenError } from "../errors.ts";
import { readPersonTimeline } from "./person-timeline.ts";
import * as columnDrafts from "./column-drafts.ts";
import * as peopleData from "./people.ts";
import { readOrgChart, readOrgChartOn, setTeamColour } from "./org-chart.ts";
import * as hireData from "./hires.ts";
import * as hireReads from "./hire-reads.ts";
import * as fills from "./fills.ts";
import * as featureTeamData from "./feature-teams.ts";
import { readFeatureTeams } from "./feature-team-reads.ts";
import { changeMemberTeams } from "./feature-team-month-cells.ts";
import { readTeamMonths } from "./team-months.ts";
import { recordPersonalView } from "./history.ts";
import type { Saved, ChangeSetId } from "./changes.ts";
import { readTimeZone } from "./settings.ts";
import {
  readPeopleColumns,
  seenPeople,
  seenPeopleColumns,
} from "./page-reads.ts";
import { columnEditor } from "./column-state.ts";

export interface PeopleAccess {
  // Everyone the actor may see, with the columns whose values they may see, today or on another
  // day. Reading anyone's Personal details, or another day, is recorded in the access history.
  read(
    actor: Actor,
    on?: string,
  ): Promise<{
    people: Person[];
    fields: Field[];
    order: string[];
    positionHidden?: true;
  }>;
  // Today's reporting lines as approved, with General details only, each person's draft of their
  // manager and team name beside, and the chart as drafts make it, as the reader may see them.
  // Telling anyone that a manager has left, or showing them a draft's Personal details, such as
  // its manager, its dates, or someone it adds, is recorded in the access history.
  readOrgChart(actor: Actor, on?: string): Promise<OrgChart>;
  // A person's timeline, for a role that sees start and end dates; reading it is recorded in the
  // access history, as it holds Personal details.
  readTimeline(actor: Actor, personId: string): Promise<Timeline>;
  // The added columns as their drafts make them, and their order, as the actor may see them, with
  // none of anyone's values.
  readColumns(actor: Actor): Promise<{ fields: Field[]; order: string[] }>;
  // Sets the colour of a manager's named team, or removes it, at once rather than as a draft.
  setTeamColour(
    actor: Actor,
    managerId: string,
    colour: PaletteColour | null,
  ): Promise<void>;
  // Changes to people are drafts, which reach the live people once approved.
  create(
    actor: Actor,
    requests: readonly PersonRequest[],
  ): Promise<Saved<string[]>>;
  update(actor: Actor, id: string, change: PersonChange): Promise<ChangeSetId>;
  delete(actor: Actor, id: string): Promise<ChangeSetId>;
  discardDraft(actor: Actor, id: string): Promise<ChangeSetId>;
  // Sends a rejected draft for approval again, unchanged.
  resubmitDraft(actor: Actor, id: string): Promise<ChangeSetId>;
  createField(actor: Actor, request: FieldRequest): Promise<Saved<Field>>;
  updateField(
    actor: Actor,
    id: string,
    request: FieldRequest,
  ): Promise<Saved<Field>>;
  deleteField(actor: Actor, id: string): Promise<ChangeSetId>;
  // Discards a draft of a column, or sends a rejected one for approval again.
  discardColumnDraft(actor: Actor, id: string): Promise<ChangeSetId>;
  resubmitColumnDraft(actor: Actor, id: string): Promise<ChangeSetId>;
}

// Every change to planned hires is a draft, which reaches the live hires once approved. Reading the
// whole hiring plan is recorded in the access history, as is reading placeholders whose position or
// state is more sensitive than General.
export interface HireAccess {
  read(actor: Actor): Promise<Hires>;
  create(
    actor: Actor,
    requests: readonly HireRequest[],
  ): Promise<Saved<string[]>>;
  update(actor: Actor, id: string, change: HireChange): Promise<ChangeSetId>;
  delete(actor: Actor, id: string): Promise<ChangeSetId>;
  discardDraft(actor: Actor, id: string): Promise<ChangeSetId>;
  resubmitDraft(actor: Actor, id: string): Promise<ChangeSetId>;
  fill(actor: Actor, id: string, fill: HireFill): Promise<ChangeSetId>;
}

export interface FeatureTeamAccess {
  read(actor: Actor, on?: string): Promise<FeatureTeams>;
  readMonths(actor: Actor, range: MonthRange): Promise<TeamMonths>;
  create(actor: Actor, request: FeatureTeamRequest): Promise<Saved<string>>;
  update(
    actor: Actor,
    id: string,
    change: FeatureTeamChange,
  ): Promise<ChangeSetId>;
  // Changes the teams someone is on from a day, drafted on each team.
  changeMemberTeams(
    actor: Actor,
    personId: string,
    change: MemberTeamsChange,
  ): Promise<ChangeSetId>;
  delete(actor: Actor, id: string): Promise<ChangeSetId>;
  discardDraft(actor: Actor, id: string): Promise<ChangeSetId>;
  resubmitDraft(actor: Actor, id: string): Promise<ChangeSetId>;
  setColour(
    actor: Actor,
    id: string,
    colour: PaletteColour | null,
  ): Promise<void>;
}

export function createFeatureTeamAccess(database: Database): FeatureTeamAccess {
  return {
    read: async (actor, on) => {
      const read = await readFeatureTeams(database, actor, on);
      // Seeing the days members join or leave is recorded while their class is above General: those
      // a draft gives, and those a reader who sees them can tell from teams on a chosen day, or from
      // the month a team disbands.
      const sawDays =
        actor.dataClasses.featureTeamDates !== "general" &&
        (on === undefined
          ? read.teams.some(
              ({ draft, disbandedFrom }) =>
                draft?.days !== undefined ||
                draft?.leadDay !== undefined ||
                disbandedFrom !== undefined,
            )
          : seesField(actor, "featureTeamDates"));
      // So is naming who fills a planned hire, someone not yet started, while start dates are above
      // General.
      const sawFiller =
        actor.dataClasses.startDate !== "general" &&
        read.teams.some(({ hires }) =>
          Object.values(hires ?? {}).some(
            ({ filledBy }) => filledBy !== undefined,
          ),
        );
      if (sawDays || sawFiller) {
        await recordPersonalView(
          database,
          actor.user.id,
          await readTimeZone(database),
        );
      }
      return read;
    },
    readMonths: async (actor, range) => {
      const read = await readTeamMonths(database, actor, range);
      // Rows and shaded months follow employment dates, in their classes.
      await recordPersonalView(
        database,
        actor.user.id,
        await readTimeZone(database),
      );
      return read;
    },
    create: async (actor, request) => {
      const { id, changeSetId } = await featureTeamData.createFeatureTeam(
        database,
        actor,
        request,
      );
      return { result: id, changeSetId };
    },
    update: async (actor, id, change) =>
      featureTeamData.updateFeatureTeam(database, actor, id, change),
    changeMemberTeams: async (actor, personId, change) =>
      changeMemberTeams(database, actor, personId, change),
    delete: async (actor, id) =>
      featureTeamData.deleteFeatureTeam(database, actor, id),
    discardDraft: async (actor, id) =>
      featureTeamData.discardFeatureTeamDraft(database, actor, id),
    resubmitDraft: async (actor, id) =>
      featureTeamData.resubmitFeatureTeamDraft(database, actor, id),
    setColour: async (actor, id, colour) => {
      featureTeamData.requireChanging(actor);
      await featureTeamData.setFeatureTeamColour(database, id, colour);
    },
  };
}

export function createHireAccess(database: Database): HireAccess {
  return {
    read: async (actor) => {
      const { includedPersonal, ...read } = await hireReads.readHires(
        database,
        actor,
      );
      if (read.wholePlan && read.hires.length > 0) {
        await recordPersonalView(
          database,
          actor.user.id,
          await readTimeZone(database),
          "hiring-plan-viewed",
        );
      } else if (includedPersonal) {
        await recordPersonalView(
          database,
          actor.user.id,
          await readTimeZone(database),
        );
      }
      return read;
    },
    create: async (actor, requests) => {
      const { ids, changeSetId } = await hireData.createHires(
        database,
        actor,
        requests,
      );
      return { result: ids, changeSetId };
    },
    update: async (actor, id, change) =>
      hireData.updateHire(database, actor, id, change),
    delete: async (actor, id) => hireData.deleteHire(database, actor, id),
    discardDraft: async (actor, id) =>
      fills.discardDraft(database, actor, { kind: "planned-hire", id }),
    resubmitDraft: async (actor, id) =>
      fills.resubmitDraft(database, actor, { kind: "planned-hire", id }),
    fill: async (actor, id, fill) => fills.fillHire(database, actor, id, fill),
  };
}

export function createPeopleAccess(database: Database): PeopleAccess {
  return {
    readColumns: async (actor) => seenPeopleColumns(database, actor),
    read: async (actor, on) => {
      const read = await seenPeople(database, actor, on);
      if (read.includedPersonal) {
        await recordPersonalView(
          database,
          actor.user.id,
          await readTimeZone(database),
        );
      }
      if (read.hiringPlanViewed) {
        await recordPersonalView(
          database,
          actor.user.id,
          await readTimeZone(database),
          "hiring-plan-viewed",
        );
      }
      const columns = await readPeopleColumns(database, actor);
      return {
        people: read.people,
        ...columns,
        ...(read.positionHidden ? { positionHidden: true as const } : {}),
      };
    },
    readTimeline: async (actor, personId) => {
      requirePermission(actor, "people:view");
      if (!seesEmployment(actor)) throw new ForbiddenError();
      const { timeline, includedHiringPlan, timeZone } =
        await readPersonTimeline(database, actor, personId);
      await recordPersonalView(database, actor.user.id, timeZone);
      if (includedHiringPlan) {
        await recordPersonalView(
          database,
          actor.user.id,
          timeZone,
          "hiring-plan-viewed",
        );
      }
      return timeline;
    },
    readOrgChart: async (actor, on) => {
      requirePermission(actor, "people:view");
      const { includedPersonal, includedHiringPlan, ...chart } = await (on ===
      undefined
        ? readOrgChart(database, actor)
        : readOrgChartOn(database, actor, on));
      if (includedPersonal) {
        await recordPersonalView(
          database,
          actor.user.id,
          await readTimeZone(database),
        );
      }
      if (includedHiringPlan) {
        await recordPersonalView(
          database,
          actor.user.id,
          await readTimeZone(database),
          "hiring-plan-viewed",
        );
      }
      return chart;
    },
    setTeamColour: async (actor, managerId, colour) => {
      requirePermission(actor, "people:edit");
      await setTeamColour(database, managerId, colour);
    },
    create: async (actor, requests) => {
      const { ids, changeSetId } = await peopleData.createPeople(
        database,
        actor,
        requests,
      );
      return { result: ids, changeSetId };
    },
    update: async (actor, id, change) =>
      peopleData.updatePerson(database, actor, id, change),
    delete: async (actor, id) => peopleData.deletePerson(database, actor, id),
    discardDraft: async (actor, id) =>
      fills.discardDraft(database, actor, { kind: "person", id }),
    resubmitDraft: async (actor, id) =>
      fills.resubmitDraft(database, actor, { kind: "person", id }),
    createField: async (actor, request) => {
      columnEditor(actor, "people");
      return columnDrafts.createField(database, actor, request);
    },
    updateField: async (actor, id, request) => {
      columnEditor(actor, "people");
      return columnDrafts.updateField(database, actor, id, request);
    },
    deleteField: async (actor, id) => {
      columnEditor(actor, "people");
      return columnDrafts.deleteField(database, actor, id);
    },
    discardColumnDraft: async (actor, id) =>
      columnDrafts.discardColumnDraft(database, columnEditor(actor, "people"), {
        id,
      }),
    resubmitColumnDraft: async (actor, id) =>
      columnDrafts.resubmitColumnDraft(
        database,
        columnEditor(actor, "people"),
        { id },
      ),
  };
}
