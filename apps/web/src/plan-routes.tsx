// SPDX-License-Identifier: Apache-2.0

// The planning pages' routes, Releases, Capacity, Projects, Features and Feature assignments, with
// what each page's address holds.

import {
  approvableKinds,
  cardPartSchema,
  cyclesViewChoices,
  daySchema,
  editsField,
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
  capacityModeSchema,
  capacityModes,
  shownCapacityMode,
} from "./capacity.ts";
import { removedCycleMark } from "./cycle-table.tsx";
import { FeatureAssignmentsPage } from "./feature-assignments-page.tsx";
import { ProjectsPage, projectTabSchema } from "./projects-page.tsx";
import { featureNamers, planAddress } from "./projects.ts";
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
    const { permissions } = signedIn.useRouteContext();
    const navigate = releasesRoute.useNavigate();
    const { tab = "releases", open, ...search } = releasesRoute.useSearch();
    const kept = { tab: tab === "releases" ? undefined : tab, open };
    return (
      <ReleasesPage
        tab={tab}
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
          void navigate({ search: { ...search, ...kept, open: next } });
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
        approves={approvableKinds(permissions)}
        // The tab is always one of the fixed tabs.
        // eslint-disable-next-line security/detect-object-injection
        canShareViews={sharesViews(releasesTabTables[tab], permissions)}
        {...viewProps(
          search,
          (next, replace) => {
            void navigate({ search: { ...next, ...kept }, replace });
          },
          // The tab is always one of the fixed tabs.
          // eslint-disable-next-line security/detect-object-injection
          releasesTabChoices[tab],
        )}
      />
    );
  },
});

// The Capacity page's address: its mode, and People's view.
const capacitySearch = viewSearchSchema.extend({
  mode: capacityModeSchema.optional().catch(undefined),
});

export const capacityRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/capacity",
  validateSearch: capacitySearch,
  beforeLoad: (match) => {
    opening("capacity")(match);
    openOnLastView(
      match,
      shownOn("capacity", match.search, [], match.search.mode),
    );
  },
  component: function Capacity() {
    const { permissions, access } = signedIn.useRouteContext();
    const navigate = capacityRoute.useNavigate();
    const { mode: asked, ...search } = capacityRoute.useSearch();
    const mode = shownCapacityMode(asked, access);
    // The address keeps the mode shown, not one asked for that the role doesn't see.
    const kept = asked === undefined ? {} : { mode };
    return (
      <CapacityPage
        modes={capacityModes(access)}
        mode={mode}
        onMode={(next) => {
          void navigate({ search: { mode: next } });
        }}
        byManager={seesView("groupingByManager", access)}
        canShareViews={sharesViews("capacity", permissions)}
        {...viewProps(search, (next, replace) => {
          void navigate({ search: { ...next, ...kept }, replace });
        })}
        canEditSettings={permissions.includes("configuration:edit")}
        approves={approvableKinds(permissions)}
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
// and the parts of its cards hidden.
const featuresSearch = planRecordSearch.extend({
  column: linkedColumnSearch,
  mode: planModeSchema.optional().catch(undefined),
  stream: z.uuid().optional().catch(undefined),
  from: daySchema.optional().catch(undefined),
  hide: z.array(cardPartSchema).optional().catch(undefined),
});

export const featuresRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/features",
  validateSearch: featuresSearch,
  beforeLoad: (match) => {
    reaching("features")(match);
    openOnLastView(
      match,
      shownOn("features", match.search, ["stream", "hide"], match.search.mode),
    );
  },
  component: function Features() {
    const { permissions } = signedIn.useRouteContext();
    const navigate = featuresRoute.useNavigate();
    // Table or Board, and the cycle the Board starts from, are kept in the address but not the
    // view, which the table and the Board share.
    const { open, mode, from, column, ...search } = featuresRoute.useSearch();
    const { stream, hide } = search;
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
        canEditColumns={permissions.includes("configuration:edit")}
        canShareViews={sharesViews("features", permissions)}
        onTab={(next, record) => {
          void navigate(planAddress(next, record));
        }}
        onReleaseStream={(streamId) => {
          void navigate({
            to: "/releases/{-$streamId}",
            params: { streamId: undefined },
            search: { tab: "schedules", open: streamId },
          });
        }}
        approves={approvableKinds(permissions)}
        {...viewProps(
          search,
          (next, replace) => {
            void navigate({ search: { ...next, mode, from, open }, replace });
          },
          ["stream", "hide"],
        )}
        open={open}
        onOpen={(next) => {
          void navigate({ search: { ...search, mode, from, open: next } });
        }}
        board={{
          mode,
          onMode: (next) => {
            void navigate({
              search: {
                ...search,
                from,
                open,
                mode: next === "board" ? next : undefined,
              },
            });
          },
          place: { stream, from, hide },
          onPlace: (place) => {
            void navigate({ search: { ...search, mode, ...place, open } });
          },
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
    const { permissions } = signedIn.useRouteContext();
    const navigate = projectsRoute.useNavigate();
    const { tab, open, ...search } = projectsRoute.useSearch();
    return (
      <ProjectsPage
        tab={tab ?? "projects"}
        canShareViews={sharesViews(tab ?? "projects", permissions)}
        onTab={(next, record) => {
          void navigate(planAddress(next, record));
        }}
        approves={approvableKinds(permissions)}
        {...viewProps(search, (next, replace) => {
          void navigate({ search: { ...next, tab, open }, replace });
        })}
        open={open}
        onOpen={(next) => {
          void navigate({ search: { ...search, tab, open: next } });
        }}
        onMilestonesOf={(project) => {
          void navigate({
            search: {
              tab: "milestones",
              filters: { projectId: { any: [project.id] } },
            },
          });
        }}
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

// The Feature assignments page's address. Its Allocations mode moved to Capacity's People mode, so
// an address naming it, such as a saved link, opens that instead, with the same view.
const featureAssignmentsSearch = viewSearchSchema.extend({
  mode: z.literal("allocations").optional().catch(undefined),
});

export const featureAssignmentsRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/feature-assignments",
  validateSearch: featureAssignmentsSearch,
  beforeLoad: ({ context, cause, search: { mode, ...shown } }) => {
    if (mode !== undefined) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's way to redirect
      throw redirect({
        to: "/capacity",
        search: { ...shown, mode: "people" },
        replace: true,
      });
    }
    opening("feature-assignments")({ context });
    openOnLastView(
      { context, search: shown, cause },
      shownOn("feature-assignments", shown),
    );
  },
  component: function FeatureAssignments() {
    const { permissions, access } = signedIn.useRouteContext();
    const navigate = featureAssignmentsRoute.useNavigate();
    return (
      <FeatureAssignmentsPage
        byManager={seesView("groupingByManager", access)}
        editsTeams={editsFeatureTeams(permissions)}
        changesDates={editsField(access, "featureTeamDates")}
        canShareViews={sharesViews("feature-assignments", permissions)}
        {...viewProps(featureAssignmentsRoute.useSearch(), (next, replace) => {
          void navigate({ search: next, replace });
        })}
      />
    );
  },
});
