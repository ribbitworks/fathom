// SPDX-License-Identifier: Apache-2.0

// Fathom's pages and how to reach them, with what each page's address holds.

import type { QueryClient } from "@tanstack/react-query";
import {
  allChartLevels,
  approvableKinds,
  changesField,
  changesHiringPlan,
  changesLinesOn,
  chartLevelsSchema,
  daySchema,
  draftsTabSchema,
  editsColumnsOf,
  editsField,
  historySearchLength,
  opensWith,
  pageNeeds,
  parseRecordKey,
  parseRecordLink,
  personLengths,
  reaches,
  seesEmployment,
  seesHiringPlan,
  seesView,
  sharesViews,
  showSchema,
} from "@fathom/shared";
import { Anchor } from "@mantine/core";
import {
  createRoute,
  createRouter,
  getRouteApi,
  Link,
  notFound,
  type RouterHistory,
  redirect,
} from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import { AccountsPage } from "./accounts-page.tsx";
import { RecordNotShown } from "./go-page.tsx";
import { HelpPageView } from "./help-page.tsx";
import { helpIndexPage, shownHelpPage } from "./help-pages.ts";
import { ChangeHistoryPage } from "./change-history-page.tsx";
import { draftsSeen } from "./draft-reading.ts";
import { shownPlace } from "./draft-places.ts";
import { DraftsPage } from "./drafts-page.tsx";
import { HistoryPage } from "./history-page.tsx";
import { Home } from "./home.tsx";
import { firstPage } from "./layout.tsx";
import { ListsPage } from "./lists-page.tsx";
import { listKindSchema } from "./lists.ts";
import { OrgChartPage } from "./org-chart-page.tsx";
import {
  chartAddressOf,
  chartChoiceKeys,
  type ChartSearch,
  chartViewSearch,
} from "./org-chart.ts";
import { SettingsPage } from "./settings-page.tsx";
import { DataClassesPage } from "./data-classes-page.tsx";
import { shownDay, today } from "./today.ts";
import { PeoplePage } from "./people-page.tsx";
import {
  capacityRoute,
  featureAssignmentsRoute,
  featuresRoute,
  projectsRoute,
  releasesRoute,
} from "./plan-routes.tsx";
import { followLink } from "./record-links.ts";
import { ServerProblem } from "./problems.tsx";
import { RolesPage } from "./roles-page.tsx";
import {
  editsFeatureTeams,
  fathomIdLength,
  linkedColumnSearch,
  openOnLastView,
  reaching,
  rootRoute,
  shownOn,
  signedIn,
  signedInRoute,
  useLinkedColumn,
} from "./signed-in-route.tsx";
import { SignIn } from "./sign-in.tsx";
import { viewProps, viewSearchSchema } from "./table-view.ts";

const people = getRouteApi("/signed-in/people");

// The org chart's address: the person found on it, by Employee ID, or by Fathom's own ID for a
// planned hire; the manager whose team alone is shown, by Fathom's own ID, or by Employee ID in an
// address made before; what the Draft menu shows; the person whose details are shown beside it;
// and the saved view the chart's view started from. An address from before feature teams were
// named `teams` still opens on them.
const chartAddressLength = Math.max(personLengths.employeeId, fathomIdLength);
const oldFeatureTeams = "feature-teams";
const chartSearch = z
  .object({
    person: z.string().max(chartAddressLength).optional().catch(undefined),
    team: z.string().max(chartAddressLength).optional().catch(undefined),
    show: showSchema.optional().catch(undefined),
    open: z.string().max(personLengths.employeeId).optional().catch(undefined),
    // Which teams the chart draws: managers' teams, or, when chosen, feature teams.
    teams: z.literal("feature").optional().catch(undefined),
    // The levels shown, when not the two the chart opens on.
    levels: z
      .union([
        z.literal(allChartLevels),
        z
          .number()
          .refine(
            (count) => chartLevelsSchema.safeParse(String(count)).success,
          ),
      ])
      .optional()
      .catch(undefined),
    view: z
      .union([z.uuid(), z.literal(oldFeatureTeams)])
      .optional()
      .catch(undefined),
    // The feature team whose details are shown beside the chart.
    featureTeam: z.uuid().optional().catch(undefined),
    // The day the chart is drawn as of, when not today.
    day: daySchema.optional().catch(undefined),
  })
  .transform(({ view, teams, ...search }): ChartSearch => ({
    ...search,
    teams: view === oldFeatureTeams ? "feature" : teams,
    view: view === oldFeatureTeams ? undefined : view,
  }));

