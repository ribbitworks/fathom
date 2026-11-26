// SPDX-License-Identifier: Apache-2.0

// Tests for the allocations table month by month: how a month's cell reads, the table's columns and
// choices, and its filter across every month.

import type { AllocatedFeature, Allocation } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  allocatedWork,
  AllocationLines,
  allocationMonthRecords,
  allocationMonthsTable,
  type AllocationRow,
  monthHoursOf,
  unseenActivityChoice,
  unseenFeatureChoice,
} from "./allocation-months.tsx";

import { allocatedToGrouping } from "./allocation-groups.ts";
import { anyMonthKey, featureTeamGrouping } from "./team-months.tsx";
import { testTheme } from "./test-support.tsx";
import {
  activities,
  months,
  search,
  teamMonths,
  features,
  allocation,
  draft,
  noHires,
  rowsOf,
  casey,
} from "./test-allocation-months.ts";

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

  it("shows a whole month on two or more features with no total", () => {
    cell([
      allocation({ months: { "2027-03": 50 } }),
      allocation({
        id: "a-2",
        featureId: "f-billing",
        months: { "2027-03": 50 },
      }),
    ]);

    expect(lineTexts()).toEqual(["Billing50%", "Checkout50%"]);
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

    const over = screen.getByText("Over").parentElement;
    expect([over?.textContent, over?.getAttribute("data-tip")]).toEqual([
      "Over+25%, Total 125%",
      "Total 125%",
    ]);
  });

  it("marks a month under a whole month, even with one feature", () => {
    cell([allocation({ months: { "2027-03": 50 } })]);

    expect(lineTexts()).toEqual(["Checkout50%", "Under\u221250%, Total 50%"]);
  });

  it("marks an empty month someone can be allocated in as not allocated, with no tip", () => {
    cell([]);

    expect([
      lineTexts(),
      screen.getByText("Not allocated").closest("[data-tip]"),
    ]).toEqual([["Not allocated"], null]);
  });

  it("names an activity as a feature, its project in its tip, and counts its time", () => {
    // Given Casey on the activity General of Crane Control for half of March
    cell([
      allocation({
        featureId: null,
        activityId: "a-general",
        months: { "2027-03": 50 },
      }),
    ]);

    // Then its line reads as a feature's, with no swatch, and the month is half allocated
    const line = screen.getByText("General").closest("[data-tip]");
    expect([
      line?.getAttribute("data-tip"),
      line?.querySelector("[data-colour]"),
    ]).toEqual(["General (Crane Control)", null]);
    expect(lineTexts()).toEqual(["General50%", "Under\u221250%, Total 50%"]);
  });

  it("names each feature after its team's colour", () => {
    render(
      <MantineProvider theme={testTheme}>
        <AllocationLines
          lines={[
            {
              workId: "f-checkout",
              name: "Checkout",
              tip: "Checkout",
              meaning: "in-progress",
              monthHours: 0,
              colour: "teal",
              percentage: 100,
              live: 100,
            },
          ]}
          month="2027-03"
          currentMonth="2027-03"
          allocatable
          show="both"
        />
      </MantineProvider>,
    );

    expect(
      screen
        .getByText("Checkout")
        .parentElement?.querySelector("[data-colour]")
        ?.getAttribute("data-colour"),
    ).toBe("teal");
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
      screen
        .getByText("Checkout")
        .parentElement?.querySelector('[aria-hidden="true"]'),
    ).not.toBeNull();
    expect(
      screen
        .getByText("Billing")
        .parentElement?.querySelector('[aria-hidden="true"]'),
    ).not.toBeNull();
  });
});

