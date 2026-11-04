// SPDX-License-Identifier: Apache-2.0

// Tests for the People table on its own: how its columns are put in order, where a dragged column
// goes, how wide each column is, and adding people for a user who does not see start and end
// dates. The page around it is tested in people-page.test.tsx.

import type { Field, List, Person } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { act, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  columnsFor,
  columnWidth,
  countedPeople,
  droppedAfter,
  liveFields,
  livePeople,
  PeopleGrid,
} from "./people-grid.tsx";
import { emptyView, formatDay } from "./table-view.ts";
import { testTheme } from "./test-support.tsx";

const site: Field = {
  id: "f1",
  name: "Site",
  type: "choice" as const,
  listId: "l1",
  visibility: null,
  multiple: false,
  required: false,
};
const sites: List = {
  id: "l1",
  name: "Sites",
  description: "",
  visibility: "general",
  retired: false,
  choices: [{ id: "c1", label: "Harbour", description: "", retired: false }],
};

describe("the order of the columns", () => {
  it("follows the order given, putting columns it does not name at the end in their usual order", () => {
    expect(
      columnsFor([site], [sites], ["f1", "employeeId"], true).map(
        ({ key }) => key,
      ),
    ).toEqual(["f1", "employeeId", "preferredName", "startDate", "endDate"]);
  });

  it("offers no choices for a column whose list cannot be found", () => {
    expect(columnsFor([site], [], [], false).at(-1)?.choices).toEqual([]);
  });
});

describe("where a dragged column goes", () => {
  const keys = ["a", "b", "c"];

  it.each([
    ["a", "c", "c"],
    ["c", "a", null],
    ["c", "b", "a"],
    ["a", "a", undefined],
    ["x", "a", undefined],
  ])("%s dropped on %s follows %s", (moved, onto, after) => {
    expect(droppedAfter(keys, moved, onto)).toBe(after);
  });
});

const noop = () => undefined;
const actions = {
  add: noop,
  update: noop,
  remove: noop,
  discard: noop,
  resubmit: noop,
  decide: noop,
  moveColumn: noop,
  editColumn: noop,
  discardColumn: noop,
  resubmitColumn: noop,
};

describe("how wide each column is", () => {
  const person = (id: string, preferredName: string): Person => ({
    id,
    preferredName,
    employeeId: "E1",
    startDate: null,
    endDate: null,
    values: {},
    links: {},
  });
  const grid = (people: Person[]) => (
    <MantineProvider theme={testTheme}>
      <PeopleGrid
        people={people}
        fields={[site]}
        order={[]}
        lists={[sites]}
        canEdit={false}
        canEditColumns={false}
        showDates
        view={emptyView}
        onView={noop}
        actions={actions}
      />
    </MantineProvider>
  );
  const nameChars = () =>
    document.querySelector("col")?.style.getPropertyValue("--cell-chars");
  const choice = (label: string, retired = false) => ({
    id: label,
    label,
    description: "",
    retired,
  });
  const widthOf = (field: Field, list: List) => {
    const [, , column] = columnsFor([field], [list], [], false);
    return column && columnWidth(column, new Map());
  };

  it("fits a text column to the longest value it held when the page opened, and keeps it while values change", () => {
    const { rerender } = render(
      grid([person("p1", "Hana Fictional"), person("p2", "Ian")]),
    );
    expect(nameChars()).toBe("14");
    rerender(
      grid([
        person("p1", "Hana Fictional With A Much Longer Name"),
        person("p2", "Ian"),
      ]),
    );
    expect(nameChars()).toBe("14");
  });

  it("fits a column drawing on a list to its longest choice, retired ones included, however many a cell may hold", () => {
    const list = {
      ...sites,
      choices: [choice("Harbour"), choice("Lighthouse Point", true)],
    };
    expect(widthOf(site, list)).toEqual({ cells: 16, header: 4 });
    expect(widthOf({ ...site, multiple: true }, list)).toEqual({
      cells: 16,
      header: 4,
    });
  });

  it("fits a date column to the longest date", () => {
    const [, , start] = columnsFor([], [], [], true);
    const width = start && columnWidth(start, new Map());
    const longest = Math.max(
      ...Array.from(
        { length: 12 },
        (_, month) =>
          formatDay(`2026-${String(month + 1).padStart(2, "0")}-28`).length,
      ),
    );
    expect(width?.cells).toBe(longest);
    expect(width?.header).toBe(5);
  });

  it("fits a text column with no values to its header", () => {
    const [name] = columnsFor([], [], [], false);
    expect(name && columnWidth(name, new Map())).toEqual({
      cells: 0,
      header: 4,
    });
  });

  it("stops at the widest a column may be", () => {
    const long = "L".repeat(40);
    expect(
      widthOf({ ...site, name: long }, { ...sites, choices: [choice(long)] }),
    ).toEqual({ cells: 30, header: 30 });
  });
});

