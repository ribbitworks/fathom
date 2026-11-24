---
title: "Agent Workflow"
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["**/*"]
dependencies: ["docs/standards/code-review.md", "docs/standards/testing.md", "docs/standards/documentation.md"]
last_updated: "2026-11-24"
---

# Agent Workflow

How an AI coding agent works in this repository. "Owner" means the user the agent
is working for. There are two working modes; the owner chooses one per session,
and the rules for both modes hold either way.

`AGENTS.md` names Fathom's build, test and run commands, and the kinds of real
data it must never hold. Where this document says "the project's test command"
or "the project's targeted tests", use the ones it names.

## Choosing a Mode

- Before making any change in a session, the agent **Must** ask the owner which
  mode to use:
  - **Autonomous:** the agent runs tests and builds, has its changes reviewed,
    then commits, pushes and opens a pull request without waiting for the
    owner's approval. The owner checks screens and manual tests, and merges.
  - **Restrictive:** the agent edits files only; the owner builds, tests and
    commits.
- Until the owner answers, the agent **Must** follow Restrictive. Restrictive is
  the fallback, not a reason to skip the question.
- The chosen mode holds for the rest of the session. The owner may switch modes
  at any time.
- A subagent (for example a reviewer) inherits the mode of the agent that
  launched it and gets its exact task and scope in its prompt. A subagent
  **Must Not** ask the owner anything, stage, commit or push.

## Rules for Both Modes

- **Checkouts:** work only in a checkout the owner names for the task, such as
  one of several clones of the repository. If the owner has not named one, ask.
  - **Other checkouts:** never switch branches, pull, stash or edit files in
    any other checkout, even one that looks clean: the owner may be working in
    it. Read-only commands there (`git log`, `git status`, searching) are fine.
- **Starting a task:** once the owner has chosen a mode and, in Restrictive
  mode, approved the change, check that `git status` in the named checkout and
  its submodules shows no uncommitted or untracked work. If it does, stop and
  tell the owner.
  - **Creating the branch:** otherwise create the task's branch from the
    latest `origin/main` and tell the owner its name:

    ```bash
    git fetch origin
    git switch --no-track -c <type>/<task> origin/main
    git submodule update --init --recursive
    ```

  - **Setup:** then run the project's setup command. The submodule update and
    the setup do not count as a build.
  - **Resuming:** follow-up work on the same task stays on that branch. To
    resume it, make the same check, run `git switch <type>/<task>`, and update
    the submodules again.
  - **Pushing:** push with `git push -u origin <type>/<task>`.
  - **Submodule pointers:** never commit a change to a submodule pointer
    unless the task is to bump it.
- **Branch cleanup:** when the owner asks, or at the start of the next task
  once its branch is created, delete the local branches of merged pull
  requests.
  - **Checking first:** confirm the merge and that the local branch holds
    nothing the pull request lacks: `git rev-parse <type>/<task>` must match
    `headRefOid` from `gh pr view <number> --json state,headRefOid`. If it does
    not, stop and tell the owner.
  - **Deleting:** then run `git branch -D <type>/<task>`; rebase merges rewrite
    the commits, so `git branch -d` refuses.
- **Tests and builds:** run only through the project's own commands, never the
  underlying tools directly. If a category of tests can't run, stop and tell
  the owner; never report the tests as passing. Report a flaky test to the
  owner rather than rerunning it until it passes.
- **Issues:** propose each issue, with its title, labels and body, to the
  owner, and file only those the owner approves. Name one not approved in the
  pull request or the report instead.
- **Versions and tags:** release tags follow semantic versioning,
  `vMAJOR.MINOR.PATCH`. Only the owner tags a release, or an agent the owner
  asks to.
  - **MAJOR:** a change that breaks something that uses the release bumps
    MAJOR. Before 1.0.0, a breaking change bumps MINOR instead, as semantic
    versioning allows for initial development.
  - **MINOR:** a new feature or option, even a small one, bumps MINOR and
    resets PATCH.
  - **PATCH:** a release with no new feature or breaking change (fixes,
    documentation, refactors, tests, chores) bumps PATCH.
  - **Choosing the bump:** decide the bump from the commits since the last
    tag, not from the size of the change.
