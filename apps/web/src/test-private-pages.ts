// SPDX-License-Identifier: Apache-2.0

// A fictional private page, its maker's session and the server's answers to them, for tests of the
// pages under Mine.

import type { PrivatePage, PrivateRow } from "@fathom/shared";
import { fictionalUser } from "./test-support.tsx";

export const pageId = "20000000-0000-4000-8000-000000000001";
export const pagePath = `/api/private-pages/${pageId}`;
export const nameField = "30000000-0000-4000-8000-000000000001";
export const dueField = "30000000-0000-4000-8000-000000000002";

export const maker = {
  ...fictionalUser,
  permissions: [...fictionalUser.permissions, "private-pages:make"],
};

export const row = (id: string, name: string, due?: string): PrivateRow => ({
  id,
  key: `K${id.slice(-3).toUpperCase()}`,
  values: {},
  links: {},
  notes: {},
  numbers: {},
  flags: {},
  texts: { [nameField]: name },
  days: due === undefined ? {} : { [dueField]: due },
  linked: {},
});

export const followUps = (rows: PrivateRow[]): PrivatePage => ({
  id: pageId,
  name: "Follow-ups",
  position: 0,
  key: "K7QM",
  firstFieldId: nameField,
  columns: [
    {
      id: nameField,
      name: "Name",
      type: "text",
      listId: null,
      visibility: "general",
      multiple: false,
    },
    {
      id: dueField,
      name: "Due",
      type: "date",
      listId: null,
      visibility: "general",
      multiple: false,
    },
  ],
  rows,
});

export const listed = [
  { id: pageId, name: "Follow-ups", position: 0 },
  {
    id: "20000000-0000-4000-8000-000000000002",
    name: "Customer asks",
    position: 1,
  },
];

// The answers a page under Mine reads on opening.
export const pageAnswers = (page: PrivatePage) => ({
  "GET /api/session": () => Response.json(maker),
  "GET /api/private-pages": () => Response.json(listed),
  [`GET ${pagePath}`]: () => Response.json(page),
  "GET /api/lists": () => Response.json({ lists: [] }),
});
