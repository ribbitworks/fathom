# Fathom — Agent Instructions

Guidance for AI coding agents working in this repository.

## Workflow

Complete these steps, in order, for every change before it is committed:

1. **Tests:** If the project has tests, run the full suite except UI tests, and fix all failures.
1. **Build warnings:** If the project has a build, resolve all build warnings.
1. **Code review:** Have a separate agent, acting as a senior staff engineer, review the changes against the [Code Review Standards](docs/standards/code-review.md). If you cannot start a separate agent, tell the user and ask how to proceed.
1. **Review findings:** Address every finding. For any finding you do not fix, tell the user which one and why, and get their approval before committing.
1. **UI verification:** Have the user verify any UI change before proceeding.
1. **User review:** Summarize the changes for the user and wait for their explicit approval before committing.
1. **Commit:** Commit the changes, following the branching and commit message rules below.
1. **Stop:** After committing, stop and wait for instructions.

If addressing findings, UI feedback, or user review feedback changes the code, repeat the test and build steps. Repeat the code review as well if those changes go beyond fixing the reported review findings or UI feedback, or if user review feedback adds new content. Then return to the user review step and get explicit approval of the updated changes before committing.

## Branching

Until the repository has a remote, you may commit directly to `main`, and feature branches may be merged into `main` locally. Once a remote exists, these rules apply:

- Never commit to `main`
- Before making changes for a new task, create a feature branch from the latest `main`
- Stay on the current feature branch for follow-up work on the same task
- Name branches `type/short-description`, using the commit types below (e.g. `docs/agent-workflow`)
- Changes reach `main` only through a pull request, except the initial push of existing `main` history when the remote is first added

## Commit messages

- Use semantic (conventional) commits: `type: summary` (e.g. `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`)
- Keep the subject line short and imperative
- Body is bullet points only, no prose paragraphs
- Bullets describe intent and overview, not implementation details
- No AI attribution trailers (e.g. `Co-Authored-By`, "Generated with")
- Amend the most recent commit, instead of adding a new one, when the change responds to feedback on that commit and it has not been pushed
- Amended changes go through the full workflow, and the code review covers the whole amended commit

Example:

```text
chore: initialize repository

- Add stack-agnostic .gitignore
- Add README with project overview
- Add docs directory for project documentation
```

## Data

- Never commit real company or employee information, including names, org structure, company plans, internal documents, or exports
- Sample, seed, and test data must be fictional, and must not be derived from real people or real company data, including anonymized or masked copies
- Do not put real data into prompts you write (including to subagents), issues, pull requests, commit messages, screenshots, logs, or documentation examples
- If you are given or find real company or employee data, do not use, copy, or commit it; stop and tell the user
- Real data the owner keeps locally belongs only in `private/`, which is git-ignored; agents do not read from it

## Documentation

- Follow the standards in `docs/standards/` when writing or editing files they cover
- Markdown formatting rules: [Markdown Style Guidelines](docs/standards/markdown-style-guidelines.md)
- Code review process: [Code Review Standards](docs/standards/code-review.md)