describe("the table", () => {
  const rows = rowsOf([allocation()]);
  const table = allocationMonthsTable({
    teamMonths,
    works: allocatedWork({ allocations: [], features, activities }),
    allocations: [allocation()],
    managers: [{ id: "p-blair", name: "Blair Fictional" }],
    currentMonth: "2027-03",
    show: "both",
    byWork: false,
    offersWork: true,
  });

  it("is read only, offering the allocated features and activities to filter a month by", () => {
    const columns = table.columnsFor([], [], [], rows);
    const [name, ...monthColumns] = columns;

    expect(monthColumns[0]?.choices.map(({ label }) => label)).toEqual([
      "Billing",
      "Checkout",
      "General (Crane Control)",
      "Maybe later",
    ]);
    expect(table.label).toBe("Allocations by month");
    expect(name?.readOnly).toBe(true);
    expect(monthColumns.every(({ readOnly }) => readOnly === true)).toBe(true);
    expect(monthColumns.map(({ key }) => key)).toEqual(months);
  });

  it("offers the features the reader can't read as one choice in each month, its value and live one alike", () => {
    // Given Casey on two features the reader can't read in March
    const hidden = (id: string): AllocatedFeature => ({
      id,
      name: "A feature",
      meaning: "in-progress",
      colour: null,
      unseen: true,
    });
    const unseen = [hidden("f-hidden-1"), hidden("f-hidden-2")];
    const row = allocationMonthRecords({
      teamMonths,
      allocations: {
        allocations: [
          allocation({ featureId: "f-hidden-1" }),
          allocation({ id: "a-2", featureId: "f-hidden-2" }),
        ],
        features: unseen,
        activities: [],
      },
      chart: noHires,
      grouping: undefined,
      show: "both",
    }).find(({ personId }) => personId === "p-casey");
    const march = allocationMonthsTable({
      teamMonths,
      works: allocatedWork({
        allocations: [],
        features: unseen,
        activities: [],
      }),
      allocations: [],
      managers: undefined,
      currentMonth: "2027-03",
      show: "both",
      byWork: false,
      offersWork: true,
    })
      .columnsFor([], [], [], [])
      .find(({ key }) => key === "2027-03");

    // Then March offers one choice for them, and reads as it
    expect(march?.choices.map(({ id, label }) => [id, label])).toEqual([
      [unseenFeatureChoice, "A feature"],
    ]);
    expect(march?.value(row as AllocationRow)).toEqual([unseenFeatureChoice]);
    const draftOfMarch = {
      live: {
        values: { "2027-03": ["f-hidden-1", "f-hidden-2"] },
        links: {},
      },
    };
    expect(march?.live(draftOfMarch as never)).toEqual([unseenFeatureChoice]);
  });

  it("offers the activities the reader can't read as one choice of their own", () => {
    const hidden = (id: string) => ({
      id,
      name: "An activity",
      meaning: "in-progress" as const,
      colour: null,
      unseen: true as const,
    });
    const unseen = [hidden("a-hidden-1"), hidden("a-hidden-2")];
    const row = allocationMonthRecords({
      teamMonths,
      allocations: {
        allocations: [
          allocation({ featureId: null, activityId: "a-hidden-1" }),
          allocation({ id: "a-2", featureId: null, activityId: "a-hidden-2" }),
        ],
        features: [],
        activities: unseen,
      },
      chart: noHires,
      grouping: undefined,
      show: "both",
    }).find(({ personId }) => personId === "p-casey") as AllocationRow;
    const march = allocationMonthsTable({
      teamMonths,
      works: allocatedWork({
        allocations: [],
        features: [],
        activities: unseen,
      }),
      allocations: [],
      managers: undefined,
      currentMonth: "2027-03",
      show: "both",
      byWork: false,
      offersWork: true,
    })
      .columnsFor([], [], [], [])
      .find(({ key }) => key === "2027-03");

    expect(march?.choices.map(({ id, label }) => [id, label])).toEqual([
      [unseenActivityChoice, "An activity"],
    ]);
    expect(march?.value(row)).toEqual([unseenActivityChoice]);
  });

  it("filters a row by the activities it is allocated to, as by features", () => {
    const [filter] = table.barFilters ?? [];
    const onGeneral = casey(
      rowsOf([allocation({ featureId: null, activityId: "a-general" })]),
    );

    expect(filter?.column.value(onGeneral)).toEqual(["a-general"]);
  });

  it("filters across the whole grid by what a row is allocated to in its months, from an Allocations button", () => {
    // Given Casey on Checkout in March, under Search, and on Billing in April, under none
    const grouped = rowsOf(
      [
        allocation({ months: { "2027-03": 50, "2027-04": null } }),
        allocation({
          id: "a-2",
          featureId: "f-billing",
          months: { "2027-04": 25 },
        }),
      ],
      { grouping: featureTeamGrouping },
    );
    const [filter] = table.barFilters ?? [];
    const inAnyMonth = (group: string | undefined) =>
      filter?.column.value(
        grouped.find((row) => row.group?.id === group) as AllocationRow,
      );

    // Then each row has only its own months' allocations, and none reads as not allocated
    expect([
      filter?.button,
      filter?.column.key,
      filter?.column.emptyLabel,
    ]).toEqual(["Allocations", anyMonthKey, "Not allocated"]);
    expect(inAnyMonth(search.id)).toEqual(["f-checkout"]);
    expect(inAnyMonth(undefined)).toEqual(["f-billing"]);
    expect(filter?.column.value(casey(rowsOf([])))).toEqual([]);
  });

  it("groups by manager, feature team or what each is allocated to", () => {
    expect(table.groupings?.map(({ label }) => label)).toEqual([
      "Manager",
      "Feature team",
      "Allocated to",
    ]);
  });

  it("totals each group and the organization, in person-months", () => {
    render(
      <MantineProvider theme={testTheme}>
        {table.totals?.cell([casey(rows)], "2027-03")}
      </MantineProvider>,
    );

    expect(table.totals).toMatchObject({
      label: "Total, person-months",
      overall: "Organization, person-months",
    });
    expect(screen.getByText("0.5 of 1")).toBeTruthy();
    expect(screen.getByText("person-month allocated")).toBeTruthy();
    expect(document.querySelector("[data-tip]")?.getAttribute("data-tip")).toBe(
      "0.5 of 1 person-month allocated: 50%",
    );
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

describe("the table grouped by what each is allocated to", () => {
  // Casey on Checkout at half from March, whose whole month gives 80 hours, and Checkout's
  // estimate, needing 240 hours with the buffer, by June, past the grid's last month.
  const onCheckout = allocation({ hours: { full: 80, rampUp: {} } });
  const withEffort = features.map((feature) =>
    feature.id === "f-checkout"
      ? {
          ...feature,
          effort: {
            live: { estimate: 200, needed: 240, lastMonth: "2027-06" },
          },
        }
      : feature,
  );
  const tableBy = (byWork: boolean) =>
    allocationMonthsTable({
      teamMonths,
      works: allocatedWork({
        allocations: [],
        features: withEffort,
        activities: [],
      }),
      allocations: [onCheckout],
      managers: undefined,
      currentMonth: "2027-03",
      show: "both",
      byWork,
      offersWork: true,
    });
  const rows = rowsOf([onCheckout], { grouping: allocatedToGrouping });

  it("totals each feature's hours each month as Allocated", () => {
    const { totals } = tableBy(true);

    expect([totals?.label, totals?.cell(rows, "2027-03")]).toEqual([
      "Allocated",
      "40 h",
    ]);
  });

  it("heads each feature with its Effort, Remaining, and Allocated to its last month, past the grid's", () => {
    const grouping = tableBy(true).groupings?.find(
      ({ key }) => key === allocatedToGrouping,
    );
    const [group] = grouping?.of(rows[0] as AllocationRow) ?? [];
    render(
      <MantineProvider theme={testTheme}>
        <p data-testid="heading">
          {group?.label}
          {group?.facts}
        </p>
      </MantineProvider>,
    );

    expect(screen.getByTestId("heading").textContent).toBe(
      "Checkout · Effort 200 h · Allocated 160 h · Remaining 80 h",
    );
  });

  it("totals a month before the allocation, or past the grid's, as none", () => {
    const { totals } = tableBy(true);
    expect([
      totals?.cell(rows, "2027-02"),
      totals?.cell(rows, "2030-01"),
    ]).toEqual(["0 h", "0 h"]);
  });

  it("heads those allocated to nothing as Not allocated", () => {
    const grouping = tableBy(true).groupings?.find(
      ({ key }) => key === allocatedToGrouping,
    );
    const [none] = rowsOf([], { grouping: allocatedToGrouping });

    expect(grouping?.of(none as AllocationRow)[0]?.label).toBe("Not allocated");
  });

  it("marks no one's load on a row for one feature, which holds only part of their month", () => {
    const [march] = tableBy(true)
      .columnsFor([], [], [], rows)
      .filter(({ key }) => key === "2027-03");
    render(
      <MantineProvider theme={testTheme}>
        <p data-testid="cell">{march?.content?.(rows[0] as AllocationRow)}</p>
      </MantineProvider>,
    );

    expect(screen.getByTestId("cell").textContent).toBe("Checkout50%");
  });

  // Casey on the General activity at half from March too, its estimate needing 48 hours, with no
  // dates, so counted to the current month.
  const onGeneral = allocation({
    id: "a-2",
    featureId: null,
    activityId: "a-general",
    hours: { full: 80, rampUp: {} },
  });
  const withActivityEffort = activities.map((activity) => ({
    ...activity,
    effort: { live: { estimate: 40, needed: 48, lastMonth: null } },
  }));
  const tableOfWork = (
    works: Parameters<typeof allocatedWork>[0],
    allocated: readonly Allocation[],
  ) =>
    allocationMonthsTable({
      teamMonths,
      works: allocatedWork(works),
      allocations: allocated,
      managers: undefined,
      currentMonth: "2027-03",
      show: "both",
      byWork: true,
      offersWork: true,
    });
  const groupingOf = (table: ReturnType<typeof tableOfWork>) =>
    table.groupings?.find(({ key }) => key === allocatedToGrouping);

  it("heads an activity by its name and its project, with its hours to the current month without dates, and totals them", () => {
    const table = tableOfWork(
      { allocations: [], features: withEffort, activities: withActivityEffort },
      [onCheckout, onGeneral],
    );
    const grouped = rowsOf([onCheckout, onGeneral], {
      grouping: allocatedToGrouping,
    });
    const onActivity = grouped.filter(({ work }) => work === "a-general");
    const [group] = groupingOf(table)?.of(onActivity[0] as AllocationRow) ?? [];
    render(
      <MantineProvider theme={testTheme}>
        <p data-testid="heading">
          {group?.label}
          {group?.facts}
        </p>
      </MantineProvider>,
    );

    expect([
      screen.getByTestId("heading").textContent,
      table.totals?.cell(onActivity, "2027-03"),
    ]).toEqual([
      "General (Crane Control) · Effort 40 h · Allocated 40 h · Remaining 8 h",
      "40 h",
    ]);
  });

  it("heads every feature, and every activity, the reader can't read under one heading of its kind, with no hours", () => {
    const hidden = (id: string, name: string) => ({
      id,
      name,
      meaning: "in-progress" as const,
      colour: null,
      unseen: true as const,
    });
    const table = tableOfWork(
      {
        allocations: [],
        features: [
          hidden("f-hidden-1", "A feature"),
          hidden("f-hidden-2", "A feature"),
        ],
        activities: [hidden("a-hidden-1", "An activity")],
      },
      [],
    );
    const groupOf = (work: string) =>
      groupingOf(table)?.of({ ...(rowsOf([])[0] as AllocationRow), work })[0];

    expect(
      ["f-hidden-1", "f-hidden-2", "a-hidden-1"].map((work) => {
        const group = groupOf(work);
        return [group?.key, group?.label, group?.facts];
      }),
    ).toEqual([
      [unseenFeatureChoice, "A feature", undefined],
      [unseenFeatureChoice, "A feature", undefined],
      [unseenActivityChoice, "An activity", undefined],
    ]);
  });

  it("is not offered to a reader who doesn't see the planning settings, which its hours tell", () => {
    const groupings = allocationMonthsTable({
      teamMonths,
      works: allocatedWork({
        allocations: [],
        features: withEffort,
        activities: [],
      }),
      allocations: [onCheckout],
      managers: undefined,
      currentMonth: "2027-03",
      show: "both",
      byWork: false,
      offersWork: false,
    }).groupings?.map(({ label }) => label);

    expect(groupings).toEqual(["Feature team"]);
  });

  it("totals in person-months under any other grouping", () => {
    expect(tableBy(false).totals?.label).not.toBe("Allocated");
  });
});

describe("monthHoursOf", () => {
  const line = (percentage: number, live: number | null) => ({
    workId: "f-checkout",
    name: "Checkout",
    tip: "Checkout",
    meaning: "in-progress" as const,
    colour: null,
    monthHours: 80,
    percentage,
    live,
  });

  it("gives the hours at the drafted percentage while drafts show, and at the approved one otherwise, none for a line a draft adds", () => {
    const lines = [line(100, 50), line(25, null)];
    expect([
      monthHoursOf(lines, "drafts"),
      monthHoursOf(lines, "live"),
    ]).toEqual([100, 40]);
  });
});
