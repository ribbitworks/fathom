// SPDX-License-Identifier: Apache-2.0

// Fictional people and the server's answers, shared by the tests of notes on People.

import { colourTag } from "@fathom/shared";
import { background, fictionalUser } from "./test-support.tsx";

export const s1 = "00000000-0000-4000-8000-000000000001";

export const session = (permissions: string[]) => () =>
  Response.json({ ...fictionalUser, permissions });
export const editor = session([
  "configuration:edit",
  "configuration:view",
  "people:edit",
  "people:view",
  "plan:view",
  "features:view",
]);
export const viewer = session(["people:view", "plan:view", "features:view"]);

export const averyNote = `**Joined** from the ${colourTag("teal")}platform</span> team`;
export const avery = {
  id: "p1",
  keyNumber: 1,
  preferredName: "Avery Fictional",
  employeeId: "E1",
  positionId: "position-1",
  values: {},
  links: {},
  notes: { f1: averyNote },
};
export const blake = {
  id: "p2",
  keyNumber: 1,
  preferredName: "Blake Fictional",
  employeeId: "E2",
  positionId: "position-1",
  values: {},
  links: {},
};
export const peopleAnswer =
  (people: object[] = [avery, blake]) =>
  () =>
    Response.json({
      people,
      fields: [background],
      order: ["preferredName", "employeeId", "f1"],
    });
export const saved = () => Response.json({ changeSetId: s1 });
