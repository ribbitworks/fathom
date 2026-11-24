// SPDX-License-Identifier: Apache-2.0

// Following a link to a record by its key: the server finds the record under the reader's
// permissions, and the link gives way to the page that shows it, with its details open, so Back
// returns to wherever the reader came from.

import {
  type FoundRecord,
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
  | { to: "/features" | "/people"; search: { column: string } }
  | { to: "/accounts" | "/roles"; search: { open: string } };

async function recordAddress(
  queryClient: QueryClient,
  found: FoundRecord,
): Promise<RecordAddress> {
  const { kind, id } = found;
  switch (kind) {
    case "feature":
      return planAddress("features", id);
    case "project":
      return planAddress("projects", id);
    case "proposal":
      return planAddress("proposals", id);
    case "customer":
      return planAddress("customers", id);
    case "milestone":
      return planAddress("milestones", id);
    // An activity opens the project or release it belongs to.
    case "activity":
      return found.activityOf?.owner === "release"
        ? {
            to: "/releases/{-$streamId}",
            params: { streamId: undefined },
            search: { open: found.activityOf.id },
          }
        : planAddress("projects", found.activityOf?.id ?? id);
    case "schedule":
      return {
        to: "/releases/{-$streamId}",
        params: { streamId: undefined },
        search: { tab: "schedules", open: id },
      };
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
        to: found.table === "features" ? "/features" : "/people",
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
    `/api/go/${parsed.kind}/${String(parsed.keyNumber)}`,
    recordLookupSchema,
  );
  if (lookup.result === "found") {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's way to redirect
    throw redirect({
      ...(await recordAddress(queryClient, lookup)),
      replace: true,
    });
  }
  return {
    shownKey: shownRecordKey(parsed.kind, parsed.keyNumber),
    removed: lookup.result === "removed",
  };
}
