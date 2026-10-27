# Fathom — Decisions Log

**Last updated:** 2026-10-26

Detailed product decisions made so far. The [Product Brief](brief.md) holds the high-level picture. Domain terms are defined in [Domain Concepts](domain.md). Open questions at this level of detail are raised when the related feature is worked on.

## Planning

- **Planning granularity:** Monthly, open to revisiting.
- **Allocation unit:** A percentage of a person's month, chosen from 10%, 25%, 50%, 75%, 90%, or 100%. The default is 100%.
- **Multiple assignments:** Fathom warns, but does not block, when a person has more than two assignments in a month.
- **Project allocations:** People can be allocated to a project directly. See the [Domain Model](../design/domain-model.md) for how this may be modeled.
- **Project ownership:** Projects have an owner, such as a Software Project Manager.
- **Employment dates:** A person cannot be allocated before their start date or after their end date.
- **Plan approval:** Draft plan changes are approved by a user with an approver role before they reach the live plan.
- **Editing model:** No live collaboration. Saving a change (subject to approval) and refreshing to see others' changes is acceptable.
- **Cycles and releases:** Cycle length, which cycles a release includes, and patch frequency are all configurable in Fathom.
- **Release contents:** Fathom records which features ship in which release.

## Workforce

- **Placeholder allocations:** Planned hires can be allocated to projects and features like current staff. When a role is filled, the new hire takes over its allocations.
- **Hiring entries:** A planned hire records role, level, team, manager, target date, status, and approval state. Budget is not tracked.
- **Hiring target date:** The date the new hire starts work. Onboarding time is handled with a reduced allocation percentage.
- **Hiring workflow:** Moving a planned hire between states is controlled by role.
- **Reporting lines:** Each person has exactly one manager. Dotted-line relationships, described in [Domain Concepts](domain.md), exist in some cases but are kept to a minimum. Future-dated manager reassignments, for example for a reorg, can be planned.
- **People ownership:** Software Engineering Managers own their people, including when those people work on features led by someone else.
- **Feature ownership:** Features are owned and delivered by a feature team. A feature's owner is the feature lead of its feature team.
- **Feature team membership:** A person can be on more than one feature team at a time. Membership changes can be planned ahead, like reporting changes.
- **Feature team approval:** Software Engineering Managers propose and maintain feature teams, and the Director reviews and approves them.
- **Team names:** Teams can be named.
- **Team composition:** Balance is evaluated for both teams and feature teams. The measures, their targets, and how positions count toward them are configurable. Planned hires count toward a manager's reports, with a filter to exclude them in a later stage or release.
- **Reporting view:** Reporting lines appear both as an org chart and within the unified people view.

## People and Privacy

- **Employee details:** Preferred name, gender, site, position (for example Software Engineer, Test Engineer, SDET, Manager), level (for example P1–P5, M1–M5, co-op), role on the team (for example Team Lead, Design Authority), start date, and end date.
- **Gender:** Recorded because the company works across several countries, and colleagues cannot always tell someone's gender from their name.
- **System of record:** Fathom holds a manually maintained copy of employee details from the HR system.
- **Use limits:** Fathom's data is used only for planning, not for performance evaluation or discipline.
- **Former employees:** People who leave are marked inactive rather than deleted.
- **Access control:** Access is role-based, and a user can have one or more roles. Roles are proposed in [Roles](roles.md).
- **Sensitivity tiers:** Roles grant access to tiers of data, not to individual screens. Adding a field means assigning it to a tier. The initial tiers, subject to the privacy review, are:
  - *General:* preferred name, team, feature teams, feature leads, position, site, manager, and assignments.
  - *Restricted:* gender, level, start and end dates, and active status.
  - *Confidential:* the hiring plan and future-dated reorgs.
- **Consistent enforcement:** Exports, snapshots, and search results follow the same access rules as screens.
- **Access history:** Fathom records who viewed or changed Restricted or Confidential data, without recording the values.
- **Separation of duties:** Running the system, such as backups and updates, does not require access to people data in Fathom.
- **Data outside the app:** Backups are encrypted, server login is restricted, and backup files are kept only in approved locations.

## Privacy Law Context

The company is a private company in British Columbia, so BC PIPA is expected to govern employee personal information, unless the company is federally regulated. Employees in other countries may bring their own local laws. In particular, the company has employees and managers in India, whose personal data may be subject to Indian law, such as India's Digital Personal Data Protection Act, 2023. These notes are a general understanding, not legal advice, and are to be confirmed in the privacy review:

- Employers can generally collect and use employee information that is reasonably needed to manage employment without consent, if employees are told beforehand and given the purposes.
- Employees can ask to see or correct their information.
- Personal information used to make a decision that directly affects someone must be kept for at least one year after the decision, then destroyed or anonymized once no longer needed for legal or business purposes.

## Platform and Operations

- **Tech stack:** Recorded in [ADR 0001](../adr/0001-tech-stack.md).
- **Authentication:** Local accounts managed in Fathom for v1.
- **Snapshots:** Taken both manually and on a schedule, and contain projects, features, and allocations only. The schedule is to be decided.
- **Exports:** PDF, and CSV or TSV for use in Excel.
- **Backup operations:** Run and monitored by the owner's department, since IT is too busy to support custom applications.
