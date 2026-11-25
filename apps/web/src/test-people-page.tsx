// SPDX-License-Identifier: Apache-2.0

// Set-up for the People page's tests: the page opened on the rows given, for a role that changes
// people and planned hires, as the planned hire tests' server answers.

import { screen } from "@testing-library/react";
import { answers } from "./test-hire-fill-form.tsx";
import { renderApp, type serverAnswers } from "./test-support.tsx";

export async function openPeopleWith(
  rows: readonly object[],
  more: Parameters<typeof serverAnswers>[0] = {},
) {
  const fetch = answers([...rows], { more });
  renderApp("/people");
  await screen.findByRole("grid", { name: "People" });
  return fetch;
}
