# Fathom: How Data Is Safeguarded

**Last updated:** 2026-11-14

- **Classification:** All data has one of three classifications: General, Personal or Confidential.
- **Permissions:** Permissions control which classifications a user can see and change.
- **Roles:** A role is a set of permissions. Each user is given one or more roles.
- **Enforcement:** The server checks permissions on every request, and never sends data a user's role can't see.
- **Audit log:** All changes are recorded, with who made them and when. Sign-ins, views of Personal or Confidential data, and changes to accounts and roles are recorded too. The log can't be changed through Fathom.
- **Approval:** Changes to the plan and to people's details are drafts until a role allowed to approve them does.
- **Exports:** Exporting Personal or Confidential data asks for confirmation, and is recorded.
- **Encryption:** Browsers connect to Fathom over HTTPS. The database isn't encrypted at rest, as the [Security Plan](../security/security-plan.md) sets out.
- **Outside services:** Today, Fathom sends no data to outside services, and needs no internet access to run.
- **Development:** Fathom is developed and tested with fictional data only.

The [Security Plan](../security/security-plan.md) and [Roles](../product/roles.md) give the details.
