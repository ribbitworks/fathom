# Fathom — Issues

**Status:** Working list
**Last updated:** 2026-11-04

Known problems and deferred work that are not yet scheduled in the [Implementation Plan](design/implementation-plan.md). Each item says why it was deferred. When an item is scheduled or resolved, it moves to the document that owns it, or is removed.

## Access History

- **Sign-ins, sign-outs, and failed sign-ins:** Not recorded in the access history. The server's request log already records each sign-in attempt with its time and network address, and active sessions are kept in the database. Deferred by the owner; worth revisiting if HR or IT asks for them.

## Roles

- **Access limited to one's own part of the organization:** Permissions apply to everyone's data, so People Managers see Restricted details for everyone, and a Project Manager cannot be limited to editing their own projects. The owner decided on 2026-11-04 that permissions will take a scope, such as one's own reporting line, and that it must be built; it waits until roles are editable and Teams and Reporting Lines is built, and may use the linked person records proposed in [Roles](product/roles.md#access-to-your-own-record-and-your-reports).

## Planning

- **Which delivery a feature is needed by:** The release warning checks each needed feature against its project's earliest customer delivery date still to come, so a phased project warns about features only its later deliveries need. Saying which delivery each feature is needed by was deferred by the owner on 2026-11-03 until the warnings prove noisy.

## Account Administration

- **Two administrators choosing the same email address at once:** Two accounts given the same email address at the same moment, by creating or changing them, can give a server error instead of the "already exists" message. Accepted by the owner as unlikely with 20 to 30 users.
- **Changing a password after deactivation:** Changing one's own password goes straight to Better Auth, which does not check that the account is still active, so a session made just before an account is deactivated could still change its password. The session cannot be used for anything else. Found in review on 2026-11-03.
- **Two users taking the same name at once:** The check that a name is free when users change their own takes no lock, so two users renaming themselves to the same name at the same moment could both succeed, and Administrators creating or renaming accounts do not check names at all. Both renames are still recorded and marked as worth checking. Accepted as unlikely with 20 to 30 users, like the email address case above. Found in review on 2026-11-03.

## Lists

- **Splitting the lists module:** `apps/server/src/data/lists.ts` holds both reading lists with their drafts and drafting changes to them, and is large enough to split. Deferred by the owner on 2026-11-01 as low risk at Fathom's size.
- **Reading drafts' history:** Reading lists or people reads each draft's whole history of changes, to name who changed it, and undoing changes to drafts of lists reads every list again for each record undone. Both are fast at Fathom's size; deferred by the owner on 2026-11-01 until tables grow.

## People

- **Undo while adding people:** Undoing a change while people being added are still saving, or later undoing a change made while they were, briefly shows the table without them, or with them as they were before they were saved, until it reloads.
- **Splitting the People table:** `apps/web/src/record-grid.tsx`, the table People is built on, holds the table's editing, its menus, and how drafts of columns and their order are shown, and is large enough to split, such as the live copies of columns and the marks under their names into a module of their own. Found in review on 2026-11-02.
- **Pasted rows checked against each other:** When rows are pasted, each is checked against the records and the new rows already there, but not against the other rows pasted with it, so two pasted people with the same Employee ID are refused only by the server, which refuses the whole paste. Found in review on 2026-11-03.
- **Pasted rows that hold nothing readable:** A pasted row whose only cell cannot be read, such as a choice its column's list does not have, is left out without a word, since a row with nothing in it is not added. Found in review on 2026-11-03.
- **Checks on a whole row see only the columns shown:** A row's check, such as an end date before the start date, reads only the columns the user sees, so it relies on the server for the rest. Found in review on 2026-11-03.
- **The seed's change history tiers:** The seed records every change to people's values as General, whatever the tier of the column, so a Restricted or Confidential column's seeded values show in the change history to users who may not see them. Only fictional seed data is affected. Found in review on 2026-11-03.
- **Kinds of cell in two places:** Each kind of People cell, such as a web link, is described once in `apps/web/src/cell-kinds.tsx`, but how each kind is searched, sorted, and filtered is described in the table model every table shares, `apps/web/src/table-view.ts`, and the metrics tell choices from other kinds there too, so a new kind of column is added in both. Left as it is, since the table model serves tables besides People. Found in review on 2026-11-03.
- **Pasting several choices:** Pasting into a column that takes several choices reads each cell as one choice name. How several are pasted into one cell was left for later by the owner.

## Drafts

- **A draft's lineage:** No one place shows how a draft came to be where it is: who made and changed it, who rejected it and why, when it was sent again, and which drafts it uses or that use it. The record's menu, the Drafts page and the change history each hold part of it, which makes a draft waiting on a rejected one hard to follow. A view of a draft's lineage was suggested by the owner while testing drafts by hand on 2026-11-02.
- **A column removal's status:** Removing a column whose tier the editor cannot see is refused with 409, while adding or changing one, or a list, is refused with 403, so the web app shows the server's reason for the first and its own permission message for the others. Found in review on 2026-11-03.
- **Unnamed in the access history:** The access history names each person by their live record, so a Restricted change to someone only drafted to be added shows them without a name until their draft is approved.
- **A reason's tier in the change history:** A rejection's reason is recorded with the tier of its draft when rejected, so, unlike the draft's values, it does not become more sensitive in the change history if a column's list later does.

## Error Pages

- **Every page error blamed on the server:** The router shows any error while drawing a page as "Fathom could not reach its server", with a way to try again, so a page failing on data it did not expect reads as the server being down and sends the reader looking in the wrong place. Found while testing the Drafts page by hand on 2026-11-03; a plainer page for errors other than failed requests is deferred as outside the fix made then.

## Dependencies

- **Advisories in minimatch and glob:** Two medium advisories, published by 2026-10-30, affect minimatch before 11.0.1 (denial of service from crafted patterns) and glob 9 to 14.0.1 (a cancelled search can keep reading files). They reach the server through @fastify/static, and development tools such as ESLint, markdownlint, and Testcontainers. In Fathom, the patterns come from code, never from users. The fixed versions are new major versions that the packages depending on them do not accept yet, so they wait for those packages' updates. The Security Plan's 90 days for medium findings runs to 2027-01-28.

## Development

- **Database tests to tidy:** In `packages/db/src/database.test.ts`, each group of tests declares its own copies of PostgreSQL's error codes, which one shared set would replace, and the lists test checks several behaviours in one test. Found in review on 2026-11-03.
- **Reseeding after a seed draft of a list is approved:** Once an Approver approves the seed's draft adding the Skills list, the list is no longer seed data, so removing the seed data keeps it, and seeding again then stops with "There is already a list with that name" while making the drafts of lists. `pnpm dev:reset` recovers. Found in a manual check on 2026-11-03.
- **Files the code scan skips without reporting them:** Semgrep skips files larger than 1 MB and files it judges to be minified, and its results list them only in verbose mode, so the security report cannot tell they were skipped. Fathom's repository has no such files today. Deferred until it has.
