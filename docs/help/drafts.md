# Drafts

Most changes you make to the plan and its people are drafts at first. A draft is a change that waits for someone to approve it before it goes live. This page explains what happens to a draft, and the marks you see beside records that have one, such as on **People** and **Lists**.

## What Happens to a Draft

A draft goes through these stages:

- **Saved:** nobody else sees your change yet. **Publish** in the top bar says how many changes are waiting, such as **Publish 3 changes**. Select it to publish them all.
  - Changes you made under another role that your current role can't make stay unpublished. Switch roles to publish them.
  - The menu beside **Publish** lists your changes, and **Discard all…** throws them all away, after asking you first.
  - To publish or discard one record's change, use the record's [**⋯** menu](drafts.md#publish-or-discard-one-change).
  - To publish or discard several, use the **Not published** tab of the [Drafts page](drafts-page.md#publish-some-of-your-changes).
  - Others can change the same record meanwhile. Each of you sees only your own unpublished changes.
- **Published:** the draft waits for an approver, someone whose role approves that kind of change. If someone else changes it, only they see their changes until they publish them.
- **Approved:** the change goes live. Any new list, column or choice it depends on is approved with it. Approving can't be undone.
- **Rejected:** the draft goes back to whoever made it. They can change it, resubmit it, or discard it.
  - Drafts that depend on it wait. Rejecting a new list, column or choice also rejects the drafts that depend on it.
- **Discarded:** the draft is removed, and the record stays as it was. You can't discard a new list, column or choice while other drafts depend on it. Discard or change those drafts first.

Approvers approve and reject drafts on the [Drafts page](drafts-page.md), under **To decide**, as well as where the records are.

## Publish or Discard One Change

Each record's **⋯** menu acts on its draft. It opens from two places, which offer the same, except that only the row's offers **Show details**:

- The **⋯** at the end of the record's row.
- The **⋯** at the top of its details, just before the **×**. A person's details beside the Org chart have none.

To publish your change to one record:

1. Open the record's **⋯** menu.
1. Select **Publish draft…**. A change that goes alone is published at once.
1. If other changes must go with it, such as a new choice it uses, Fathom names them and asks first. Select **Publish** to publish them all.

To throw your change away instead, select **Discard draft** in the same menu. The record goes back to how it was.

The menu also offers **Resubmit** once your draft is rejected, and **Approve draft…** and **Reject draft…** if your role approves the draft.

You're done when the record's hollow dot turns yellow, once published, or is gone, once discarded.

## Marks

- **A hollow dot** marks a change you haven't published yet. Nobody else sees it.
- **A yellow dot** marks a change waiting for approval. It comes before what changed: at the start of the row, for a record that's added, removed or moved, or before each value that changed. Point at the dot to see what the change is, and what the value was.
- **A name struck through**, after its dot, is removed once the draft is approved.
- **In a list of records**, such as a project's customers, each record is marked on its own: one the draft adds has a dot before it, one it takes away has a dot and is struck through, and the rest have no mark.
- **A red dot in a ring** means the draft was rejected. Point at it to see what was rejected and why. The reason is in the record's menu too.
- **Moved**, **Reordered**, **Retired** or **Restored**, in a yellow box after the name of a draft waiting for approval, says what a dot can't.
- **A grey or red box** after a name is a fact about it, not a draft. It can be **Built in**, **Planned, expected** and a month or **Planned, no date**, or a warning such as **Left**.
- **Red words** where a value would be, such as **No feature team** or **Not staffed**, are a warning too. They're not a draft either.
- **A date** after the name, such as **from Dec 1, 2026**, says when a change takes effect, where that's not the date shown.
- **A green dot** marks the value or record as it is now, without the draft. It's in the light green row or line under the draft.
- **A faint yellow tint**, while drafts are shown beside live, marks a row, column or card with a draft. It's faintly red once the draft is rejected, and the changed values are in bold.

## What the Draft Menu Shows

Each table of records, such as People or Features, has a **Draft** menu, which chooses how drafts show. Its button names the choice, such as **Drafts & Live**:

- **Drafts & Live** shows each draft next to how the record is now.
- **Drafts applied** shows everything as it will be once the waiting drafts are approved. You see the drafts' dots, but no tints, bold or Live rows.
- **Live only** shows everything as it is now. A green dot marks each record or value a waiting draft would change. Point at it to see what kind of change is waiting.

On the tables of records, such as People, Features, Projects and Releases, the menu also filters the rows, under **Filter**. Choose **Waiting**, **Rejected** or **No draft** to show only the records with that kind of draft, or none.

The menu's button has a dot after its name while the filter is on. The filter needs drafts shown, so it's greyed out under **Live only**, and **Rejected** is greyed out under **Drafts applied**.

If your role approves drafts, the menu ends with **Approve** and **Reject** for every waiting draft the table shows, such as **Approve 4 drafts…**. When a search, a filter or a hidden column hides some, the menu says so, such as **4 of 6 waiting drafts shown**.

**Approve** leaves some drafts waiting: those someone else must approve, such as drafts you changed yourself, and those that depend on a rejected draft. The dialog names them.

## Undo

To undo your latest change, press Cmd+Z on a Mac, or Ctrl+Z elsewhere. If you're in a field with something typed in it, that undoes the typing instead.

A change that takes something out of view, such as deleting a saved view, also shows a notice with **Undo** for a few seconds.

You can't undo approving or rejecting a draft.
