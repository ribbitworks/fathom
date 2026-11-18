# Fathom: How Data Is Safeguarded

**Last updated:** 2026-11-17

- **Classification:** All data has one of three classifications: General, Personal or Confidential.
- **Permissions:** Permissions control which classifications a user can see and change.
- **Roles:** A role is a set of permissions. Each user is given one or more roles.
- **Enforcement:** The server checks permissions on every request, and never sends data a user's role can't see.
- **Histories:** The change history records every change, with who made it and when. The access history records sign-ins, changes to accounts and roles, and views of Personal or Confidential data, at most once a day for each user. Neither can be changed through Fathom.
- **Approval:** Changes to the plan and to people's details stay drafts until a role allowed to approve them approves them.
- **Exports:** Exporting Personal or Confidential data asks for confirmation, and the export is recorded in the access history.
- **Encryption:** Browsers connect to Fathom over HTTPS. The database isn't encrypted at rest, as the [Security Plan](../security/security-plan.md) sets out.
- **Outside services:** Fathom sends no data to outside services, as the [threat model](../security/security-plan.md#information-disclosure) sets out.
- **Development:** Fathom is developed and tested with fictional data only.

The [Security Plan](../security/security-plan.md) and [Roles](../product/roles.md) give the details.
