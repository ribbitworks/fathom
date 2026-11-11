// SPDX-License-Identifier: Apache-2.0

// The data classes of Fathom's built-in details that pages and views depend on, and what each page
// or view needs, as the Decisions Log's Data classes set out. A page or view shows whole only to a
// role that sees every class it needs, and otherwise says why in one line; it is never cut down.

import { type Permission, type Tier, tierSchema } from "./access.ts";

type ClassifiedField =
  | "startDate"
  | "endDate"
  | "managerHistory"
  | "featureTeamDates"
  | "futureReorganizations";

// The class each built-in detail starts in. Every detail must be listed, which the compiler checks.
const defaultClasses: Record<ClassifiedField, Tier> = {
  startDate: "personal",
  endDate: "personal",
  managerHistory: "personal",
  featureTeamDates: "personal",
  futureReorganizations: "confidential",
};

// Each class's name, as people read it. Every class must be named, which the compiler checks.
export const classNames: Record<Tier, string> = {
  general: "General",
  personal: "Personal",
  confidential: "Confidential",
};

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

// The classes a view needs that permissions do not let a role see, least sensitive first.
function missingClasses(
  view: ClassifiedView,
  permissions: readonly Permission[],
): Tier[] {
  // The view is always one of the fixed views listed above.
  // eslint-disable-next-line security/detect-object-injection
  const needed = viewNeeds[view].map(
    // The field is always one of the fixed fields listed above.
    // eslint-disable-next-line security/detect-object-injection
    (field: ClassifiedField) => defaultClasses[field],
  );
  return tierSchema.options.filter(
    (dataClass) =>
      needed.includes(dataClass) && !seesClass(permissions, dataClass),
  );
}

export function seesView(
  view: ClassifiedView,
  permissions: readonly Permission[],
): boolean {
  return missingClasses(view, permissions).length === 0;
}

// Why a role does not get a view, such as "Other dates need Personal access.", or undefined when it
// does.
export function whyMissing(
  view: ClassifiedView,
  permissions: readonly Permission[],
): string | undefined {
  const missing = missingClasses(view, permissions);
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
