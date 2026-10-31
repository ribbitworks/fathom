// SPDX-License-Identifier: Apache-2.0

// The lists of choices for people's details, through the server's API, with the names users see for
// each list, and how to say who made a change.

import {
  type ChangeStamp,
  type ListItem,
  type ListItemRequest,
  listItemSchema,
  type ListName,
  listsSchema,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { getJson, sendDelete, sendJsonFor } from "./api.ts";

// Every list must be named, which the compiler checks.
const listTitles: Record<ListName, string> = {
  sites: "Sites",
  positions: "Positions",
  levels: "Levels",
  "team-roles": "Roles on the team",
};

export function listTitle(list: ListName): string {
  // The list is always one of the fixed lists named above.
  // eslint-disable-next-line security/detect-object-injection
  return listTitles[list];
}

export const listsQuery = queryOptions({
  queryKey: ["lists"],
  queryFn: async () => (await getJson("/api/lists", listsSchema)).lists,
});

const itemResponse = z.object({ item: listItemSchema });

const itemsPath = (list: ListName) =>
  `/api/lists/${encodeURIComponent(list)}/items`;

export async function addListItem(
  list: ListName,
  item: ListItemRequest,
): Promise<ListItem> {
  return (await sendJsonFor("POST", itemsPath(list), item, itemResponse)).item;
}

export async function updateListItem(
  list: ListName,
  id: string,
  item: ListItemRequest,
): Promise<ListItem> {
  return (
    await sendJsonFor(
      "PUT",
      `${itemsPath(list)}/${encodeURIComponent(id)}`,
      item,
      itemResponse,
    )
  ).item;
}

export async function removeListItem(
  list: ListName,
  id: string,
): Promise<void> {
  await sendDelete(`${itemsPath(list)}/${encodeURIComponent(id)}`);
}

// Who made a change: a user, or Fathom itself, as for data made by setup scripts.
export function changedBy(stamp: ChangeStamp): string {
  return stamp.by === null ? "Fathom" : stamp.by.name;
}
