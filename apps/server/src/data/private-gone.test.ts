// SPDX-License-Identifier: Apache-2.0

// Unit tests of which records a user's private changes are to that are there for everyone else, what
// taking back a change to one gone records, and the role it is recorded as.

import { defaultClasses } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import type { ColumnsState } from "./column-state.ts";
import type { Draft, Recorded } from "./draft-records.ts";
import type { ListsState } from "./list-state.ts";
import { existsFor, lastRoleFor, withoutRemovals } from "./private-gone.ts";
import { takingBack } from "./private-withdrawals.ts";
import type { OpenDraftChange, Row, Versions } from "./private-versions.ts";
import { draft, kindState, recordsState } from "./test-records-state.ts";
import type { TableColumns } from "./values.ts";

const id = "record-1";

const row = (recordType: string, action: Draft["action"] = "changed"): Row => ({
  recordType,
  recordId: id,
  userId: "user-1",
  setId: "set-1",
  action,
  fields: {},
  startedFrom: {},
  since: new Date(0),
  sequence: 1,
});

const lists = (parts: Partial<ListsState> = {}): ListsState => ({
  lists: new Map(),
  builtIn: new Map(),
  choices: new Map(),
  listDrafts: new Map(),
  choiceDrafts: new Map(),
  orderDrafts: new Map(),
  keys: new Map(),
  ...parts,
});

const columns = (parts: Partial<ColumnsState> = {}): ColumnsState => ({
  fields: new Map(),
  fieldDrafts: new Map(),
  liveOrder: [],
  lists: lists(),
  ...parts,
});

const peopleColumns: TableColumns = Object.assign([], {
  positionTier: "general" as const,
  stateTier: "general" as const,
  dataClasses: defaultClasses,
});

const kept = (
  live: Recorded | undefined,
  theirs: Draft | undefined,
): { live: Map<string, Recorded>; theirs: Map<string, Draft> } => ({
  live: new Map(live === undefined ? [] : [[id, live]]),
  theirs: new Map(theirs === undefined ? [] : [[id, theirs]]),
});

// Everything empty but the parts given, as everyone else sees them.
const versions = ({
  theirLists = lists(),
  theirColumns = columns(),
  people = kept(undefined, undefined),
  hires = kept(undefined, undefined),
  teams = kept(undefined, undefined),
  customers = kindState(),
  myPeople = new Map<string, Draft>(),
  myCustomers = kindState(),
}: {
  theirLists?: ListsState;
  theirColumns?: ColumnsState;
  people?: ReturnType<typeof kept>;
  hires?: ReturnType<typeof kept>;
  teams?: ReturnType<typeof kept>;
  customers?: ReturnType<typeof kindState>;
  myPeople?: Map<string, Draft>;
  myCustomers?: ReturnType<typeof kindState>;
} = {}): Versions => ({
  rows: [],
  mine: { lists: lists(), columns: columns() },
  theirs: { lists: theirLists, columns: theirColumns },
  people: { columns: peopleColumns, mine: myPeople, ...people },
  hires: { mine: new Map(), tierOf: () => "general", ...hires },
  teams: { mine: new Map(), ...teams },
  liveSince: new Map(),
  records: {
    mine: recordsState({ customer: myCustomers }),
    theirs: recordsState({ customer: customers }),
  },
});

const record: Recorded = { name: "Fictional Record" };
const added = draft("created", record);
const removed = draft("deleted");

