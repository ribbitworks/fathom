# Fathom — Implementation Plan

**Status:** Proposal for the owner's review
**Last updated:** 2026-10-27

A proposed way to build the first stage of the [Roadmap](../product/roadmap.md): groundwork first, then a sequence of thin vertical slices. Each slice goes through every layer (browser, server, database, deployment), follows the roadmap's [Guiding Principles](../product/roadmap.md#guiding-principles), the [Workflow](../../AGENTS.md#workflow), and the [Data](../../AGENTS.md#data) rules.

## Groundwork

These come before the first line of application code:

- **Library choices:** Recorded in [ADR 0002](../adr/0002-libraries.md).
- **Testing standard:** Recorded in the [Testing Standards](../standards/testing.md).
- **Code review standard for source code:** Recorded in the [Code Review Standards](../standards/code-review.md).
- **Build process:** Where builds and scans run, answering the open question in the [Security Plan](../security/security-plan.md). Until it is answered, builds and scans run locally.
- **Development setup:** The repository layout, local development, and fictional seed data, as described in [Development Setup](development-setup.md).
- **Shared repository:** When a shared remote is created, the branching rules in `AGENTS.md` and the repository proposals in the Security Plan apply.

## Definition of Done for Each Slice

Beyond the workflow, each slice adds the [access control tests](../standards/testing.md#access-control-tests) for the data it introduces, records access history for any Restricted or Confidential data it introduces, and updates the threat model as the [Code Review Standards](../standards/code-review.md) require.

## Slices

The slices are built in this order, which may change as work progresses.

### Hello Fathom

The smallest version of Fathom: a single page that proves the foundation works end to end.

- A React page served by the application server over HTTPS.
- The page calls the server, which reads from PostgreSQL through the migrations and data access chosen in the groundwork, and shows the result.
- Both containers run with Docker Compose. The database is reachable only from the application, and neither container can reach the internet.
- Unit and integration tests, type checking, linting, and the build-time scans from the Security Plan all run with one command.
- Tests prove that outbound internet access from the containers fails.

### Component Evaluation

The evaluation in the roadmap's [After Hello Fathom](../product/roadmap.md#after-hello-fathom) section. It is not a vertical slice, so the definition of done for slices does not apply to it.

### Accounts and Access Control

Local accounts, sign-in, sessions, and the proposed [Roles](../product/roles.md), enforced through the shared data access layer, with the access history. Every later slice builds on this. The roadmap asks whether roles must be agreed before this slice is built.

### People and Org Structure

People with the employee details the roadmap's [first stage](../product/roadmap.md#stage-who-is-working-on-what) allows, teams, people managers, and their current direct reports.

### Projects and Features

Projects with their customers, features with their feature teams and feature leads, and milestones. Until plan approval arrives, edits go straight to the live plan and People Managers edit feature teams directly, as set out in the roadmap and [Roles](../product/roles.md).

### Cycles and Releases

Configurable cycles, releases, and patch frequency, and which features ship in which release.

### Allocations and Capacity

Monthly allocations, capacity by person and team, and the warnings and rules in the [Decisions Log](../product/decisions.md).

### Hiring Plan

Planned hires and their ramp-up through allocations, shown in the plan as proposed in [Roles](../product/roles.md).

### Team Composition

Reports per manager, including planned hires, compared with a target.

### Demand Forecasting

One estimate per feature, compared with capacity over the forecasting horizons in the [Product Brief](../product/brief.md).

### Software Project Manager Input

The input Software Project Managers give on whether teams are in place. Its form is an [open question in the Product Brief](../product/brief.md#open-questions), so this slice is scheduled once it is answered.

## Deployment Testing

Testing on the server platforms in [Supported Platforms](../operations/supported-platforms.md) may be some time away. Until then, slices are proven on development platforms, and each server platform is tested as soon as a suitable machine is available. Deploying to company infrastructure, including for testing, first needs IT approval.

## Going Live

When the slices are complete, Fathom is deployed to the production host and the steps in the roadmap's [Before Going Live](../product/roadmap.md#before-going-live) section are completed.
