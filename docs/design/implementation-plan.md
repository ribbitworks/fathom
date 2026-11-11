# Fathom: Implementation Plan

**Status:** Proposal for the owner's review
**Last updated:** 2026-11-10

A proposed way to build the first stage of the [Roadmap](../product/roadmap.md): groundwork first, then a sequence of thin vertical slices. Each slice goes through every layer (browser, server, database, deployment), follows the roadmap's [Guiding Principles](../product/roadmap.md#guiding-principles), the [Agent Workflow](../standards/shared/agent-workflow.md), and the [Data](../../AGENTS.md#data) rules.

## Groundwork

These come before the first line of application code:

- **Library choices:** Recorded in [ADR 0002](../adr/0002-libraries.md).
- **Testing standard:** Recorded in the [Testing Standards](../standards/testing.md).
- **Code review standard for source code:** Recorded in the [Code Review Standards](../standards/code-review.md).
- **Build process:** Where builds and scans run, answering the open question in the [Security Plan](../security/security-plan.md). Until it is answered, builds and scans run locally.
- **Development setup:** The repository layout, local development, and fictional seed data, as described in [Development Setup](development-setup.md).
- **Remote repository:** Once the repository has a remote, the branching rules in [agent-workflow.md](../standards/shared/agent-workflow.md) and the repository proposals in the Security Plan apply.

## Definition of Done for Each Slice

Beyond the workflow, each slice:

