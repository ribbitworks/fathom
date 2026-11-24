// SPDX-License-Identifier: Apache-2.0

// Building blocks for fictional records, used by the seed data generator and test data, the same on
// every run from a fixed seed and reference date. No real person, company, site or product is named.
// A development-only package, never included in the runtime image.

export { fictionalId } from "./fictional-id.ts";
export {
  fillingHires,
  firstUnnamed,
  lastOnNoTeam,
} from "./left-as-they-are.ts";
export { leavingInDays } from "./leaving.ts";
export { onboarding, onboardingSteps, starterHandbook } from "./onboarding.ts";
export { fictionalOrganization, newcomerCount } from "./organization.ts";
export type {
  FictionalColumn,
  FictionalFeatureTeam,
  FictionalHire,
  FictionalLine,
  FictionalList,
  FictionalOrganization,
  FictionalPerson,
  FictionalTeam,
} from "./types.ts";
