// SPDX-License-Identifier: Apache-2.0

// Tests for the count above People's table, which names the day it counts people on.

import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDay } from "./day-formats.ts";
import { fictionalUser, renderApp, serverAnswers } from "./test-support.tsx";
import { today } from "./today.ts";

const person = (id: string, preferredName: string) => ({
  id,
  keyNumber: 1,
  preferredName,
  employeeId: `E-${id}`,
  positionId: "position-1",
  startDate: "2024-03-01",
  endDate: null,
  values: {},
});

const people = () =>
  Response.json({
    people: [person("p1", "Avery Fictional"), person("p2", "Blake Fictional")],
    fields: [],
    order: ["preferredName"],
  });

async function openPeople(path: string) {
  serverAnswers({
    "GET /api/session": () =>
      Response.json({
        ...fictionalUser,
        permissions: [
          "people:view",
          "configuration:view",
          "plan:view",
          "features:view",
          "personal:view",
        ],
      }),
    "GET /api/people": people,
    "GET /api/people?on=2025-03-01": people,
    "GET /api/lists": () => Response.json({ lists: [] }),
  });
  renderApp(path);
  await screen.findByRole("grid", { name: "People" });
  return (await screen.findByText(/ people on /u)).textContent;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("People's count", () => {
  it("names today, the day People shows with none chosen", async () => {
    expect(await openPeople("/people")).toBe(
      `2 people on ${formatDay(today())}`,
    );
  });

  it("names the day chosen", async () => {
    expect(await openPeople("/people?day=2025-03-01")).toBe(
      "2 people on Mar 1, 2025",
    );
  });
});
