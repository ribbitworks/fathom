---
title: "Shell Script Standards"
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["**/*.sh", "**/*.ps1"]
dependencies: ["../core-principles.md", "../code-review.md"]
last_updated: "2026-11-01"
---

# Shell Script Standards

Rules for shell scripts. They add to the stack-neutral standards one folder up.
The baseline reference is the
[Google Shell Style Guide](https://google.github.io/styleguide/shellguide.html).

## Automation

- Automate every repeatable setup, development and operations task with a
  script in `scripts/`, rather than documenting manual steps.
- Scripts are safe to run repeatedly, and stop on the first error with a clear
  message.
- Use Bash for macOS, Linux and WSL, written to run on the Bash 3.2 that ships
  with macOS. Use PowerShell for Windows hosts, installing Windows packages with
  `winget`.
- Name scripts in lowercase words joined by hyphens, with the extension for
  their shell, such as `lint-shell.sh` or `dev-bootstrap.ps1`; linters find
  scripts by extension.

## Structure

- **Shebang:** `#!/usr/bin/env bash` for Bash; `#!/bin/sh` only for scripts
  that are POSIX-only and tested as such.
- **Header:** a short comment after the shebang says what the script is for,
  how it is used, and its assumptions (macOS only, needs `git`, Python 3.11 or
  later).
- **Strict mode:** `set -euo pipefail`. Where strictness must be relaxed, such
  as in a script that is sourced into an interactive shell, say why in one
  line.
- **Functions:** anything beyond a few lines has a `main` function and ends with
  `main "$@"`. Shared logic lives in a sourced library, such as
  `scripts/lib.sh`, not copied between scripts.
- **Paths:** resolve sibling files from the script's own location, not the
  current directory, unless the script's contract is "run from the repository
  root":

  ```bash
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  ```

## Safety

- **Quote every expansion:** `"${var}"`, `"$1"`, `"$@"`. Unquoted expansions
  are the most common source of shell bugs.
- Use `$(...)`, never backticks.
- Use `printf`, not `echo -e`, when output needs escapes or exact formatting.
- Never `eval` untrusted input. Where `eval` builds a command, compose it only
  from values the script controls or has validated.
- Create temporary files with `mktemp`, and remove them with a `trap` on exit.
- Never print secrets, and never put them in command-line arguments that other
  processes can see.

## Errors and Exit Codes

- Print errors to standard error (`>&2`).
- Exit `0` on success and non-zero on failure.

## Linting

Run [ShellCheck](https://www.shellcheck.net/) on every script, through the
project's lint script where it has one. Silence a false positive only with
`# shellcheck disable=SCxxxx` and a one-line reason.

## Code Review Criteria

Add these to the focus areas in [code-review.md](../code-review.md):

- Missing strict mode, unquoted expansions, backticks.
- Paths resolved from the current directory without a stated contract.
- `eval` of anything not controlled by the script.
- Temporary files without cleanup; secrets in output or arguments.
- Bash 4 or later features in scripts that must run on macOS Bash 3.2.
- ShellCheck warnings, or suppressions without a reason.
