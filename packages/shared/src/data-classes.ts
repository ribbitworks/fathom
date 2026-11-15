// SPDX-License-Identifier: Apache-2.0

// The data classes of Fathom's built-in details, which the organization moves with Classify data,
// and what each page or view needs, as the Decisions Log's Data classes set out. A page or view
// shows whole only to a role that sees every class it needs, and otherwise says why in one line; it
// is never cut down.

import { z } from "zod";
import {
  type Permission,
  permissionLabel,
  type Tier,
  tierSchema,
} from "./access.ts";
import { builtInColumnNames } from "./changes.ts";
import { mayDateLineChange } from "./days.ts";
import { allOf } from "./words.ts";

// The built-in details whose class is stored and can be moved. Lists and columns hold their own.
export const classifiedFieldSchema = z.enum([
  "startDate",
  "endDate",
  "managerHistory",
  "featureTeamDates",
  "futureReorganizations",
  "hiringPlan",
]);

export type ClassifiedField = z.infer<typeof classifiedFieldSchema>;

export const dataClassesSchema = z.record(classifiedFieldSchema, tierSchema);

export type DataClasses = z.infer<typeof dataClassesSchema>;

// The class each built-in detail starts in. Every detail must be listed, which the compiler checks.
export const defaultClasses: DataClasses = {
  startDate: "personal",
  endDate: "personal",
  managerHistory: "personal",
  featureTeamDates: "personal",
  futureReorganizations: "confidential",
  hiringPlan: "confidential",
};

// Each detail's name, as people read it. Every detail must be named, which the compiler checks.
export const classifiedFieldNames: Record<ClassifiedField, string> = {
  startDate: "Start date",
  endDate: "End date",
  managerHistory: "Past managers",
  featureTeamDates: "Feature team dates",
  futureReorganizations: "Future reorganizations",
  hiringPlan: "Hiring plan",
};

// Each class's name, as people read it. Every class must be named, which the compiler checks.
export const classNames: Record<Tier, string> = {
  general: "General",
  personal: "Personal",
  confidential: "Confidential",
};

// A column's class: its own, or that of the list it draws on, or nothing while that list isn't
// known.
export const columnClass = (
  column: { readonly visibility: Tier | null },
  list: { readonly visibility: Tier } | undefined,
): Tier | undefined => column.visibility ?? list?.visibility;

// A part of a line Fathom writes: its own words, or a class it names.
export type ClassNamedPart = { words: string } | { dataClass: Tier };

const classOfName = new Map(
  tierSchema.options
    .filter((dataClass) => dataClass !== "general")
    // The class is always one of the fixed classes.
    // eslint-disable-next-line security/detect-object-injection
    .map((dataClass) => [classNames[dataClass], dataClass] as const),
);

// Longest first, so a class whose name holds another's is found whole. Built only from the fixed
// classes' names, which hold no pattern characters.
// eslint-disable-next-line security/detect-non-literal-regexp
const classNamePattern = new RegExp(
  `\\b(${[...classOfName.keys()]
    .sort((first, second) => second.length - first.length)
    .join("|")})\\b`,
  "u",
);

// A line Fathom writes split into its words and the classes beyond
// General it names, so each shows as a class. Words someone typed are never split, since theirs may
// mean something else.
export function classesNamedIn(line: string): ClassNamedPart[] {
  return line
    .split(classNamePattern)
    .filter((part) => part !== "")
    .map((part) => {
      const dataClass = classOfName.get(part);
      return dataClass === undefined ? { words: part } : { dataClass };
    });
}

export const classMoveSchema = z.object({ dataClass: tierSchema });

export type ClassMove = z.infer<typeof classMoveSchema>;

// The classes of the People table's built-in details: the Position and State columns', which move
// with their lists, and the classes of the rest, read together so every class worked out agrees.
export interface BuiltInTiers {
  readonly positionTier: Tier;
  readonly stateTier: Tier;
  readonly dataClasses: DataClasses;
}

// The People table's built-in columns holding a classified detail, by key, with the detail.
const classifiedColumns: ReadonlyMap<string, ClassifiedField> = new Map([
  ["startDate", "startDate"],
  ["endDate", "endDate"],
  ["managerFrom", "managerHistory"],
]);

