// SPDX-License-Identifier: Apache-2.0

// Fathom's pages and how to reach them. Every page but the sign-in page needs a signed-in user;
// anyone else is sent to sign in, then brought back. A user signed in with a password Fathom
// generated sees only the page that changes it, at the start page's address. An address that names
// no page, or a server that cannot be reached, gets a page that says so.

import type { QueryClient } from "@tanstack/react-query";
import {
  approvableKinds,
  changesField,
  historySearchLength,
  editsField,
  seesEmployment,
  seesView,
  whyMissing,
  type Permission,
  personLengths,
  showSchema,
  daySchema,
} from "@fathom/shared";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  getRouteApi,
  notFound,
  type RouterHistory,
  redirect,
} from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import { AccountsPage } from "./accounts-page.tsx";
import { FirstPasswordChange } from "./change-password.tsx";
import { DraftsHelpPage, RolesHelpPage } from "./help-page.tsx";
import { ChangeHistoryPage } from "./change-history-page.tsx";
import { DraftsPage } from "./drafts-page.tsx";
import { HistoryPage } from "./history-page.tsx";
import { Home } from "./home.tsx";
import { firstPage, Layout } from "./layout.tsx";
import { ListsPage } from "./lists-page.tsx";
import { listKindSchema } from "./lists.ts";
import {
  FeatureAssignmentsPage,
  type GridMode,
  gridModeSchema,
} from "./feature-assignments-page.tsx";
import { OrgChartPage } from "./org-chart-page.tsx";
import { CapacityPage, capacityTabSchema } from "./capacity-page.tsx";
import { SettingsPage } from "./settings-page.tsx";
import { DataClassesPage } from "./data-classes-page.tsx";
import { setTimeZone } from "./today.ts";
import { ReleasesPage } from "./releases-page.tsx";
import { PeoplePage } from "./people-page.tsx";
import { ProjectsPage, projectTabSchema } from "./projects-page.tsx";
import { featureNamers, type PlanTab } from "./projects.ts";
import { PageNotFound, ServerProblem } from "./problems.tsx";
import { RolesPage } from "./roles-page.tsx";
import { sessionQuery } from "./session.ts";
import { SignIn } from "./sign-in.tsx";
import { searchFor, viewProps, viewSearchSchema } from "./table-view.ts";

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  notFoundComponent: PageNotFound,
});

// The signed-in user and their permissions, as the signed-in routes check them below.
const signedIn = getRouteApi("/signed-in");
const people = getRouteApi("/signed-in/people");

// The org chart's address: the person found on it, and the manager whose team alone is shown, each
// by Employee ID, or by Fathom's own ID for readers who do not see people, what the Draft menu
// shows, and the person whose details are shown beside it.
const fathomIdLength = 36;
const chartAddressLength = Math.max(personLengths.employeeId, fathomIdLength);
const chartSearch = z.object({
  person: z.string().max(chartAddressLength).optional().catch(undefined),
  team: z.string().max(chartAddressLength).optional().catch(undefined),
  show: showSchema.optional().catch(undefined),
  open: z.string().max(personLengths.employeeId).optional().catch(undefined),
  // Which teams the chart draws: managers' teams, or, when chosen, feature teams.
  view: z.literal("feature-teams").optional().catch(undefined),
  // The feature team whose details are shown beside the chart.
  featureTeam: z.uuid().optional().catch(undefined),
  // The day the chart is drawn as of, when not today.
  day: daySchema.optional().catch(undefined),
});

// Pages only for users with a permission; anyone else is told there is no such page.
function requiring(...permissions: Permission[]) {
  return ({ context }: { context: { permissions: Permission[] } }) => {
    if (!permissions.some((one) => context.permissions.includes(one))) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's way to say so
      throw notFound();
    }
  };
}

const signedInRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "signed-in",
  beforeLoad: async ({ context, location }) => {
    // Checked afresh on every change of page, so an expired session is noticed.
    const session = await context.queryClient.query(sessionQuery);
    if (session === null) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's way to redirect
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
    if (session.mustChangePassword && location.pathname !== "/") {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's way to redirect
      throw redirect({ to: "/", replace: true });
    }
    // Every page works out today in Fathom's time zone, as the session has it now.
    setTimeZone(session.settings.timeZone);
    return {
      user: session.user,
      role: session.role,
      roles: session.roles,
      permissions: session.permissions,
      access: {
        permissions: session.permissions,
        dataClasses: session.settings.dataClasses,
      },
      mustChangePassword: session.mustChangePassword,
      timeZone: session.settings.timeZone,
      passwords: session.settings.passwords,
    };
  },
  component: function SignedIn() {
    const { user, role, roles, permissions, mustChangePassword, passwords } =
      signedIn.useRouteContext();
    if (mustChangePassword) {
      return <FirstPasswordChange rules={passwords.rules} owner={user} />;
    }
    return (
      <Layout
        user={user}
        role={role}
        roles={roles}
        permissions={permissions}
        passwordRules={passwords.rules}
      />
    );
  },
});

// The Overview, for those who may see the plan. Anyone else is sent to the first page their role
// lets them open, or, with none, to Help's Roles page.
const homeRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/",
  beforeLoad: ({ context }) => {
    if (context.mustChangePassword || context.permissions.includes("plan:view"))
      return;
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's way to redirect
    throw redirect({
      to: firstPage(context.permissions) ?? "/help/roles",
      replace: true,
    });
  },
  component: Home,
});

const accountsRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/accounts",
  beforeLoad: requiring("accounts:view"),
  component: function Accounts() {
    const { user, permissions } = signedIn.useRouteContext();
    return (
      <AccountsPage
        user={user}
        canManage={permissions.includes("accounts:manage")}
        canEditRoles={permissions.includes("roles:edit")}
      />
    );
  },
});

const rolesRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/roles",
  beforeLoad: requiring("roles:view"),
  component: function Roles() {
    const { user, permissions } = signedIn.useRouteContext();
    return (
      <RolesPage user={user} canEdit={permissions.includes("roles:edit")} />
    );
  },
});

const dataClassesRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/data-classes",
  beforeLoad: requiring("data:classify"),
  component: function DataClasses() {
    const { access } = signedIn.useRouteContext();
    return <DataClassesPage access={access} />;
  },
});

const settingsRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/settings",
  beforeLoad: requiring("settings:view"),
  component: function Settings() {
    const { timeZone, passwords, permissions } = signedIn.useRouteContext();
    return (
      <SettingsPage
        timeZone={timeZone}
        passwords={passwords}
        canEdit={permissions.includes("settings:edit")}
      />
    );
  },
});

// A history page's search, kept in the address; one too long, as a hand-edited address might
// have, is ignored.
const historySearch = z.object({
  search: z.string().max(historySearchLength).optional().catch(undefined),
});

const changesRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/changes",
  validateSearch: historySearch,
  beforeLoad: requiring("changes:view"),
  component: function Changes() {
    const navigate = changesRoute.useNavigate();
    return (
      <ChangeHistoryPage
        search={changesRoute.useSearch().search ?? ""}
        onSearch={(search, replace) => {
          void navigate({ search: { search: search || undefined }, replace });
        }}
      />
    );
  },
});