describe("adding people without dates", () => {
  it("leaves dates out for a user who does not see them, and checks Employee IDs against every new row", async () => {
    const add = vi.fn();
    const noop = () => undefined;
    render(
      <MantineProvider theme={testTheme}>
        <PeopleGrid
          people={[]}
          fields={[site]}
          order={[]}
          lists={[sites]}
          canEdit
          canEditColumns={false}
          showDates={false}
          view={emptyView}
          onView={noop}
          actions={{
            add,
            update: noop,
            remove: noop,
            discard: noop,
            resubmit: noop,
            decide: noop,
            moveColumn: noop,
            editColumn: noop,
            discardColumn: noop,
            resubmitColumn: noop,
          }}
        />
      </MantineProvider>,
    );
    act(() => {
      document.getElementById("cell-new-0-preferredName")?.focus();
    });
    await userEvent.paste("Hana Fictional\tE1\tHarbour\nIan Fictional");
    expect(add).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Employee ID needed");
    act(() => {
      document.getElementById("cell-new-2-employeeId")?.focus();
    });
    await userEvent.keyboard("E2{Enter}");
    expect(add).toHaveBeenCalledWith(
      [
        {
          id: expect.stringMatching(/^pending-/) as string,
          request: {
            preferredName: "Hana Fictional",
            employeeId: "E1",
            values: { f1: ["c1"] },
            links: {},
          },
        },
        {
          id: expect.stringMatching(/^pending-/) as string,
          request: {
            preferredName: "Ian Fictional",
            employeeId: "E2",
            values: { f1: [] },
            links: {},
          },
        },
      ],
      expect.any(Function),
      expect.any(Function),
    );
  });
});

describe("the live people", () => {
  const draft = {
    state: "waiting" as const,
    madeBy: null,
    madeAt: null,
    changed: [],
    live: { values: {}, links: {} },
  };
  const person = (id: string, more: Partial<Person> = {}): Person => ({
    id,
    preferredName: `Fictional ${id}`,
    employeeId: id,
    startDate: "2024-01-01",
    endDate: null,
    values: {},
    links: {},
    ...more,
  });

  it("leaves out those only drafted to be added, and puts back what drafts change", () => {
    expect(
      livePeople([
        person("p1"),
        person("p2", { draft: { ...draft, action: "created" } }),
        person("p3", { draft: { ...draft, action: "deleted" } }),
        person("p4", {
          preferredName: "Fictional Renamed",
          endDate: "2027-01-01",
          values: { f1: ["c2"], f2: ["c9"], f3: ["c5"] },
          draft: {
            ...draft,
            action: "changed",
            changed: ["preferredName", "endDate", "f1", "f2", "f4"],
            live: {
              preferredName: "Fictional p4",
              values: { f1: ["c1"], f2: [] },
              links: {},
            },
          },
        }),
      ]),
    ).toEqual([
      person("p1"),
      person("p3"),
      person("p4", { endDate: null, values: { f3: ["c5"], f1: ["c1"] } }),
    ]);
  });
});

describe("the live links", () => {
  it("puts back each link a draft changes, keeping the rest", () => {
    const kept = { address: "https://kept.example.test/", text: "" };
    const live = { address: "https://live.example.test/", text: "Live" };
    const [person] = livePeople([
      {
        id: "p1",
        preferredName: "Fictional p1",
        employeeId: "p1",
        values: {},
        links: {
          f1: { address: "https://drafted.example.test/", text: "" },
          f2: kept,
          f3: { address: "https://added.example.test/", text: "" },
        },
        draft: {
          action: "changed",
          changed: ["f1", "f3"],
          live: { values: {}, links: { f1: live } },
          state: "waiting",
          madeBy: null,
          madeAt: null,
        },
      },
    ]);
    expect(person?.links).toEqual({ f2: kept, f1: live });
  });
});

describe("the people the metrics count", () => {
  const draft = {
    state: "waiting" as const,
    madeBy: null,
    madeAt: null,
    changed: [],
    live: { values: {}, links: {} },
  };
  const person = (id: string, more: Partial<Person> = {}): Person => ({
    id,
    preferredName: `Fictional ${id}`,
    employeeId: id,
    values: {},
    links: {},
    ...more,
  });
  const people = [
    person("p1"),
    person("p2", { draft: { ...draft, action: "created" } }),
    person("p3", { draft: { ...draft, action: "deleted" } }),
  ];
  const [column, other] = columnsFor([site], [sites], [], false);

  it("are those shown, unless drafts show beside live", () => {
    expect(countedPeople("live", people, [], () => undefined)).toEqual({
      rows: people,
    });
    expect(countedPeople("drafts", people, [], () => undefined)).toEqual({
      rows: people,
    });
  });

  it("are, with drafts beside live, those not drafted to be removed, and as they are live by each column's live copy", () => {
    const counted = countedPeople(
      "both",
      people,
      [column, other].flatMap((each) => (each ? [each] : [])),
      (each) => (each === column ? each : undefined),
    );
    expect(counted.rows.map(({ id }) => id)).toEqual(["p1", "p2"]);
    expect(counted.live?.rows.map(({ id }) => id)).toEqual(["p1", "p3"]);
    expect(counted.live?.columns).toEqual([column]);
  });
});

describe("the live columns", () => {
  const column = {
    id: "f1",
    name: "Grade",
    type: "choice" as const,
    listId: "l1",
    visibility: null,
    multiple: false,
    required: true,
  };
  const draft = {
    state: "waiting" as const,
    madeBy: null,
    madeAt: null,
  };
  it("leave out columns only drafted to be added, and put back each setting a draft changes", () => {
    expect(
      liveFields([
        { ...column, id: "f0" },
        {
          ...column,
          draft: {
            ...draft,
            action: "changed",
            changed: ["name", "required"],
            live: { name: "Level", required: false },
          },
        },
        {
          ...column,
          id: "f2",
          draft: { ...draft, action: "created", changed: [], live: {} },
        },
        {
          ...column,
          id: "f4",
          listId: "l2",
          draft: {
            ...draft,
            action: "changed",
            changed: ["listId"],
            live: { listId: "l1" },
          },
        },
        {
          ...column,
          id: "f3",
          draft: { ...draft, action: "deleted", changed: [], live: {} },
        },
      ]),
    ).toEqual([
      { ...column, id: "f0" },
      { ...column, name: "Level", required: false },
      { ...column, id: "f4" },
      { ...column, id: "f3" },
    ]);
  });
});
