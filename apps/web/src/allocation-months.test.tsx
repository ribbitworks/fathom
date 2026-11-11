// SPDX-License-Identifier: Apache-2.0

// Tests for allocations month by month as a table of records: each row's features and percentages
// by month, people and planned hires, the months drafts change, a month's total as the Draft menu
// shows it, the months someone can be allocated in, and how a cell reads.

import type {
  Allocation,
  AllocationDraft,
  Allocations,
  OrgChart,
  OrgChartPerson,
  TeamMonths,
} from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  allocatableIn,
  type AllocationLine,
  AllocationLines,
  allocationMonthRecords,
  allocationMonthsTable,
  type AllocationRow,
  allocationManagers,
  CapacityTotal,
  capacityOf,
  monthTotal,
} from "./allocation-months.tsx";
import { featureTeamGrouping } from "./team-months.tsx";
import { testTheme } from "./test-support.tsx";

const months = ["2027-02", "2027-03", "2027-04"];
const search = { id: "t-search", name: "Search", colour: null };

const teamMonths: TeamMonths = {
  months,
  teams: [search],
  drafts: [],
  people: [
    {
      id: "p-casey",
      preferredName: "Casey Fictional",
      manager: { id: "p-blair", name: "Blair Fictional" },
      managers: {},
      teams: { "2027-03": [search.id] },
      outside: ["2027-02"],
    },
  ],
};

const features: Allocations["features"] = [
  { id: "f-checkout", name: "Checkout", meaning: "in-progress" },
  { id: "f-billing", name: "Billing", meaning: "in-progress" },
  { id: "f-maybe", name: "Maybe later", meaning: "possible" },
];

const allocation = (fields: Partial<Allocation> = {}): Allocation => ({
  id: "a-1",
  personId: "p-casey",
  plannedHireId: null,
  featureId: "f-checkout",
  months: { "2027-03": 50 },
  ...fields,
});

const draft = (fields: Partial<AllocationDraft> = {}): AllocationDraft => ({
  action: "changed",
  months: { "2027-03": 75 },
  state: "waiting",
  madeBy: "Resource Planner",
  madeAt: null,
  ...fields,
});

const card = (fields: Partial<OrgChartPerson>): OrgChartPerson => ({
  id: "p-blair",
  preferredName: "Blair Fictional",
  employeeId: null,
  position: null,
  teamName: null,
  teamColour: null,
  managerId: null,
  ...fields,
});

const noHires: OrgChart = { people: [card({})], drafted: [] };

const rowsOf = (
  allocated: readonly Allocation[],
  {
    chart = noHires,
    grouping,
    show = "both",
  }: {
    chart?: OrgChart;
    grouping?: string;
    show?: "both" | "drafts" | "live";
  } = {},
) =>
  allocationMonthRecords({
    teamMonths,
    allocations: { allocations: [...allocated], features },
    chart,
    grouping,
    show,
  });

const casey = (rows: readonly AllocationRow[]) =>
  rows.find(({ personId }) => personId === "p-casey") as AllocationRow;

const linesIn = (row: AllocationRow, month: string) =>
  (row.allocated.get(month) ?? []).map(
    ({ name, percentage, drafted }) =>
      `${name} ${String(percentage)}%${drafted === undefined ? "" : ` ${drafted}`}`,
  );

