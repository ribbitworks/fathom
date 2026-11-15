# Fathom: Product Brief

**Last updated:** 2026-11-14

## What Fathom Is

Fathom plans software work over time: what a team will build, who will build it, and when. It keeps projects, features, releases, people, teams and the hiring plan in one place, and changes are drafts until they're approved.

## Users

Fathom names its personas as they are widely known in the software industry, with typical titles for each. [Roles](roles.md) sets out what each can do.

| Persona | Typical titles |
| --- | --- |
| Product Manager | Product Manager, Product Owner |
| Project Manager | Project Manager, Program Manager, Delivery Manager |
| Engineering Manager | Engineering Manager, Software Development Manager |
| Feature Lead | Feature Lead, Tech Lead |
| Engineering Director | Director, Head of Engineering |
| Engineering Operations Manager | Engineering Operations Manager, Chief of Staff, Resource Manager |
| Executive | VP, CTO |
| Team Member | Software Engineer, Test Engineer |
| Fathom Administrator | System administrator |

## Goals for v1

- **Projects, features, and milestones:** Plan projects with the features they need and their milestones, and the proposals that may become projects.
- **People and teams:** Keep a list of people with their teams, feature teams, capacity, and the employee details planning needs.
- **Org structure:** Record who reports to whom, including planned changes, and show it as an org chart.
- **Hiring plan:** Track the roles that need to be hired and when, and include planned hires in the plan before they are hired.
- **Team composition:** Evaluate teams for balance, such as test-to-development ratios and the number of reports per manager compared with a target.
- **Unified people view:** See current staff and planned hires together, with their reporting lines and high-level assignments.
- **Release planning:** See which features are targeted at which cycles, and which cycles make up each release.
- **Demand forecasting:** See rough estimates (ROMs and SWAGs) for features over the next 6 months, 12 months, 2 years, and beyond, to know what may come and what resources are needed.
- **Resource assignment:** Assign people to projects or features by month.
- **Capacity visibility:** Show over- and under-allocation by person, by manager, and by feature team.
- **Timeline / Gantt view:** Show work interactively, with drag-and-drop to change dates and assignments.
- **Roadmap view:** Let Product Managers shape the roadmap of features by cycle and release, and give leadership a clean, read-only view of it.
- **Roles:** Control what each user can see, edit, and approve through roles.
- **Plan approval:** Save changes as drafts, which are approved before they reach the live plan.
- **Change history:** See who changed what, and when, for the data each user may see.
- **Custom fields and tables:** Let users add their own fields to Fathom's built-in tables, and their own tables, set up in plain language rather than database terms.
- **Exports:** Export the plan and roadmap, limited to what each user's roles allow.
- **Snapshots:** Save point-in-time snapshots of the plan and view them later.

## Out of scope for v1

- Integrations with external systems, such as issue trackers, project scheduling tools and HR systems
- Sign-in through a corporate directory
- Live collaborative editing
- Cost, rates, and budget tracking. Fathom tracks people and time only.
- Task-level or sprint-level tracking. Fathom plans at the project and feature level.
- Time tracking and timesheets
- Mobile-specific UI
- Recording dotted-line reporting relationships
- Tracking licenses

## Constraints

- **No internet at runtime:** Fathom depends on no internet services while it runs, including CDNs, fonts or external APIs.
- **Scale:** Tens of users and a modest amount of data. Simple, easy-to-run choices matter more than horizontal scaling.
- **Personal data:** Fathom holds details about people, so access is by role and classification, and logs leave those details out.
- **Configurability:** As configurable as possible, to suit different domains and structures.
- **Front end:** Rich, interactive timeline, Gantt, org chart, and capacity views, which drive the front-end technology choice.

## Key Decisions

- **Planning model:** Monthly planning, with allocations as a percentage of a person's month.
- **Planning level:** Fathom plans features, not their stories or tasks, and is never a clone of a full project management application. See the [Decisions Log](decisions.md#planning).
- **Planned hires:** Planned hires appear in the plan and can be allocated like current staff.
- **Access:** Role-based. Each user holds one or more roles and acts as one at a time, and roles grant access to classifications of data.
- **Editing:** No live collaboration. Draft changes are approved before they reach the live plan.
- **Configurability:** A fixed core of built-in tables, extended with custom fields and tables. See the [Decisions Log](decisions.md#configuration).
- **Authentication:** Local accounts managed in Fathom for v1.
- **Tech stack:** TypeScript end to end with PostgreSQL, in Docker. See [ADR 0001](../adr/0001-tech-stack.md).

Detailed decisions are recorded in the [Decisions Log](decisions.md). The order in which goals are delivered is in the [Roadmap](roadmap.md).

## Future possibilities

- Sign-in through the corporate directory (Active Directory / Entra ID / LDAP)
- Reading project data from a project scheduling tool
- Integrations with issue trackers and HR systems
- Other integrations as needs emerge
- Physical resources, such as equipment, planned and allocated alongside people
- Importing people: adding and updating people from a CSV or TSV file, planned for v1.1, as the [Roadmap](roadmap.md#not-yet-placed) records
