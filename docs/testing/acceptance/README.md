# Acceptance Tests

Each acceptance test follows the workflows of a [Help page](../../help/index.md) by hand, as [Testing Standards § Manual Tests](../../standards/testing.md#manual-tests) sets out. This page gives the order to run them in for a whole run, what each starts from, and how long each takes.

## Run Order

| Order | Test | Starts from | Cases | Time |
| --- | --- | --- | --- | --- |
| 1 | [Installing Fathom](acceptance-installing-fathom-manual-test.md) | Its own [Prepare the Installation](acceptance-installing-fathom-manual-test.md#prepare-the-installation), on a machine with no earlier installation | 4 | 30 minutes, plus the first build |
| 2 | [Setting Up Fathom](acceptance-setting-up-fathom-manual-test.md) | [Start From an Empty Database](../manual-test-basics.md#start-from-an-empty-database) | 9 | 30 minutes |
| 3 | [Work Between Roles](acceptance-work-between-roles-manual-test.md) | What Setting Up Fathom leaves, run straight after it with no restore or reset | 6 | 30 minutes |
| 4 | [Team Member](acceptance-team-member-manual-test.md) | [Reset the Database](../manual-test-basics.md#reset-the-database) | 4 | 20 minutes |
| 5 | [Product Manager](acceptance-product-manager-manual-test.md) | [Reset the Database](../manual-test-basics.md#reset-the-database) | 9 | 30 minutes |
| 6 | [Feature Lead](acceptance-feature-lead-manual-test.md) | [Reset the Database](../manual-test-basics.md#reset-the-database) | 8 | 30 minutes |
| 7 | [Project Manager](acceptance-project-manager-manual-test.md) | [Reset the Database](../manual-test-basics.md#reset-the-database) | 4 | 30 minutes |
| 8 | [Engineering Manager](acceptance-engineering-manager-manual-test.md) | [Reset the Database](../manual-test-basics.md#reset-the-database) | 8 | 30 minutes |
| 9 | [Engineering Director](acceptance-engineering-director-manual-test.md) | [Reset the Database](../manual-test-basics.md#reset-the-database) | 5 | 30 minutes |
| 10 | [Workforce Administrator](acceptance-workforce-administrator-manual-test.md) | [Reset the Database](../manual-test-basics.md#reset-the-database) | 8 | 30 minutes |
| 11 | [Executive](acceptance-executive-manual-test.md) | [Reset the Database](../manual-test-basics.md#reset-the-database) | 5 | 20 minutes |
| 12 | [Administrator](acceptance-administrator-manual-test.md) | [Reset the Database](../manual-test-basics.md#reset-the-database) | 8 | 30 minutes |
| | **Total** | | **78** | **About 5 hours 40 minutes, plus the first build** |

Installing Fathom stands alone, with its own secrets, containers and database, built from the clone. It ends by removing them and its `deploy/.env`, which must be done before the next test. Setting Up Fathom and Work Between Roles then run, in that order, since the second works on the organization the first sets up. Each role's test starts from the seed data afresh, so the role tests may run in any order; the order above is that of the role tutorials in [Help](../../help/index.md).

## Starting a Whole Run

1. Set up a fresh clone of Fathom as [Development Setup § First Run](../../design/development-setup.md#first-run) describes.
1. Get ready as [Manual Test Basics § Test Environment](../manual-test-basics.md#test-environment) describes, adding what each test's own Test Environment lists.
1. Run the tests in the order above, each starting as its own instructions say.

## Results

Mark each step while running it, and save the marked copy outside the repository, as [Manual Test Basics § Recording Results](../manual-test-basics.md#recording-results) sets out. Nothing about a run's results goes into the repository.
