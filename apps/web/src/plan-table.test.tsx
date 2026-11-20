// SPDX-License-Identifier: Apache-2.0

// Tests for what the plan's tables share: their records as they are live.

import type { Customer } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { livePlanRecords } from "./plan-table.tsx";
import { recordDraft } from "./test-support.tsx";

describe("the plan's records as they are live", () => {
  const record = (more: object) =>
    ({ id: "c1", name: "Now", ...more }) as Customer;

  it("leaves out those only drafted to be added, and undoes a draft's other changes", () => {
    expect(
      livePlanRecords([
        record({}),
        record({ id: "c2", draft: recordDraft({ action: "created" }) }),
        record({ id: "c3", draft: recordDraft({ action: "deleted" }) }),
        record({
          id: "c4",
          draft: recordDraft({ changed: ["name"], live: { name: "Before" } }),
        }),
      ]).map(({ id, name, draft }) => ({ id, name, draft })),
    ).toEqual([
      { id: "c1", name: "Now", draft: undefined },
      { id: "c3", name: "Now", draft: undefined },
      { id: "c4", name: "Before", draft: undefined },
    ]);
  });
});
