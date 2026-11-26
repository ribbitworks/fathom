// SPDX-License-Identifier: Apache-2.0

// The settings the Projects, Features and Activities pages share one component by.

import type {
  Customer,
  DecidedKind,
  PlanMode,
  Project,
  ProjectPlan,
} from "@fathom/shared";
import type { ActivitiesOf } from "./activity-list.tsx";
import type { BoardPlace } from "./feature-board-view.tsx";
import {
  withActivityColumns,
  withFeatureColumns,
} from "./plan-record-changes.ts";
import type { FeatureNamer, PlanTab } from "./projects.ts";
import type { LinkedColumn } from "./record-table.ts";
import type { ChangeView } from "./table-controls.tsx";
import type { View } from "./table-view.ts";

// What sets each of the plan's pages apart.
export const planPages = {
  projects: {
    title: "Projects",
    tabbed: true,
    loadsStreams: false,
    loadsEffort: false,
    mayEdit: (plan: ProjectPlan) => plan.canEdit,
  },
  features: {
    title: "Features",
    tabbed: false,
    loadsStreams: true,
    loadsEffort: true,
    mayEdit: (plan: ProjectPlan) => plan.canEditFeatures,
  },
  activities: {
    title: "Activities",
    tabbed: false,
    loadsStreams: true,
    loadsEffort: true,
    mayEdit: (plan: ProjectPlan) => plan.canEditFeatures,
  },
};

// The tables of planned work, whose columns can be added to, by the tab that shows each.
export const plannedTables = {
  features: {
    table: "features",
    columns: (plan: ProjectPlan) => plan.featureColumns,
    withColumns: withFeatureColumns,
  },
  activities: {
    table: "activities",
    columns: (plan: ProjectPlan) => plan.activityColumns,
    withColumns: withActivityColumns,
  },
} as const;

export type PlannedTable = (typeof plannedTables)[keyof typeof plannedTables];

export const plannedTableOn = (tab: PlanTab): PlannedTable | undefined =>
  tab === "features" || tab === "activities"
    ? // The tab is always one of the two fixed tabs here.
      // eslint-disable-next-line security/detect-object-injection
      plannedTables[tab]
    : undefined;

// What the plan's pages are given.
export interface ProjectsPageProps {
  // An added column on Features a link opens, whose menu the table opens with open.
  linkedColumn?: LinkedColumn | undefined;
  tab: PlanTab;
  // Shows another of the plan's pages or tabs, with a record's details open if one is named.
  onTab?: (tab: PlanTab, open?: string) => void;
  // The kinds of draft the user's role approves and rejects.
  approves?: readonly DecidedKind[];
  // Whether the user may add and change the columns on Features.
  canEditColumns?: boolean;
  // Whether the user may set a feature's feature team.
  editsFeatureTeams?: boolean;
  view: View;
  onView: ChangeView;
  // The saved view the view started from, as the address names it.
  applied: string | undefined;
  onApply: (view: View, id: string, replace?: boolean) => void;
  canShareViews?: boolean;
  // The record whose details are shown beside the table, by its identifier.
  open?: string | undefined;
  onOpen?: (id: string | undefined) => void;
  // Shows the Milestones tab with only a project's milestones.
  onMilestonesOf?: (project: Project) => void;
  // Shows Features with only those a project or proposal names.
  onFeaturesOf?: (namer: FeatureNamer) => void;
  // Shows Features with every feature a customer gets or asks for.
  onCustomerFeatures?: (customer: Customer) => void;
  // Whether the reader sees features, without which Customers has no Features column.
  seesFeatures?: boolean;
  // Shows a release stream on Releases, with its releases and cycles.
  onReleaseStream?: (streamId: string) => void;
  // Set for a role that sees activities: shows a project's on Activities.
  activitiesOf?: Pick<ActivitiesOf, "showAll"> | undefined;
  // How Features shows its features, as a table or a board, and where the board is.
  board?: {
    mode: PlanMode | undefined;
    onMode: (mode: PlanMode) => void;
    place: BoardPlace;
    onPlace: (place: BoardPlace) => void;
  };
}
