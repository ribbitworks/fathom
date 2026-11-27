# Draft Rows

- **ADR:** 0007
- **Status:** Accepted
- **Date:** 2026-11-01
- **Revised:** 2026-11-19, to say data classes, as Fathom does, rather than tiers; 2026-11-27, to mark a change in a discard that keeps its draft

## Context

Every change to the plan is a draft until an Approver approves it, one draft per row, seen by everyone who may see the data, as the [Domain Model](../design/domain-model.md#drafts-and-approval) sets out. Drafts must be:

- **Checked** as the live data is, such as for an Employee ID someone already has.
- **Read** through the same class checks.
- **Recorded** in the change history, which can only be added to. The change history shows what happened but can't stop a change, so it doesn't replace approval.

The data access layer already writes every change through one place per kind of record, recording each field changed, and undo already puts a record's fields back from what the change history holds.

## Decision

- **A table of drafts:** Drafts are kept in one table, apart from the live tables, keyed by the kind of record and its identifier, so a record has at most one.
  - **What a draft holds:** A draft that adds a record holds all its fields, one that changes it holds only the fields that differ from the live record, and one that removes it holds none.
  - **One form:** The fields are kept as the change history records them, so a draft, its history, and undo use one form.
- **Live tables hold approved data only:** The live tables and their constraints are unchanged, and only approving writes to them. Reading a table puts each draft over its live record, so every page shows drafts in place without each page knowing about them.
- **Checks at both ends:** Each change to a draft is checked as the live change was, against the live data and the other drafts.
  - **Employee IDs:** An Employee ID is taken while any live person or draft has it, and a live person's stays taken until a draft that changes it is approved, so approving drafts one at a time never finds two people with the same one.
  - **Columns and choices:** A column or choice a draft uses cannot be deleted, and a column's settings must fit the drafts.
  - **Approving:** Approving checks again, and the database's own constraints refuse what was missed.
- **Marked in the change history:** Each change records whether it was to a draft, and each change set what it did: saved changes, or approved, rejected, or discarded drafts.
  - **Kept by a discard:** A change in a discard that leaves its record's draft in place, as taking a fill out of the fill's other drafts does, records that it keeps the draft, so it doesn't end the draft's makers.
  - **Approving:** Approving records the changes it makes to the live data as a change set of its own, by the Approver.
  - **Undo:** Undo puts back drafts from the history as it puts back live records, and refuses to undo approving or rejecting.
- **One lock for drafts:** Changes to drafts, approvals, rejections, undoing, and deleting a choice wait for one another, through one advisory lock taken before any row is locked, so two cannot take the same Employee ID, update the same draft, or remove a choice a draft is being given, at once.

## Consequences

- **Every table follows the same pattern:** Configuration, and every table added later, gains drafts by reading through the overlay and writing through the same draft functions.
- **What the database cannot check:** Drafts refer to columns and choices without foreign keys, so the server refuses deleting what a draft uses, and approving checks that each draft still fits.
- **One change to drafts at a time:** Changes to drafts wait for each other, which suits the number of editors the [Product Brief](../product/brief.md) expects.
- **Drafts are read whole:** Every read of a table reads its drafts, which suits tables of the size [ADR 0006](0006-table-views-in-the-browser.md) expects.
