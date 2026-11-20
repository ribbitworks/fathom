// SPDX-License-Identifier: Apache-2.0

// The identifiers of a list panel's choice rows and fields, which focus moves to.

export const entryNameId = "choice-entry-name";
export const editNameId = "choice-edit-name";
export const entryWeightId = "choice-entry-weight";
export const editWeightId = "choice-edit-weight";
export const rowId = (choice: { id: string }) => `choice-${choice.id}`;
export const actionsId = (choice: { id: string }) =>
  `choice-actions-${choice.id}`;
