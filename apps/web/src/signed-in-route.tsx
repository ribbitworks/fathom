// SPDX-License-Identifier: Apache-2.0

// The routes every page sits under, and what the pages' routes share: checking who may open a page,
// opening a page on its last view, taking a linked column out of the address, and an open note.

import type { QueryClient } from "@tanstack/react-query";
import {
  type ClassAccess,
  type GuardedPage,
  opensWith,
  pageNeeds,
  reaches,
  type Permission,
  viewPageOf,
  type ViewTable,
} from "@fathom/shared";
import {
  createRootRouteWithContext,
  createRoute,
  getRouteApi,
  notFound,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { FirstPasswordChange } from "./change-password.tsx";
import { Layout } from "./layout.tsx";
import {
  lastViewAddress,
  lastViewsQuery,
  menuChoiceSchema,
  opensLastView,
  type Shown,
} from "./last-views.ts";
import {
  noteSearch,
  type OpenNoteAddress,
  OpenNoteContext,
  TableNoteContext,
} from "./note-address.ts";
import { PageNotFound } from "./problems.tsx";
import type { LinkedColumn } from "./record-table.ts";
import { sessionQuery } from "./session.ts";
import { viewOfAddress, type ViewSearch } from "./table-view.ts";
import { setTimeZone } from "./today.ts";

export const rootRoute = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  notFoundComponent: PageNotFound,
});

// The signed-in user and their permissions, as the signed-in routes check them below.
export const signedIn = getRouteApi("/signed-in");

export const fathomIdLength = 36;

// Pages only for users whose access opens them; anyone else is told there is no such page.
export function opening(page: GuardedPage) {
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
export function reaching(page: GuardedPage) {
  return ({ context }: { context: { permissions: Permission[] } }) => {
    // The page is always one of the fixed pages.
    // eslint-disable-next-line security/detect-object-injection
    if (!reaches(pageNeeds[page], context.permissions)) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's way to say so
      throw notFound();
    }
  };
}

// Opens a page on its last view when its address names no view, before the page is drawn, so it
// isn't drawn first as it opens by default. The address keeps the view's choices, and a page's tab,
// under names of its own, which `addressOf` gives. The menu's mark is always taken out of the
// history, so going back to the page later shows what it showed then.
export function openOnLastView(
  {
    context,
    search,
    cause,
    location,
  }: {
    context: { queryClient: QueryClient };
    search: object;
    cause: string;
    location: { state: unknown };
  },
  shown: Shown,
  addressOf: (
    address: ViewSearch & Record<string, unknown>,
    table: ViewTable,
  ) => object = (address) => address,
): void {
  const fromMenu = menuChoiceSchema.safeParse(location.state).success;
  if (!opensLastView(cause, fromMenu)) return;
  const views = context.queryClient.getQueryData(lastViewsQuery.queryKey);
  const restored = lastViewAddress(shown, views?.[viewPageOf[shown.table]]);
  if (restored === undefined && !fromMenu) return;
  // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's way to redirect
  throw redirect({
    to: ".",
    search:
      restored === undefined
        ? search
        : { ...search, ...addressOf(restored.address, restored.table) },
    replace: true,
  });
}

// The view a page's address shows, as its last view is kept.
export const shownOn = <Search extends ViewSearch>(
  table: ViewTable,
  search: Search,
  choiceKeys: readonly (keyof Search & string)[] = [],
  mode?: string,
): Shown => ({
  table,
  view: viewOfAddress(search, choiceKeys),
  applied: search.view,
  mode,
});

export const signedInRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "signed-in",
  // The notes open beside any page, which every page keeps in its address.
  validateSearch: noteSearch,
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
    // Read before the first page shows, so it opens on its last view at once; without them, every
    // page opens on its default.
    await context.queryClient.query(lastViewsQuery).catch(() => undefined);
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
    const { note, tableNote } = signedIn.useSearch();
    const navigate = useNavigate();
    const openNote = useMemo(
      (): OpenNoteAddress => ({
        note,
        onNote: (next, replace) => {
          void navigate({
            to: ".",
            search: (shown) => ({ ...shown, note: next }),
            replace,
          });
        },
      }),
      [note, navigate],
    );
    const tableNoteAddress = useMemo(
      (): OpenNoteAddress => ({
        note: tableNote,
        onNote: (next, replace) => {
          void navigate({
            to: ".",
            search: (shown) => ({ ...shown, tableNote: next }),
            replace,
          });
        },
      }),
      [tableNote, navigate],
    );
    if (mustChangePassword) {
      return <FirstPasswordChange rules={passwords.rules} owner={user} />;
    }
    return (
      <OpenNoteContext value={openNote}>
        <TableNoteContext value={tableNoteAddress}>
          <Layout
            user={user}
            role={role}
            roles={roles}
            permissions={permissions}
            dataClasses={access.dataClasses}
            passwordRules={passwords.rules}
          />
        </TableNoteContext>
      </OpenNoteContext>
    );
  },
});

// An added column a link opens, taken out of the address at once, since a menu isn't kept there,
// and kept until the table has opened its menu, then let go, so drawing the table again, as
// switching to the Board and back does, doesn't open it again.
export const linkedColumnSearch = z.uuid().optional().catch(undefined);

export function useLinkedColumn(
  column: string | undefined,
  drop: () => void,
): LinkedColumn | undefined {
  const [linked, setLinked] = useState(column);
  const dropped = useRef(false);
  useEffect(() => {
    if (column === undefined || dropped.current) return;
    dropped.current = true;
    drop();
  }, [column, drop]);
  return linked === undefined
    ? undefined
    : {
        key: linked,
        onOpened: () => {
          setLinked(undefined);
        },
      };
}

// Whether a role may draft changes to feature teams, which needs seeing the people on them.
export const editsFeatureTeams = (permissions: readonly string[]) =>
  permissions.includes("people:view") &&
  permissions.includes("feature-teams:edit");
