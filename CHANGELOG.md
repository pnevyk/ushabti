# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `confluence comments` command to download a page's footer and inline comments as markdown or JSON.
- Positional arguments for each command's main subject: `jira fetch ABC-123` / `jira fetch ABC`, `jira comments ABC-123`, `jira create ticket.md [ABC]`, `jira update ABC-123.md`, `jira project [ABC]`, `jira filter [ABC]`, `confluence download|comments <id>`, `confluence create page.md [ENG]`, `confluence upload page.md`, `pr comments [<n>]`.
- Jira, Confluence and GitHub URLs are accepted wherever a ticket, page, space or PR is expected (a PR URL also supplies `--repo`).
- Optional `[jira] project` and `[confluence] space` config fields, used when no project/space is given.
- `jira filter` accepts `--config`.
- Upgrade guide: `docs/upgrading/0.2.0.md`.
- `--out -` prints to stdout instead of writing a file, on `jira fetch`, `jira comments`, `jira project`, `confluence download`, `confluence comments`, `pr comments` and `pr digest`. Multi-document output is concatenated; attachments are skipped with a warning.

### Changed

- `jira fetch <ticket-id>` derives the project from the ticket id; a redundant `--project` is ignored with a warning.
- Deprecated, still working with a warning on stderr: `--id`, `--file`, `--pr`, `--project` and `--space` (use the positional arguments instead; see the upgrade guide).

## [0.1.1] - 2026-09-08

### Added

- `pr digest --author <login|me>` / `--reviewer <login|me>` / `--commenter <login|me>` to filter the digest to a single user's PRs (mutually exclusive); `me` resolves to the new `github.username` config field.
- `pr digest --comments-by <login|me>` to trim each returned PR's comments/review comments down to a single user's; combines with `--author`/`--reviewer`/`--commenter`.
- `pr digest` warns on stderr when GitHub search results are incomplete (search timeout) or capped at 1000.

### Fixed

- Confluence table round-trip: a table with no header row/column no longer gains one on re-upload (records header row/column/both/none via a `<!-- table:header=... -->` sentinel), a flat bullet/ordered list in a table cell no longer collapses into broken hyphens, and a macro (e.g. table of contents) in a table cell no longer comes back as raw JSON text.
- Ordered lists now render with numbered markers (`1.`, `2.`, ...) instead of bullet dashes.
- `pr digest` no longer crashes when a search matches more than 1000 PRs; it now returns the first 1000 with a warning instead.

## [0.1.0] - 2026-08-12

### Added

- Initial release.
- `pr comments` / `pr digest` for fetching GitHub PR review threads and activity summaries into local files.
- `jira create` / `fetch` / `update` / `comments` / `filter` / `template` / `project` for reading and writing Jira issues through local files.
- `confluence create` / `upload` / `download` / `template` for round-tripping Confluence pages as Markdown, including mermaid/UML diagram macro plugins.
- `secrets set` / `delete` / `list` for storing service credentials in the OS keychain, with a file-based fallback.
- `config template` and merged project-local/global TOML configuration.
- `ui estimate` local browser UI for task estimation.

[Unreleased]: https://github.com/pnevyk/ushabti/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/pnevyk/ushabti/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/pnevyk/ushabti/releases/tag/v0.1.0