describe("a person's allocations", () => {
  it("lists each month's features by name, with the percentage in force", () => {
    const row = casey(
      rowsOf([
        allocation({ months: { "2027-03": 50 } }),
        allocation({
          id: "a-2",
          featureId: "f-billing",
          months: { "2027-02": 25, "2027-04": null },
        }),
      ]),
    );

    expect(linesIn(row, "2027-02")).toEqual(["Billing 25%"]);
    expect(linesIn(row, "2027-03")).toEqual(["Billing 25%", "Checkout 50%"]);
    expect(linesIn(row, "2027-04")).toEqual(["Checkout 50%"]);
    expect(row.values).toEqual({
      "2027-02": ["f-billing"],
      "2027-03": ["f-billing", "f-checkout"],
      "2027-04": ["f-checkout"],
    });
    expect(row.draft).toBeUndefined();
  });

  it("keeps the person's months outside their employment", () => {
    expect(casey(rowsOf([])).outside).toEqual(new Set(["2027-02"]));
  });

  it("gives someone a row under each feature team and under none, holding only those months, grouped by feature team", () => {
    const rows = rowsOf([allocation({ months: { "2027-03": 50 } })], {
      grouping: featureTeamGrouping,
    });
    const onSearch = rows.find(({ group }) => group?.id === search.id);
    const onNone = rows.find(({ group }) => group === undefined);

    expect(onSearch?.holds).toEqual(new Set(["2027-03", "2027-02"]));
    expect(linesIn(onSearch as AllocationRow, "2027-03")).toEqual([
      "Checkout 50%",
    ]);
    expect(onNone?.holds).toEqual(new Set(["2027-04", "2027-02"]));
    expect(linesIn(onNone as AllocationRow, "2027-03")).toEqual([]);
    expect(new Set(rows.map(({ id }) => id)).size).toBe(2);
  });

  describe("grouped by manager", () => {
    const dana = { id: "p-dana", name: "Dana Fictional" };
    const blair = { id: "p-blair", name: "Blair Fictional" };
    const withManagers = (
      managers: TeamMonths["people"][number]["managers"],
    ): TeamMonths => ({
      ...teamMonths,
      people: teamMonths.people.map((person) => ({ ...person, managers })),
    });
    const byManager = (data: TeamMonths) =>
      allocationMonthRecords({
        teamMonths: data,
        allocations: { allocations: [allocation()], features },
        chart: noHires,
        grouping: "manager",
        show: "both",
      });

    it("gives someone a row under each manager they reported to, holding that line's months", () => {
      const rows = byManager(
        withManagers({ "2027-02": blair, "2027-03": blair, "2027-04": dana }),
      );

      expect(
        rows.map(({ manager, holds }) => [manager?.id, holds && [...holds]]),
      ).toEqual([
        ["p-blair", ["2027-03", "2027-02"]],
        ["p-dana", ["2027-04", "2027-02"]],
      ]);
    });

    it("lists every month's managers, for grouping by them", () => {
      expect(
        allocationManagers(
          withManagers({ "2027-03": null, "2027-04": dana }),
          noHires,
        ),
      ).toEqual([blair, dana]);
    });
  });
});

describe("a person's allocations as drafts change them", () => {
  it("marks a changed percentage from the month the draft changes, with the row as approved kept", () => {
    const row = casey(rowsOf([allocation({ draft: draft() })]));

    expect(linesIn(row, "2027-03")).toEqual(["Checkout 75% changed"]);
    expect(row.allocated.get("2027-03")?.[0]?.live).toBe(50);
    expect(row.draft).toMatchObject({
      action: "changed",
      changed: ["2027-03", "2027-04"],
      state: "waiting",
      live: { values: { "2027-03": ["f-checkout"] } },
    });
    expect(row.live === undefined ? [] : linesIn(row.live, "2027-03")).toEqual([
      "Checkout 50%",
    ]);
  });

  it("marks a feature a draft adds", () => {
    const row = casey(
      rowsOf([
        allocation({
          months: {},
          draft: draft({ action: "created", months: { "2027-04": 100 } }),
        }),
      ]),
    );

    expect(linesIn(row, "2027-03")).toEqual([]);
    expect(linesIn(row, "2027-04")).toEqual(["Checkout 100% added"]);
    expect(row.allocated.get("2027-04")?.[0]?.live).toBeNull();
  });

  it("strikes through a feature a draft takes off, or leaves it out with drafts applied", () => {
    const removed = [allocation({ draft: draft({ action: "deleted" }) })];

    expect(linesIn(casey(rowsOf(removed)), "2027-03")).toEqual([
      "Checkout 50% removed",
    ]);
    expect(
      linesIn(casey(rowsOf(removed, { show: "drafts" })), "2027-03"),
    ).toEqual([]);
    expect(casey(rowsOf(removed, { show: "drafts" })).values).toEqual({});
  });

  it("leaves months a draft holds at the same percentage unmarked", () => {
    const row = casey(
      rowsOf([
        allocation({
          months: { "2027-02": 50 },
          draft: draft({ months: { "2027-02": 50, "2027-04": 25 } }),
        }),
      ]),
    );

    expect(linesIn(row, "2027-03")).toEqual(["Checkout 50%"]);
    expect(row.draft?.changed).toEqual(["2027-04"]);
  });

  it("is no draft when the draft changes none of the months shown", () => {
    const row = casey(
      rowsOf([
        allocation({
          months: { "2027-03": 50 },
          draft: draft({ months: { "2027-03": 50, "2028-06": null } }),
        }),
      ]),
    );

    expect(row.draft).toBeUndefined();
  });

  it("shows a rejected draft beside live, and leaves it out with drafts applied", () => {
    const rejected = [allocation({ draft: draft({ state: "rejected" }) })];

    expect(casey(rowsOf(rejected)).draft?.state).toBe("rejected");
    expect(
      linesIn(casey(rowsOf(rejected, { show: "drafts" })), "2027-03"),
    ).toEqual(["Checkout 50%"]);
  });

  it("lists features with drafts and without them together, by name", () => {
    const row = casey(
      rowsOf([
        allocation({ draft: draft() }),
        allocation({
          id: "a-2",
          featureId: "f-billing",
          months: { "2027-03": 25 },
        }),
      ]),
    );

    expect(linesIn(row, "2027-03")).toEqual([
      "Billing 25%",
      "Checkout 75% changed",
    ]);
  });

  it("is the reader's own while any draft holds their unpublished changes", () => {
    const row = casey(
      rowsOf([allocation({ draft: draft({ unpublished: true }) })]),
    );

    expect(row.draft?.unpublished).toBe(true);
  });
});

