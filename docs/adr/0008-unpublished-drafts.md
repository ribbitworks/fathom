# Unpublished Drafts

- **ADR:** 0008
- **Status:** Accepted
- **Date:** 2026-11-03
- **Revised:** 2026-11-17, to publish or discard chosen changes, and to mark a change set published once none of its changes is held; 2026-11-20, to publish only the changes the role in use may make

## Context

A user's changes are seen only by that user until they publish them:

- **Publishing and discarding:** They publish or discard them all at once, or chosen changes with those they must go with.
- **Held records:** A record someone has unpublished changes to is held: others see it as it was, marked as being changed, and cannot change, approve, or reject it.
- **Published drafts:** Changing a published draft makes the change the editor's alone until they publish it, while others keep seeing the published draft.
- **The change history:** It shows unpublished edits only to their maker until they are published.

[ADR 0007](0007-draft-rows.md) keeps drafts in one table, one per record, shown to everyone. Some records exist only as drafts, such as a person or a list drafted to be added.

## Decision

- **A table of unpublished drafts:** A user's unpublished changes are kept in a second table, shaped as the table of drafts, keyed the same way, so a record has at most one, and naming the user whose changes they are.
  - **Whole drafts:** Each row holds the whole draft the user intends, as a draft row does, not the difference from the published draft.
- **Held by the row:** A record is held while it has an unpublished draft. Changing it, approving it, or rejecting it is refused for anyone but that user, and the user's own changes update their unpublished draft, starting from the published draft when there is one.
- **Read per user:** Reading a table puts each user's own unpublished drafts over the published drafts, and marks the records others hold with who holds them. A record that exists only as someone else's unpublished draft is not shown at all.
- **Publishing moves the rows:** Publishing writes each of the user's unpublished drafts over the published draft for the same record, waiting for approval, and removes them, all in one transaction.
  - **No change left:** An unpublished draft that no longer changes anything removes the published draft.
  - **Discarding:** Discarding removes them.
  - **Chosen rows:** Publishing or discarding chosen rows works the same way on those rows alone, with the rows the server adds to them:
    - **On publishing:** the user's own rows they use, the rows saved in the same change set, and the rest of any fill.
    - **On discarding:** the user's own rows that use them, and the rest of any fill.
  - **The server's answer:** The server answers each of the user's rows with its key and the rows it goes with, so the page ticks them together.
  - **Other users' rows:** A chosen row that isn't the user's is refused as one that doesn't exist.
- **Publishing as the role in use:** A row changed in a change set made as another of the user's roles is published only when the role in use may make its kind of change.
  - **Rows made as the role in use:** A row changed in a change set made as the role in use is published whatever its kind, since a change may move records of other kinds with it, such as the releases a cycle's new length moves.
  - **Rows left:** A row that can't be published stays, with every row that uses it or was saved with it, and publishing answers how many it left.
  - **Discarding:** Discarding takes back any of the user's rows, whichever role made them, so nothing they made stays held.
- **Private change sets:** Each change set records whether it was saved as unpublished changes.
  - **In the change history:** The change history shows such change sets only to their maker until publishing marks them published.
  - **Marked published:** A change set is marked published once none of its changes is to a record its maker still holds, so a change set saved with changes to several records is published once all of them are.
  - **Undo:** Undo works on them as on any change set, putting back the unpublished draft.
- **Checks see everything:** Checks for values that must be unique, such as an Employee ID, count unpublished drafts as they count drafts, so publishing never finds a value taken.

## Consequences

- **Every write path changes once:** The functions that write drafts write unpublished drafts instead, and every read goes through the per-user overlay, so pages need no changes beyond showing who holds a record.
- **One schema change:** A new table and a new column on change sets, added by a reviewed migration.
- **A held record waits:** A record stays held until its holder publishes or discards, so the holder's unpublished changes can block others; the top bar's count keeps them in view.
- **Holds are seen by everyone:** A held record is marked as being changed, with who, even for a viewer who may not see the values being changed, since the hold stops them changing it and must be explained. The values stay hidden.
- **Reverted edits are published later:** Edits a user takes back by hand before publishing leave nothing to publish, so their change sets stay unpublished until the user next publishes, when they appear in the history with the rest.
- **One exception to an append-only history:** Marking change sets published is the only update the change history allows, limited by the database to that mark, from unpublished to published.
