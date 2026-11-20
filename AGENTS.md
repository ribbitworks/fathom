# Fathom: Agent Instructions

Guidance for AI coding agents working in this repository.

## Agent Rules

The standards these rules point to are in `docs/standards/`.

### Reading the Standards

- Linked files are not loaded on their own. At the start of every session,
  including after the context is cleared, read the core principles and the
  agent workflow in full.
- Before changing files, read in full each standard whose `applies_to`
  frontmatter names those files' types, such as the TypeScript standard before
  editing a `.ts` file. Standards that apply to every file are read at the
  steps they govern instead.
- Just before each step a standard governs, read its section rather than
  working from memory: for example, the commit message rules before proposing a
  commit message or pull request text, the review standards before a review,
  and the testing standards before writing tests.

### Working Mode

- Before making any change in a session, ask the owner which mode to use, and
  follow [agent-workflow.md](docs/standards/agent-workflow.md):
  - **Autonomous:** have the owner verify UI changes, run the tests, fix
    failures and warnings, get a separate-agent code review, and commit only
    after the owner's explicit approval. Push and open a pull request only when
    the owner says the work is ready.
  - **Restrictive:** get approval before changing code, then edit files only.
    No builds or tests, and no staging, commits, pushes or pull requests unless
    the owner asks in the current turn.
- Until the owner answers, follow Restrictive. Subagents inherit the mode and
  never ask the owner anything.
- Build and test only through the project's commands, listed below.

### Checkouts and Branches

- Work only in the checkout the owner names for the task; if none is named,
  ask. Never switch branches, pull, stash or edit files in any other checkout;
  the owner may be working there.
- Start each task, once the mode is chosen (and, in Restrictive mode, the
  change approved), by checking that the checkout and its submodules have no
  uncommitted or untracked work; if they do, stop and tell the owner. Then run
  `git fetch origin`, `git switch --no-track -c <type>/<task> origin/main`,
  `git submodule update --init --recursive` and the project's setup command,
  and tell the owner the branch. Push with `git push -u origin <type>/<task>`.