// The Overview, for those who may see the plan. Anyone else is sent to the first page their role
// lets them open, or, with none, to Help's index.
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
    throw redirect({ to: firstPage(context.access) ?? "/help", replace: true });
  },
  component: Home,
});

// The Accounts page's address: the table's view, and the account whose details are shown beside it.
const accountsSearch = viewSearchSchema.extend({
  open: z.uuid().optional().catch(undefined),
});

const accountsRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/accounts",
  validateSearch: accountsSearch,
  beforeLoad: (match) => {
    reaching("accounts")(match);
    openOnLastView(match, shownOn("accounts", match.search));
  },
  component: function Accounts() {
    const { user, permissions } = signedIn.useRouteContext();
    const navigate = accountsRoute.useNavigate();
    const { open, ...search } = accountsRoute.useSearch();
    return (
      <AccountsPage
        user={user}
        canManage={permissions.includes("administration:edit")}
        canShareViews={sharesViews("accounts", permissions)}
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

// The Roles page's address: only a role a link opens, which the page takes out once its dialog is
// open.
const rolesSearch = z.object({
  open: z.uuid().optional().catch(undefined),
});

const rolesRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/roles",
  validateSearch: rolesSearch,
  beforeLoad: reaching("roles"),
  component: function Roles() {
    const { user, permissions, access } = signedIn.useRouteContext();
    const { open } = rolesRoute.useSearch();
    const navigate = rolesRoute.useNavigate();
    return (
      <RolesPage
        user={user}
        canEdit={permissions.includes("administration:edit")}
        dataClasses={access.dataClasses}
        linked={open}
        onLinkedOpened={() => {
          void navigate({ search: {}, replace: true });
        }}
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

// Drafts, for those who see the data they change, with the table's view in the address, its tab,
// and the draft whose details are shown beside it; Approvers approve and reject here those of the
// areas their role approves.
const draftRowLength = 100;
const draftsSearch = viewSearchSchema.extend({
  tab: draftsTabSchema.optional().catch(undefined),
  open: z.string().max(draftRowLength).optional().catch(undefined),
});

const draftsRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/drafts",
  validateSearch: draftsSearch,
  beforeLoad: (match) => {
    reaching("drafts")(match);
    openOnLastView(match, shownOn("drafts", match.search, ["tab"]));
  },
  component: function Drafts() {
    const { permissions, access } = signedIn.useRouteContext();
    const navigate = draftsRoute.useNavigate();
    const { open, ...search } = draftsRoute.useSearch();
    return (
      <DraftsPage
        {...draftsSeen(permissions)}
        canShareViews={sharesViews("drafts", permissions)}
        {...viewProps(
          search,
          (next, replace) => {
            // A draft's details stay open while its tab does.
            const kept = next.tab === search.tab ? open : undefined;
            void navigate({ search: { ...next, open: kept }, replace });
          },
          ["tab"],
        )}
        open={open}
        onOpen={(next, replace = false) => {
          void navigate({ search: { ...search, open: next }, replace });
        }}
        recordLink={(place) => {
          const { pageName, needs, address } = shownPlace(place);
          return (
            opensWith(needs, access) && (
              <Anchor
                size="sm"
                renderRoot={(props) => <Link {...props} {...address} />}
              >
                Show on {pageName}
              </Anchor>
            )
          );
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

// People's address: its view, and the person whose details are shown beside it, by Employee ID.
const peopleSearch = viewSearchSchema.extend({
  column: linkedColumnSearch,
  open: z.string().max(personLengths.employeeId).optional().catch(undefined),
  day: daySchema.optional().catch(undefined),
});

const peopleRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/people",
  validateSearch: peopleSearch,
  beforeLoad: (match) => {
    reaching("people")(match);
    openOnLastView(match, shownOn("people", match.search));
  },
  component: function People() {
    const { permissions, access } = signedIn.useRouteContext();
    const navigate = people.useNavigate();
    const {
      open,
      note,
      tableNote,
      day: asked,
      column,
      ...search
    } = people.useSearch();
    const notes = { note, tableNote };
    const linkedColumn = useLinkedColumn(column, () => {
      void navigate({
        search: (shown) => ({ ...shown, column: undefined }),
        replace: true,
      });
    });
    const otherDates = seesView("orgChartOtherDates", access);
    const futureDates = seesView("orgChartFutureDates", access);
    const day = shownDay(asked, { otherDates, futureDates });
    // Columns and planned hires are changed on today alone; people's managers change from another
    // day too, for roles that may date a change then.
    const onToday = day === undefined;
    return (
      <PeoplePage
        linkedColumn={linkedColumn}
        canEdit={permissions.includes("people:edit")}
        canEditHires={
          onToday &&
          permissions.includes("people:edit") &&
          changesHiringPlan(access)
        }
        approves={approvableKinds(permissions)}
        canEditColumns={onToday && editsColumnsOf(permissions, "people")}
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
          void navigate({ search: { ...next, open, ...notes, day }, replace });
        })}
        open={open}
        seesFeatureTeams={permissions.includes("feature-teams:view")}
        access={access}
        onOpen={(next, replace = false) => {
          void navigate({
            search: { ...search, day, open: next, ...notes },
            replace,
          });
        }}
      />
    );
  },
});

const orgChartRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/org-chart",
  validateSearch: chartSearch,
  beforeLoad: (match) => {
    reaching("org-chart")(match);
    openOnLastView(
      match,
      shownOn("org-chart", chartViewSearch(match.search), chartChoiceKeys),
      chartAddressOf,
    );
  },
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
        canShareViews={sharesViews("org-chart", permissions)}
        search={orgChartRoute.useSearch()}
        onSearch={(search, replace) => {
          void navigate({ search, replace });
        }}
      />
    );
  },
});

