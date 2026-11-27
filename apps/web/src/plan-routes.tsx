// SPDX-License-Identifier: Apache-2.0

// The planning pages' routes, Releases, Capacity, Projects and Features, with what each page's
// address holds, and Feature assignments' old address.

import {
  approvableKinds,
  cardPartSchema,
  cyclesViewChoices,
  daySchema,
  editsColumnsOf,
  editsField,
  opensWith,
  pageNeeds,
  planModeSchema,
  releasesViewChoices,
  seesView,
  sharesViews,
  shownChoiceSchema,
} from "@fathom/shared";
import { createRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { CapacityPage } from "./capacity-page.tsx";
import {
  capacityModeOfTable,
  capacityModeSchema,
  capacityModes,
  capacityTabChoices,
  capacityTables,
  settingsMode,
  shownCapacityMode,
} from "./capacity.ts";
import { removedCycleMark } from "./cycle-table.tsx";
import { oneBoardColumns } from "./feature-board.ts";
import { lastViewsQuery } from "./last-views.ts";
import { customerChoiceKey } from "./customer-filter.ts";
import { ProjectsPage, projectTabSchema } from "./projects-page.tsx";
import type { ActivitiesOf, ActivityOwner } from "./activity-list.tsx";
import { featureNamers, planAddress } from "./projects.ts";
import { streamAddress } from "./record-links.ts";
import {
  ReleasesPage,
  type ReleasesTab,
  releasesTabSchema,
  releasesTabTables,
} from "./releases-page.tsx";
import {
  editsFeatureTeams,
  fathomIdLength,
  linkedColumnSearch,
  opening,
  openOnLastView,
  reaching,
  shownOn,
  signedIn,
  signedInRoute,
  useLinkedColumn,
} from "./signed-in-route.tsx";
import { viewProps, viewSearchSchema } from "./table-view.ts";

// A cycle's own identifier: its schedule's, a space, and its first day, then, for a cycle a draft
// removes, its mark.
const cycleIdLength =
  fathomIdLength + " YYYY-MM-DD".length + removedCycleMark.length;

// The Releases page's address: its tab, the record of the tab whose details are shown beside it,
// the tab's view, and whether shipped releases show, on Releases, or past and later cycles, on
// Cycles. Changing the tab starts its view afresh.
const releasesSearch = viewSearchSchema.extend({
  tab: releasesTabSchema.optional().catch(undefined),
  open: z.string().max(cycleIdLength).optional().catch(undefined),
  shipped: shownChoiceSchema.optional().catch(undefined),
  past: shownChoiceSchema.optional().catch(undefined),
  later: shownChoiceSchema.optional().catch(undefined),
});

// The choices each tab of the Releases page keeps in its view, by their names in the address.
const releasesTabChoices: Record<
  ReleasesTab,
  readonly ("shipped" | "past" | "later")[]
> = {
  releases: releasesViewChoices.keyof().options,
  cycles: cyclesViewChoices.keyof().options,
  schedules: [],
};

// Releases, their schedules and cycles, seen with the plan or planning configuration. An address
// naming a schedule after the page, as links made before the page had tabs do, opens it on
// Schedules.
export const releasesRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/releases/{-$streamId}",
  validateSearch: releasesSearch,
  beforeLoad: (match) => {
    reaching("releases")(match);
    const { streamId } = match.params;
    if (streamId !== undefined) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's way to redirect
      throw redirect({
        to: "/releases/{-$streamId}",
        params: { streamId: undefined },
        search: { ...match.search, tab: "schedules", open: streamId },
        replace: true,
      });
    }
    const tab = match.search.tab ?? "releases";
    openOnLastView(
      match,
      shownOn(
        // The tab is always one of the fixed tabs.
        // eslint-disable-next-line security/detect-object-injection
        releasesTabTables[tab],
        match.search,
        // eslint-disable-next-line security/detect-object-injection
        releasesTabChoices[tab],
      ),
      (address, table) => ({
        ...address,
        tab: releasesTabSchema.options.find(
          // The tab is always one of the fixed tabs.
          // eslint-disable-next-line security/detect-object-injection
          (shown) => shown !== "releases" && releasesTabTables[shown] === table,
        ),
      }),
    );
  },
  component: function Releases() {
    const { permissions, access } = signedIn.useRouteContext();
    const opensActivities = opensWith(pageNeeds.activities, access);
    const navigate = releasesRoute.useNavigate();
    const {
      tab = "releases",
      open,
      note,
      tableNote,
      ...search
    } = releasesRoute.useSearch();
    const notes = { note, tableNote };
    const kept = { tab: tab === "releases" ? undefined : tab, open };
    return (
      <ReleasesPage
        tab={tab}
        editsFeatureTeams={editsFeatureTeams(permissions)}
        onTab={(next, { open: record, schedule } = {}) => {
          void navigate({
            search: {
              ...(next === "releases" ? {} : { tab: next }),
              ...(record === undefined ? {} : { open: record }),
              ...(schedule === undefined
                ? {}
                : { filters: { schedule: { any: [schedule] } } }),
            },
          });
        }}
        open={open}
        onOpen={(next) => {
          void navigate({
            search: { ...search, ...kept, open: next, ...notes },
          });
        }}
        onFeatures={(at) => {
          void navigate(
            "feature" in at
              ? planAddress("features", at.feature)
              : {
                  to: "/features",
                  search: {
                    filters: { [at.filter.key]: { any: [at.filter.value] } },
                    ...(at.board === undefined
                      ? {}
                      : { mode: "board" as const, ...at.board }),
                  },
                },
          );
        }}
        {...(opensActivities
          ? {
              activitiesOf: {
                ...showsActivitiesOf("releaseId", (to) => {
                  void navigate(to);
                }),
                open: (id: string) => {
                  void navigate(planAddress("activities", id));
                },
              },
            }
          : {})}
        approves={approvableKinds(permissions)}
        // The tab is always one of the fixed tabs.
        // eslint-disable-next-line security/detect-object-injection
        canShareViews={sharesViews(releasesTabTables[tab], permissions)}
        {...viewProps(
          search,
          (next, replace) => {
            void navigate({ search: { ...next, ...kept, ...notes }, replace });
          },
          // The tab is always one of the fixed tabs.
          // eslint-disable-next-line security/detect-object-injection
          releasesTabChoices[tab],
        )}
      />
    );
  },
});