- **Code reviews:** follow [code-review.md](code-review.md). A review only
  writes its review file; it **Must Not** stage or commit.
  - **Scope:** in Restrictive mode, ask the owner which scope to review. In
    Autonomous mode, review the uncommitted changes (the whole commit when
    amending), or the branch as
    [Pushing and Pull Requests](#pushing-and-pull-requests) sets out. A review
    subagent gets its scope in its prompt and never asks.
  - **A faster model:** a separate agent running a faster model may review a
    change to documentation, scripts or wording on screens alone, or to tests
    other than access control and security tests. It may also run the
    interaction review before a pull request.
  - **The full model:** reviews anything the
    [Security and Data](code-review.md#security-and-data) focus area covers,
    such as sign-in, sessions, access control, the data access layer,
    migrations, secrets, the containers, and checks on user input, including
    web addresses. It also reviews any change where the choice is in doubt.
- **Commit messages and pull requests:** follow
  [code-review.md § Commit Message Rules](code-review.md#commit-message-rules),
  including its no-attribution rule.
- **UI changes:** the owner verifies them on a device, simulator or browser
  before they are committed.
- **Branches and pull requests:**
  - **Must Not** commit to `main`; changes reach `main` only through a pull
    request.
  - Name branches `type/short-description`, using the commit types in
    [code-review.md § Commit Message Rules](code-review.md#commit-message-rules),
    for example `docs/agent-workflow`.
  - Only the owner approves a pull request, by merging it or telling an agent to
    merge it. Without that, **Must Not** merge, turn on auto-merge or request
    other reviewers. An agent told to merge adds the pull request to the merge
    queue only once its Full check has passed, since earlier it turns on
    auto-merge.
  - Merge pull requests by rebasing onto `main`, never by squashing or with a
    merge commit, so each commit lands as written. Each commit therefore
    follows the commit message rules on its own.
- **Data:**
  - **Commits:** **Must Not** commit real personal, health, financial or
    company data, such as exports, account numbers, measurements or names.
  - **Sample and test data:** sample files, fixtures and test data **Must** be
    fictional and not derived from real data, even anonymized.
  - **Everywhere else:** **Must Not** put real data into prompts (including to
    subagents), issues, pull requests, commit messages, screenshots or logs.
  - **Real data found:** if you are given or find real data, do not use or
    copy it; stop and tell the owner.

## Autonomous Mode

### Workflow

Complete these steps, in order, for every change:

1. **UI verification:** for any change to a screen, have the owner verify the
   screens (layout, controls, wording, behaviour) before running the tests or
   the code review, and iterate until the owner approves the UX. A build to run
   the app for this is allowed. A change with no screen changes skips this
   step.
   - **First, prove it:** drive the screens' basic paths as
     [Testing Standards § Proving a Screen](testing.md#proving-a-screen) sets
     out. Never call a screen ready without having seen it work.
   - **What the owner gets:** the list in
     [A Screen Change's Pull Request](#a-screen-changes-pull-request).
1. **Tests:** run the project's targeted tests, for the code the change
   touches, and its linters, and fix all failures. A change to documentation
   only may skip this and the next step, apart from the project's checks of
   documents, unless the project's standards say its documents are built into
   the product.
1. **Warnings:** resolve every build warning and runtime warning the run
   reports, including ones that predate the change.
1. **Code review:** have a separate agent, acting as a senior staff engineer,
   review the uncommitted changes (or the whole commit, when amending) against
   [code-review.md](code-review.md). If you cannot start a separate agent, tell
   the owner and ask how to proceed.
1. **Review findings:** address every finding. For any finding you do not fix,
   tell the owner which one and why, and get their approval before committing.
1. **Full suite:** once the findings are fixed, run the full suite except UI
   tests with the project's test command, on the code to be committed, and fix
   all failures and warnings. A change to documentation only may skip this
   step too.
   - **Run by continuous integration:** where the project's continuous
     integration runs the full suite on every pull request, as its standards
     say, that run is this step instead.
   - **Order in that case:** the commit and push come first, failures and
     warnings are fixed as later commits, and the owner merges only once it
     passes.
1. **Manual test check:** when the change adds a manual test, or changes one
   significantly, such as by adding or removing test cases or changing
   expected results, stop until the owner approves the test or runs it.
   - **Small edits:** a small edit to a manual test, such as its wording or a
     renamed control, needs no stop.
   - **Other changes:** any other change goes straight to the commit, without
     asking.
   - **Unfixed findings:** a review finding left unfixed stops for the owner as
     Review findings sets out.
1. **Commit and push:** commit, following the branch and commit rules, then
   push when [Pushing and Pull Requests](#pushing-and-pull-requests) says to.
1. **Open the pull request and report:** open the pull request, ready for
   review rather than as a draft, with
   [A Screen Change's Pull Request](#a-screen-changes-pull-request) in its
   description when it changes a screen. Report it to the owner with its link,
   and stop.

At any step, stop and ask the owner:

- **Owner decisions:** about a decision the owner should weigh in on, such as
  what users see or can do, a product rule, scope beyond the task, or
  something hard to undo.
- **Decisions the standards reserve:** about anything the standards say needs
  the owner's decision.

The agent makes everyday choices itself and records each one in the pull
request's description under a Decisions heading: the question, what it chose,
what it rejected, and why.

When changes come out of findings, the full suite, UI feedback or owner
feedback:

- If they change a screen, have the owner verify it again.
- Repeat the test and warning steps, then the full suite step.
- Repeat the code review too if the changes go beyond the reported findings or
  UI feedback, or if owner feedback adds new content.
- Then commit and push again, stopping first at the manual test check if the
  changes add a manual test or change one significantly.

### Pushing and Pull Requests

- Push without waiting for the owner's word: before the pull request, once the
  task's commits are made and any branch review the next point asks for is
  done; once the pull request is open, each later commit as soon as it is made.
  A branch can collect several commits before its first push.
- Before opening the pull request, have a separate agent review the branch
  against `main` when its commits' own reviews cannot see all of it. Handle any
  findings as in the workflow:
  - **A commit skipped review:** the review covers the whole branch, however
    many commits it has.
  - **Every commit reviewed:** a branch of two or more commits has an
    interaction review, a short review of only where the commits meet, such as
    shared code two of them change, a feature one builds on another, or a
    document more than one edits.
    - **What it covers:** it names the earlier review files and does not
      review each commit again.
    - **No interaction review needed:** a branch with a single commit, or
      whose later commits only fix review findings or the owner's UI
      feedback, needs no review.
- Push with `git push -u origin <type>/<task>`.
- Open the pull request with `gh pr create`, ready for review, following the
  commit message rules for its title and description.

### A Screen Change's Pull Request

The owner checks screens as the product's manager, not as a tester. A pull
request that changes a screen gives the owner these, in order, each brief:

1. **Try it:** 3 to 6 numbered steps through the feature's use cases, like a
   short manual test. Each says who to sign in as, where to go, what to do,
   what to see, and what to judge, such as the wording, the layout or the
   flow. No edge cases.
1. **Full manual tests:** the manual test cases the change adds or changes, by
   file and ID, such as `docs/testing/projects-manual-test.md` PROJ-12, for
   when the owner wants to run them in full.
1. **Decisions to confirm:** one line for each choice under the pull request's
   Decisions heading that changes what users see or can do, which the
   Decisions heading gives in full.
1. **Already proved:** the basic and edge paths driven and tested, such as
   empty fields, duplicates, refusals, focus and permissions, one line each
   with the test that proves it, so the owner needn't repeat them.

The agent's own screen check, and any check before the owner's, follow Try it
and Already proved.

### Branches and Commits

- For a new task, create a new branch from the latest `origin/main` in the
  named checkout, as [Rules for Both Modes](#rules-for-both-modes) describes.
- Stay on the task's branch for follow-up work on the same task.
- Respond to feedback on a pushed commit with a new commit on the same branch.
  Since each commit is pushed as the workflow sets out, this is the usual case.
- Amend the most recent commit, instead of adding one, only while it has not
  been pushed, such as on a branch collecting several commits before its first
  push, when the change responds to feedback on that commit. Feedback on an
  earlier unpushed commit gets a new commit; do not rewrite history without the
  owner's say-so.
- An amended commit goes through the whole workflow, and the code review covers
  the whole amended commit.

## Restrictive Mode

- **Approval first:** get the owner's approval before making code changes,
  then create the task's branch and tell the owner its name.
- **Screens unseen:** since the agent can't run the app, it reports a screen
  change as not yet seen working, with the paths the owner should drive.
- **No builds or tests:** **Must Not** run the project's build, test or run
  commands, or any other build tool. The owner builds and runs tests. Read-only
  diagnostics that the project's standards allow, such as listing devices or
  reading logs, are fine.
- **No staging or commits without an explicit ask:** **Must Not** run `git add`
  or anything else that stages the index, or `git commit`, unless the owner asks
  for that action in the current turn. Editing files, finishing a task or
  completing a code review is not permission to stage or commit.
- **No pushes or pull requests** unless the owner asks in the current turn.
