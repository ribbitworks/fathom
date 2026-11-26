// SPDX-License-Identifier: Apache-2.0

// Following a link to a record by its key: the server finds it under the reader's permissions, and
// the link gives way to the page that shows it, with its details open.

import {
  type ColumnTable,
  type FoundPrivateRecord,
  type FoundRecord,
  isCodedKey,
  isFoundPrivate,
  recordKey,
  type RecordKeyOf,
  recordLookupSchema,
  shownRecordKey,
} from "@fathom/shared";
import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { getJson } from "./api.ts";
import { peopleQuery } from "./people.ts";
import { planAddress } from "./projects.ts";

type RecordAddress =
  | ReturnType<typeof planAddress>
  | {
      to: "/releases/{-$streamId}";
      params: { streamId: undefined };
      search: { tab?: "schedules"; open: string };
    }
  | { to: "/people"; search: { open: string | undefined } }
  | { to: "/org-chart"; search: { teams: "feature"; featureTeam: string } }
  | { to: "/lists/{-$listId}"; params: { listId: string } }
  | { to: "/features" | "/activities" | "/people"; search: { column: string } }
  | { to: "/accounts" | "/roles"; search: { open: string } };

// A private page's address, or the page's with a row's details open, which Mine's page will serve.
export const privatePagePath = ({ kind, id, pageId }: FoundPrivateRecord) =>
  kind === "page"
    ? `/mine/${pageId}`
    : `/mine/${pageId}?${new URLSearchParams({ open: id }).toString()}`;

// The page each table's added columns open on.
const columnPages = {
  people: "/people",
  features: "/features",
  activities: "/activities",
} as const satisfies Record<ColumnTable, string>;

// A release stream's details on Releases.
export const streamAddress = (streamId: string) =>
  ({
    to: "/releases/{-$streamId}",
    params: { streamId: undefined },
    search: { tab: "schedules", open: streamId },
  }) as const;

async function recordAddress(
  queryClient: QueryClient,
  found: FoundRecord,
): Promise<RecordAddress> {
  const { kind, id } = found;
  switch (kind) {
    case "feature":
      return planAddress("features", id);
    case "activity":
      return planAddress("activities", id);
    case "project":
      return planAddress("projects", id);
    case "proposal":
      return planAddress("proposals", id);
    case "customer":
      return planAddress("customers", id);
    case "milestone":
      return planAddress("milestones", id);
    case "schedule":
      return streamAddress(id);
    case "release":
      return {
        to: "/releases/{-$streamId}",
        params: { streamId: undefined },
        search: { open: id },
      };
    // People's and planned hires' details open by the ID People shows them by.
    case "person":
    case "hire": {
      const { people } = await queryClient.query(peopleQuery);
      const row = people.find((one) => one.id === id);
      return { to: "/people", search: { open: row?.employeeId } };
    }
    case "team":
      return {
        to: "/org-chart",
        search: { teams: "feature", featureTeam: id },
      };
    case "list":
      return { to: "/lists/{-$listId}", params: { listId: id } };
    case "column":
      return {
        to: columnPages[found.table ?? "people"],
        search: { column: id },
      };
    case "account":
      return { to: "/accounts", search: { open: id } };
    case "role":
      return { to: "/roles", search: { open: id } };
  }
}

// What a link that opens no record shows: the key it names, as typed when it names none, and
// whether its record was removed.
export async function followLink(
  queryClient: QueryClient,
  parsed: RecordKeyOf | undefined,
  typed: string,
): Promise<{ shownKey: string; removed: boolean }> {
  if (parsed === undefined) return { shownKey: typed, removed: false };
  const lookup = await getJson(
    isCodedKey(parsed)
      ? `/api/go/${recordKey(parsed)}`
      : `/api/go/${parsed.kind}/${String(parsed.keyNumber)}`,
    recordLookupSchema,
  );
  if (lookup.result === "found") {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's way to redirect
    throw isFoundPrivate(lookup)
      ? // Not yet served by a route of its own, so by its whole address.
        redirect({ href: privatePagePath(lookup), replace: true })
      : redirect({
          ...(await recordAddress(queryClient, lookup)),
          replace: true,
        });
  }
  return {
    shownKey: shownRecordKey(parsed),
    removed: lookup.result === "removed",
  };
}
