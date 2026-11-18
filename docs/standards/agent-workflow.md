---
title: "Agent Workflow"
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["**/*"]
dependencies: ["code-review.md", "testing.md", "documentation.md"]
last_updated: "2026-11-17"
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

- **Checkouts:** work only in a checkout the owner names for the task, such as
  one of several clones of the repository. If the owner has not named one, ask.
  Never switch branches, pull, stash or edit files in any other checkout, even
  one that looks clean: the owner may be working in it. Read-only commands
  there (`git log`, `git status`, searching) are fine.
- **Starting a task:** once the owner has chosen a mode and, in Restrictive
  mode, approved the change, check that `git status` in the named checkout and
  its submodules shows no uncommitted or untracked work. If it does, stop and
  tell the owner. Otherwise create the task's branch from the latest
  `origin/main` and tell the owner its name:

  ```bash
  git fetch origin
  git switch --no-track -c <type>/<task> origin/main
  git submodule update --init --recursive
  ```

  Then run the project's setup command. The submodule update and the setup
  do not count as a build. Follow-up work on the same task stays on that
  branch; to resume it, make the same check, run `git switch <type>/<task>`,
  and update the submodules again. Push with
  `git push -u origin <type>/<task>`. Never commit a change to a submodule
  pointer unless the task is to bump it.
- **Branch cleanup:** when the owner asks, or at the start of the next task
  once its branch is created, delete the local branches of merged pull
  requests. Confirm the merge and that the local branch holds nothing the pull
  request lacks: `git rev-parse <type>/<task>` must match `headRefOid` from
  `gh pr view <number> --json state,headRefOid`. If it does not, stop and tell
  the owner. Then run `git branch -D <type>/<task>`; rebase merges rewrite the
  commits, so `git branch -d` refuses.
- **Tests and builds:** run only through the project's own commands, never the
  underlying tools directly.
- **Versions and tags:** release tags follow semantic versioning,
  `vMAJOR.MINOR.PATCH`. A change that breaks something that uses the release
  bumps MAJOR; a new feature or option, even a small one, bumps MINOR and
  resets PATCH; a release with no new feature or breaking change (fixes,
  documentation, refactors, tests, chores) bumps PATCH. Before 1.0.0, a
  breaking change bumps MINOR instead, as semantic versioning allows for
  initial development. Decide the bump from the commits since the last tag,
  not from the size of the change. Only the owner tags a release, or an agent
  the owner asks to.
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
   screens (layout, controls, wording, behaviour) before running the tests or
   the code review, and iterate until the owner approves the UX. A build to run
   the app for this is allowed. A change with no screen changes skips this
   step.
1. **Tests:** run the project's targeted tests, for the code the change
   touches, and its linters, and fix all failures. A change to documentation
   only may skip this and the next step, unless the project's standards say its
   documents are built into the product.
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
   step too. Where the project's continuous integration runs the full suite on
   every pull request, as its standards say, that run is this step instead: the
   commit and push come first, failures and warnings are fixed as later
   commits, and the owner merges only once it passes.
1. **Owner review:** summarize the changes and wait for the owner's explicit
   approval before committing.
1. **Commit:** commit, following the branch and commit rules.
1. **Stop:** stop and wait for instructions after committing or pushing.

When changes come out of findings, the full suite, UI feedback or owner
feedback:

- If they change a screen, have the owner verify it again.
- Repeat the test and warning steps, then the full suite step.
- Repeat the code review too if the changes go beyond the reported findings or
  UI feedback, or if owner feedback adds new content.
- Then return to the owner review step and get explicit approval again before
  committing.

### Pushing and Pull Requests

- A branch can collect several commits before it is pushed. Push only when the
  owner says the work is ready for a pull request.
- Before opening the pull request, have a separate agent review the branch
  against `main` when its commits' own reviews cannot see all of it. Handle any
  findings as in the workflow:
  - **A commit skipped review:** the review covers the whole branch, however
    many commits it has.
  - **Every commit reviewed:** a branch of two or more commits has an
    interaction review, a short review of only where the commits meet, such as
    shared code two of them change, a feature one builds on another, or a
    document more than one edits. It names the earlier review files and does
    not review each commit again. A branch with a single commit, or whose later
    commits only fix review findings or the owner's UI feedback, needs no
    review.
- Push with `git push -u origin <type>/<task>`.
- Open the pull request with `gh pr create`, following the commit message rules
  for its title and description.
- Once a pull request is open, each later approved commit on its branch is
  pushed as part of the commit step.

### Branches and Commits

- For a new task, create a new branch from the latest `origin/main` in the
  named checkout, as [Rules for Both Modes](#rules-for-both-modes) describes.
- Stay on the task's branch for follow-up work on the same task.
- Amend the most recent commit, instead of adding one, when the change responds
  to feedback on that commit and it has not been pushed. Feedback on an earlier
  unpushed commit gets a new commit; do not rewrite history without the owner's
  say-so. Once a commit has been pushed, respond with a new commit on the same
  branch.
- An amended commit goes through the whole workflow, and the code review covers
  the whole amended commit.

## Restrictive Mode

- **Approval first:** get the owner's approval before making code changes,
  then create the task's branch and tell the owner its name.
- **No builds or tests:** **Must Not** run the project's build, test or run
  commands, or any other build tool. The owner builds and runs tests. Read-only
  diagnostics that the project's standards allow, such as listing devices or
  reading logs, are fine.
- **No staging or commits without an explicit ask:** **Must Not** run `git add`
  or anything else that stages the index, or `git commit`, unless the owner asks
  for that action in the current turn. Editing files, finishing a task or
  completing a code review is not permission to stage or commit.
- **No pushes or pull requests** unless the owner asks in the current turn.