// The tier of each of the People table's built-in columns, by key, as readers are sent them: the
// manager is General, though a drafted one is as past managers are, since everyone is sent each
// live manager.
export function builtInColumnTiers(tiers: BuiltInTiers): Map<string, Tier> {
  return new Map<string, Tier>([
    ["preferredName", "general"],
    ["employeeId", "general"],
    ["positionId", tiers.positionTier],
    ["stateId", tiers.stateTier],
    ["expected", "general"],
    ["managerId", "general"],
    ["isManager", "general"],
    ["team", "general"],
    ["featureTeams", "general"],
    ["teamName", "general"],
    ...[...classifiedColumns].map(([key, field]): [string, Tier] => [
      key,
      // The field is always one of the fixed fields.
      // eslint-disable-next-line security/detect-object-injection
      tiers.dataClasses[field],
    ]),
  ]);
}

// The People table's built-in columns that need a permission besides People's own, by key: Feature
// teams, sent only to those who see feature teams.
export const builtInColumnNeeds: ReadonlyMap<string, Permission> = new Map([
  ["featureTeams", "feature-teams:view"],
]);

// Whether a role holds the permission a built-in column of People needs, where it needs one.
export function seesBuiltInColumn(
  permissions: readonly Permission[],
  key: string,
): boolean {
  const needs = builtInColumnNeeds.get(key);
  return needs === undefined || permissions.includes(needs);
}

// What decides a role's access to classified data: what its role grants, and the classes the
// organization keeps its details in.
export interface ClassAccess {
  permissions: readonly Permission[];
  dataClasses: DataClasses;
}

// The permissions that let a role see and change each class of people's data beyond General, whose
// data comes with each page's own area.
export const classPermissions: Record<
  Exclude<Tier, "general">,
  { view: Permission; edit: Permission }
> = {
  personal: { view: "personal:view", edit: "personal:edit" },
  confidential: { view: "confidential:view", edit: "confidential:edit" },
};

// Whether permissions let a role see a class, on the pages its areas reach. General data is seen
// with the page that holds it.
export function seesClass(
  permissions: readonly Permission[],
  dataClass: Tier,
): boolean {
  if (dataClass === "general") return true;
  // The class is always one of the fixed classes listed above.
  // eslint-disable-next-line security/detect-object-injection
  return permissions.includes(classPermissions[dataClass].view);
}

// Whether permissions let a role change data of a class, beyond the area holding it, which General
// data needs alone.
export function editsClass(
  permissions: readonly Permission[],
  dataClass: Tier,
): boolean {
  if (dataClass === "general") return true;
  // The class is always one of the fixed classes listed above.
  // eslint-disable-next-line security/detect-object-injection
  return permissions.includes(classPermissions[dataClass].edit);
}

// The class a built-in detail is kept in now. A detail in General is seen and changed with the page
// or area that holds it, so these answer yes for it without any permission of their own.
export const classOf = (access: ClassAccess, field: ClassifiedField): Tier =>
  // The field is always one of the fixed fields listed above.
  // eslint-disable-next-line security/detect-object-injection
  access.dataClasses[field];

export const seesField = (
  access: ClassAccess,
  field: ClassifiedField,
): boolean => seesClass(access.permissions, classOf(access, field));

export const editsField = (
  access: ClassAccess,
  field: ClassifiedField,
): boolean => editsClass(access.permissions, classOf(access, field));

// Whether a role sees and changes a built-in detail, needing both for its class.
export const changesField = (
  access: ClassAccess,
  field: ClassifiedField,
): boolean => seesField(access, field) && editsField(access, field);

// Whether a role changes people's reporting lines from a day other than today, as the Org chart and
// People both let it: it changes people, and may date a change then.
export const changesLinesOn = (
  access: ClassAccess,
  day: string,
  today: string,
): boolean =>
  access.permissions.includes("people:edit") &&
  mayDateLineChange(changesField(access, "managerHistory"), day, today);

// Whether a role sees the hiring plan, and changes it: the hiring plan is an area of its own, and
// still kept in a class, so each needs both.
export const seesHiringPlan = (access: ClassAccess): boolean =>
  access.permissions.includes("hiring-plan:view") &&
  seesField(access, "hiringPlan");

export const changesHiringPlan = (access: ClassAccess): boolean =>
  access.permissions.includes("hiring-plan:edit") &&
  changesField(access, "hiringPlan");

// The hiring plan's permissions, what each is named as on the Roles page, and whether a role's
// class access lets it do what the permission grants.
const hiringPlanActions: readonly {
  permission: Permission;
  name: string;
  done: (access: ClassAccess) => boolean;
  needs: (dataClass: Exclude<Tier, "general">) => string;
}[] = [
  {
    permission: "hiring-plan:view",
    name: "Hiring plan",
    done: seesHiringPlan,
    // The class is always one of the fixed classes listed above.
    // eslint-disable-next-line security/detect-object-injection
    needs: (dataClass) => classNames[dataClass],
  },
  {
    permission: "hiring-plan:edit",
    name: "Changing the hiring plan",
    done: changesHiringPlan,
    needs: (dataClass) =>
      // The class is always one of the fixed classes listed above.
      // eslint-disable-next-line security/detect-object-injection
      permissionLabel(classPermissions[dataClass].edit),
  },
  {
    permission: "hiring-plan:approve",
    name: "Approving drafts of planned hires",
    done: seesHiringPlan,
    // The class is always one of the fixed classes listed above.
    // eslint-disable-next-line security/detect-object-injection
    needs: (dataClass) => classNames[dataClass],
  },
];