describe("planned hires' allocations", () => {
  const chart: OrgChart = {
    people: [
      card({}),
      card({
        id: "h-tester",
        preferredName: "Payments tester",
        managerId: "p-blair",
        planned: { expected: "2027-03" },
      }),
      card({
        id: "h-unnamed",
        preferredName: "SDET, TBD-7",
        managerId: null,
        planned: { expected: "2027-04", shownId: "TBD-7" },
      }),
    ],
    drafted: [],
  };

  it("gives each planned hire on the chart a row, under its manager, from the month it is expected", () => {
    const rows = rowsOf(
      [
        allocation({
          personId: null,
          plannedHireId: "h-tester",
          months: { "2027-03": 100 },
        }),
      ],
      { chart },
    );
    const tester = rows.find(({ id }) => id === "h-tester") as AllocationRow;

    expect(tester).toMatchObject({
      name: "Payments tester",
      manager: { id: "p-blair", name: "Blair Fictional" },
      allocatableFrom: "2027-03",
    });
    expect(tester.group).toBeUndefined();
    expect(linesIn(tester, "2027-03")).toEqual(["Checkout 100%"]);
    expect(linesIn(casey(rows), "2027-03")).toEqual([]);
  });

  it("lists the managers of people and of planned hires, for grouping by manager", () => {
    expect(allocationManagers(teamMonths, chart)).toEqual([
      { id: "p-blair", name: "Blair Fictional" },
      { id: "p-blair", name: "Blair Fictional" },
    ]);
  });

  it("lists today's managers alone when no month's managers are given", () => {
    const today = {
      ...teamMonths,
      people: teamMonths.people.map(
        ({ id, preferredName, manager, teams }) => ({
          id,
          preferredName,
          manager,
          teams,
        }),
      ),
    };
    expect(allocationManagers(today, chart)).toEqual([
      { id: "p-blair", name: "Blair Fictional" },
      { id: "p-blair", name: "Blair Fictional" },
    ]);
  });

  it("names a planned hire with no name by its position and ID, in place of a name", () => {
    const unnamed = rowsOf([], { chart }).find(
      ({ id }) => id === "h-unnamed",
    ) as AllocationRow;

    expect(unnamed).toMatchObject({
      name: "",
      madeName: "SDET, TBD-7",
      manager: null,
    });
  });
});

