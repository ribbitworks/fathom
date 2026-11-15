// SPDX-License-Identifier: Apache-2.0

// Changing the class of data through the server's API: a built-in detail, a list, or a column with
// a class of its own. A change of class takes effect at once, and is changed back rather than
// undone, except for a list or column only drafted to be added, whose draft it changes.

import {
  type ClassifiedField,
  type DataClasses,
  dataClassesSchema,
  savedSchema,
  type Tier,
} from "@fathom/shared";
import { sendJsonFor } from "./api.ts";

export const moveFieldClass = (
  field: ClassifiedField,
  dataClass: Tier,
): Promise<DataClasses> =>
  sendJsonFor(
    "PUT",
    `/api/data-classes/${field}`,
    { dataClass },
    dataClassesSchema,
  );

export const moveListClass = (listId: string, dataClass: Tier) =>
  sendJsonFor(
    "PUT",
    `/api/lists/${encodeURIComponent(listId)}/class`,
    { dataClass },
    savedSchema,
  ).then(({ changeSetId }) => changeSetId);

export const moveColumnClass = (fieldId: string, dataClass: Tier) =>
  sendJsonFor(
    "PUT",
    `/api/columns/${encodeURIComponent(fieldId)}/class`,
    { dataClass },
    savedSchema,
  ).then(({ changeSetId }) => changeSetId);
