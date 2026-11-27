// SPDX-License-Identifier: Apache-2.0

// What the Metrics panel's tests share: the People table, with made-up levels and roles, and the
// panel's figures by group.

import type { Field, List, Person, PersonDraft } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { screen, within } from "@testing-library/react";
import { useState } from "react";
import { PeopleGrid } from "./people-grid.tsx";
import { emptyView, type View } from "./table-view.ts";
import { testTheme } from "./test-support.tsx";
import { peopleActions } from "./test-people-grid.tsx";

export const level: Field = {
  id: "f1",
  keyNumber: 1,
  name: "Level",
  type: "choice" as const,
  listId: "l1",
  visibility: null,
  multiple: false,
  required: false,
};
export const role: Field = {
  id: "f2",
  keyNumber: 1,
  name: "Role",
  type: "choice" as const,
  listId: "l2",
  visibility: null,
  multiple: false,
  required: false,
};
export const hours: Field = {
  id: "f3",
  keyNumber: 1,
  name: "Hours",
  type: "number" as const,
  listId: null,
  visibility: "general",
  multiple: false,
  required: false,
};
export const choice = (id: string, label: string) => ({
  id,
  label,
  description: "",
  retired: false,
});
export const lists: List[] = [
  {
    id: "l1",
    keyNumber: 1,
    name: "Levels",
    description: "",
    visibility: "general",
    retired: false,
    choices: [choice("p3", "P3"), choice("p4", "P4")],
  },
  {
    id: "l2",
    keyNumber: 1,
    name: "Roles",
    description: "",
    visibility: "general",
    retired: false,
    choices: [choice("test", "Test engineer"), choice("dev", "Developer")],
  },
];

export const person = (
  id: string,
  levels: string[],
  roles: string[],
  draft?: PersonDraft,
): Person => ({
  id,
  keyNumber: 1,
  preferredName: `Fictional ${id}`,
  employeeId: id,
  positionId: "position-1",
  values: { f1: levels, f2: roles },
  links: {},
  ...(draft ? { draft } : {}),
});

export const everyone = [
  person("a", ["p4"], ["test"]),
  person("b", ["p4"], ["dev"]),
  person("c", ["p3"], ["test"]),
  person("d", [], ["test"]),
];

export function Table({
  people = everyone,
  fields = [level, role],
  start = emptyView,
  showDates = false,
  listsShown = lists,
  drawnLater = false,
}: {
  people?: Person[];
  fields?: Field[];
  start?: View;
  showDates?: boolean;
  listsShown?: List[];
  // Whether a new view is drawn a few frames after it is asked for, as one kept in the address is.
  drawnLater?: boolean;
}) {
  const [view, setView] = useState(start);
  return (
    <MantineProvider theme={testTheme}>
      <PeopleGrid
        people={people}
        fields={fields}
        order={[]}
        lists={listsShown}
        canEdit={false}
        canEditColumns={false}
        showDates={showDates}
        seesHiringPlan={showDates}
        view={view}
        onView={(next) => {
          if (drawnLater) {
            setTimeout(() => {
              setView(next);
            }, laterMilliseconds);
          } else setView(next);
        }}
        actions={peopleActions()}
      />
    </MantineProvider>
  );
}

// Longer than focusing waits before its first look, shorter than the frames it waits for after.
const laterMilliseconds = 30;

export const panel = () => screen.getByRole("region", { name: "Metrics" });
// The figures of a row of the panel's table, by the name of its group.
export const figures = (group: string) =>
  within(
    within(panel())
      .getByRole("rowheader", { name: group })
      .closest("tr") as HTMLElement,
  )
    .getAllByRole("cell")
    .map((cell) => cell.textContent);
