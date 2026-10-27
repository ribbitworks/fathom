# Fathom — Agent Instructions

Guidance for AI coding agents working in this repository.

## Commit messages

- Use semantic (conventional) commits: `type: summary` (e.g. `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`)
- Keep the subject line short and imperative
- Body is bullet points only, no prose paragraphs
- Bullets describe intent and overview, not implementation details
- No AI attribution trailers (e.g. `Co-Authored-By`, "Generated with")
- Amend the previous commit for follow-up changes to the same work instead of adding new commits, as long as it has not been pushed

Example:

```text
chore: initialize repository

- Add stack-agnostic .gitignore
- Add README with project overview
- Add docs directory for project documentation
```

## Documentation

- Follow the standards in `docs/standards/` when writing or editing files they cover
- Markdown formatting rules: [Markdown Style Guidelines](docs/standards/markdown-style-guidelines.md)
- Code review process: [Code Review Standards](docs/standards/code-review.md)