// The hiring plan's permissions a role holds that do nothing without the hiring plan's class, each
// as a view of People the role misses, with why, such as "Hiring plan: needs Confidential".
export function hiringPlanWithoutClass(
  access: ClassAccess,
): Map<Permission, RoleView> {
  const dataClass = classOf(access, "hiringPlan");
  if (dataClass === "general") return new Map();
  return new Map(
    hiringPlanActions
      .filter(
        ({ permission, done }) =>
          access.permissions.includes(permission) && !done(access),
      )
      .map(({ permission, name, needs }) => [
        permission,
        { name, page: "People", why: `${name}: needs ${needs(dataClass)}` },
      ]),
  );
}

// Whether a role sees people who have not started yet and those who have left, which their start
// and end dates would reveal. Both are needed, so a person is shown or hidden as a whole.
export const seesEmployment = (access: ClassAccess): boolean =>
  seesField(access, "startDate") && seesField(access, "endDate");

export const needsClassify = "Changing a class needs Classify data";

// Why a role may not move data from one class to another, or undefined when it may: moving needs
// Classify data and sight of both classes, so nobody moves data they cannot see, or out of sight.
export function whyNoMove(
  permissions: readonly Permission[],
  from: Tier,
  to: Tier,
): string | undefined {
  if (!permissions.includes("data:classify")) return needsClassify;
  const unseen = [from, to].find(
    (dataClass) => !seesClass(permissions, dataClass),
  );
  if (unseen === undefined) return undefined;
  // The class is always one of the fixed classes listed above.
  // eslint-disable-next-line security/detect-object-injection
  return `This role can't see ${classNames[unseen]} data`;
}

const employment = ["startDate", "endDate"] as const;
const overTime = [...employment, "managerHistory", "featureTeamDates"] as const;

// The pages and views that need classified details.
const classifiedViewSchema = z.enum([
  "orgChartOtherDates",
  "orgChartFutureDates",
  "featureAssignments",
  "groupingByManager",
  "allocations",
]);

export type ClassifiedView = z.infer<typeof classifiedViewSchema>;

// What each view needs. Allocations reads the months of Feature assignments, so needs what it does.
const viewNeeds: Record<ClassifiedView, readonly ClassifiedField[]> = {
  orgChartOtherDates: overTime,
  orgChartFutureDates: [...overTime, "futureReorganizations"],
  featureAssignments: overTime,
  groupingByManager: [...overTime, "futureReorganizations"],
  allocations: overTime,
};

// What the allocations grid reads, as a role must hold it to see the grid: allocations, which open
// its page, and the feature teams' months and the org chart's planned hires it draws on.
export const allocationsGridPermissions = [
  "allocations:view",
  "feature-teams:view",
  "people:view",
] as const satisfies readonly Permission[];

// How a sentence on the view's page names it, and whether it reads as plural. Every view must be
// named, which the compiler checks.
const viewWords: Record<ClassifiedView, { subject: string; plural: boolean }> =
  {
    orgChartOtherDates: { subject: "Other dates", plural: true },
    orgChartFutureDates: { subject: "Future dates", plural: true },
    featureAssignments: { subject: "Feature assignments", plural: false },
    groupingByManager: { subject: "Grouping by manager", plural: false },
    allocations: { subject: "Allocations", plural: false },
  };

// Where each view is: each page holding it, its name there, and the permissions it needs there
// beyond reaching the page, the first of which the role must hold for the view to be on its page at
// all.
const viewPlaces: Record<
  ClassifiedView,
  readonly { page: string; name: string; needs?: readonly Permission[] }[]
> = {
  orgChartOtherDates: [
    { page: "People", name: "People on other dates" },
    { page: "Org chart", name: "Org chart on other dates" },
  ],
  orgChartFutureDates: [
    { page: "People", name: "People on future dates" },
    { page: "Org chart", name: "Org chart on future dates" },
  ],
  featureAssignments: [
    { page: "Feature assignments", name: "Feature assignments" },
  ],
  groupingByManager: [
    {
      page: "Feature assignments",
      name: "Feature assignments grouped by manager",
    },
    {
      page: "Capacity",
      name: "Allocations grouped by manager",
      needs: allocationsGridPermissions,
    },
  ],
  allocations: [
    {
      page: "Capacity",
      name: "Allocations",
      needs: allocationsGridPermissions,
    },
  ],
};

