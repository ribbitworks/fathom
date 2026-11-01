---
title: "Agent Workflow"
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["**/*"]
dependencies: ["code-review.md", "testing.md", "documentation.md"]
last_updated: "2026-11-01"
---

# Agent Workflow

How an AI coding agent works in a repository. "Owner" means the user the agent
is working for. There are two working modes; the owner chooses one per session,
and the rules for both modes hold either way.

The project's own standards name its build, test and run commands, and the
kinds of real data it must never hold. Where this document says "the project's
test command", use the one they name.

## Choosing a Mode

- Before making any change in a session, the agent **Must** ask the owner which
  mode to use:
  - **Autonomous:** the agent runs tests and builds, has its changes reviewed,
    and commits after the owner approves.
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

- **Tests and builds:** run only through the project's own commands, never the
  underlying tools directly.
- **Git hooks:** **Must Not** be bypassed (`--no-verify`, `SKIP_PRE_PUSH=1` or
  similar). Hooks that run builds or tests are allowed in either mode.
- **Code reviews:** follow [code-review.md](code-review.md). A review only
  writes its review file; it **Must Not** stage or commit.
- **Commit messages and pull requests:** follow
  [code-review.md § Commit Message Rules](code-review.md#commit-message-rules),
  including its no-attribution rule.
- **UI changes:** the owner verifies them on a device, simulator or browser
  before they are committed.
- **Branches and pull requests:**
  - **Must Not** commit to `main`; changes reach `main` only through a pull
    request. Until a repository has a remote, commits may go directly to
    `main`.
  - Name branches `type/short-description`, using the commit types in
    [code-review.md § Commit Message Rules](code-review.md#commit-message-rules),
    for example `docs/agent-workflow`.
  - Only the owner approves a pull request, by merging it or telling an agent to
    merge it. Without that, **Must Not** merge, turn on auto-merge or request
    other reviewers.
  - Merge pull requests by rebasing onto `main`, never by squashing or with a
    merge commit, so each commit lands as written. Each commit therefore
    follows the commit message rules on its own.
- **Data:** **Must Not** commit real personal, health, financial or company
  data, such as exports, account numbers, measurements or names. Sample files,
  fixtures and test data **Must** be fictional and not derived from real data,
  even anonymized. **Must Not** put real data into prompts (including to
  subagents), issues, pull requests, commit messages, screenshots or logs. If
  you are given or find real data, do not use or copy it; stop and tell the
  owner.

## Autonomous Mode

### Workflow

Complete these steps, in order, for every change:

1. **UI verification:** for any change to a screen, have the owner verify the
   screens (layout, controls, wording, behavior) before running the full test
   suite or the code review, and iterate until the owner approves the UX. A
   build to run the app for this is allowed. A change with no screen changes
   skips this step.
1. **Tests:** run the full suite except UI tests with the project's test
   command, and fix all failures. A change to documentation only may skip this
   and the next step, unless the project's standards say its documents are
   built into the product.
1. **Warnings:** resolve every build warning and runtime warning the run
   reports, including ones that predate the change.
1. **Code review:** have a separate agent, acting as a senior staff engineer,
   review the uncommitted changes (or the whole commit, when amending) against
   [code-review.md](code-review.md). If you cannot start a separate agent, tell
   the owner and ask how to proceed.
1. **Review findings:** address every finding. For any finding you do not fix,
   tell the owner which one and why, and get their approval before committing.
1. **Owner review:** summarize the changes and wait for the owner's explicit
   approval before committing.
1. **Commit:** commit, following the branch and commit rules.
1. **Stop:** stop and wait for instructions after committing or pushing.

When changes come out of findings, UI feedback or owner feedback:

- If they change a screen, have the owner verify it again.
- Repeat the test and warning steps.
- Repeat the code review too if the changes go beyond the reported findings or
  UI feedback, or if owner feedback adds new content.
- Then return to the owner review step and get explicit approval again before
  committing.

### Pushing and Pull Requests

- A branch can collect several commits before it is pushed. Push only when the
  owner says the work is ready for a pull request.
- Before opening the pull request, have a separate agent review the whole branch
  against `main`, and handle its findings as in the workflow.
- Open the pull request with `gh pr create`, following the commit message rules
  for its title and description.
- Once a pull request is open, each later approved commit on its branch is
  pushed as part of the commit step.

### Branches and Commits

- For a new task, create a branch from the latest `main`. If you are already on
  another feature branch, or the working tree has uncommitted changes, ask the
  owner first.
- Stay on the task's branch for follow-up work on the same task.
- Amend the most recent commit, instead of adding one, when the change responds
  to feedback on that commit and it has not been pushed. Feedback on an earlier
  unpushed commit gets a new commit; do not rewrite history without the owner's
  say-so. Once a commit has been pushed, respond with a new commit on the same
  branch.
- An amended commit goes through the whole workflow, and the code review covers
  the whole amended commit.

## Restrictive Mode

- **Approval first:** get the owner's approval before making code changes.
- **No builds or tests:** **Must Not** run the project's build, test or run
  commands, or any other build tool. The owner builds and runs tests. Read-only
  diagnostics that the project's standards allow, such as listing devices or
  reading logs, are fine.
- **No staging or commits without an explicit ask:** **Must Not** run `git add`
  or anything else that stages the index, or `git commit`, unless the owner asks
  for that action in the current turn. Editing files, finishing a task or
  completing a code review is not permission to stage or commit.
- **No pushes or pull requests** unless the owner asks in the current turn.