- Adds the [access control tests](../standards/testing.md#access-control-tests) for the data it introduces.
- Records access history for any Restricted or Confidential data it introduces.
- Makes changes to the data it introduces drafts that need approval, once Draft and Approval is built.
- Updates the threat model as the [Code Review Standards](../standards/code-review.md) require.

## Slices

The slices are built in this order, which may change as work progresses. The table shows the slices that are done or next; the rest are still to come.

| Slice | Progress |
| --- | --- |
| Hello Fathom | Done, on macOS; server platforms are tested as in [Deployment Testing](#deployment-testing) |
| Component Evaluation | Done, in [ADR 0004](../adr/0004-ui-components.md) |
| Accounts and Access Control | Done |
| Visual Design | Done |
| People | Done: user-defined lists and people |
| Seed Accounts | Done |
| Change History | Done |
| Draft and Approval | Done |
| Web Link Columns | Done |
| Note Columns | Done |
| Number Columns | Done |
| Teams and Reporting Lines | In progress: schema, server, seed, Drafts, People's columns, the Manager flag, the org chart, and manual tests |
| Org Chart Additions | In progress: team colours, drafts on the chart, and person details; next chart fields, filters, and sort |
| Projects and Feature Teams | In progress: feature teams on the org chart, with the feature team chart, a team's panel, its members and lead as drafts, a person's feature teams in their details, and the Feature assignments page, showing feature team drafts, with its cells edited one at a time; projects next |
| General Features | Done |
| Allocations and Capacity | In progress: allocations on the server, each person's or planned hire's allocation to a feature one draft, approved with Approve allocations, with the employment and removal rules, the change history, and the seed's fictional allocations; a planned hire with allocations can't be filled, and a filled one can't be allocated, until filling moves its allocations; the Allocations mode of the Feature assignments grid, read only, with planned hires as rows, each month's features and total, the over- and under-allocation marks, and allocation drafts; next the capacity total rows for each group and the whole organization |
| Features and the Roadmap | In progress: schema, and features on the server as drafts approved with Approve Plan, following their cycles when those move, with the seed's fictional features; Edit Features is built; the Features page, grouped by cycle, with feature drafts on the Drafts page and in the change-length dialog; a feature's status as a list with meanings, the month it is needed by, customers, a note, and grouping by that month; columns added to Features, with their values in a feature's draft; the conversions between units of effort on the server; the Effort column, shown in the unit and decimal places the view names; the features projects and proposals name, on the server and in Features columns on Projects and Proposals, each feature a link from their details; next the Projects and Proposals columns on Features, then grouping Features by release, with the conversions' settings deferred, as [Issues](../issues.md) records |
| Cycles and Releases | In progress: schema, server, seed, the Releases page and its timeline, a colour for each release, and changing one cycle's length |
| Hiring Plan | In progress: schema and server, with Position and the hiring states built in and hires known by requisition or temporary ID; lists with meanings edited on the Lists page, which marks built-in lists; planned hires as rows of People, with optional names, the Hired state for people, the seed's planned hires, and a manual test; planned hires' values in People's added columns, each offered on them unless switched off; the Left state, with each person's own state of the meaning their end date gives, and those who have left listed for everyone who sees people; planned managers, with planned hires reporting to them on People and drawn as placeholders on the org chart; filling a planned hire as one draft, from its details panel |
| Editable Roles | In progress: schema, the server reading roles from the database, the Roles page, several roles for each account, chosen from every role on the Accounts page, with a default, acting as one at a time and switching from the account menu, each change recording the role it was made as, the Hiring plan permission area, with viewing and editing, approving split by area, the starting roles rewritten for the personas, and viewing accounts, roles, and settings apart from changing them |

### Hello Fathom

The smallest version of Fathom: a single page that proves the foundation works end to end.

- A React page served by the application server over HTTPS.
- The page calls the server, which reads from PostgreSQL through the migrations and data access chosen in the groundwork, and shows the result.
- The containers run with Docker Compose, as shown in the [Architecture](architecture.md). The database is reachable only from the application, and neither the application nor the database can reach the internet.
- Unit and integration tests, type checking, linting, and the build-time scans from the Security Plan all run with one command.
- Tests prove that outbound internet access from the application and database containers fails.

### Component Evaluation

The evaluation in the roadmap's [After Hello Fathom](../product/roadmap.md#after-hello-fathom) section. It is not a vertical slice, so the definition of done for slices does not apply to it.

### Accounts and Access Control

Local accounts, sign-in, sessions, and the proposed [Roles](../product/roles.md), enforced through the shared data access layer, with the access history. Every later slice builds on this. Roles are built so they are cheap to change, and are agreed before going live, as the roadmap requires.

### Visual Design

The visual design in the roadmap's [After Hello Fathom](../product/roadmap.md#after-hello-fathom) section, agreed with the owner and applied to the screens that exist: navigation and layout, type, colour, spacing, and how tables, forms, dialogs, and messages look, using the components chosen in ADR 0004. Every later slice is built in this design, as [Visual Design](visual-design.md) sets out. It is not a vertical slice, so the definition of done for slices does not apply to it.

### People

People with the employee details the roadmap's [first stage](../product/roadmap.md#stage-who-is-working-on-what) allows.

It is built in two steps: user-defined lists of choices, as set out in the [Decisions Log](../product/decisions.md#configuration), and people, with fictional seed data and commands to load and remove it, whose details such as site or position are columns drawing on lists. Teams with their managers and direct reports come in the Teams and Reporting Lines slice. The lists step adds the change history the Decisions Log requires, which every later slice records its changes in. The people step adds columns on People that draw on lists, held in the values table [ADR 0005](../adr/0005-flexible-data-model.md) proposes, and undo in one step for lists and people. The other field types, apart from Web link, and custom tables wait for the custom fields stage.

### Seed Accounts

Fictional accounts for development, one for each persona in the [Product Brief](../product/brief.md#users), with addresses on the reserved `fathom.test` domain, named after their persona, and holding that persona's role from [Roles](../product/roles.md#roles-by-persona), so each role can be tried by signing in as it.

- **Password:** They share a random password in the git-ignored `.dev/secrets/dev_account_password`, made if missing and printed when the accounts are seeded. `pnpm dev:reset` seeds them, replacing the single account it made before.
- **Adding and removing:** They are added and removed with the rest of the seed data. Accounts are never deleted, since the change history refers to them and can only be added to, so removing the seed data deactivates them, and seeding again reactivates them.
- **Development only:** They exist only in development databases, since the seed package is never part of the runtime image. The threat model gains a row for them, with the check that keeps them out of production.

### Change History

A page showing the change history the lists step built: who changed what, and when, limited to the changes each user may see, as set out in the [Decisions Log](../product/decisions.md#configuration). Draft and approval builds on it to show what a draft changes.

### Draft and Approval

Plan approval, built on lists and people first, as the owner intends approval to cover them too, so the pattern every later table follows is set once: each changed row is a draft, seen with the live data, until an Approver approves or rejects it, as set out in the [Decisions Log](../product/decisions.md#planning) and [ADR 0007](../adr/0007-draft-rows.md). The seed data gains drafts made by the personas who edit, covering each case: a row added, changed, and removed, a rejected draft with its reason, and a draft that uses another, such as a person given a choice that is itself a draft.

It is built in two steps. The first gives people drafts: shown in place on the People table, approved and rejected there and on a Drafts page, explained on Help's Drafts page, undone like other changes, and recorded in the change history, with seed drafts of people added, changed, and removed, and rejected. The second gives drafts to lists, choices, the order of a list's choices, and columns, with drafts that use other drafts approved together, which Help's Drafts page then explains, and adds the seed draft that uses another. A third makes drafts private until published, as [ADR 0008](../adr/0008-unpublished-drafts.md) sets out, with seed data holding unpublished changes and a record someone else holds.

### Web Link Columns

A second type of column on People, Web link: each person's value is one web address, http or https only, intranet hosts included, never a file or folder, with an optional name shown in its place. A Web link column sets its own visibility, since it has no list to take one from.

### Note Columns

A third type of column on People, Note: each person's value is one rich-text note, kept as Markdown holding only the formats the [Decisions Log](../product/decisions.md#configuration) allows, and written in a side panel in an editor or as Markdown. A Note column sets its own visibility, as a Web link column does. The note format is shared, so each release also has one note of its own, written in the same side panel from the Releases page, with fictional notes on two seeded releases.

### Number Columns

A fourth type of column on People and planned hires, Number: each value is one number, typed in one form and shown as the reader's language writes it, as the [Decisions Log](../product/decisions.md#configuration) sets out, with its own visibility, and sorting, filtering, and Metrics. The rules for what a number is are shared, for later columns that hold a number with more to it, such as an estimate.

### Teams and Reporting Lines

People managers and their current direct reports: each person's reporting line, with the date it takes effect from, shown as Manager and Team columns on People, the Manager flag that decides who can be a manager, teams' optional names, and the rules, drafts, and warnings in the [Decisions Log](../product/decisions.md#workforce). The seed data gains managers, reports, named and unnamed teams, a person with no manager, and a manager whose end date has passed while people still report to them. Reporting lines set the pattern for records that link to other records, which features, feature teams, and planned hires reuse, and for records in force from a date until the next one starts, which feature team membership and allocations reuse. The Org chart page draws today's approved reporting lines with React Flow, as [ADR 0004](../adr/0004-ui-components.md) chooses, and as the [Decisions Log](../product/decisions.md#workforce) describes, with a [manual test](../testing/org-chart-manual-test.md). Planned hires join the chart as placeholders, with planned managers heading their planned teams, as the [Hiring Plan](#hiring-plan) slice builds. The [Org Chart Additions](#org-chart-additions) slice builds on it. Future dates come with planned reporting changes in [The Organization](../product/roadmap.md#stage-the-organization) stage, which also shows the chart on a chosen date.

### Org Chart Additions

The additions to the org chart that the [Decisions Log](../product/decisions.md#workforce) records, built in this order, each step its own pull request:

1. **Team colours:** each team's colour, from the palette releases use, chosen on the org chart and changed at once rather than drafted, with a Team colours permission, which needs a migration; with it, naming teams on the chart as drafts, a Teams panel, and teams in the finder.
2. **Drafts on the chart:** the Draft menu tables have, on the org chart: people drafted to a new manager drawn under them with a Live copy under their current one, drafted positions and team names, Drafts applied and Live only, as the [Decisions Log](../product/decisions.md#workforce) sets out.
3. **Person details:** one person's details in a side panel, which the org chart's cards and People's rows open, as the [Decisions Log](../product/decisions.md#workforce) sets out. Restricted details shown there are recorded in the access history, as on People. Those who may change people change the person's details there, as on People.
4. **Chart fields, filters, and sort:** cards show fields chosen from People's columns, at the tiers the reader may see, kept apart from the card's own details, with filters and sort saved as People's views are.

The [Projects and Feature Teams](#projects-and-feature-teams) slice adds a second chart, of feature teams, with their own colours, as the [Decisions Log](../product/decisions.md#workforce) records; its dotted lines to members' managers follow, as [Issues](../issues.md#people) records.

### Hiring Plan

Planned hires as rows of the People table beside people, as the [Decisions Log](../product/decisions.md#workforce) sets out: an optional name, shown as the hire's position and ID while it has none; requisitions in the ID column, with temporary IDs until the official one is known; position as a built-in column, required for people and planned hires alike; the State column, the first list with meanings, which the slice builds; the Expected column; People's added columns offered on planned hires unless switched off for them; drafts, with removing a hire removing its allocations; and placeholders for those who do not see planned hires' other details. The server's planned hires, built apart from People, are read and changed through People's table. Fathom holds no real data yet, so the migration carries the development data over simply: each hire's title is dropped, its state becomes the Proposed or Open choice it maps to, and cancelled or filled hires are removed; the Positions list and the column drawing on it become the built-in ones, and a person without a position is given one before Position is required. Planned managers, planned hires marked as managers, have other planned hires report to them, on People and on the org chart, where every planned hire is drawn as a placeholder. Filling a planned hire links it to an existing person or adds a new one, and new employees can be added before they start; filling a planned manager moves its planned hires to the person who fills it. Placeholders show with their manager's team, and count toward its reports once the Team Composition slice compares them with the range. The seed data gains planned hires in each state, with values in the columns they share with people, some with requisitions and some with temporary IDs, one filled by a new employee who has not started, and one filled by an internal transfer. Planned hires are allocated with the [Allocations and Capacity](#allocations-and-capacity) slice.

### Editable Roles

Roles kept in the database as sets of permissions, as the [Decisions Log](../product/decisions.md#people-and-privacy) sets out, built in this order, each step its own pull request:

1. **Schema:** roles, and the permissions each grants. Accounts hold roles by reference, and the migration makes today's eight roles with exactly what they grant now, so nobody's access changes. The application cannot change a starting role's key, and a role it adds cannot take one.
2. **Server:** what a user may do is read from their role in the database, on every request. Each permission gains its plain-English descriptions, naming the permissions it does nothing without any of.
3. **Roles page:** an Administrator who may edit roles sees each role's permissions as a grid of areas and actions, with the plain-English result beside it, copies and edits roles, and sees which accounts a change affects before saving it. Roles' names and descriptions are then read from the database, replacing the copies in the web app and [Roles](../product/roles.md), which already differ slightly. Which pages a role does not open is worked out from the permission each sidebar page names. Before roles can be edited, the last-Administrator guard moves from the Administrator role to the permissions to manage accounts and to edit roles. The Roles page comes first; then each account holds exactly one role, as the [Decisions Log](../product/decisions.md#people-and-privacy) sets out: one starting role for each persona replaces the eight, granting what each persona's roles granted together, and the account dialog chooses one role from every role, made later or starting, by its ID, with each role's description, so no combined result is needed. The Accounts page reads roles' names and descriptions from the database, and its controls follow the permissions rather than the Administrator role. Help lists the starting roles as Fathom gives them, with the user's own role, read from the database. The access history marks every change to a role as worth checking; a second person confirming Confidential grants is deferred in [Issues](../issues.md#roles) until HR asks for it.
4. **Finer permissions:** split by area, one area at a time, starting with approving, so Approvers approve only the kinds of drafts their role names. Approving is split, each kind of draft mapped to one area's Approve permission in `approvePermissions` in `packages/shared/src/drafts.ts`, decided by the owner on 2026-11-07; approving the plan's customers, projects, proposals, and milestones is built, with Approve Plan no longer marked not built yet, and approving features is built with them; approving the roadmap is built with the roadmap. Planned hires are an area of their own, Hiring plan, with viewing and editing, in place of the Confidential tier's hold on them, decided by the owner on 2026-11-07, as the [Decisions Log](../product/decisions.md#people-and-privacy) sets out; drafting and approving them come with the split of approving. The starting roles are then rewritten for the personas, with Product Manager and Feature Lead in place of Planner, Edit Features apart from Edit Plan, and View Accounts, View Roles, and View Settings, which open those pages read only, decided by the owner on 2026-11-07, as the [Decisions Log](../product/decisions.md#people-and-privacy) sets out. Releases are an area of their own, apart from the rest of the plan, so approving draft releases, which Project Managers and the Engineering Director generally do, can be granted on its own, decided by the owner on 2026-11-04.

Scope, such as one's own reporting line, follows later, as [Issues](../issues.md#roles) records.

### Importing People

Importing people from a CSV or TSV file, as the [Decisions Log](../product/decisions.md#people-and-privacy) sets out, after Teams and Reporting Lines and the People table that also holds planned hires. It is no longer part of the first stage, as the [Roadmap](../product/roadmap.md#not-yet-placed) records. The browser reads the file, with an open-source parser chosen as [ADR 0002](../adr/0002-libraries.md) sets out, which handles quoted cells, Excel's UTF-8 files, and either separator, and sends its rows as the edits pasting them would make, so the server's checks are those of any edit and it parses no files. The server checks the whole import in one request, so problems only it finds are listed with the others. The preview lists problems in a table that can be copied, for fixing the file. Planned hires, and other tables, may take imports later in the same way.

### Cycles and Releases

Release streams, as many as an organization uses, each with a configurable cycle length and cycle names that can change from a chosen date, and releases with typed names that include consecutive cycles, as set out in the [Decisions Log](../product/decisions.md#planning). Each cycle knows its share of the months it spans, as the Decisions Log sets out, which capacity and the timeline use.

### Projects and Feature Teams

Built: customers, projects, proposals, and project milestones as draftable records, approved with Approve Plan, with the seed's fictional customers, projects, and proposals, and the Projects page that shows and edits them, as [Visual Design](visual-design.md#layout) sets out. Projects with their customers, from a built-in Customers table. Milestones of projects, in a Milestones table of their own, as the [Decisions Log](../product/decisions.md#planning) sets out. Feature teams with their names, members and feature leads, with membership and leads kept from a date as reporting lines are, including planned changes, and read as of a chosen day with the Org chart's date control, as the [Decisions Log](../product/decisions.md#workforce) sets out; the screens for planning ahead are still to come. The Feature assignments page shows them month by month on the shared table, where those who propose feature teams change a month's teams, as [Visual Design](visual-design.md#components) sets out, and its second mode, Allocations, comes with the [Allocations and Capacity](#allocations-and-capacity) slice. Engineering Managers propose them as drafts, which an Approver approves, as set out in [Roles](../product/roles.md). They are kept on the org chart, as the [Decisions Log](../product/decisions.md#workforce) sets out, which draws them as a second chart. Building feature teams takes their three permissions out of `unbuiltPermissions` in `packages/shared/src/access.ts`, so the Roles page stops marking them Not built yet. The seed data gains fictional projects with customers and milestones, and fictional feature teams, which the roadmap's test page later draws.

This slice and Proposals come before Features and the Roadmap, as the [Decisions Log](../product/decisions.md#planning) sets out, so what links them to features is built with that slice.

### Proposals

Built with Projects: proposals, with their statuses from the built-in Proposal statuses list and the projects linking to them, with no rules between a proposal and a project, as the [Decisions Log](../product/decisions.md#planning) sets out. They reuse the patterns Projects and Feature Teams sets, so they come straight after it.

### Features and the Roadmap

The Product Manager's roadmap: features with the built-in columns in the Decisions Log, each targeting a cycle, shown as a table that can be grouped by cycle, with Later for features that target none. Products become a built-in table, and lists drawn from a table let a Product column on Features pick from it. Fathom offers to add suggested columns, such as kind, priority, and product, which the owner will judge once seen. Features have a built-in description, and their increments are not linked, as the [Decisions Log](../product/decisions.md#planning) sets out, which also says where a feature's effort falls in time, for the Demand Forecasting slice. The seed data gains fictional features across the cycles of a release stream, with some in Later, for the test page below. The slice also links features to what was built before them: the features a project needs, edited from either Projects or Features; milestones of features and the release warnings; the features a feature team owns; and the features a proposal proposes, as the [Decisions Log](../product/decisions.md#planning) sets out. After the Features page, one step makes a feature's status a [list with meanings](../product/decisions.md#configuration) and adds what a Product Manager enters first, Needed by, customers, and a note, with the description limited, as the [Decisions Log](../product/decisions.md#planning) sets out, and the table able to group by Needed by; another adds columns users add to Features, starting with Complexity, decided by the owner on 2026-11-08. Feature milestones and the release warnings follow the links to projects and proposals, as their own step, decided by the owner on 2026-11-08: a milestone's record then holds its feature and no longer assumes a project. General features come with [General Features](#general-features). Changing one cycle's length moves the features on cycles that move, and a change that would leave a feature's target no longer a cycle is refused, as the Decisions Log's Cycles and Cycle length changes set out, built with the server's features.

Features will take saved views, personal and shared, as People's table does, in a pull request of their own soon after, decided by the owner on 2026-11-08.

A test page of the roadmap board proposed in [ADR 0009](../adr/0009-roadmap-and-timeline-views.md) comes with the slice, so the owner can judge the board before The Organization stage. It is labelled as a test and left off the main navigation:

- **Roadmap board:** The real features of one release stream, with a column for each cycle and Later, and cards moved by mouse, by Alt and the arrow keys, and from their menu. Moves are real drafts of the target cycle, marked as on tables.
- **Timeline sketch:** Read only, with rows for the real feature teams and bars across cycles drawn from fixed fictional data in the page, since allocations do not exist yet, to judge lanes and row height.

### General Features

Each project's general feature, which a future allocation names for work on the project itself, as the [Decisions Log](../product/decisions.md#planning) sets out, built before [Allocations and Capacity](#allocations-and-capacity). Whatever names a feature handles a general feature, which has no name of its own, as allocations will. The slice began as Workstreams, which the [Decisions Log](../product/decisions.md#planning) records as dropped.

### Allocations and Capacity

Allocations kept from a month, as reporting lines are, for people and planned hires; capacity by person, by manager, by feature team, and for the whole organization; and the warnings and rules in the [Decisions Log](../product/decisions.md#planning), including over- and under-allocation and allocations a date change leaves outside someone's employment. They are shown in the monthly resource grid, grouped by manager or feature team, with the cycle and release lines of one release stream at a time from the Cycles and Releases slice, as [Visual Design](visual-design.md#components) sets out. Filling a planned hire moves its allocations to the person who fills it, as the [Decisions Log](../product/decisions.md#workforce) sets out. The seed data gains fictional allocations for people and planned hires across several months, including an over-allocated person, an under-allocated one, a project's general feature, and a filled planned hire whose person starts after its target date. A manual test in [Manual Tests](../testing/) walks through the grid. Building allocations takes their two permissions out of `unbuiltPermissions` in `packages/shared/src/access.ts`, so the Roles page stops marking them Not built yet, and adds Approve allocations. Making drafts stays marked, since no change checks it yet, as [Issues](../issues.md#planning) records.

### Team Composition

Reports per manager, including planned hires, compared with a range, in a Teams table with a row for each manager, counted as at a month the reader picks, as the [Decisions Log](../product/decisions.md#workforce) sets out. It builds on the People table's [metrics](../product/decisions.md#configuration), which count people by a column's values: reports per manager groups the same counts by manager, with a target beside each, and later ratios, such as test to development, compare two of a column's counts.

### Demand Forecasting

One estimate per feature, entered in a unit of effort, with configurable conversions between units, and compared with the capacity from [Allocations and Capacity](#allocations-and-capacity) over the forecasting horizons in the [Product Brief](../product/brief.md), worked out from features' allocations and target cycles, as the [Decisions Log](../product/decisions.md#planning) sets out. A Demand page shows the forecast as a table and a simple bar chart, for the whole organization and for each feature team, and Features gain Allocated and Remaining columns beside the estimate. Each cycle's demand on the roadmap board waits for the visual roadmap.

Where a feature's effort counts in the forecast, as [Feature effort over time](../product/decisions.md#planning) and the Demand forecast set out:

```mermaid
flowchart TD
    feature[A feature's estimate and allocations] --> allocated[Allocations count in their own months]
    feature --> left{Done or cancelled, or allocations reach the estimate?}
    left -->|yes| none[Nothing more counts]
    left -->|no| cycle{Targets a cycle?}
    cycle -->|yes| spread[The rest counts across the cycle's months, by their days]
    cycle -->|no| later[The rest counts in Later]
    allocated --> bands[Bands: next 6 months, 6 to 12 months, 1 to 2 years, beyond 2 years]
    spread --> bands
    bands --> split[Split into committed and possible, by the feature's status]
    later --> split
```

### Project Manager Input

The input Project Managers give on whether teams are in place. Its form is an [open question in the Product Brief](../product/brief.md#open-questions), so this slice is scheduled once it is answered.

## Deployment Testing

Testing on the server platforms in [Supported Platforms](../operations/supported-platforms.md) may be some time away. Until then, slices are proven on development platforms. Each server platform is tested once its host setup below is written and a suitable machine is available. Deploying to company infrastructure, including for testing, first needs IT approval.

## Host Setup

The scripts that set up the production host are written once the first stage works on macOS, close to deployment. For the first deployment's Windows Server with WSL 2, they cover the [setup it needs](../operations/supported-platforms.md#windows-server-with-wsl-2), the host firewall, where possible blocking the proxy's outbound traffic, and creating the first Administrator, the Fathom Administrator account, by running `apps/server/src/create-administrator.ts` in the application's container, as `pnpm stack:create-administrator` does. They wait until then because they depend on IT's answers to the requests in the [IT Overview](../operations/it-overview.md) and [Deployment](../operations/deployment.md), and need a Windows machine to test on.

## Going Live

When the slices are complete, Fathom is deployed to the production host and the steps in the roadmap's [Before Going Live](../product/roadmap.md#before-going-live) section are completed.
