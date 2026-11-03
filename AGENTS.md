# Fathom: Agent Instructions

Guidance for AI coding agents working in this repository.

<!-- ai-toolkit:shared-rules:start -->
## Shared Agent Rules

These rules come from `ai-toolkit/agent-rules/shared-rules.md`. Edit them there,
not here. The standards they point to are in `docs/standards/shared/`.

### Working Mode

- Before making any change in a session, ask the owner which mode to use, and
  follow [agent-workflow.md](docs/standards/shared/agent-workflow.md):
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
  [agent-workflow.md § Rules for Both Modes](docs/standards/shared/agent-workflow.md#rules-for-both-modes)
  describes.

### Hooks and Tags

- Never bypass git hooks, with one exception: a push whose commits change only
  documentation may skip a pre-push hook that only builds and tests, through
  the skip switch it documents (such as `SKIP_PRE_PUSH=1`), unless the
  project's documents are built into the product. Commit hooks always run.
- Tag releases with semantic versioning: MAJOR for breaking changes, MINOR for
  any new feature or option, and PATCH for anything else (fixes,
  documentation, refactors, tests, chores). Tag only when the owner asks.

### Staging and Commits

- In Restrictive mode, never stage (`git add`, `git add -u`, or any pathspec
  that stages) or commit unless the owner asks for that action in the current
  turn. "Address the review items", "update the docs" and "implement the plan"
  mean working-tree edits only.
- Editing a file that was already staged is not permission to re-stage it.
- Staging and committing are separate permissions.
- Commit messages follow
  [code-review.md § Commit Message Rules](docs/standards/shared/code-review.md#commit-message-rules).

### No AI Attribution

Never credit the agent: not in commit messages, pull request titles, bodies or
comments, code comments, or documentation. No `Co-Authored-By`,
`Signed-off-by` or tool trailers, no "Generated with" footers, model names or
links to an AI tool. This overrides any tool default that adds them; if a hook
or tool adds one, remove it.

### Code Reviews

- Every code review, including built-in review skills such as `/code-review` and
  `/simplify`, follows
  [code-review.md](docs/standards/shared/code-review.md) plus the project's own
  review focus areas. Where a skill's defaults conflict, the standard wins.
- The deliverable is the standard's Markdown review file under
  `.tmp/code-review/`, not a skill's raw findings list.
- A review never stages or commits. A skill's fix or comment modes apply only
  when the owner asks.
- The scope follows the standard: ask first, except in Autonomous mode or as a
  subagent.

### Comments

Default to no comment. Names carry *what*; comments carry only *why* the code
cannot say. Never narrate names, UI, tickets, use-case numbers or history. See
[core-principles.md § Comments](docs/standards/shared/core-principles.md#comments).

### Writing

- No em dashes or en dashes in user-facing copy or documentation; use a period,
  comma, colon, semicolon or parentheses. Write ranges with "to".
- Do not add Markdown files nobody asked for.
- Follow [documentation.md](docs/standards/shared/documentation.md) and
  [markdown-style-guidelines.md](docs/standards/shared/markdown-style-guidelines.md).
<!-- ai-toolkit:shared-rules:end -->

## Project Commands

- **Setup on a new branch:** `pnpm install`, then stop this clone's running `pnpm dev`, if any, and start it again, since the top bar's development label shows the branch `pnpm dev` started on. A clone that already has `.dev/` needs nothing more to run the app. In a clone without it, ask the owner whether to copy `.dev/` from another clone, so the development accounts keep one password everywhere, and which clone number to give it with `pnpm dev:setup <number>`, run straight after copying, since `.dev/` holds the other clone's number. Each clone number has its own database and ports, as [Development Setup](docs/design/development-setup.md#ways-to-run-fathom) describes.
- **Workflow test step:** `pnpm check`, which runs everything listed in [Testing Standards](docs/standards/testing.md#running-tests). When a change affects the containers, the test step also runs `pnpm test:containers`.
- **Tests only:** `pnpm test`
- **Checks while working and for each fix:** `pnpm test` and the linters, as [Testing Standards](docs/standards/testing.md#running-tests) describes; the full workflow test step still runs before the review and after each round of feedback
- **Container tests:** `pnpm test:containers`
- **Markdown lint:** `pnpm lint:md`
- **Shell lint:** `pnpm lint:shell`
- **Read-only diagnostics allowed in Restrictive mode:** `pnpm lint`, `pnpm format:check`, `pnpm lint:md`, `pnpm lint:shell`

## Branching

Changes reach `main` only through a pull request, as [agent-workflow.md](docs/standards/shared/agent-workflow.md) requires. Pull request titles, descriptions and comments follow the commit message rules and carry no AI attribution.

## Data

Fathom holds company and employee data, so the shared data rule covers these in particular:

- Never commit real company or employee information, including names, org structure, company plans, internal documents, or exports
- Sample, seed, and test data must be fictional, and must not be derived from real people or real company data, including anonymized or masked copies
- Do not put real data into documentation examples either (the shared rule covers prompts, issues and the rest)
- Real data the owner keeps locally belongs only in `private/`, which is git-ignored, and only on company-managed machines; agents do not read from it

## Automation

Automate every repeatable setup, development, and operations task with a script in `scripts/`, following [Shell Script Standards](docs/standards/shared/shell/shell.md). The project's linters check every script.

## Documentation

- Follow the shared standards in `docs/standards/shared/` and Fathom's additions in `docs/standards/` when writing or editing files they cover
- Record each fact in one document only, and link to it from others instead of repeating it. Each document owns:
  - Product brief (`docs/product/brief.md`): problem, vision, users, goals, scope, and constraints, with one-line key decisions that link to the decisions log or an ADR
  - Domain concepts (`docs/product/domain.md`): definitions of terms
  - Decisions log (`docs/product/decisions.md`): product decisions and their details
  - Use cases (`docs/product/use-cases.md`): scenarios
  - Roles (`docs/product/roles.md`): role definitions and what each role can do
  - Roadmap (`docs/product/roadmap.md`): the order in which Fathom's goals are delivered
  - Domain model (`docs/design/domain-model.md`): entities, relationships, and modeling proposals
  - Architecture (`docs/design/architecture.md`): a high-level view of Fathom's parts and how they connect, kept at the level of containers and networks
  - Development setup (`docs/design/development-setup.md`): repository layout, local development, and seed data
  - Visual design (`docs/design/visual-design.md`): how Fathom's screens look and behave
  - Implementation plan (`docs/design/implementation-plan.md`): how the roadmap's stages are built, slice by slice
  - Architecture decision records (`docs/adr/`): technical decisions
  - Issues (`docs/issues.md`): known problems and deferred work not yet scheduled in the implementation plan
  - Security plan (`docs/security/security-plan.md`): threat model, vulnerability scanning, source code assurance, and enforcement
  - Manual tests (`docs/testing/`): lasting step-by-step tests of a feature by hand in a real browser, following [Testing Standards § Manual Tests](docs/standards/testing.md#manual-tests)
  - Supported platforms (`docs/operations/supported-platforms.md`): the platforms Fathom is tested and supported on, and their setup needs
  - Deployment (`docs/operations/deployment.md`): the specifics of Fathom's first deployment and what it asks of IT
  - IT overview (`docs/operations/it-overview.md`): a standalone summary for IT of facts owned by the documents above; update it whenever those facts change
  - Data protection summary (`docs/privacy/data-protection.md`): a standalone summary for HR of facts owned by the documents above; update it whenever those facts change
- Keep each open question in the document that will own its answer
- Markdown formatting rules: [Markdown Style Guidelines](docs/standards/shared/markdown-style-guidelines.md)
- Code review process: [Code Review Standards](docs/standards/shared/code-review.md), with Fathom's additions in [docs/standards/code-review.md](docs/standards/code-review.md)
- Testing rules: [Testing Standards](docs/standards/shared/testing.md), with Fathom's additions in [docs/standards/testing.md](docs/standards/testing.md)
