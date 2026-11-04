# Fathom: Implementation Plan

**Status:** Proposal for the owner's review
**Last updated:** 2026-11-03

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
| Draft and Approval | In progress: drafts of people, lists, choices, and columns done; drafts private until published in progress; drafts that use other drafts next |

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

It is built in two steps: user-defined lists of choices, as set out in the [Decisions Log](../product/decisions.md#configuration), and people, with fictional seed data and commands to load and remove it, whose details such as site or position are columns drawing on lists. Teams with their managers and direct reports come in the Teams and Reporting Lines slice. The lists step adds the change history the Decisions Log requires, which every later slice records its changes in. The people step adds columns on People that draw on lists, held in the values table [ADR 0005](../adr/0005-flexible-data-model.md) proposes, and undo in one step for lists and people. The other field types and custom tables wait for the custom fields stage.

### Seed Accounts

Fictional accounts for development, one for each persona in the [Product Brief](../product/brief.md#users), with addresses on the reserved `fathom.test` domain, named after their persona, and that persona's default roles from [Roles](../product/roles.md#default-roles-by-persona), so each role can be tried by signing in as it.

- **Password:** They share a random password in the git-ignored `.dev/secrets/dev_account_password`, made if missing and printed when the accounts are seeded. `pnpm dev:reset` seeds them, replacing the single account it made before.
- **Adding and removing:** They are added and removed with the rest of the seed data. Accounts are never deleted, since the change history refers to them and can only be added to, so removing the seed data deactivates them, and seeding again reactivates them.
- **Development only:** They exist only in development databases, since the seed package is never part of the runtime image. The threat model gains a row for them, with the check that keeps them out of production.

### Change History

A page showing the change history the lists step built: who changed what, and when, limited to the changes each user may see, as set out in the [Decisions Log](../product/decisions.md#configuration). Draft and approval builds on it to show what a draft changes.

### Draft and Approval

Plan approval, built on lists and people first, as the owner intends approval to cover them too, so the pattern every later table follows is set once: each changed row is a draft, seen with the live data, until an Approver approves or rejects it, as set out in the [Decisions Log](../product/decisions.md#planning) and [ADR 0007](../adr/0007-draft-rows.md). The seed data gains drafts made by the personas who edit, covering each case: a row added, changed, and removed, a rejected draft with its reason, and a draft that uses another, such as a person given a choice that is itself a draft.

It is built in two steps. The first gives people drafts: shown in place on the People table, approved and rejected there and on a Drafts page, explained on Help's Drafts page, undone like other changes, and recorded in the change history, with seed drafts of people added, changed, and removed, and rejected. The second gives drafts to lists, choices, columns, and their order, with drafts that use other drafts approved together, which Help's Drafts page then explains, and adds the seed draft that uses another. A third makes drafts private until published, as [ADR 0008](../adr/0008-unpublished-drafts.md) sets out, with seed data holding unpublished changes and a record someone else holds.

### Cycles and Releases

Release streams, as many as an organization uses, each with a configurable cycle length and cycle names that can change from a chosen date, and releases with typed names that include consecutive cycles, as set out in the [Decisions Log](../product/decisions.md#planning). Each cycle knows its share of the months it spans, as the Decisions Log sets out, which capacity and the timeline use. Releases set the pattern for records that link to other records, which features, teams, and feature teams reuse.

### Features and the Roadmap

The Product Manager's roadmap: features with the built-in columns in the Decisions Log, each targeting a cycle, shown as a table that can be grouped by cycle, with Later for features that target none. Products become a built-in table, and lists drawn from a table let a Product column on Features pick from it. Fathom offers to add suggested columns, such as kind, priority, and product, which the owner will judge once seen. Decided when this slice starts: whether features have a built-in description before text columns arrive, where a feature's effort falls in time for demand, as the [Decisions Log](../product/decisions.md#planning) asks, and whether increments are linked, as the [Domain Model](domain-model.md#open-questions) asks. A test page of the roadmap board proposed in [ADR 0009](../adr/0009-roadmap-and-timeline-views.md), on seed data, comes with the slice.

### Teams and Reporting Lines

Teams with their managers and current direct reports. They set the pattern for changes dated ahead, which feature team membership and allocations reuse.

### Projects and Feature Teams

Projects with their customers, from a built-in Customers table, the features they need, their milestones, and the release warnings in the Decisions Log. Feature teams with their members and feature leads, owning features. People Managers propose them as drafts, which an Approver approves, as set out in [Roles](../product/roles.md).

### Allocations and Capacity

Monthly allocations, capacity by person, by manager, and by feature team, and the warnings and rules in the [Decisions Log](../product/decisions.md), shown in the monthly resource grid, with the cycle and release lines from the Cycles and Releases slice. Decided when this slice starts: whose cycle and release lines the grid shows when there are several release streams.

### Hiring Plan

Planned hires and their ramp-up through allocations, shown in the plan as proposed in [Roles](../product/roles.md).

### Team Composition

Reports per manager, including planned hires, compared with a target. It builds on the People table's [metrics](../product/decisions.md#configuration), which count people by a column's values: reports per manager groups the same counts by manager, with a target beside each, and later ratios, such as test to development, compare two of a column's counts.

### Demand Forecasting

One estimate per feature, entered in a unit of effort, with configurable conversions between units, and compared with capacity over the forecasting horizons in the [Product Brief](../product/brief.md), worked out from features' target cycles.

### Project Manager Input

The input Project Managers give on whether teams are in place. Its form is an [open question in the Product Brief](../product/brief.md#open-questions), so this slice is scheduled once it is answered.

## Deployment Testing

Testing on the server platforms in [Supported Platforms](../operations/supported-platforms.md) may be some time away. Until then, slices are proven on development platforms. Each server platform is tested once its host setup below is written and a suitable machine is available. Deploying to company infrastructure, including for testing, first needs IT approval.

## Host Setup

The scripts that set up the production host are written once the first stage works on macOS, close to deployment. For the first deployment's Windows Server with WSL 2, they cover the [setup it needs](../operations/supported-platforms.md#windows-server-with-wsl-2), the host firewall, where possible blocking the proxy's outbound traffic, and creating the first administrator's account. They wait until then because they depend on IT's answers to the requests in the [IT Overview](../operations/it-overview.md) and [Deployment](../operations/deployment.md), and need a Windows machine to test on.

## Going Live

When the slices are complete, Fathom is deployed to the production host and the steps in the roadmap's [Before Going Live](../product/roadmap.md#before-going-live) section are completed.
