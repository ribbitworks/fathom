// SPDX-License-Identifier: Apache-2.0

// What the tests of each type of column added to People share, beside the People page's own test
// helpers: people holding values in the columns, as the server sends them, People opened on them,
// and the New column dialog.

import type { ColumnValueMap } from "@fathom/shared";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import {
  type Answers,
  openAt,
  openPeople,
  savedAs,
  session,
} from "./test-people-page.tsx";
import { positions } from "./test-support.tsx";

// An editor who sees no Personal details, so a new person is sent with only what the test gives.
const columnEditor = session([
  "configuration:edit",
  "configuration:view",
  "people:edit",
  "people:view",
  "plan:view",
  "features:view",
]);

// A person holding the values given in one map, by column.
export const personWith = (
  id: string,
  name: string,
  map: ColumnValueMap,
  values: object,
) => ({
  id,
  keyNumber: 1,
  preferredName: name,
  employeeId: id,
  positionId: "position-1",
  values: {},
  links: {},
  [map]: values,
});

// People, as the server sends them with the columns given after Name and ID.
export const peopleHolding =
  (people: readonly object[], fields: readonly { id: string }[]) => () =>
    Response.json({
      people,
      fields,
      order: ["preferredName", "employeeId", ...fields.map(({ id }) => id)],
    });

// Opens People at the address given on the people given, each change to p1 or p2 saved.
export const openPeopleWith = async (
  people: Answers[string],
  answers: Answers = {},
  at = "/people",
) =>
  (
    await openAt(at, {
      "GET /api/session": columnEditor,
      "GET /api/people": people,
      "GET /api/lists": () => Response.json({ lists: [positions] }),
      "PATCH /api/people/p1": savedAs(),
      "PATCH /api/people/p2": savedAs(),
      ...answers,
    })
  ).fetch;

// Opens the New column dialog on People, with the answers given.
export async function openNewColumn(answers: Answers) {
  const fetch = await openPeople({
    "GET /api/session": columnEditor,
    ...answers,
  });
  await userEvent.click(screen.getByRole("button", { name: "New column" }));
  return {
    fetch,
    dialog: await screen.findByRole("dialog", { name: "New column" }),
  };
}