// What else holds each built-in detail besides views and columns: the hiring plan's class keeps
// planned hires' target dates, drafts and history from view, though everyone reaching People sees
// the hires themselves.
const heldElsewhere: Record<ClassifiedField, readonly string[]> = {
  startDate: [],
  endDate: [],
  managerHistory: [],
  featureTeamDates: [],
  futureReorganizations: [],
  hiringPlan: ["Planned hires' target dates, drafts and history"],
};

// The views needing a built-in detail, People's columns holding it, and what else holds it, by name.
export function shownIn(field: ClassifiedField): string[] {
  const views = classifiedViewSchema.options.flatMap((view) =>
    // The view is always one of the fixed views listed above.
    // eslint-disable-next-line security/detect-object-injection
    viewNeeds[view].includes(field)
      ? // The view is always one of the fixed views listed above.
        // eslint-disable-next-line security/detect-object-injection
        viewPlaces[view].map(({ name }) => name)
      : [],
  );
  const columns = [...builtInColumnNames].flatMap(([key, label]) =>
    classifiedColumns.get(key) === field ? [`People's ${label}`] : [],
  );
  // The field is always one of the fixed fields.
  // eslint-disable-next-line security/detect-object-injection
  return [...views, ...columns, ...heldElsewhere[field]];
}

// The classes the details a view needs are kept in.
export const classesOfView = (
  view: ClassifiedView,
  access: Pick<ClassAccess, "dataClasses">,
): Tier[] =>
  // The view is always one of the fixed views listed above.
  // eslint-disable-next-line security/detect-object-injection
  viewNeeds[view].map((field: ClassifiedField) => access.dataClasses[field]);

// The classes a view needs that a role does not see, least sensitive first.
function missingClasses(view: ClassifiedView, access: ClassAccess): Tier[] {
  const needed = classesOfView(view, access);
  return tierSchema.options.filter(
    (dataClass) =>
      needed.includes(dataClass) && !seesClass(access.permissions, dataClass),
  );
}

export function seesView(view: ClassifiedView, access: ClassAccess): boolean {
  return missingClasses(view, access).length === 0;
}

// A view needing classified details, on the page holding it, which is the whole page when the two
// share a name; with why a role misses it, when it does.
export interface RoleView {
  name: string;
  page: string;
  why?: string;
}

// The views needing classified details on the pages a role reaches, named as the sidebar names
// them, each with why the role misses it, such as "Org chart on future dates: needs Confidential",
// naming the permissions and classes it needs, never the details in a class, which each
// organization decides. Views on pages it never reaches are left out, as those pages are.
export function viewsOfRole(
  access: ClassAccess,
  pages: readonly string[],
): RoleView[] {
  return classifiedViewSchema.options.flatMap((view) =>
    // The view is always one of the fixed views listed above.
    // eslint-disable-next-line security/detect-object-injection
    viewPlaces[view].flatMap(({ page, name, needs = [] }) => {
      const [opening, ...others] = needs;
      if (
        !pages.includes(page) ||
        (opening !== undefined && !access.permissions.includes(opening))
      ) {
        return [];
      }
      const permissions = others
        .filter((one) => !access.permissions.includes(one))
        .map(permissionLabel);
      const classes = missingClasses(view, access).map(
        // The class is always one of the fixed classes listed above.
        // eslint-disable-next-line security/detect-object-injection
        (dataClass) => classNames[dataClass],
      );
      const missing = [...permissions, ...classes];
      if (missing.length === 0) return [{ name, page }];
      return [{ name, page, why: `${name}: needs ${allOf(missing)}` }];
    }),
  );
}

// Why a role does not get a view, such as "Other dates need Personal access.", or undefined when it
// does.
export function whyMissing(
  view: ClassifiedView,
  access: ClassAccess,
): string | undefined {
  const missing = missingClasses(view, access);
  if (missing.length === 0) return undefined;
  // The view is always one of the fixed views listed above.
  // eslint-disable-next-line security/detect-object-injection
  const { subject, plural } = viewWords[view];
  const names = missing
    // The class is always one of the fixed classes listed above.
    // eslint-disable-next-line security/detect-object-injection
    .map((dataClass) => classNames[dataClass])
    .join(" and ");
  return `${subject} ${plural ? "need" : "needs"} ${names} access.`;
}
