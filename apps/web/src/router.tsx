// SPDX-License-Identifier: Apache-2.0

// Fathom's pages and how to reach them. Every page but the sign-in page needs a signed-in user;
// anyone else is sent to sign in, then brought back. A user signed in with a password Fathom
// generated sees only the page that changes it, at the start page's address. An address that names
// no page, or a server that cannot be reached, gets a page that says so.

import type { QueryClient } from "@tanstack/react-query";
import {
  approvableKinds,
  type ClassAccess,
  changesField,
  changesLinesOn,
  changesHiringPlan,
  type GuardedPage,
  historySearchLength,
  editsField,
  opensWith,
  pageNeeds,
  reaches,
  seesEmployment,
  seesHiringPlan,
  type Permission,
  personLengths,
  seesView,
  sharesViews,
  showSchema,
  daySchema,
  cardPartSchema,
  planModeSchema,
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
import { draftsSeen } from "./draft-entries.ts";
import { DraftsPage } from "./drafts-page.tsx";
import { HistoryPage } from "./history-page.tsx";
import { Home } from "./home.tsx";
import { firstPage, Layout } from "./layout.tsx";
import { ListsPage } from "./lists-page.tsx";
import { listKindSchema } from "./lists.ts";
import { FeatureAssignmentsPage } from "./feature-assignments-page.tsx";
import { OrgChartPage } from "./org-chart-page.tsx";
import { CapacityPage } from "./capacity-page.tsx";
import {
  capacityModeSchema,
  capacityModes,
  shownCapacityMode,
} from "./capacity.ts";
import { SettingsPage } from "./settings-page.tsx";
import { DataClassesPage } from "./data-classes-page.tsx";
import { setTimeZone, shownDay, today } from "./today.ts";
import { ReleasesPage } from "./releases-page.tsx";
import { PeoplePage } from "./people-page.tsx";
import { ProjectsPage, projectTabSchema } from "./projects-page.tsx";
import { featureNamers, type PlanTab } from "./projects.ts";
import { PageNotFound, ServerProblem } from "./problems.tsx";
import { RolesPage } from "./roles-page.tsx";
import { sessionQuery } from "./session.ts";
import { SignIn } from "./sign-in.tsx";
import { viewProps, viewSearchSchema } from "./table-view.ts";

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

// Pages only for users whose access opens them; anyone else is told there is no such page.
function opening(page: GuardedPage) {
  return ({ context }: { context: { access: ClassAccess } }) => {
    // The page is always one of the fixed pages.
    // eslint-disable-next-line security/detect-object-injection
    if (!opensWith(pageNeeds[page], context.access)) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's way to say so
      throw notFound();
    }
  };
}

// Pages only for users with a permission that would open them; anyone else is told there is no such
// page.
function reaching(page: GuardedPage) {
  return ({ context }: { context: { permissions: Permission[] } }) => {
    // The page is always one of the fixed pages.
    // eslint-disable-next-line security/detect-object-injection
    if (!reaches(pageNeeds[page], context.permissions)) {
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
    const {
      user,
      role,
      roles,
      permissions,
      access,
      mustChangePassword,
      passwords,
    } = signedIn.useRouteContext();
    if (mustChangePassword) {
      return <FirstPasswordChange rules={passwords.rules} owner={user} />;
    }
    return (
      <Layout
        user={user}
        role={role}
        roles={roles}
        permissions={permissions}
        dataClasses={access.dataClasses}
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
    if (
      context.mustChangePassword ||
      reaches(pageNeeds.overview, context.permissions)
    )
      return;
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's way to redirect
    throw redirect({
      to: firstPage(context.access) ?? "/help/roles",
      replace: true,
    });
  },
  component: Home,
});

const accountsRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/accounts",
  beforeLoad: reaching("accounts"),
  component: function Accounts() {
    const { user, permissions } = signedIn.useRouteContext();
    return (
      <AccountsPage
        user={user}
        canManage={permissions.includes("administration:edit")}
      />
    );
  },
});

const rolesRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/roles",
  beforeLoad: reaching("roles"),
  component: function Roles() {
    const { user, permissions, access } = signedIn.useRouteContext();
    return (
      <RolesPage
        user={user}
        canEdit={permissions.includes("administration:edit")}
        dataClasses={access.dataClasses}
      />
    );
  },
});

const dataClassesRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/data-classes",
  beforeLoad: reaching("data-classes"),
  component: function DataClasses() {
    const { access } = signedIn.useRouteContext();
    return <DataClassesPage access={access} />;
  },
});

const settingsRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/settings",
  beforeLoad: reaching("settings"),
  component: function Settings() {
    const { timeZone, passwords, permissions } = signedIn.useRouteContext();
    return (
      <SettingsPage
        timeZone={timeZone}
        passwords={passwords}
        canEdit={permissions.includes("administration:edit")}
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
  beforeLoad: reaching("changes"),
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
  beforeLoad: reaching("drafts"),
  component: function Drafts() {
    const { permissions } = signedIn.useRouteContext();
    const navigate = draftsRoute.useNavigate();
    return (
      <DraftsPage
        {...draftsSeen(permissions)}
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
  beforeLoad: reaching("history"),
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
  beforeLoad: reaching("lists"),
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
// with the table's view in the address, and the stream in the address, if any, open in its side
// panel.
const releasesRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/releases/{-$streamId}",
  validateSearch: viewSearchSchema,
  beforeLoad: reaching("releases"),
  component: function Releases() {
    const { permissions } = signedIn.useRouteContext();
    const navigate = releasesRoute.useNavigate();
    return (
      <ReleasesPage
        streamId={releasesRoute.useParams().streamId}
        approves={approvableKinds(permissions)}
        canShareViews={sharesViews("release-streams", permissions)}
        {...viewProps(releasesRoute.useSearch(), (next, replace) => {
          void navigate({ search: next, replace });
        })}
      />
    );
  },
});

// The Capacity page's address: its mode, and People's view.
const capacitySearch = viewSearchSchema.extend({
  mode: capacityModeSchema.optional().catch(undefined),
});

const capacityRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/capacity",
  validateSearch: capacitySearch,
  beforeLoad: opening("capacity"),
  component: function Capacity() {
    const { permissions, access } = signedIn.useRouteContext();
    const navigate = capacityRoute.useNavigate();
    const { mode: asked, ...search } = capacityRoute.useSearch();
    const mode = shownCapacityMode(asked, access);
    // The address keeps the mode shown, not one asked for that the role doesn't see.
    const kept = asked === undefined ? {} : { mode };
    const { view, onView } = viewProps(search, (next, replace) => {
      void navigate({ search: { ...next, ...kept }, replace });
    });
    return (
      <CapacityPage
        modes={capacityModes(access)}
        mode={mode}
        onMode={(next) => {
          void navigate({ search: { mode: next } });
        }}
        byManager={seesView("groupingByManager", access)}
        view={view}
        onView={onView}
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

// Features' address adds whether it shows a board, and the board's stream, the cycle it starts from,
// and the parts of its cards hidden.
const featuresSearch = planRecordSearch.extend({
  mode: planModeSchema.optional().catch(undefined),
  stream: z.uuid().optional().catch(undefined),
  from: daySchema.optional().catch(undefined),
  hide: z.array(cardPartSchema).optional().catch(undefined),
});

const featuresRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/features",
  validateSearch: featuresSearch,
  beforeLoad: reaching("features"),
  component: function Features() {
    const { permissions } = signedIn.useRouteContext();
    const navigate = featuresRoute.useNavigate();
    // Table or Board, and the cycle the Board starts from, are kept in the address but not the
    // view, which the table and the Board share.
    const { open, mode, from, ...search } = featuresRoute.useSearch();
    const { stream, hide } = search;
    return (
      <ProjectsPage
        tab="features"
        canEditColumns={permissions.includes("configuration:edit")}
        canShareViews={sharesViews("features", permissions)}
        onTab={(next, record) => {
          void navigate(planAddress(next, record));
        }}
        onReleaseStream={(streamId) => {
          void navigate({ to: "/releases/{-$streamId}", params: { streamId } });
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

const projectsRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/projects",
  validateSearch: projectsSearch,
  beforeLoad: reaching("projects"),
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

// People's address: its view, and the person whose details are shown beside it, by Employee ID.
const peopleSearch = viewSearchSchema.extend({
  open: z.string().max(personLengths.employeeId).optional().catch(undefined),
  day: daySchema.optional().catch(undefined),
});

const peopleRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/people",
  validateSearch: peopleSearch,
  beforeLoad: reaching("people"),
  component: function People() {
    const { permissions, access } = signedIn.useRouteContext();
    const navigate = people.useNavigate();
    const { open, day: asked, ...search } = people.useSearch();
    const otherDates = seesView("orgChartOtherDates", access);
    const futureDates = seesView("orgChartFutureDates", access);
    const day = shownDay(asked, { otherDates, futureDates });
    // Columns and planned hires are changed on today alone; people's managers change from another
    // day too, for roles that may date a change then.
    const onToday = day === undefined;
    return (
      <PeoplePage
        canEdit={permissions.includes("people:edit")}
        canEditHires={
          onToday &&
          permissions.includes("people:edit") &&
          changesHiringPlan(access)
        }
        approves={approvableKinds(permissions)}
        canEditColumns={onToday && permissions.includes("configuration:edit")}
        dates={
          otherDates
            ? {
                day,
                laterDays: futureDates,
                changes:
                  day !== undefined && changesLinesOn(access, day, today()),
                onDay: (next) => {
                  void navigate({ search: { ...search, open, day: next } });
                },
              }
            : undefined
        }
        showDates={seesEmployment(access)}
        showHireDates={seesHiringPlan(access)}
        {...viewProps(search, (next, replace) => {
          void navigate({ search: { ...next, open, day }, replace });
        })}
        open={open}
        seesFeatureTeams={permissions.includes("feature-teams:view")}
        access={access}
        onOpen={(next, replace = false) => {
          void navigate({ search: { ...search, day, open: next }, replace });
        }}
      />
    );
  },
});

// Whether a role may draft changes to feature teams, which needs seeing the people on them.
const editsFeatureTeams = (permissions: readonly string[]) =>
  permissions.includes("people:view") &&
  permissions.includes("feature-teams:edit");

const orgChartRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/org-chart",
  validateSearch: chartSearch,
  beforeLoad: reaching("org-chart"),
  component: function OrgChart() {
    const { permissions, access } = signedIn.useRouteContext();
    const navigate = orgChartRoute.useNavigate();

    const featureTeamEdits = useMemo(
      () => ({
        members: editsFeatureTeams(permissions),
        undated: editsFeatureTeams(permissions),
        dates: editsField(access, "featureTeamDates"),
      }),
      [permissions, access],
    );
    return (
      <OrgChartPage
        showDates={seesEmployment(access)}
        otherDates={seesView("orgChartOtherDates", access)}
        futureDates={seesView("orgChartFutureDates", access)}
        canEdit={permissions.includes("people:edit")}
        changesDates={changesField(access, "managerHistory")}
        featureTeamEdits={featureTeamEdits}
        search={orgChartRoute.useSearch()}
        onSearch={(search, replace) => {
          void navigate({ search, replace });
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

const featureAssignmentsRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/feature-assignments",
  validateSearch: featureAssignmentsSearch,
  beforeLoad: ({ context, search: { mode, ...shown } }) => {
    if (mode !== undefined) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's way to redirect
      throw redirect({
        to: "/capacity",
        search: { ...shown, mode: "people" },
        replace: true,
      });
    }
    opening("feature-assignments")({ context });
  },
  component: function FeatureAssignments() {
    const { permissions, access } = signedIn.useRouteContext();
    const navigate = featureAssignmentsRoute.useNavigate();
    const { view, onView } = viewProps(
      featureAssignmentsRoute.useSearch(),
      (next, replace) => {
        void navigate({ search: next, replace });
      },
    );
    return (
      <FeatureAssignmentsPage
        byManager={seesView("groupingByManager", access)}
        editsTeams={editsFeatureTeams(permissions)}
        changesDates={editsField(access, "featureTeamDates")}
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
