# Fathom — Issues

**Status:** Working list
**Last updated:** 2026-10-30

Known problems and deferred work that are not yet scheduled in the [Implementation Plan](design/implementation-plan.md). Each item says why it was deferred. When an item is scheduled or resolved, it moves to the document that owns it, or is removed.

## Access History

- **Users changing their own password:** Not yet recorded in the access history. Only changes administrators make to accounts are. Deferred by the owner while the access history was first built.
- **Sign-ins, sign-outs, and failed sign-ins:** Not recorded in the access history. The server's request log already records each sign-in attempt with its time and network address, and active sessions are kept in the database. Deferred by the owner; worth revisiting if HR or IT asks for them.

## Account Administration

- **Two administrators changing the same account at once:** Two role changes at the same moment can leave a combination of both sets of roles, and two accounts created with the same email address at the same moment can give a server error instead of the "already exists" message. Accepted by the owner as unlikely with 20 to 30 users.
