# Fathom — Decisions Log

**Last updated:** 2026-10-26

Detailed product decisions made so far. The [Product Brief](brief.md) holds the high-level picture. Domain terms are defined in [Domain Concepts](domain.md). Open questions at this level of detail are raised when the related feature is worked on.

## Planning

- **Planning granularity:** Monthly, open to revisiting.
- **Allocation unit:** A percentage of a person's month, chosen from 10%, 25%, 50%, 75%, 90%, or 100%. The default is 100%.
- **Multiple assignments:** Fathom warns, but does not block, when a person has more than two assignments in a month.
- **Project allocations:** People can be allocated to a project directly. This may be modeled as a general feature owned by the project.
- **Project ownership:** Projects and features have an owner, such as a Project Manager.
- **Employment dates:** A person cannot be allocated before their start date or after their end date.
- **Plan approval:** Draft plan changes are approved by a user with an approver role before they reach the live plan.
- **Editing model:** No live collaboration. Saving a change (subject to approval) and refreshing to see others' changes is acceptable.
- **Cost:** Not tracked. Allocations record people against projects or features per month.

## Workforce

- **Placeholder allocations:** Planned hires can be allocated to projects and features like current staff. When a role is filled, the new hire takes over its allocations.
- **Hiring entries:** A planned hire records role, level, team, manager, target date, status, and approval state. Budget is not tracked.
- **Hiring target date:** The date the new hire starts work. Onboarding time is handled with a reduced allocation percentage.
- **Hiring workflow:** Moving a planned hire between states is controlled by role.
- **Hiring plan ownership:** The Director maintains the hiring plan and employee details.
- **Reporting lines:** Each person has exactly one manager. Dotted-line relationships exist in some cases, such as Software Engineering Managers to the Project Managers of the projects their team works on, but are kept to a minimum. Future-dated manager reassignments, for example for a reorg, can be planned.
- **Reporting view:** Reporting lines appear both as an org chart and within the unified people view.

## People and Privacy

- **Employee details:** Preferred name, gender, site, position (for example Software Engineer, Test Engineer, SDET, Manager), level (for example P1–P5, M1–M5, co-op), role on the team (for example Team Lead, Design Authority), start date, and end date.
- **Gender:** Recorded because the company works across several countries, and colleagues cannot always tell someone's gender from their name.
- **System of record:** Fathom holds a manually maintained copy of employee details from the HR system.
- **Former employees:** People who leave are marked inactive rather than deleted.
- **Access control:** Access is role-based, and a user can have one or more roles. The owner will define the roles.
- **Sensitivity tiers:** Roles grant access to tiers of data, not to individual screens. Adding a field means assigning it to a tier. The initial tiers, subject to the privacy review, are:
  - *General:* preferred name, team, position, site, manager, and assignments.
  - *Restricted:* gender, level, start and end dates, and active status.
  - *Confidential:* the hiring plan and future-dated reorgs.
- **Consistent enforcement:** Exports, snapshots, and search results follow the same access rules as screens.
- **Access history:** Fathom records who viewed or changed Restricted or Confidential data, without recording the values.
- **Logging:** Personal data not needed for planning is kept out of logs and other output.
- **Separation of duties:** Running the system, such as backups and updates, does not require access to people data in Fathom.
- **Data outside the app:** Backups are encrypted, server login is restricted, and backup files are kept only in approved locations.

## Privacy Law Context

The company is a private company in British Columbia, so BC PIPA is expected to govern employee personal information, unless the company is federally regulated. Employees in other countries may bring their own local laws. These notes are a general understanding, not legal advice, and are to be confirmed in the privacy review:

- Employers can generally collect and use employee information that is reasonably needed to manage employment without consent, if employees are told beforehand and given the purposes.
- Employees can ask to see or correct their information.
- Personal information used to make a decision that directly affects someone must be kept for at least one year after the decision, then destroyed or anonymized once no longer needed for legal or business purposes.

## Platform and Operations

- **Tech stack:** TypeScript end to end with PostgreSQL, in Docker. See [ADR 0001](../adr/0001-tech-stack.md).
- **Authentication:** Local accounts managed in Fathom for v1.
- **Snapshots:** Taken both manually and on a schedule. The schedule is to be decided.