// The Capacity page's address: its tab, and its grid's view.
const capacitySearch = viewSearchSchema.extend({
  mode: z
    .union([capacityModeSchema, z.literal(settingsMode)])
    .optional()
    .catch(undefined),
  over: shownChoiceSchema.optional().catch(undefined),
  under: shownChoiceSchema.optional().catch(undefined),
});

export const capacityRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/capacity",
  validateSearch: capacitySearch,
  beforeLoad: (match) => {
    if (match.search.mode === settingsMode) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's way to redirect
      throw redirect({ to: "/planning-settings", replace: true });
    }
    opening("capacity")(match);
    const mode = shownCapacityMode(match.search.mode, match.context.access);
    // An address naming a tab, such as an old Feature assignments link, shows that tab, with its last
    // view only where it was on that tab.
    const last = match.context.queryClient.getQueryData(
      lastViewsQuery.queryKey,
    )?.capacity;
    if (
      match.search.mode !== undefined &&
      (last === undefined || capacityModeOfTable(last.table) !== mode)
    ) {
      return;
    }
    openOnLastView(
      match,
      shownOn(
        // The tab is always one of the grid tabs here.
        // eslint-disable-next-line security/detect-object-injection
        capacityTables[mode],
        match.search,
        // eslint-disable-next-line security/detect-object-injection
        capacityTabChoices[mode],
      ),
      (address, table) => ({ ...address, mode: capacityModeOfTable(table) }),
    );
  },
  component: function Capacity() {
    const { permissions, access } = signedIn.useRouteContext();
    const navigate = capacityRoute.useNavigate();
    const { mode: asked, ...search } = capacityRoute.useSearch();
    const mode = shownCapacityMode(asked, access);
    // The address keeps the tab shown, not one asked for that the role doesn't see.
    const kept = asked === undefined ? {} : { mode };
    return (
      <CapacityPage
        modes={capacityModes(access)}
        mode={mode}
        onMode={(next) => {
          void navigate({ search: { mode: next } });
        }}
        byManager={seesView("groupingByManager", access)}
        groupsByWork={permissions.includes("configuration:view")}
        seesHires={opensWith(pageNeeds["org-chart"], access)}
        editsTeams={editsFeatureTeams(permissions)}
        changesDates={editsField(access, "featureTeamDates")}
        // The tab is always one of the fixed tabs.
        // eslint-disable-next-line security/detect-object-injection
        canShareViews={sharesViews(capacityTables[mode], permissions)}
        {...viewProps(
          search,
          (next, replace) => {
            void navigate({ search: { ...next, ...kept }, replace });
          },
          // The tab is always one of the fixed tabs.
          // eslint-disable-next-line security/detect-object-injection
          capacityTabChoices[mode],
        )}
        opensSettings={opensWith(pageNeeds["planning-settings"], access)}
      />
    );
  },
});