describe("whether the record a private change is to is there for everyone else", () => {
  it("is not there for a customer neither live nor drafted to be added", () => {
    expect(existsFor(versions(), row("customer"))).toBe(false);
  });

  it("is there for a live customer", () => {
    const customers = kindState([[id, record]]);
    expect(existsFor(versions({ customers }), row("customer"))).toBe(true);
  });

  it("is there for a customer a published draft adds", () => {
    const customers = kindState([], [[id, added]]);
    expect(existsFor(versions({ customers }), row("customer"))).toBe(true);
  });

  it("is there for a person until the published draft removing them is approved", () => {
    const people = kept(record, removed);
    expect(existsFor(versions({ people }), row("person"))).toBe(true);
  });

  it("is there for a person a published draft adds", () => {
    const people = kept(undefined, added);
    expect(existsFor(versions({ people }), row("person"))).toBe(true);
  });

  it("is not there for a person only the change's maker adds", () => {
    expect(existsFor(versions(), row("person", "created"))).toBe(false);
  });

  it("is not there for a planned hire neither live nor drafted to be added", () => {
    expect(existsFor(versions(), row("planned-hire"))).toBe(false);
  });

  it("is there for a planned hire a published draft adds", () => {
    const hires = kept(undefined, added);
    expect(existsFor(versions({ hires }), row("planned-hire"))).toBe(true);
  });

  it("is not there for a feature team neither live nor drafted to be added", () => {
    expect(existsFor(versions(), row("feature-team"))).toBe(false);
  });

  it("is there for a live feature team", () => {
    const teams = kept(record, undefined);
    expect(existsFor(versions({ teams }), row("feature-team"))).toBe(true);
  });

  it("is not there for a list neither live nor drafted to be added", () => {
    expect(existsFor(versions(), row("list"))).toBe(false);
  });

  it("is there for a live list a published draft removes", () => {
    const theirLists = lists({
      lists: new Map([[id, record]]),
      listDrafts: new Map([[id, removed]]),
    });
    expect(existsFor(versions({ theirLists }), row("list"))).toBe(true);
  });

  it("is not there for the order of a list neither live nor drafted to be added", () => {
    expect(existsFor(versions(), row("choice-order"))).toBe(false);
  });

  it("is there for the order of a list a published draft adds", () => {
    const theirLists = lists({ listDrafts: new Map([[id, added]]) });
    expect(existsFor(versions({ theirLists }), row("choice-order"))).toBe(true);
  });

  it("is not there for a choice neither live nor drafted to be added", () => {
    expect(existsFor(versions(), row("list-item"))).toBe(false);
  });

  it("is there for a live choice", () => {
    const theirLists = lists({
      choices: new Map([[id, { record, position: 1 }]]),
    });
    expect(existsFor(versions({ theirLists }), row("list-item"))).toBe(true);
  });

  it("is not there for a column neither live nor drafted to be added", () => {
    expect(existsFor(versions(), row("field"))).toBe(false);
  });

  it("is there for a live column", () => {
    const theirColumns = columns({ fields: new Map([[id, record]]) });
    expect(existsFor(versions({ theirColumns }), row("field"))).toBe(true);
  });
});

describe("taking back a change to a record gone", () => {
  const person: Recorded = {
    preferredName: "Fictional Person",
    startDate: "2026-01-05",
  };
  const renamed = { preferredName: "Fictional Renamed" };
  const fieldsOf = (changes: { field: string; action: string }[]) =>
    changes.map(({ field, action }) => ({ field, action }));

  it("records only the fields its maker changed of a person an approval removes, at their class", () => {
    const before = versions({
      people: kept(person, removed),
      myPeople: new Map([[id, draft("changed", renamed)]]),
    });
    const changes = takingBack(
      withoutRemovals(before, [row("person")]),
      row("person"),
      defaultClasses,
    );
    expect(changes).toEqual([
      expect.objectContaining({
        field: "preferredName",
        action: "changed",
        tier: "general",
        oldValue: "Fictional Renamed",
        newValue: "Fictional Person",
      }),
    ]);
  });

  it("records only the fields its maker changed of a person whose added draft is discarded", () => {
    const before = versions({
      people: kept(undefined, draft("created", person)),
      myPeople: new Map([[id, draft("created", { ...person, ...renamed })]]),
    });
    const changes = takingBack(
      withoutRemovals(before, [row("person", "created")]),
      row("person", "created"),
      defaultClasses,
    );
    expect(fieldsOf(changes)).toEqual([
      { field: "preferredName", action: "changed" },
    ]);
  });

  it("records only the fields its maker changed of a plan's record an approval removes", () => {
    const before = versions({
      customers: kindState([[id, record]], [[id, removed]]),
      myCustomers: kindState(
        [[id, record]],
        [[id, draft("changed", { name: "Fictional Renamed" })]],
      ),
    });
    const changes = takingBack(
      withoutRemovals(before, [row("customer")]),
      row("customer"),
      defaultClasses,
    );
    expect(fieldsOf(changes)).toEqual([{ field: "name", action: "changed" }]);
  });

  it("keeps a published removal of a record not gone", () => {
    const before = versions({ people: kept(person, removed) });
    const after = withoutRemovals(before, [row("customer")]);
    expect(after.people.theirs.get(id)).toBe(removed);
  });
});

describe("the role a withdrawal is recorded as", () => {
  const change = (recordId: string, madeAsRoleId: string | null) =>
    ({
      changeSetId: "set-1",
      recordType: "person",
      recordId,
      madeAsRoleId,
    }) satisfies OpenDraftChange;

  it("is the role of the last open change to the records withdrawn", () => {
    const open = [
      change(id, "role-1"),
      change("record-2", "role-2"),
      change(id, "role-3"),
      change("record-2", "role-4"),
    ];
    expect(lastRoleFor(open, [row("person")])).toBe("role-3");
  });

  it("is none when no open change is to them", () => {
    expect(lastRoleFor([change("record-2", "role-2")], [row("person")])).toBe(
      null,
    );
  });
});
