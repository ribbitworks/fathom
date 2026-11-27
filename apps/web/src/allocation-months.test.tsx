// SPDX-License-Identifier: Apache-2.0

// Tests for allocations month by month as records: each row's features and percentages by month,
// people and planned hires, the months drafts change, a month's total as the Draft menu shows it,
// the months someone can be allocated in, and the marks they carry from now on.

import type { Allocation, OrgChart, TeamMonths } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  allocatableIn,
  type AllocationLine,
  allocationMonthRecords,
  type AllocationRow,
  CapacityTotal,
  capacityOf,
  marksFrom,
  monthTotal,
} from "./allocation-months.tsx";
import { allocatedToGrouping } from "./allocation-groups.ts";
import { monthManagers } from "./planned-hire-months.ts";
import {
  activities,
  allocation,
  card,
  casey,
  draft,
  features,
  linesIn,
  months,
  noHires,
  rowsOf,
  search,
  teamMonths,
} from "./test-allocation-months.ts";
import { featureTeamGrouping } from "./team-months.tsx";
import { testTheme } from "./test-support.tsx";

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

  it("gives someone a row under each feature they're allocated to, each showing that feature's lines alone, grouped by what they're allocated to", () => {
    const rows = rowsOf(
      [
        allocation({ months: { "2027-03": 50 } }),
        allocation({
          id: "a-2",
          featureId: "f-billing",
          months: { "2027-03": 25 },
        }),
      ],
      { grouping: allocatedToGrouping },
    );

    expect(rows.map((row) => [row.work, linesIn(row, "2027-03")])).toEqual([
      ["f-checkout", ["Checkout 50%"]],
      ["f-billing", ["Billing 25%"]],
    ]);
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
        allocations: { allocations: [allocation()], features, activities },
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
        monthManagers(
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
    // As live, the line keeps its approved percentage, marked with the change waiting for it
    expect(row.live === undefined ? [] : linesIn(row.live, "2027-03")).toEqual([
      "Checkout 50% changed",
    ]);
    expect(row.live?.allocated.get("2027-03")?.[0]).toMatchObject({
      shownLive: true,
      draft: { state: "waiting" },
    });
  });

  it("marks a feature a draft takes off as live, unstruck, for the Live row", () => {
    const row = casey(
      rowsOf([allocation({ draft: draft({ action: "deleted" }) })]),
    );

    expect(row.live?.allocated.get("2027-03")?.[0]).toMatchObject({
      drafted: "removed",
      shownLive: true,
    });
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
        keyNumber: 1,
        preferredName: "Payments tester",
        managerId: "p-blair",
        planned: { expected: "2027-03" },
      }),
      card({
        id: "h-unnamed",
        keyNumber: 1,
        preferredName: "SDET, TBD-7",
        managerId: null,
        planned: { expected: "2027-04", shownId: "TBD-7" },
      }),
    ],
    drafted: [],
  };

  it("marks none of a planned hire's months before it is expected", () => {
    // Given a hire expected in April, a whole month from then on
    const rows = rowsOf(
      [
        allocation({
          personId: null,
          plannedHireId: "h-unnamed",
          months: { "2027-04": 100 },
        }),
      ],
      { chart },
    );
    const hire = rows.find(({ personId }) => personId === "h-unnamed");

    // Then March, before it is expected, is not marked Not allocated
    expect(
      hire === undefined
        ? undefined
        : [...marksFrom(hire, months, "2027-02", "both")],
    ).toEqual([]);
  });

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
      plannedHire: true,
    });
    expect(tester.outside.has("2027-02")).toBe(true);
    expect(tester.outside.has("2027-03")).toBe(false);
    expect(tester.group).toBeUndefined();
    expect(linesIn(tester, "2027-03")).toEqual(["Checkout 100%"]);
    expect(linesIn(casey(rows), "2027-03")).toEqual([]);
  });

  it("gives a planned hire on a team a row under it, holding the months it is on it, grouped by feature team", () => {
    // Given the tester on Search from April
    const rows = rowsOf(
      [
        allocation({
          personId: null,
          plannedHireId: "h-tester",
          months: { "2027-03": 50, "2027-04": 100 },
        }),
      ],
      {
        chart,
        grouping: featureTeamGrouping,
        hires: [{ id: "h-tester", teams: { "2027-04": [search.id] } }],
      },
    );
    const tester = rows.filter(({ personId }) => personId === "h-tester");

    // Then it has a row under Search holding April, and one under none holding March
    expect(
      tester.map(({ group, holds }) => [
        group?.id,
        [...(holds ?? [])].filter((month) => months.includes(month)).sort(),
      ]),
    ).toEqual([
      [search.id, ["2027-02", "2027-04"]],
      [undefined, ["2027-02", "2027-03"]],
    ]);
    expect(tester.every(({ plannedHire }) => plannedHire === true)).toBe(true);
  });

  it("lists the managers of people and of planned hires, for grouping by manager", () => {
    expect(monthManagers(teamMonths, chart)).toEqual([
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
          keyNumber: 1,
          preferredName,
          manager,
          teams,
        }),
      ),
    };
    expect(monthManagers(today, chart)).toEqual([
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
    workId: "f-checkout",
    name: "Checkout",
    tip: "Checkout",
    meaning: "in-progress",
    monthHours: 0,
    colour: null,
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

  it("leaves out the months before a planned hire is expected, as outside its employment", () => {
    const hire = {
      ...row,
      outside: new Set(["2027-02"]),
      plannedHire: true as const,
    };

    expect(allocatableIn(hire, "2027-02")).toBe(false);
    expect(allocatableIn(hire, "2027-03")).toBe(true);
  });
});

describe("marksFrom", () => {
  const marks = (monthly: Allocation["months"], currentMonth: string) =>
    [
      ...marksFrom(
        casey(rowsOf([allocation({ months: monthly })])),
        months,
        currentMonth,
        "both",
      ),
    ].sort();

  it("gives each mark any month carries from the current month on", () => {
    expect(marks({ "2027-03": 50, "2027-04": 150 }, "2027-03")).toEqual([
      "over",
      "under",
    ]);
  });

  it("leaves out the months before the current month", () => {
    expect(marks({ "2027-03": 50, "2027-04": 150 }, "2027-04")).toEqual([
      "over",
    ]);
  });

  it("gives none for whole months, nor for months outside employment", () => {
    expect(marks({ "2027-03": 100, "2027-04": 100 }, "2027-02")).toEqual([]);
  });

  it("reads drafts only with drafts applied, as the cells do", () => {
    // Given Casey a whole month from March, which a draft makes 75% from April
    const allocated = [
      allocation({
        months: { "2027-03": 100 },
        draft: draft({ months: { "2027-04": 75 } }),
      }),
    ];
    const marksIn = (show: "drafts" | "live") => [
      ...marksFrom(casey(rowsOf(allocated, { show })), months, "2027-03", show),
    ];

    // Then April is under with drafts applied, and whole as approved
    expect([marksIn("drafts"), marksIn("live")]).toEqual([["under"], []]);
  });

  it("leaves out the months a row does not hold, as its cells are blank", () => {
    const row = {
      ...casey(
        rowsOf([allocation({ months: { "2027-03": 100, "2027-04": 50 } })]),
      ),
      holds: new Set(["2027-03"]),
    };

    expect([...marksFrom(row, months, "2027-03", "both")]).toEqual([]);
  });
});
