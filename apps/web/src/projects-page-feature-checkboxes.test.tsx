// SPDX-License-Identifier: Apache-2.0

// Tests of a checkbox column on the Features page.

import { userEvent } from "@testing-library/user-event";
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { chooseIn, recordCell } from "./test-support.tsx";
import {
  answers,
  changeSetId,
  featureEditor,
  featurePlan,
  later,
  openPage,
  saved,
  sent,
} from "./test-projects-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("sends no new list for a column changed to a checkbox after one was begun", async () => {
  const path = "POST /api/features/columns";
  const start = featurePlan({ features: [later] });
  const { fetch } = await openPage(
    "/features",
    start,
    {
      ...answers,
      "GET /api/lists": () => Response.json({ lists: [] }),
      [path]: () =>
        Response.json(
          {
            field: {
              id: "10000000-0000-4000-8000-0000000000c5",
              keyNumber: 1,
              name: "Fictional Checked",
              type: "flag",
              listId: null,
              visibility: "general",
              multiple: false,
              required: false,
              onPlannedHires: false,
            },
            changeSetId,
          },
          { status: 201 },
        ),
    },
    [
      "plan:view",
      "features:view",
      "features:edit",
      "configuration:view",
      "people:view",
    ],
  );
  await waitFor(() => {
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "New column" })
        .disabled,
    ).toBe(false);
  });
  await userEvent.click(screen.getByRole("button", { name: "New column" }));
  const dialog = await screen.findByRole("dialog", { name: "New column" });
  await userEvent.type(
    within(dialog).getByLabelText("Name"),
    "Fictional Checked",
  );
  await chooseIn(dialog, "Type", "Choice from a list");
  await chooseIn(dialog, "List", "New list");
  await userEvent.type(
    within(dialog).getByLabelText("List name"),
    "Fictional Checks",
  );
  await chooseIn(dialog, "Type", "Checkbox");
  await userEvent.click(
    within(dialog).getByRole("button", { name: "Add column" }),
  );
  await waitFor(() => {
    expect(sent(fetch, path)).toEqual([
      {
        name: "Fictional Checked",
        type: "flag",
        visibility: "general",
        multiple: false,
        required: false,
        onPlannedHires: false,
      },
    ]);
  });
});

it("ticks a checkbox column's box with a click", async () => {
  const urgent = {
    id: "10000000-0000-4000-8000-0000000000c4",
    keyNumber: 1,
    name: "Fictional Urgent",
    type: "flag" as const,
    listId: null,
    visibility: "general" as const,
    multiple: false,
    required: false,
    onPlannedHires: false,
  };
  const start = featurePlan({
    features: [later],
    featureColumns: {
      fields: [urgent],
      order: ["name", urgent.id],
      lists: [],
    },
  });
  const path = `PUT /api/features/${later.id}`;
  const fetch = (
    await openPage(
      "/features",
      start,
      { ...answers, [path]: saved(() => start) },
      featureEditor,
    )
  ).fetch;
  await userEvent.click(recordCell(later.id, urgent.id) as HTMLElement);
  await waitFor(() => {
    expect(sent(fetch, path)).toMatchObject([{ flags: { [urgent.id]: true } }]);
  });
});
