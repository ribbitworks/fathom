// SPDX-License-Identifier: Apache-2.0

// The data classes of Fathom's built-in details, which the organization moves with Classify data,
// and what each page or view needs, as the Decisions Log's Data classes set out. A page or view
// shows whole only to a role that sees every class it needs, and otherwise says why in one line; it
// is never cut down.

import { z } from "zod";
import { type Permission, type Tier, tierSchema } from "./access.ts";

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

export const classMoveSchema = z.object({ dataClass: tierSchema });

export type ClassMove = z.infer<typeof classMoveSchema>;

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

// Whether permissions let a role see a class. General data is seen with the page that holds it, and
// Personal details are details of people, so they show only with people.
export function seesClass(
  permissions: readonly Permission[],
  dataClass: Tier,
): boolean {
  if (dataClass === "general") return true;
  // The class is always one of the fixed classes listed above.
  // eslint-disable-next-line security/detect-object-injection
  const { view } = classPermissions[dataClass];
  return (
    permissions.includes(view) &&
    (dataClass !== "personal" || permissions.includes("people:view"))
  );
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

// Whether a role sees people who have not started yet and those who have left, which their start and
// end dates would reveal. Both are needed, so a person is shown or hidden as a whole.
export const seesEmployment = (access: ClassAccess): boolean =>
  seesField(access, "startDate") && seesField(access, "endDate");

export const needsClassify = "Moving data to another class needs Classify data";

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

// The pages and views that need classified details, and what each needs. Allocations reads the
// months of Feature assignments, so needs what it does.
const viewNeeds = {
  orgChartOtherDates: overTime,
  orgChartFutureDates: [...overTime, "futureReorganizations"],
  featureAssignments: overTime,
  groupingByManager: [...overTime, "futureReorganizations"],
  allocations: overTime,
} as const satisfies Record<string, readonly ClassifiedField[]>;

export type ClassifiedView = keyof typeof viewNeeds;

// How a sentence names each view, and whether it reads as plural. Every view must be named, which
// the compiler checks.
const viewWords: Record<ClassifiedView, { subject: string; plural: boolean }> =
  {
    orgChartOtherDates: { subject: "Other dates", plural: true },
    orgChartFutureDates: { subject: "Future dates", plural: true },
    featureAssignments: { subject: "Feature assignments", plural: false },
    groupingByManager: { subject: "Grouping by manager", plural: false },
    allocations: { subject: "Allocations", plural: false },
  };

// The classes a view needs that a role does not see, least sensitive first.
function missingClasses(view: ClassifiedView, access: ClassAccess): Tier[] {
  // The view is always one of the fixed views listed above.
  // eslint-disable-next-line security/detect-object-injection
  const needed = viewNeeds[view].map((field: ClassifiedField) =>
    classOf(access, field),
  );
  return tierSchema.options.filter(
    (dataClass) =>
      needed.includes(dataClass) && !seesClass(access.permissions, dataClass),
  );
}

export function seesView(view: ClassifiedView, access: ClassAccess): boolean {
  return missingClasses(view, access).length === 0;
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
