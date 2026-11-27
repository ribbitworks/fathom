// SPDX-License-Identifier: Apache-2.0

// Fictional added columns, their lists, and opening a planned-work page, Features by default, with
// them and the column dialog, shared by the tests of Features' and Activities' columns.

import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect } from "vitest";
import {
  answers,
  featurePlan,
  openPage,
  type Plan,
} from "./test-projects-page.tsx";

export const sizes = {
  id: "10000000-0000-4000-8000-0000000000a1",
  keyNumber: 1,
  name: "Fictional Sizes",
  description: "",
  visibility: "general",
  retired: false,
  choices: [
    {
      id: "10000000-0000-4000-8000-0000000000b1",
      label: "Small",
      description: "",
      retired: false,
    },
  ],
};
export const hidden = {
  ...sizes,
  id: "10000000-0000-4000-8000-0000000000a2",
  keyNumber: 1,
  name: "Fictional Hidden",
  visibility: "personal",
};
export const size = {
  id: "10000000-0000-4000-8000-0000000000c1",
  keyNumber: 1,
  name: "Fictional Size",
  type: "choice" as const,
  listId: sizes.id,
  visibility: null,
  multiple: false,
  required: false,
  table: "features" as const,
};
export const columnsOf = (fields: Plan["featureColumns"]["fields"] = [size]) =>
  ({
    fields,
    order: ["name", ...fields.map(({ id }) => id)],
    lists: [sizes],
  }) as Plan["featureColumns"];
export const withColumns = (more: Partial<Plan> = {}) =>
  featurePlan({ featureColumns: columnsOf(), ...more });
export const columnEditor = [
  "plan:view",
  "features:view",
  "features:edit",
  "configuration:view",
  "people:view",
];
export const lists = () => Response.json({ lists: [sizes, hidden] });
export const openWith = (
  start: Plan,
  more: object = {},
  permissions = columnEditor,
  path = "/features",
) =>
  openPage(
    path,
    start,
    { ...answers, "GET /api/lists": lists, ...more },
    permissions,
  );
export const newColumn = async () => {
  await waitFor(() => {
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "New column" })
        .disabled,
    ).toBe(false);
  });
  await userEvent.click(screen.getByRole("button", { name: "New column" }));
  return screen.findByRole("dialog", { name: "New column" });
};
export const editColumn = async () => {
  await userEvent.click(
    screen.getByRole("button", { name: "Fictional Size column" }),
  );
  await userEvent.click(
    await screen.findByRole("menuitem", { name: "Edit column…" }),
  );
  return screen.findByRole("dialog", { name: "Edit column" });
};
