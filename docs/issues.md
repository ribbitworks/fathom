# Fathom — Issues

**Status:** Working list
**Last updated:** 2026-11-02

Known problems and deferred work that are not yet scheduled in the [Implementation Plan](design/implementation-plan.md). Each item says why it was deferred. When an item is scheduled or resolved, it moves to the document that owns it, or is removed.

## Access History

- **Users changing their own password:** Not yet recorded in the access history. Only changes administrators make to accounts are. Deferred by the owner while the access history was first built.
- **Sign-ins, sign-outs, and failed sign-ins:** Not recorded in the access history. The server's request log already records each sign-in attempt with its time and network address, and active sessions are kept in the database. Deferred by the owner; worth revisiting if HR or IT asks for them.

## Roles

- **Simpler, more flexible roles:** Roles may need rethinking as planning arrives, for example so a Project Manager can edit their own projects' details without editing the whole plan. The owner expects the redesign to be both simpler and more flexible, so the defaults set on 2026-10-31 are not refined further until then.
- **Marking your own roles:** Help's Roles page marks the roles a user holds with a "Yours" badge, which the owner finds poor: it is cut short to "YOU…" beside long role names, such as Workforce Administrator. Keep showing which roles are the user's, in a clearer way.

## Account Administration

- **Two administrators changing the same account at once:** Two role changes at the same moment can leave a combination of both sets of roles, and two accounts created with the same email address at the same moment can give a server error instead of the "already exists" message. Accepted by the owner as unlikely with 20 to 30 users.

The owner decided the following on 2026-10-30, to be built together as one change to account administration:

- **Changing your own account:** As decided in [Roles](product/roles.md#safeguards-for-administrators), with its two guards. The Security Plan changes with it.
- **Names and email addresses:** Administrators can change any account's name and email address. Today neither can be changed.
- **Editing includes viewing:** As decided in [Roles](product/roles.md#what-each-role-can-do).
- **Clearer actions:** Each account's actions are behind a small "⋯" button that is easy to miss; make them easier to find.
- **UX principles:** The Accounts and Change password pages were built before [Visual Design](design/visual-design.md#principles) ruled out page descriptions and hint text, and still have both. They are brought into line with this change.

## Lists

- **Splitting the lists module:** `apps/server/src/data/lists.ts` holds both reading lists with their drafts and drafting changes to them, and is large enough to split. Deferred by the owner on 2026-11-01 as low risk at Fathom's size.
- **Reading drafts' history:** Reading lists or people reads each draft's whole history of changes, to name who changed it, and undoing changes to drafts of lists reads every list again for each record undone. Both are fast at Fathom's size; deferred by the owner on 2026-11-01 until tables grow.

## People

- **Undo while adding people:** Undoing a change while people being added are still saving, or later undoing a change made while they were, briefly shows the table without them, or with them as they were before they were saved, until it reloads.
- **Splitting the People table:** `apps/web/src/people-grid.tsx` holds the table's editing, its menus, and how drafts of columns and their order are shown, and is large enough to split, such as the live copies of columns and the marks under their names into a module of their own. Found in review on 2026-11-02.
- **Pasting several choices:** Pasting into a column that takes several choices reads each cell as one choice name. How several are pasted into one cell was left for later by the owner.

## Drafts

- **A draft's lineage:** No one place shows how a draft came to be where it is: who made and changed it, who rejected it and why, when it was sent again, and which drafts it uses or that use it. The record's menu, the Drafts page and the change history each hold part of it, which makes a draft waiting on a rejected one hard to follow. A view of a draft's lineage was suggested by the owner while testing drafts by hand on 2026-11-02.
- **A column's tier and its creator:** The Security Plan says a column can only be given a tier its creator can see, but adding a column has never checked it: a Workforce Administrator sees every tier, so no role reaches the gap today. Found in review on 2026-11-01.
- **Unnamed in the access history:** The access history names each person by their live record, so a Restricted change to someone only drafted to be added shows them without a name until their draft is approved.
- **A reason's tier in the change history:** A rejection's reason is recorded with the tier of its draft when rejected, so, unlike the draft's values, it does not become more sensitive in the change history if a column's list later does.

## Dependencies

- **Advisories in minimatch and glob:** Two medium advisories, published by 2026-10-30, affect minimatch before 11.0.1 (denial of service from crafted patterns) and glob 9 to 14.0.1 (a cancelled search can keep reading files). They reach the server through @fastify/static, and development tools such as ESLint, markdownlint, and Testcontainers. In Fathom, the patterns come from code, never from users. The fixed versions are new major versions that the packages depending on them do not accept yet, so they wait for those packages' updates. The Security Plan's 90 days for medium findings runs to 2027-01-28.

## Development

- **Copies of the repository share a database image:** Development mode and the database tests in every copy build and use the same `fathom-postgres:dev` image, so two copies changing the database image at once can test each other's build. Deferred as rare: the image changes far less often than the code.
- **Release tags are matched loosely:** Any tag of the form `v` followed by three dot-separated parts counts as a release, so a tag such as `v1.2.3.4` would too, and when two release tags mark one commit, the version shown may be the older. Deferred, since the owner makes every tag: tag each commit once, as `vMAJOR.MINOR.PATCH`.
- **Sidebar items repeat their content:** The About Fathom item, a button, repeats the icon and name that each page's link in the sidebar shows, in `apps/web/src/layout.tsx`. Deferred until the branch changing the sidebar's menus merges, so the two do not conflict; then both share one piece.