// A plan page's address: its view, and the record whose details are shown beside it.
const planRecordSearch = viewSearchSchema.extend({
  open: z.uuid().optional().catch(undefined),
});

// The Projects page's address adds its tab. Changing the tab starts its view afresh.
const projectsSearch = planRecordSearch.extend({
  tab: projectTabSchema.optional().catch(undefined),
});

// Features' address adds whether it shows a board, and the board's stream, the cycle it starts from,
// and the parts of its cards hidden, and the customer whose features alone it shows.
const featuresSearch = planRecordSearch
  .extend({
    column: linkedColumnSearch,
    customer: z.uuid().optional().catch(undefined),
    mode: planModeSchema.optional().catch(undefined),
    stream: z.uuid().optional().catch(undefined),
    schedule: z.uuid().optional().catch(undefined),
    finished: shownChoiceSchema.optional().catch(undefined),
    from: daySchema.optional().catch(undefined),
    hide: z.array(cardPartSchema).optional().catch(undefined),
  })
  .transform(oneBoardColumns);

// The choices Features keeps in its view, by their names in the address.
const featuresChoices = [
  "stream",
  "schedule",
  "hide",
  "finished",
  customerChoiceKey,
] as const;

export const featuresRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/features",
  validateSearch: featuresSearch,
  beforeLoad: (match) => {
    reaching("features")(match);
    openOnLastView(
      match,
      shownOn("features", match.search, featuresChoices, match.search.mode),
    );
  },
  component: function Features() {
    const { permissions } = signedIn.useRouteContext();
    const navigate = featuresRoute.useNavigate();
    // Table or Board, and the cycle the Board starts from, are kept in the address but not the
    // view, which the table and the Board share.
    const { open, note, tableNote, mode, from, column, ...search } =
      featuresRoute.useSearch();
    const notes = { note, tableNote };
    const { stream, schedule, hide } = search;
    const linkedColumn = useLinkedColumn(column, () => {
      void navigate({
        search: (shown) => ({ ...shown, column: undefined }),
        replace: true,
      });
    });
    return (
      <ProjectsPage
        linkedColumn={linkedColumn}
        tab="features"
        canEditColumns={editsColumnsOf(permissions, "features")}
        editsFeatureTeams={editsFeatureTeams(permissions)}
        canShareViews={sharesViews("features", permissions)}
        onTab={(next, record) => {
          void navigate(planAddress(next, record));
        }}
        onReleaseStream={(streamId) => {
          void navigate(streamAddress(streamId));
        }}
        approves={approvableKinds(permissions)}
        {...viewProps(
          search,
          (next, replace) => {
            void navigate({
              search: { ...next, mode, from, open, ...notes },
              replace,
            });
          },
          featuresChoices,
        )}
        open={open}
        onOpen={(next) => {
          void navigate({
            search: { ...search, mode, from, open: next, ...notes },
          });
        }}
        board={{
          mode,
          onMode: (next) => {
            void navigate({
              search: {
                ...search,
                from,
                open,
                ...notes,
                mode: next === "board" ? next : undefined,
              },
            });
          },
          place: { stream, schedule, from, hide },
          onPlace: (place) => {
            void navigate({
              search: { ...search, mode, ...place, open, ...notes },
            });
          },
        }}
      />
    );
  },
});

// Activities' address adds a column a link opens.
const activitiesSearch = planRecordSearch.extend({
  column: linkedColumnSearch,
});

// Activities filtered to a project's or a release's.
const activitiesAddress = (owner: ActivityOwner, id: string) =>
  ({
    to: "/activities",
    search: { filters: { [owner]: { any: [id] } } },
  }) as const;