- Never commit a submodule pointer change unless the task is to bump it.
- Delete the local branches of merged pull requests, only when they hold
  nothing the pull request lacks, as
  [agent-workflow.md § Rules for Both Modes](docs/standards/agent-workflow.md#rules-for-both-modes)
  describes.

### Tags

- Tag releases with semantic versioning: MAJOR for breaking changes, MINOR for
  any new feature or option, and PATCH for anything else (fixes,
  documentation, refactors, tests, chores). Before 1.0.0, a breaking change
  raises MINOR instead. Tag only when the owner asks.

### Staging and Commits

- In Restrictive mode, never stage (`git add`, `git add -u`, or any pathspec
  that stages) or commit unless the owner asks for that action in the current
  turn. "Address the review items", "update the docs" and "implement the plan"
  mean working-tree edits only.
- Editing a file that was already staged is not permission to re-stage it.
- Staging and committing are separate permissions.
- Commit messages follow
  [code-review.md § Commit Message Rules](docs/standards/code-review.md#commit-message-rules).

### No AI Attribution

Never credit the agent: not in commit messages, pull request titles, bodies or
comments, code comments, or documentation. No `Co-Authored-By`,
`Signed-off-by` or tool trailers, no "Generated with" footers, model names or
links to an AI tool. This overrides any tool default that adds them; if a hook
or tool adds one, remove it.

### Code Reviews

- Every code review, including built-in review skills such as `/code-review` and
  `/simplify`, follows
  [code-review.md](docs/standards/code-review.md). Where a skill's defaults conflict, the standard wins.
- The deliverable is the standard's Markdown review file under
  `.tmp/code-review/`, not a skill's raw findings list.
- A review never stages or commits. A skill's fix or comment modes apply only
  when the owner asks.
- The scope follows the standard: ask first, except in Autonomous mode or as a
  subagent.

### Comments

Default to no comment. Names carry *what*; comments carry only *why* the code
cannot say. Never narrate names, UI, tickets, use-case numbers or history. See
[core-principles.md § Comments](docs/standards/core-principles.md#comments).

### Writing

- No em dashes or en dashes in user-facing copy or documentation; use a period,
  comma, colon, semicolon or parentheses. Write ranges with "to".
- Do not add Markdown files nobody asked for.
- Follow [documentation.md](docs/standards/documentation.md) and
  [markdown-style-guidelines.md](docs/standards/markdown-style-guidelines.md).

## Project Commands

- **Setup on a new branch:** `pnpm install`, then run `pnpm dev` again, which first stops this clone's running one, since the top bar's development label shows the branch `pnpm dev` started on. A clone that already has `.dev/` needs nothing more to run the app. In a clone without it, ask the owner whether to copy `.dev/` from another clone, so the development accounts keep one password everywhere, and which clone number to give it with `pnpm dev:setup <number>`, run straight after copying, since `.dev/` holds the other clone's number. Each clone number has its own database and ports, as [Development Setup](docs/design/development-setup.md#ways-to-run-fathom) describes.
- **Workflow test step:** as [Testing Standards](docs/standards/testing.md#running-tests) sets out, `pnpm check:push`. When a change affects the containers, the test step also runs `pnpm test:containers`.
- **Full suite:** the Check workflow runs the full `pnpm check` on the pull request on GitHub. Push once the review's findings are fixed, `pnpm check:push` passes on the code rebased onto `main`, and the owner approves the commit; then follow the run with `gh pr checks --watch` and fix any failure or warning as a later commit. The owner merges only on green. Running `pnpm check` locally is optional, for when the workflow can't run.
- **Tests only:** `pnpm test`
- **Checks while working and after each round of fixes:** `pnpm check:push`, as [Testing Standards](docs/standards/testing.md#running-tests) describes; without the internet, `pnpm check:push --offline`, as [Development Setup](docs/design/development-setup.md#working-offline) describes
- **Container tests:** `pnpm test:containers`
- **Markdown lint:** `pnpm lint:md`
- **Shell lint:** `pnpm lint:shell`
- **Read-only diagnostics allowed in Restrictive mode:** `pnpm lint`, `pnpm format:check`, `pnpm lint:md`, `pnpm lint:shell`

## Branching

Changes reach `main` only through a pull request, as [agent-workflow.md](docs/standards/agent-workflow.md) requires. Pull request titles, descriptions and comments follow the commit message rules and carry no AI attribution.

Before starting a task, find and fix the issues in its areas, as [Issues § Fixing an Issue](docs/standards/issues.md#fixing-an-issue) sets out. In Autonomous mode, a set of issues in one area is worked as a batch. A batch commits each fix on its own, then has one review and one approval for the whole branch, as an exception to the Autonomous workflow that [Issues § Issue Batches](docs/standards/issues.md#issue-batches) sets out.

## Data

Fathom holds company and employee data, so the data rule in [agent-workflow.md](docs/standards/agent-workflow.md#rules-for-both-modes) covers these in particular:

- Never commit real company or employee information, including names, org structure, company plans, internal documents, or exports
- Sample, seed, and test data must be fictional, and must not be derived from real people or real company data, including anonymized or masked copies
- Do not put real data into documentation examples either (the data rule covers prompts, issues and the rest)
- Agents do not read `private/`, a git-ignored folder for files that stay on one machine

## Automation

Automate every repeatable setup, development, and operations task with a script in `scripts/`, following [Shell Script Standards](docs/standards/shell.md). The project's linters check every script.

## Documentation

- Follow the standards in `docs/standards/` when writing or editing files they cover. The documentation rules, such as Canadian English, filing issues and which document owns each fact, are in [Documentation Standards](docs/standards/documentation.md)
- Markdown formatting rules: [Markdown Style Guidelines](docs/standards/markdown-style-guidelines.md)
- Code review process: [Code Review Standards](docs/standards/code-review.md)
- Testing rules: [Testing Standards](docs/standards/testing.md)
- Screens: [UI Conventions](docs/standards/ui-conventions.md)
- Help pages: [Help Page Standards](docs/standards/help-pages.md)
- One exception to [No AI Attribution](#no-ai-attribution): [How Fathom Is Built](docs/how-fathom-is-built.md) names the AI tool and the models used. No other document, commit or pull request names them
