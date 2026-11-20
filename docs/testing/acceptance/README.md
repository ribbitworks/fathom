# Acceptance Tests

The acceptance tests install Fathom, set it up, and follow work as it passes between roles, by hand, as [Testing Standards § Manual Tests](../../standards/testing.md#manual-tests) sets out. They use none of the seed data. This page gives the order to run them in for a whole run, what each starts from, and how long each takes.

## Run Order

| Order | Test | Starts from | Cases | Time |
| --- | --- | --- | --- | --- |
| 1 | [Installing Fathom](acceptance-installing-fathom-manual-test.md) | Its own [Prepare the Installation](acceptance-installing-fathom-manual-test.md#prepare-the-installation), on a machine with no earlier installation | 4 | 30 minutes, plus the first build |
| 2 | [Setting Up Fathom](acceptance-setting-up-fathom-manual-test.md) | [Start From an Empty Database](../manual-test-basics.md#start-from-an-empty-database) | 9 | 30 minutes |
| 3 | [Work Between Roles](acceptance-work-between-roles-manual-test.md) | What Setting Up Fathom leaves, run straight after it with no restore or reset | 6 | 30 minutes |
| | **Total** | | **19** | **About 1 hour 30 minutes, plus the first build** |

Installing Fathom stands alone, with its own secrets, containers and database, built from the clone. It ends by removing them and its `deploy/.env`, which must be done before the next test. Setting Up Fathom and Work Between Roles then run, in that order, since the second works on the organization the first sets up.

## Role Workflow Tests

Each starting role also has a workflow test, which follows the workflows of its role tutorial in [Help](../../help/index.md) on the seed data. They are kept in `docs/testing/` beside the feature tests, for a quicker check after a change. They aren't part of a whole run. Each starts from [Reset the Database](../manual-test-basics.md#reset-the-database), so they may run in any order; the order below is that of the role tutorials.

| Test | Cases | Time |
| --- | --- | --- |
| [Team Member](../team-member-workflows-manual-test.md) | 4 | 20 minutes |
| [Product Manager](../product-manager-workflows-manual-test.md) | 9 | 30 minutes |
| [Feature Lead](../feature-lead-workflows-manual-test.md) | 8 | 30 minutes |
| [Project Manager](../project-manager-workflows-manual-test.md) | 4 | 30 minutes |
| [Engineering Manager](../engineering-manager-workflows-manual-test.md) | 8 | 30 minutes |
| [Engineering Director](../engineering-director-workflows-manual-test.md) | 5 | 30 minutes |
| [Workforce Administrator](../workforce-administrator-workflows-manual-test.md) | 8 | 30 minutes |
| [Executive](../executive-workflows-manual-test.md) | 5 | 20 minutes |
| [Administrator](../administrator-workflows-manual-test.md) | 8 | 30 minutes |

## Starting a Whole Run

1. Set up a fresh clone of Fathom as [Development Setup § First Run](../../design/development-setup.md#first-run) describes.
1. Get ready as [Manual Test Basics § Test Environment](../manual-test-basics.md#test-environment) describes, adding what each test's own Test Environment lists.
1. Run the tests in the Run Order above, each starting as its own instructions say.

## Results

Mark each step while running it, and save the marked copy outside the repository, as [Manual Test Basics § Recording Results](../manual-test-basics.md#recording-results) sets out. Nothing about a run's results goes into the repository.