// Drafts, for those who see the data they change, with their search in the address; Approvers
// approve and reject here those of the areas their role approves.
const draftsRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/drafts",
  validateSearch: historySearch,
  beforeLoad: requiring("people:view", "configuration:view", "plan:view"),
  component: function Drafts() {
    const { permissions } = signedIn.useRouteContext();
    const navigate = draftsRoute.useNavigate();
    return (
      <DraftsPage
        approves={approvableKinds(permissions)}
        seesPeople={permissions.includes("people:view")}
        seesLists={
          permissions.includes("people:view") ||
          permissions.includes("configuration:view")
        }
        seesPlan={
          permissions.includes("plan:view") ||
          permissions.includes("configuration:view")
        }
        seesTeams={
          permissions.includes("org-chart:view") &&
          permissions.includes("people:view")
        }
        seesProjects={permissions.includes("plan:view")}
        search={draftsRoute.useSearch().search ?? ""}
        onSearch={(search, replace) => {
          void navigate({ search: { search: search || undefined }, replace });
        }}
      />
    );
  },
});

const historyRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/history",
  validateSearch: historySearch,
  beforeLoad: requiring("history:view"),
  component: function AccessHistory() {
    const navigate = historyRoute.useNavigate();
    return (
      <HistoryPage
        search={historyRoute.useSearch().search ?? ""}
        onSearch={(search, replace) => {
          void navigate({ search: { search: search || undefined }, replace });
        }}
      />
    );
  },
});

// The Lists page, with the list in the address, if any, open in its side panel. One route, so
// opening and closing the panel keeps the rest of the page as it was.
const listsRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/lists/{-$listId}",
  validateSearch: z.object({
    show: showSchema.optional().catch(undefined),
    search: z.string().max(historySearchLength).optional().catch(undefined),
    kind: listKindSchema.exclude(["all"]).optional().catch(undefined),
  }),
  beforeLoad: requiring("configuration:view"),
  component: function Lists() {
    const { permissions } = signedIn.useRouteContext();
    const navigate = listsRoute.useNavigate();
    const { show, search, kind } = listsRoute.useSearch();
    return (
      <ListsPage
        listId={listsRoute.useParams().listId}
        canEdit={permissions.includes("configuration:edit")}
        approves={approvableKinds(permissions)}
        seesPeople={permissions.includes("people:view")}
        permissions={permissions}
        show={show ?? "both"}
        search={search ?? ""}
        kind={kind ?? "all"}
        onShow={(next) => {
          void navigate({
            search: { show: next === "both" ? undefined : next, search, kind },
            replace: true,
          });
        }}
        onSearch={(next, replace) => {
          void navigate({
            search: { show, search: next === "" ? undefined : next, kind },
            replace,
          });
        }}
        onKind={(next) => {
          void navigate({
            search: { show, search, kind: next === "all" ? undefined : next },
            replace: true,
          });
        }}
      />
    );
  },
});

// Release streams, with their cycles and releases, seen with the plan or planning configuration,
// with the stream in the address, if any, open in its side panel.
const releasesRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/releases/{-$streamId}",
  validateSearch: z.object({
    show: showSchema.optional().catch(undefined),
  }),
  beforeLoad: requiring("plan:view", "configuration:view"),
  component: function Releases() {
    const { permissions } = signedIn.useRouteContext();
    const navigate = releasesRoute.useNavigate();
    const { show } = releasesRoute.useSearch();
    return (
      <ReleasesPage
        streamId={releasesRoute.useParams().streamId}
        approves={approvableKinds(permissions)}
        show={show ?? "both"}
        onShow={(next) => {
          void navigate({
            search: { show: next === "both" ? undefined : next },
            replace: true,
          });
        }}
      />
    );
  },
});

const capacityRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/capacity",
  validateSearch: z.object({
    tab: capacityTabSchema.optional().catch(undefined),
  }),
  beforeLoad: requiring("configuration:view"),
  component: function Capacity() {
    const { permissions } = signedIn.useRouteContext();
    const navigate = capacityRoute.useNavigate();
    const { tab } = capacityRoute.useSearch();
    return (
      <CapacityPage
        tab={tab ?? "settings"}
        onTab={(next) => {
          void navigate({ search: { tab: next } });
        }}
        canEditSettings={permissions.includes("configuration:edit")}
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

// The Projects page's address for a tab, with a record's details open if one is named.
const projectsTabSearch = (
  next: z.infer<typeof projectTabSchema>,
  record?: string,
) => ({
  ...(next === "projects" ? {} : { tab: next }),
  ...(record === undefined ? {} : { open: record }),
});

// The address of one of the plan's pages or tabs, with a record's details open if one is named.
const planAddress = (next: PlanTab, record?: string) =>
  next === "features"
    ? { to: "/features" as const, search: { open: record } }
    : { to: "/projects" as const, search: projectsTabSearch(next, record) };

const featuresRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/features",
  validateSearch: planRecordSearch,
  beforeLoad: requiring("plan:view"),
  component: function Features() {
    const { permissions } = signedIn.useRouteContext();
    const navigate = featuresRoute.useNavigate();
    const { open, ...search } = featuresRoute.useSearch();
    return (
      <ProjectsPage
        tab="features"
        canEditColumns={permissions.includes("configuration:edit")}
        onTab={(next, record) => {
          void navigate(planAddress(next, record));
        }}
        onReleaseStream={(streamId) => {
          void navigate({ to: "/releases/{-$streamId}", params: { streamId } });
        }}
        approves={approvableKinds(permissions)}
        {...viewProps(search, (next, replace) => {
          void navigate({ search: { ...next, open }, replace });
        })}
        open={open}
        onOpen={(next) => {
          void navigate({ search: { ...search, open: next } });
        }}
      />
    );
  },
});

const projectsRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/projects",
  validateSearch: projectsSearch,
  beforeLoad: requiring("plan:view"),
  component: function Projects() {
    const { permissions } = signedIn.useRouteContext();
    const navigate = projectsRoute.useNavigate();
    const { tab, open, ...search } = projectsRoute.useSearch();
    return (
      <ProjectsPage
        tab={tab ?? "projects"}
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

// People's address: its view, and the person whose details are shown beside it, by Employee ID.
const peopleSearch = viewSearchSchema.extend({
  open: z.string().max(personLengths.employeeId).optional().catch(undefined),
});

const peopleRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/people",
  validateSearch: peopleSearch,
  beforeLoad: requiring("people:view"),
  component: function People() {
    const { permissions, access } = signedIn.useRouteContext();
    const navigate = people.useNavigate();
    const { open, ...search } = people.useSearch();
    return (
      <PeoplePage
        canEdit={permissions.includes("people:edit")}
        canEditHires={
          permissions.includes("people:edit") &&
          permissions.includes("hiring-plan:edit")
        }
        approves={approvableKinds(permissions)}
        canEditColumns={permissions.includes("configuration:edit")}
        showDates={seesEmployment(access)}
        showHireDates={permissions.includes("hiring-plan:view")}
        {...viewProps(search, (next, replace) => {
          void navigate({ search: { ...next, open }, replace });
        })}
        open={open}
        seesChart={permissions.includes("org-chart:view")}
        access={access}
        onOpen={(next, replace = false) => {
          void navigate({ search: { ...search, open: next }, replace });
        }}
      />
    );
  },
});

// Whether a role may draft changes to feature teams, which needs seeing the people on them.
const proposesFeatureTeams = (permissions: readonly string[]) =>
  permissions.includes("people:view") &&
  (permissions.includes("feature-teams:propose") ||
    permissions.includes("feature-teams:edit"));

const orgChartRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/org-chart",
  validateSearch: chartSearch,
  beforeLoad: requiring("org-chart:view"),
  component: function OrgChart() {
    const { permissions, access } = signedIn.useRouteContext();
    const navigate = orgChartRoute.useNavigate();
    const teamEdits = useMemo(
      () => ({
        names: permissions.includes("people:edit"),
        colours: permissions.includes("team-colours:edit"),
      }),
      [permissions],
    );
    const featureTeamEdits = useMemo(
      () => ({
        propose: proposesFeatureTeams(permissions),
        rename: proposesFeatureTeams(permissions),
        remove:
          permissions.includes("people:view") &&
          permissions.includes("feature-teams:edit"),
        colours: permissions.includes("team-colours:edit"),
        dates: editsField(access, "featureTeamDates"),
      }),
      [permissions, access],
    );
    return (
      <OrgChartPage
        seesPeople={permissions.includes("people:view")}
        showDates={seesEmployment(access)}
        whyNoOtherDates={whyMissing("orgChartOtherDates", access)}
        whyNoFutureDates={whyMissing("orgChartFutureDates", access)}
        canEdit={permissions.includes("people:edit")}
        changesDates={changesField(access, "managerHistory")}
        teamEdits={teamEdits}
        featureTeamEdits={featureTeamEdits}
        search={orgChartRoute.useSearch()}
        onSearch={(search, replace) => {
          void navigate({ search, replace });
        }}
      />
    );
  },
});

// The Feature assignments page's address adds the grid's mode, Teams unless Allocations is named.
const featureAssignmentsSearch = viewSearchSchema.extend({
  mode: gridModeSchema.optional().catch(undefined),
});

const featureAssignmentsRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/feature-assignments",
  validateSearch: featureAssignmentsSearch,
  beforeLoad: requiring("org-chart:view"),
  component: function FeatureAssignments() {
    const { permissions, access } = signedIn.useRouteContext();
    const navigate = featureAssignmentsRoute.useNavigate();
    const { mode = "teams", ...search } = featureAssignmentsRoute.useSearch();
    const seesAllocations =
      permissions.includes("allocations:view") &&
      seesView("allocations", access);
    const kept = (next: GridMode) =>
      seesAllocations && next === "allocations" ? { mode: next } : {};
    const { view, onView } = viewProps(search, (next, replace) => {
      void navigate({ search: { ...next, ...kept(mode) }, replace });
    });
    return (
      <FeatureAssignmentsPage
        whyMissing={whyMissing("featureAssignments", access)}
        whyNoManagerGrouping={whyMissing("groupingByManager", access)}
        seesAllocations={seesAllocations}
        proposesTeams={proposesFeatureTeams(permissions)}
        changesDates={editsField(access, "featureTeamDates")}
        mode={mode}
        onMode={(next, nextView) => {
          void navigate({ search: { ...searchFor(nextView), ...kept(next) } });
        }}
        view={view}
        onView={onView}
      />
    );
  },
});

// What each role allows, open to every signed-in user, whatever their role.
const helpRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/help/roles",
  component: function RolesHelp() {
    return <RolesHelpPage role={signedIn.useRouteContext().role} />;
  },
});

// Open to every signed-in user, whatever their role.
const draftsHelpRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/help/drafts",
  component: DraftsHelpPage,
});

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  // A redirect that is not text, as a hand-edited address might have, is ignored.
  validateSearch: z.object({
    redirect: z.string().optional().catch(undefined),
    idle: z.boolean().optional().catch(undefined),
  }),
  component: function SignInPage() {
    const { redirect, idle } = signInRoute.useSearch();
    return <SignIn redirect={redirect} idle={idle === true} />;
  },
});

const routeTree = rootRoute.addChildren([
  signedInRoute.addChildren([
    homeRoute,
    accountsRoute,
    rolesRoute,
    settingsRoute,
    dataClassesRoute,
    historyRoute,
    changesRoute,
    listsRoute,
    releasesRoute,
    projectsRoute,
    featuresRoute,
    peopleRoute,
    orgChartRoute,
    capacityRoute,
    featureAssignmentsRoute,
    draftsRoute,
    helpRoute,
    draftsHelpRoute,
  ]),
  signInRoute,
]);

export function createAppRouter(
  queryClient: QueryClient,
  history: RouterHistory,
) {
  return createRouter({
    routeTree,
    context: { queryClient },
    history,
    defaultErrorComponent: ServerProblem,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