// Showing a project's or a release's activities on Activities.
const showsActivitiesOf = (
  owner: ActivityOwner,
  go: (to: ReturnType<typeof activitiesAddress>) => void,
): Pick<ActivitiesOf, "showAll"> => ({
  showAll: (id) => {
    go(activitiesAddress(owner, id));
  },
});

export const activitiesRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/activities",
  validateSearch: activitiesSearch,
  beforeLoad: (match) => {
    reaching("activities")(match);
    openOnLastView(match, shownOn("activities", match.search));
  },
  component: function Activities() {
    const { permissions } = signedIn.useRouteContext();
    const navigate = activitiesRoute.useNavigate();
    const { open, note, tableNote, column, ...search } =
      activitiesRoute.useSearch();
    const notes = { note, tableNote };
    const linkedColumn = useLinkedColumn(column, () => {
      void navigate({
        search: (shown) => ({ ...shown, column: undefined }),
        replace: true,
      });
    });
    return (
      <ProjectsPage
        linkedColumn={linkedColumn}
        tab="activities"
        canEditColumns={editsColumnsOf(permissions, "activities")}
        canShareViews={sharesViews("activities", permissions)}
        approves={approvableKinds(permissions)}
        {...viewProps(search, (next, replace) => {
          void navigate({ search: { ...next, open, ...notes }, replace });
        })}
        open={open}
        onOpen={(next) => {
          void navigate({ search: { ...search, open: next, ...notes } });
        }}
        onTab={(next, record) => {
          void navigate(planAddress(next, record));
        }}
        onReleaseStream={(streamId) => {
          void navigate(streamAddress(streamId));
        }}
      />
    );
  },
});

export const projectsRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/projects",
  validateSearch: projectsSearch,
  beforeLoad: (match) => {
    reaching("projects")(match);
    openOnLastView(
      match,
      shownOn(match.search.tab ?? "projects", match.search),
      (address, table) => ({
        ...address,
        tab: table === "projects" ? undefined : table,
      }),
    );
  },
  component: function Projects() {
    const { permissions, access } = signedIn.useRouteContext();
    const navigate = projectsRoute.useNavigate();
    const opensActivities = opensWith(pageNeeds.activities, access);
    const { tab, open, note, tableNote, ...search } = projectsRoute.useSearch();
    const notes = { note, tableNote };
    return (
      <ProjectsPage
        tab={tab ?? "projects"}
        canShareViews={sharesViews(tab ?? "projects", permissions)}
        editsFeatureTeams={editsFeatureTeams(permissions)}
        onTab={(next, record) => {
          void navigate(planAddress(next, record));
        }}
        approves={approvableKinds(permissions)}
        {...viewProps(search, (next, replace) => {
          void navigate({ search: { ...next, tab, open, ...notes }, replace });
        })}
        open={open}
        onOpen={(next) => {
          void navigate({ search: { ...search, tab, open: next, ...notes } });
        }}
        onMilestonesOf={(project) => {
          void navigate({
            search: {
              tab: "milestones",
              filters: { projectId: { any: [project.id] } },
            },
          });
        }}
        seesFeatures={opensWith(pageNeeds.features, access)}
        onCustomerFeatures={({ id }) => {
          void navigate({
            to: "/features",
            search: { [customerChoiceKey]: id },
          });
        }}
        activitiesOf={
          opensActivities
            ? showsActivitiesOf("projectId", (to) => {
                void navigate(to);
              })
            : undefined
        }
        onFeaturesOf={({ type, id }) => {
          void navigate({
            to: "/features",
            search: {
              filters: {
                // The kind is always one of the fixed kinds.
                // eslint-disable-next-line security/detect-object-injection
                [featureNamers[type].key]: {
                  any: [id],
                },
              },
            },
          });
        }}
      />
    );
  },
});

// Feature assignments' old address, as a saved link may have it, opens its tab on Capacity with the
// same view, or Allocations for its old Allocations mode.
const featureAssignmentsSearch = viewSearchSchema.extend({
  mode: z.literal("allocations").optional().catch(undefined),
});

export const featureAssignmentsRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/feature-assignments",
  validateSearch: featureAssignmentsSearch,
  beforeLoad: ({ search: { mode, ...shown } }) => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's way to redirect
    throw redirect({
      to: "/capacity",
      search: { ...shown, mode: mode ?? "feature-teams" },
      replace: true,
    });
  },
});
