# Unpublished Drafts

- **ADR:** 0008
- **Status:** Accepted
- **Date:** 2026-11-03
- **Revised:** 2026-11-17, to publish or discard chosen changes, and to mark a change set published once none of its changes is held; 2026-11-20, to publish only the changes the role in use may make; 2026-11-25, to keep them as private changes, by record and user in each user's set, each standing over the published draft with its maker's own fields; 2026-11-26, so changes no longer hold their record, and count in no other user's checks; 2026-11-26, to discard everyone's changes to a record that goes away, shown to their maker alone; 2026-11-27, to count a private change from when it is published

## Context

A user's changes are seen only by that user until they publish them:

- **Publishing and discarding:** They publish or discard them all at once, or chosen changes with those they must go with.
- **Nothing held:** Others see a record without anyone else's unpublished changes, and may change, approve, reject, discard or resubmit it meanwhile.
- **Published drafts:** Changing a published draft makes the change the editor's alone until they publish it, while others keep seeing the published draft.
- **The change history:** It shows unpublished edits only to their maker until they are published.

[ADR 0007](0007-draft-rows.md) keeps drafts in one table, one per record, shown to everyone. Some records exist only as drafts, such as a person or a list drafted to be added.

## Decision

- **A table of private changes:** A user's unpublished changes are kept in a second table, shaped as the table of drafts, keyed by the record and the user whose changes they are, in that user's set. Several users may each have one for the same record.
  - **Whole drafts:** Each row holds the whole draft the user intends, as a draft row does, not the difference from the published draft.
  - **Own fields:** Each row records, for each field its maker changed, the value it started from. Read and published, it puts those fields over whatever the published draft holds then, so a change made by another meanwhile to other fields stays; a row naming no field of its own, such as a record its maker adds, or changing the action, such as a removal, keeps the whole draft.
  - **A record that goes away:** when an approval removes a record, with a list's choices and order, or publishing a discard or an undo removes the published draft that added it, everyone's rows changing it are discarded. Each is recorded in its maker's history as a withdrawal of the fields they changed, with its access history, which only they see, as a change set of its own kind that is never published and leaves the maker's other private changes as they were. A row whose fields are by then no different from everyone else's, such as an order now the same, is recorded as taking back each of its maker's changes to it, so every record withdrawn is named, with no access history, since no value changes.
- **Nothing held:** An unpublished draft holds nothing. Anyone may change, approve, reject, discard or resubmit the record meanwhile, and the user's own changes update their unpublished draft, starting from the published draft when there is one.
- **Read per user:** Reading a table puts each user's own unpublished drafts over the published drafts, and never reads anyone else's, nor says who has them. A record that exists only as someone else's unpublished draft is not shown at all.
- **Publishing moves the rows:** Publishing writes each of the user's unpublished drafts, its own fields over the published draft for the same record, waiting for approval, and removes them, all in one transaction.
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
  - **Discarding:** Discarding takes back any of the user's rows, whichever role made them.
- **Private change sets:** Each change set records whether it was saved as unpublished changes.
  - **In the change history:** The change history shows such change sets only to their maker until publishing marks them published.
  - **Marked published:** A change set is marked published once its maker has no unpublished draft left of any record it changed, so a change set saved with changes to several records is published once all of them are.
  - **From when a change counts:** Each change set records when others could first see it: when saved, or, saved privately, when its maker published it. Who changed a draft counts each change from then, so a change saved before an approval or discard of its record and published after it still counts, and its maker needs another approver. A decision counts from when it was made, so a private discard published later starts again only what was published before it, and its maker's own changes to the record made before it, published with it or still private. A draft's time, and the day the scope history gives a change, are when it was published too. A change another user publishes between a private discard's making and its publishing still counts, even when the discard's publishing takes it out: a known limit, which errs toward another approver.
  - **Changes to a record gone:** A change withdrawn because its record went is never published, so nobody but its maker ever sees it, nor its withdrawal.
    - **Their own change sets:** A change set still private that changed a record gone is never published.
    - **Saved with others:** The history can only be added to, so a change set that also changed records that stay is replaced, at its own time and role, by two copies: one of its changes to the records gone, never published, and one of the rest, published as the change set would have been. The change set itself is then shown to nobody, and its maker's history reads as their change, then its withdrawal. The copies keep its time, and whatever orders changes as made, such as undo's check for changes since and the unpublished list, orders them by their change set's time, then as saved, so the copies stand where it stood. Like any private change set, the copy of the rest is stamped when its maker publishes it, which is when it starts to count for who changed a draft.
  - **Undo:** Undo works on them as on any change set, putting back the unpublished draft. A withdrawal because a record went can't be undone, since there is no record to put the changes back on.
- **Checks see only the user's own:** Another user's unpublished drafts count in no check.
  - **Taken values:** a name, Employee ID or requisition in someone else's unpublished draft isn't taken.
  - **In use:** a choice, column, list, manager, team lead or state used only in someone else's unpublished draft isn't in use.
  - **The user's own:** a user's own unpublished drafts still count for them, and publishing checks again.

## Consequences

- **Every write path changes once:** The functions that write drafts write unpublished drafts instead, and every read goes through the per-user overlay, so pages need no changes.
- **One schema change:** A new table and a new column on change sets, added by a reviewed migration.
- **Nobody waits:** One user's unpublished changes never block another's work; the top bar's count keeps them in view for their maker.
- **Nothing seen by others:** Nobody else is shown that a record has unpublished changes, or whose, and no refusal tells them.
- **Reading others' changes:** A request that removes a record reads the private changes of everyone who has changed it, before and after, inside the drafts lock; one that removes nothing reads none.
- **The later publish wins:** Two users may change the same field, and whoever publishes later replaces the other's value without being asked.
- **Reverted edits are published later:** Edits a user takes back by hand before publishing leave nothing to publish, so their change sets stay unpublished until the user next publishes, when they appear in the history with the rest.
- **One exception to an append-only history:** Marking change sets published is the only update the change history allows, limited by the database to that mark and when it was made, from unpublished to published, once.