describe("capacityOf", () => {
  const row = (fields: Partial<AllocationRow>): AllocationRow => ({
    ...casey(rowsOf([allocation({ months: { "2027-03": 50 } })])),
    ...fields,
  });

  it("adds up each row's month, counting someone with rows under two groups once", () => {
    const first = row({ id: "one" });
    const hire = row({ id: "hire", personId: "h-tester" });

    expect(
      capacityOf([first, row({ id: "two" }), hire], "2027-03", "both"),
    ).toEqual({ allocated: 100, available: 200 });
  });

  it("counts drafts only with drafts applied", () => {
    const drafted = casey(
      rowsOf([allocation({ months: { "2027-03": 50 }, draft: draft() })]),
    );

    expect(capacityOf([drafted], "2027-03", "drafts").allocated).toBe(75);
    expect(capacityOf([drafted], "2027-03", "both").allocated).toBe(50);
  });

  it("leaves out months outside employment, with their allocations", () => {
    expect(
      capacityOf([row({ outside: new Set(["2027-03"]) })], "2027-03", "both"),
    ).toEqual({ allocated: 0, available: 0 });
  });

  it("leaves out months a row does not hold", () => {
    expect(
      capacityOf([row({ holds: new Set(["2027-04"]) })], "2027-03", "both"),
    ).toEqual({ allocated: 0, available: 0 });
  });
});

describe("a capacity total", () => {
  const renderTotal = (allocated: number, available: number) =>
    render(
      <MantineProvider theme={testTheme}>
        <CapacityTotal allocated={allocated} available={available} />
      </MantineProvider>,
    );

  it("gives person-months allocated of those available, and that as a share", () => {
    renderTotal(750, 900);

    expect(screen.getByText("7.5 of 9").nextSibling?.textContent).toBe("83.3%");
  });

  it("shows nothing when no one can be allocated", () => {
    renderTotal(0, 0);

    expect(screen.queryByText(/ of /)).toBeNull();
  });
});

describe("monthTotal", () => {
  const line = (fields: Partial<AllocationLine>): AllocationLine => ({
    featureId: "f-checkout",
    name: "Checkout",
    meaning: "in-progress",
    percentage: 50,
    live: 50,
    ...fields,
  });

  it("leaves out Possible features", () => {
    expect(monthTotal([line({}), line({ meaning: "possible" })], "both")).toBe(
      50,
    );
  });

  it("counts drafts only with drafts applied", () => {
    // Given a changed feature, an added one, and, beside live, one taken off
    const changed = line({ percentage: 75, live: 50, drafted: "changed" });
    const added = line({ percentage: 25, live: null, drafted: "added" });
    const removed = line({ percentage: 40, live: 40, drafted: "removed" });

    // Then beside live the total is as approved, and with drafts applied as drafted, where the
    // feature taken off is gone
    expect(monthTotal([changed, added, removed], "both")).toBe(90);
    expect(monthTotal([changed, added], "drafts")).toBe(100);
  });
});

describe("allocatableIn", () => {
  const row = casey(rowsOf([]));

  it("is every month of someone's employment", () => {
    expect(allocatableIn(row, "2027-03")).toBe(true);
    expect(allocatableIn(row, "2027-02")).toBe(false);
  });

  it("starts from the month a planned hire is expected", () => {
    const hire = {
      ...row,
      outside: new Set<string>(),
      allocatableFrom: "2027-03",
    };

    expect(allocatableIn(hire, "2027-02")).toBe(false);
    expect(allocatableIn(hire, "2027-03")).toBe(true);
  });
});

