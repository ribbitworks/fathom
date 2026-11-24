// SPDX-License-Identifier: Apache-2.0

// Fictional fields, lists, actions and managed people for the People table's tests, and the table
// to render with them.

import type { Field, List, Person } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { PeopleGrid } from "./people-grid.tsx";
import { emptyView } from "./table-view.ts";
import { testTheme } from "./test-support.tsx";

export const site: Field = {
  id: "f1",
  keyNumber: 1,
  name: "Site",
  type: "choice" as const,
  listId: "l1",
  visibility: null,
  multiple: false,
  required: false,
  onPlannedHires: true,
};

// The built-in Positions list, with the one position the people below have.
export const positions: List = {
  id: "positions",
  keyNumber: 1,
  name: "Positions",
  description: "",
  visibility: "general",
  retired: false,
  builtIn: "positions",
  choices: [
    {
      id: "position-1",
      label: "Fictional Engineer",
      description: "",
      retired: false,
    },
  ],
};

export const sites: List = {
  id: "l1",
  keyNumber: 1,
  name: "Sites",
  description: "",
  visibility: "general",
  retired: false,
  choices: [{ id: "c1", label: "Harbour", description: "", retired: false }],
};

export const noop = () => undefined;

export const actions = {
  add: noop,
  update: noop,
  remove: noop,
  discard: noop,
  resubmit: noop,
  decide: noop,
  editColumn: noop,
  discardColumn: noop,
  resubmitColumn: noop,
};

export const person = (id: string, more: Partial<Person> = {}): Person => ({
  id,
  keyNumber: 1,
  preferredName: `Fictional ${id}`,
  employeeId: id,
  positionId: "position-1",
  startDate: "2024-01-01",
  endDate: null,
  isManager: true,
  values: {},
  links: {},
  ...more,
});
export const lead = (id: string) => ({ id, preferredName: `Fictional ${id}` });
export const people = [
  person("p1", { teamName: "Harbour Crew", manager: null }),
  person("p2", { manager: lead("p1"), team: "Harbour Crew" }),
  person("p3", { endDate: "2025-01-01", manager: lead("p1") }),
  person("p4", {
    manager: lead("p3"),
    team: null,
    managerLeft: true,
    managerFrom: "2024-02-01",
  }),
  person("p5", { manager: { id: "p9", preferredName: "Fictional p9" } }),
];
export const grid = (more: Partial<Parameters<typeof PeopleGrid>[0]> = {}) => (
  <MantineProvider theme={testTheme}>
    <PeopleGrid
      people={people}
      fields={[]}
      order={[]}
      lists={[positions]}
      canEdit
      canEditColumns={false}
      showDates
      view={emptyView}
      onView={noop}
      actions={actions}
      {...more}
    />
  </MantineProvider>
);
export const text = (row: string, key: string) =>
  document.getElementById(`cell-${row}-${key}`)?.textContent;
