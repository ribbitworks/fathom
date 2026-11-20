// SPDX-License-Identifier: Apache-2.0

// Fictional people, a Note column and the server's answers, shared by the tests of notes on People.

import { colourTag } from "@fathom/shared";
import { fictionalUser } from "./test-support.tsx";

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

export const background = {
  id: "f1",
  keyNumber: 1,
  name: "Background",
  type: "note",
  listId: null,
  visibility: "general",
  multiple: false,
  required: false,
};
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
export const positions = {
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
