// SPDX-License-Identifier: Apache-2.0

// The routes of each person's views and own pages, and what they need, for the permission tests'
// table of every route.

import { firstTables, viewPageSchema, viewTableSchema } from "@fathom/shared";
import { randomUUID } from "node:crypto";
import {
  allOf,
  named,
  type Route,
  signedIn,
  viewTableNeeds,
} from "./test-permission-needs.ts";

export const viewAndPageRoutes: Route[] = [
  // Each table's views need what opens its page. Sharing, and changing or deleting someone else's
  // view, also need what shares views on the table, as the views tests check.
  ...viewTableSchema.options.flatMap((table): Route[] => {
    // The table is always one of the fixed tables.
    // eslint-disable-next-line security/detect-object-injection
    const needs = viewTableNeeds[table];
    const view = `/api/views/${table}/${randomUUID()}`;
    return [
      {
        method: "GET",
        pattern: "/api/views/:table",
        variant: table,
        url: `/api/views/${table}`,
        needs,
      },
      {
        method: "POST",
        pattern: "/api/views/:table",
        variant: table,
        url: `/api/views/${table}`,
        needs,
        body: () => ({ ...named(), scope: "personal", definition: {} }),
      },
      {
        method: "PUT",
        pattern: "/api/views/:table/:viewId",
        variant: table,
        url: view,
        needs,
        body: named,
      },
      {
        method: "DELETE",
        pattern: "/api/views/:table/:viewId",
        variant: table,
        url: view,
        needs,
      },
    ];
  }),

  // Every signed-in account reads its own last views, only of the pages its role opens, which the
  // last views tests check.
  { method: "GET", pattern: "/api/last-views", needs: signedIn },
  // Only a role that makes private pages lists or makes them. A page, which a random ID never
  // names, is not found for everyone, so the page's own tests check who reads and changes one.
  {
    method: "GET",
    pattern: "/api/private-pages",
    needs: allOf("private-pages:make"),
  },
  { method: "GET", pattern: "/api/private-pages/:pageId", needs: signedIn },
  {
    method: "POST",
    pattern: "/api/private-pages",
    needs: allOf("private-pages:make"),
    body: () => ({
      ...named(),
      columns: [{ name: "Number", type: "number", visibility: "general" }],
    }),
  },
  {
    method: "PATCH",
    pattern: "/api/private-pages/:pageId",
    needs: signedIn,
    body: named,
  },
  {
    method: "PUT",
    pattern: "/api/private-pages/:pageId/position",
    needs: signedIn,
    body: () => ({ position: 0 }),
  },
  { method: "DELETE", pattern: "/api/private-pages/:pageId", needs: signedIn },
  {
    method: "POST",
    pattern: "/api/private-pages/:pageId/rows",
    needs: signedIn,
    body: () => ({}),
  },
  {
    method: "PATCH",
    pattern: "/api/private-pages/:pageId/rows/:rowId",
    needs: signedIn,
    body: () => ({}),
  },
  {
    method: "DELETE",
    pattern: "/api/private-pages/:pageId/rows/:rowId",
    needs: signedIn,
  },
  // Keeping a page's last view needs what opens its tables, each of a page's tables opening alike.
  ...viewPageSchema.options.flatMap((page): Route[] => {
    // The page is always one of the fixed pages.
    // eslint-disable-next-line security/detect-object-injection
    const table = firstTables[page];
    // The table is always one of the fixed tables.
    // eslint-disable-next-line security/detect-object-injection
    const needs = viewTableNeeds[table];
    const url = `/api/last-views/${page}`;
    return [
      {
        method: "PUT",
        pattern: "/api/last-views/:page",
        variant: page,
        url,
        needs,
        body: () => ({ table, definition: {} }),
      },
    ];
  }),
];
