// SPDX-License-Identifier: Apache-2.0

// Unit tests for the checks on publishing private changes: how a refusal is named to a role that
// reads the change's kind and to one that doesn't, and what they do with an error that is no
// refusal.

import { describe, expect, it } from "vitest";
import { type Actor } from "../access.ts";
import { type Transaction } from "./changes.ts";
import { type ListsState } from "./list-state.ts";
import { type Versions } from "./private-versions.ts";
import { refuseMisfits } from "./publish-checks.ts";
import { privateChange, published } from "./test-private-changes.ts";

describe("checking private changes on publishing", () => {
  it("passes on an error that is no refusal, as it is", async () => {
    // Given a column only drafted to be added, taken back, and a database that fails when read
    const added = { ...published({ name: "Fictional" }), action: "created" };
    const versions = {
      rows: [],
      mine: { columns: {} },
      theirs: {
        columns: {
          fields: new Map(),
          fieldDrafts: new Map([["column", added]]),
        },
      },
    } as unknown as Versions;
    const takenBack = {
      ...privateChange({}, {}),
      recordType: "field",
      recordId: "column",
    };
    const failing = new Proxy(
      {},
      {
        get: () => {
          throw new Error("Fictional failure");
        },
      },
    ) as unknown as Transaction;

    // When it is checked, then the failure isn't taken for a refusal
    await expect(
      refuseMisfits(failing, { user: { id: "user-ben" } } as Actor, versions, [
        takenBack,
      ]),
    ).rejects.toThrow("Fictional failure");
  });

  // A Confidential list, which the role can't see, renamed privately.
  const salaries = { name: "Fictional Salaries", visibility: "confidential" };
  const lists: ListsState = {
    lists: new Map([["list", salaries]]),
    builtIn: new Map(),
    choices: new Map(),
    listDrafts: new Map(),
    choiceDrafts: new Map(),
    orderDrafts: new Map(),
    keys: new Map(),
  };
  const renamed = {
    ...privateChange({ name: "Fictional Pay" }, { name: salaries.name }),
    recordType: "list",
    recordId: "list",
  };
  const refusalTo = async (permissions: string[]) => {
    const versions = {
      rows: [],
      mine: { lists },
      theirs: { lists },
    } as unknown as Versions;
    const actor = { user: { id: "user-ben" }, permissions } as unknown as Actor;
    const refused = await refuseMisfits(
      {} as unknown as Transaction,
      actor,
      versions,
      [renamed],
    ).catch((error: unknown) => error);
    return (refused as Error).message;
  };

  it("names the record, with the reason a fresh change gets, to a role that reads its kind", async () => {
    expect(await refusalTo(["configuration:view"])).toBe(
      "The list Fictional Salaries: Fictional Salaries holds people's details this role can't see, so someone who can see them must change it",
    );
  });

  it("names neither the record nor the reason to a role that doesn't read its kind", async () => {
    expect(await refusalTo([])).toBe(
      "The change to a list no longer fits the data; change or discard it, then publish again",
    );
  });

  it("names a column the role no longer sees the class of, with the reason a fresh change gets", async () => {
    // Given a People column drawing on the Confidential list, renamed privately
    const salary = {
      name: "Fictional Salary",
      tableName: "people",
      type: "choice",
      listId: "list",
    };
    const columns = {
      fields: new Map([["column", salary]]),
      fieldDrafts: new Map([["column", published({ name: "Fictional Pay" })]]),
      liveOrder: ["column"],
      lists,
    };
    const versions = {
      rows: [],
      mine: { columns },
      theirs: { columns: { ...columns, fieldDrafts: new Map() } },
    } as unknown as Versions;
    const actor = {
      user: { id: "user-ben" },
      permissions: ["people:view"],
    } as unknown as Actor;
    const row = {
      ...privateChange({ name: "Fictional Pay" }, { name: salary.name }),
      recordType: "field",
      recordId: "column",
    };

    const refused = await refuseMisfits(
      {} as unknown as Transaction,
      actor,
      versions,
      [row],
    ).catch((error: unknown) => error);

    expect((refused as Error).message).toBe(
      "The column Fictional Pay: Fictional Salary holds people's details this role can't see, so someone who can see them must change it",
    );
  });
});
