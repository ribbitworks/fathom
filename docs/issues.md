# Fathom — Issues

**Status:** Working list
**Last updated:** 2026-10-31

Known problems and deferred work that are not yet scheduled in the [Implementation Plan](design/implementation-plan.md). Each item says why it was deferred. When an item is scheduled or resolved, it moves to the document that owns it, or is removed.

## Access History

- **Users changing their own password:** Not yet recorded in the access history. Only changes administrators make to accounts are. Deferred by the owner while the access history was first built.
- **Sign-ins, sign-outs, and failed sign-ins:** Not recorded in the access history. The server's request log already records each sign-in attempt with its time and network address, and active sessions are kept in the database. Deferred by the owner; worth revisiting if HR or IT asks for them.

## Roles

- **Simpler, more flexible roles:** Roles may need rethinking as planning arrives, for example so a Project Manager can edit their own projects' details without editing the whole plan. The owner expects the redesign to be both simpler and more flexible, so the defaults set on 2026-10-31 are not refined further until then.

## Account Administration

- **Two administrators changing the same account at once:** Two role changes at the same moment can leave a combination of both sets of roles, and two accounts created with the same email address at the same moment can give a server error instead of the "already exists" message. Accepted by the owner as unlikely with 20 to 30 users.

The owner decided the following on 2026-10-30, to be built together as one change to account administration:

- **Changing your own account:** As decided in [Roles](product/roles.md#safeguards-for-administrators), with its two guards. The Security Plan changes with it.
- **Names and email addresses:** Administrators can change any account's name and email address. Today neither can be changed.
- **Editing includes viewing:** As decided in [Roles](product/roles.md#what-each-role-can-do).
- **Clearer actions:** Each account's actions are behind a small "⋯" button that is easy to miss; make them easier to find.
- **UX principles:** The Accounts and Change password pages were built before [Visual Design](design/visual-design.md#principles) ruled out page descriptions and hint text, and still have both. They are brought into line with this change.
- **Session length:** Sessions should end after 30 minutes without use, not the 12 hours set in [ADR 0002](adr/0002-libraries.md), which changes with it. A short timeout means the session's expiry is updated in the database more often, which the revision weighs.

## People

- **Column widths:** Each column's width comes from its kind alone, so editing never moves the table, but columns often fit their contents poorly. The owner asked for widths that fit what columns hold, still without moving the table while editing: for a column drawing on a list, from its longest choice, and for the others, from their contents or their longest allowed value.
- **Pasting several choices:** Pasting into a column that takes several choices reads each cell as one choice name. How several are pasted into one cell was left for later by the owner.

## Dependencies

- **Advisories in minimatch and glob:** Two medium advisories, published by 2026-10-30, affect minimatch before 11.0.1 (denial of service from crafted patterns) and glob 9 to 14.0.1 (a cancelled search can keep reading files). They reach the server through @fastify/static, and development tools such as ESLint, markdownlint, and Testcontainers. In Fathom, the patterns come from code, never from users. The fixed versions are new major versions that the packages depending on them do not accept yet, so they wait for those packages' updates. The Security Plan's 90 days for medium findings runs to 2027-01-28.