describe("a month's cell", () => {
  const cell = (
    allocated: readonly Allocation[],
    month = "2027-03",
    show: "both" | "drafts" = "both",
  ) =>
    render(
      <MantineProvider theme={testTheme}>
        <div data-cell>
          <AllocationLines
            lines={
              casey(rowsOf(allocated, { show })).allocated.get(month) ?? []
            }
            month={month}
            currentMonth="2027-03"
            allocatable={month !== "2027-02"}
            show={show}
          />
        </div>
      </MantineProvider>,
    );

  const lineTexts = () =>
    [...(document.querySelector("[data-cell] > div")?.children ?? [])].map(
      (line) => line.textContent,
    );

  it("shows a whole month on one feature with no total", () => {
    cell([allocation({ months: { "2027-03": 100 } })]);

    expect(lineTexts()).toEqual(["Checkout100%"]);
  });

  it("totals two or more features", () => {
    cell([
      allocation({ months: { "2027-03": 50 } }),
      allocation({
        id: "a-2",
        featureId: "f-billing",
        months: { "2027-03": 50 },
      }),
    ]);

    expect(lineTexts()).toEqual(["Billing50%", "Checkout50%", "Total100%"]);
  });

  it("marks a month over a whole month", () => {
    cell([
      allocation({ months: { "2027-03": 75 } }),
      allocation({
        id: "a-2",
        featureId: "f-billing",
        months: { "2027-03": 50 },
      }),
    ]);

    expect(screen.getByText("Over").parentElement?.textContent).toBe(
      "Over125%",
    );
  });

  it("marks a month under a whole month, even with one feature", () => {
    cell([allocation({ months: { "2027-03": 50 } })]);

    expect(lineTexts()).toEqual(["Checkout50%", "Under50%"]);
  });

  it("marks an empty month someone can be allocated in as under", () => {
    cell([]);

    expect(lineTexts()).toEqual(["Under0%"]);
  });

  it("leaves past months unmarked", () => {
    cell([allocation({ months: { "2027-02": 50 } })], "2027-02");

    expect(lineTexts()).toEqual(["Checkout50%"]);
  });

  it("gives each feature's whole name as a tip", () => {
    cell([allocation({ months: { "2027-03": 100 } })]);

    expect(
      screen
        .getByText("Checkout")
        .closest("[data-tip]")
        ?.getAttribute("data-tip"),
    ).toBe("Checkout");
  });

  it("says aloud what a draft does to a feature, and dots what it adds, changes or removes", () => {
    cell([
      allocation({ draft: draft() }),
      allocation({
        id: "a-2",
        featureId: "f-billing",
        draft: draft({ action: "deleted" }),
      }),
    ]);

    expect(screen.getByText(", changed")).toBeDefined();
    expect(screen.getByText(", removed")).toBeDefined();
    expect(
      screen.getByText("Checkout").querySelector('[aria-hidden="true"]'),
    ).not.toBeNull();
    expect(
      screen.getByText("Billing").querySelector('[aria-hidden="true"]'),
    ).not.toBeNull();
  });
});

describe("the table", () => {
  const rows = rowsOf([allocation()]);
  const table = allocationMonthsTable({
    teamMonths,
    features,
    managers: [{ id: "p-blair", name: "Blair Fictional" }],
    currentMonth: "2027-03",
    show: "both",
  });

  it("is read only, offering the allocated features to filter a month by", () => {
    const columns = table.columnsFor([], [], [], rows);
    const [name, ...monthColumns] = columns;

    expect(monthColumns[0]?.choices.map(({ label }) => label)).toEqual([
      "Billing",
      "Checkout",
      "Maybe later",
    ]);
    expect(table.label).toBe("Allocations by month");
    expect(name?.readOnly).toBe(true);
    expect(monthColumns.every(({ readOnly }) => readOnly === true)).toBe(true);
    expect(monthColumns.map(({ key }) => key)).toEqual(months);
  });

  it("groups by manager or feature team", () => {
    expect(table.groupings?.map(({ label }) => label)).toEqual([
      "Manager",
      "Feature team",
    ]);
  });

  it("counts people and planned hires apart", () => {
    expect(
      table.counted?.counted([
        casey(rows),
        { ...casey(rows), plannedHire: true },
      ]),
    ).toBe("1 person and 1 planned hire");
  });

  it("totals each group and the organization, in person-months", () => {
    render(
      <MantineProvider theme={testTheme}>
        {table.totals?.cell([casey(rows)], "2027-03")}
      </MantineProvider>,
    );

    expect(table.totals).toMatchObject({
      label: "Total",
      overall: "Organization",
    });
    expect(screen.getByText("0.5 of 1")).toBeTruthy();
  });

  it("names a row by its name, or a planned hire with none by its position and ID", () => {
    const [name] = table.columnsFor([], [], [], rows);

    expect(table.nameOf(casey(rows))).toBe("Casey Fictional");
    expect(name?.standIn?.(casey(rows))).toBe("");
    expect(
      table.nameOf({ ...casey(rows), name: "", madeName: "SDET, TBD-7" }),
    ).toBe("SDET, TBD-7");
  });
});
