// SPDX-License-Identifier: Apache-2.0

// Features' filter to the features a customer gets or asks for, kept in its view as `customer`.

import {
  type Customer,
  customerFeatures,
  type CustomerLinks,
  type Feature,
  type Project,
  type Proposal,
} from "@fathom/shared";
import type { PageFilter } from "./filter-pills.tsx";
import { type View, withChoice } from "./table-view.ts";

export const customerChoiceKey = "customer";

// The plan's records as the view shows them, which the filter reads.
type CustomerFilterRecords = CustomerLinks<Project, Proposal, Feature> & {
  customers: readonly Customer[];
};

// The filter the view holds, while it names a customer the reader sees: the features naming the
// customer, needed by one of its projects or proposed by one of its proposals.
export function customerFilter(
  view: View,
  records: CustomerFilterRecords,
): PageFilter<Feature> | undefined {
  const chosen = view.choices?.customer;
  const customer = records.customers.find(({ id }) => id === chosen);
  if (customer === undefined) return undefined;
  const kept = new Set(
    customerFeatures(records, customer.id).map(({ id }) => id),
  );
  return {
    words: `For ${customer.name}`,
    keeps: (feature) => kept.has(feature.id),
    off: (shown) => withChoice(shown, customerChoiceKey, undefined),
  };
}
