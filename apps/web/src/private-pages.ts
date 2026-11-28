// SPDX-License-Identifier: Apache-2.0

// The signed-in person's own pages under Mine, as read and changed through the API.

import {
  listedPrivatePageSchema,
  type PrivatePage,
  privatePageRequestSchema,
  privatePageSchema,
  savedPrivatePageSchema,
  savedSchema,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import type { CellChange } from "./cell-kinds.tsx";
import { getJson, sendDeleteFor, sendJsonFor } from "./api.ts";

const pagesPath = "/api/private-pages";
const pagePath = (pageId: string) =>
  `${pagesPath}/${encodeURIComponent(pageId)}`;
const rowPath = (pageId: string, rowId: string) =>
  `${pagePath(pageId)}/rows/${encodeURIComponent(rowId)}`;

export const privatePagesQuery = queryOptions({
  queryKey: ["private-pages"],
  queryFn: () => getJson(pagesPath, z.array(listedPrivatePageSchema)),
});

export const privatePageQuery = (pageId: string) =>
  queryOptions({
    queryKey: [...privatePagesQuery.queryKey, pageId],
    queryFn: () => getJson(pagePath(pageId), privatePageSchema),
  });

// A page saved, as the server reads it back, and the change set it was saved in.
export interface SavedPage {
  page: PrivatePage;
  changeSetId: string | null;
}

export const makePrivatePage = (
  request: z.input<typeof privatePageRequestSchema>,
) => sendJsonFor("POST", pagesPath, request, savedPrivatePageSchema);

export const addPrivateRow = (pageId: string, change: CellChange) =>
  sendJsonFor(
    "POST",
    `${pagePath(pageId)}/rows`,
    change,
    savedPrivatePageSchema,
  );

export const changePrivateRow = (
  pageId: string,
  rowId: string,
  change: CellChange,
) =>
  sendJsonFor("PATCH", rowPath(pageId, rowId), change, savedPrivatePageSchema);

export const removePrivateRow = (pageId: string, rowId: string) =>
  sendDeleteFor(rowPath(pageId, rowId), savedPrivatePageSchema);

export const removePrivateColumn = (pageId: string, columnId: string) =>
  sendDeleteFor(
    `${pagePath(pageId)}/columns/${encodeURIComponent(columnId)}`,
    savedPrivatePageSchema,
  );

export const renamePrivatePage = (pageId: string, name: string) =>
  sendJsonFor("PATCH", pagePath(pageId), { name }, savedPrivatePageSchema);

export const removePrivatePage = (pageId: string) =>
  sendDeleteFor(pagePath(pageId), savedSchema);

// Where removing a page leaves its maker: the page after it under Mine, or else the one before, or
// none, for the Overview, once Mine is empty.
export function landingAfter(
  pages: readonly { id: string }[],
  removed: string,
): string | undefined {
  const at = pages.findIndex(({ id }) => id === removed);
  return (pages[at + 1] ?? (at > 0 ? pages[at - 1] : undefined))?.id;
}
