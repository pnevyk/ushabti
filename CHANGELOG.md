# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-08-12

### Added

- Initial release.
- `pr comments` / `pr digest` for fetching GitHub PR review threads and activity summaries into local files.
- `jira create` / `fetch` / `update` / `comments` / `filter` / `template` / `project` for reading and writing Jira issues through local files.
- `confluence create` / `upload` / `download` / `template` for round-tripping Confluence pages as Markdown, including mermaid/UML diagram macro plugins.
- `secrets set` / `delete` / `list` for storing service credentials in the OS keychain, with a file-based fallback.
- `config template` and merged project-local/global TOML configuration.
- `ui estimate` local browser UI for task estimation.

[Unreleased]: https://github.com/pnevyk/ushabti/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/pnevyk/ushabti/releases/tag/v0.1.0
