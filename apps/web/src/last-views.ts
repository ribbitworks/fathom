// SPDX-License-Identifier: Apache-2.0

// The view each page last showed, kept on the server for the signed-in account: reading them
// once, choosing the address a page opens on, and keeping the view a page shows.

import {
  firstTables,
  type LastView,
  type LastViewRequest,
  lastViewRequestSchema,
  lastViewsSchema,
  viewPageOf,
  type ViewTable,
} from "@fathom/shared";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { getJson, sendJson } from "./api.ts";
import { sameView, savedFor, type View, viewFrom } from "./table-view.ts";

// How long after the last change the view is kept, so typing a search sends it once.
const keptAfter = 1000;

export const lastViewsPath = "/api/last-views";

// Read once for the session, which signing in or out starts afresh.
export const lastViewsQuery = queryOptions({
  queryKey: ["last-views"],
  queryFn: () => getJson(lastViewsPath, lastViewsSchema),
  staleTime: Number.POSITIVE_INFINITY,
  retry: false,
});

// The view a page shows, with the saved view it started from and the page's mode, as it is kept.
export interface Shown {
  table: ViewTable;
  view: View;
  applied: string | undefined;
  mode?: string | undefined;
}

export function requestFor(shown: Shown): LastViewRequest {
  return {
    table: shown.table,
    definition: savedFor(shown.view),
    ...(shown.applied === undefined ? {} : { view: shown.applied }),
    ...(shown.mode === undefined ? {} : { mode: shown.mode }),
  };
}

// Whether the page's address names no view, saved view or mode, so the last view may be shown.
export const namesNoView = (shown: Shown): boolean =>
  shown.applied === undefined &&
  shown.mode === undefined &&
  Object.keys(savedFor(shown.view)).length === 0;

// Whether the view shown is the one kept, so keeping it again would change nothing.
export function isKept(shown: Shown, last: LastView | undefined): boolean {
  return (
    last !== undefined &&
    last.table === shown.table &&
    last.view === shown.applied &&
    last.mode === shown.mode &&
    sameView(viewFrom(last.definition), shown.view)
  );
}

// The address to open a page on, by the names it gives a view, and the table the last view was on:
// none when the address names a view, already shows the last view, or names a tab other than the
// page's first and the last view's.
export function lastViewAddress(
  shown: Shown,
  last: LastView | undefined,
): { table: ViewTable; address: Record<string, unknown> } | undefined {
  if (last === undefined || !namesNoView(shown) || isKept(shown, last)) {
    return undefined;
  }
  const page = viewPageOf[shown.table];
  // The page is always one of the fixed pages.
  // eslint-disable-next-line security/detect-object-injection
  if (last.table !== shown.table && shown.table !== firstTables[page]) {
    return undefined;
  }
  const { choices, ...definition } = last.definition;
  return {
    table: last.table,
    address: {
      ...definition,
      ...choices,
      ...(last.view === undefined ? {} : { view: last.view }),
      ...(last.mode === undefined ? {} : { mode: last.mode }),
    },
  };
}

// Keeps the view a page shows as its last view, once the views kept have been read.
export function useLastView(shown: Shown): void {
  const page = viewPageOf[shown.table];
  const queryClient = useQueryClient();
  const last = useQuery(lastViewsQuery);
  // The page is always one of the fixed pages.
  // eslint-disable-next-line security/detect-object-injection
  const stored = last.data?.[page];
  // A page that opened on its default, with nothing kept, has nothing to keep either.
  const unchanged =
    isKept(shown, stored) || (stored === undefined && namesNoView(shown));
  const key = JSON.stringify(requestFor(shown));
  // The view waiting to be kept, kept at once if the page is left first.
  const pending = useRef<() => void>(undefined);
  useEffect(
    () => () => {
      pending.current?.();
    },
    [],
  );
  useEffect(() => {
    pending.current = undefined;
    if (!last.isFetched) return;
    if (unchanged) return;
    const keep = () => {
      pending.current = undefined;
      // A view the server would refuse, such as one with too long a search, is not kept.
      const request = lastViewRequestSchema.safeParse(JSON.parse(key)).data;
      if (request === undefined) return;
      queryClient.setQueryData(lastViewsQuery.queryKey, (views) => ({
        ...views,
        [page]: request,
      }));
      // Keeping the view is a convenience, so a failure is left unsaid.
      sendJson("PUT", `${lastViewsPath}/${page}`, request).catch(
        () => undefined,
      );
    };
    pending.current = keep;
    const timer = setTimeout(keep, keptAfter);
    return () => {
      clearTimeout(timer);
    };
  }, [last.isFetched, unchanged, key, page, queryClient]);
}
