# Acceptance Tests

The acceptance tests install Fathom, set it up, and follow work as it passes between roles, by hand, as [Testing Standards § Manual Tests](../../standards/testing.md#manual-tests) sets out. They use none of the seed data. This page gives the order to run them in for a whole run, what each starts from, and how long each takes.

## Run Order

| Order | Test | Starts from | Cases | Time |
| --- | --- | --- | --- | --- |
| 1 | [Installing Fathom](acceptance-installing-fathom-manual-test.md) | Its own [Prepare the Installation](acceptance-installing-fathom-manual-test.md#prepare-the-installation), on a machine with no earlier installation | 4 | 30 minutes, plus the images' download |
| 2 | [The Team's Accounts](acceptance-team-accounts-manual-test.md) | What Installing Fathom leaves | 5 | 30 minutes |
| 3 | [Setting Up Fathom](acceptance-setting-up-fathom-manual-test.md) | What The Team's Accounts leaves | 12 | 30 minutes |
| 4 | [Reporting Lines](acceptance-reporting-lines-manual-test.md) | What Setting Up Fathom leaves | 4 | 20 minutes |
| 5 | [Feature Teams](acceptance-feature-teams-manual-test.md) | What Reporting Lines leaves, with its changes not yet published | 6 | 30 minutes |
| 6 | [Hiring and Who Sees What](acceptance-hiring-and-who-sees-what-manual-test.md) | What Feature Teams leaves, with the Engineering Director signed in | 5 | 30 minutes |
| 7 | [Planning Projects](acceptance-planning-projects-manual-test.md) | What Hiring and Who Sees What leaves | 5 | 25 minutes |
| 8 | [Planning Features and a Release](acceptance-planning-features-and-a-release-manual-test.md) | What Planning Projects leaves, with its changes not yet published | 5 | 30 minutes |
| 9 | [Reviewing the Plan](acceptance-reviewing-the-plan-manual-test.md) | What Planning Features and a Release leaves | 4 | 20 minutes |
| 10 | [Staffing the Work](acceptance-staffing-the-work-manual-test.md) | What Reviewing the Plan leaves | 9 | 30 minutes |
| 11 | [Deciding the Changes](acceptance-deciding-the-changes-manual-test.md) | What Staffing the Work leaves | 5 | 30 minutes |
| 12 | [Reading the Plan](acceptance-reading-the-plan-manual-test.md) | What Deciding the Changes leaves | 9 | 30 minutes |
| | **Total** | | **73** | **About 5 hours 35 minutes, plus the images' download** |

Installing Fathom installs a release's published images, with their own secrets, containers and database, in a folder of their own. Every later test runs on that installation, straight after the one before, using only what the run has made: no seed data and no development accounts.

[Start Again](../manual-test-basics.md#start-again) removes the installation, for a fresh run or before other manual tests in the clone.

## Role Workflow Tests

Each starting role also has a workflow test, which follows the workflows of its role tutorial in [Help](../../help/index.md) on the seed data. They are kept in `docs/testing/` beside the feature tests, for a quicker check after a change.

They aren't part of a whole run. Each starts from [Reset the Database](../manual-test-basics.md#reset-the-database), so they may run in any order; the order below is that of the role tutorials.

| Test | Cases | Time |
| --- | --- | --- |
| [Team Member](../team-member-workflows-manual-test.md) | 3 | 20 minutes |
| [Product Manager](../product-manager-workflows-manual-test.md) | 9 | 35 minutes |
| [Feature Lead](../feature-lead-workflows-manual-test.md) | 7 | 30 minutes |
| [Project Manager](../project-manager-workflows-manual-test.md) | 6 | 30 minutes |
| [Engineering Manager](../engineering-manager-workflows-manual-test.md) | 5 | 30 minutes |
| [Engineering Director](../engineering-director-workflows-manual-test.md) | 6 | 30 minutes |
| [Workforce Administrator](../workforce-administrator-workflows-manual-test.md) | 8 | 30 minutes |
| [Executive](../executive-workflows-manual-test.md) | 5 | 25 minutes |
| [Administrator](../administrator-workflows-manual-test.md) | 9 | 30 minutes |

## Starting a Whole Run

1. Set up a fresh clone of Fathom as [Development Setup § First Run](../../design/development-setup.md#first-run) describes, and run [Start Again](../manual-test-basics.md#start-again) if an earlier run's installation is still there.
1. Get ready as [Installing Fathom](acceptance-installing-fathom-manual-test.md#test-environment)'s Test Environment describes, adding what each later test's own Test Environment lists. Fathom's development server isn't needed.
1. Run the tests in the Run Order above, each starting as its own instructions say.

## Results

Mark each step while running it, and save the marked copy outside the repository, as [Manual Test Basics § Recording Results](../manual-test-basics.md#recording-results) sets out. Nothing about a run's results goes into the repository.