// Help's index, open to every signed-in user, whatever their role.
const helpIndexRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/help",
  component: function HelpIndex() {
    return <HelpPageView page={helpIndexPage} />;
  },
});

// A Help page, open to every signed-in user, whatever their role; the index has its own address.
const helpRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/help/$page",
  loader: ({ params }) => {
    const page = shownHelpPage(params.page);
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's way to say so
    if (page === undefined) throw notFound();
    return page;
  },
  component: function Help() {
    return <HelpPageView page={helpRoute.useLoaderData()} />;
  },
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

const goLinkRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/go/$kind/$keyNumber",
  loader: async ({ context, params }) =>
    followLink(
      context.queryClient,
      parseRecordLink(params.kind, params.keyNumber),
      `#${params.kind.toUpperCase()}-${params.keyNumber}`,
    ),
  component: function GoLink() {
    return <RecordNotShown {...goLinkRoute.useLoaderData()} />;
  },
});

const goKeyRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/go/$key",
  loader: async ({ context, params }) =>
    followLink(context.queryClient, parseRecordKey(params.key), params.key),
  component: function GoKey() {
    return <RecordNotShown {...goKeyRoute.useLoaderData()} />;
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
    helpIndexRoute,
    helpRoute,
    goLinkRoute,
    goKeyRoute,
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
