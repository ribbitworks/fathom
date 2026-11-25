// SPDX-License-Identifier: Apache-2.0

// Tests for what a list's draft menu offers, by the rule every draft menu shares.

import { describe, expect, it } from "vitest";
import { draftItemsOffer } from "./list-drafts.tsx";

const either = [false, true] as const;
const cases = either.flatMap((canEdit) =>
  either.flatMap((canApprove) =>
    either.flatMap((rejected) =>
      either.map((publishable) => ({
        canEdit,
        canApprove,
        rejected,
        publishable,
      })),
    ),
  ),
);

describe("a list's draft menu", () => {
  it.each(cases)(
    "offers deciding to approvers unless rejected, and publishing, resubmitting and discarding to editors: %o",
    (facts) => {
      const { canEdit, canApprove, rejected, publishable } = facts;

      expect(draftItemsOffer(facts)).toEqual({
        decide: canApprove && !rejected,
        publish: canEdit && publishable,
        resubmit: canEdit && rejected,
        discard: canEdit,
      });
    },
  );
});
