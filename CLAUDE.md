# ushabti

A simple NodeJS CLI tool for automating little tasks of a software engineer.

- Implementation simplicity is the main priority.
- Apply the following principles: separation of concerns, three-layer architecture, vertical slices.

## Code style

- Use double quotes for strings.
- Use 4-space indentation.

## Guidance

- Don't propose E2E tests on real resources, stick to unit tests

## Documentation

User-facing documentation lives in `docs/`, following the Diataxis framework:

- `docs/getting-started.md` — installation and configuration walkthrough.
- `docs/how-to/` — one file per use case, goal-oriented.
- `docs/reference/` — exhaustive, lookup-oriented facts (config fields, ADF-to-Markdown mapping).

After any change to the CLI's behavior, commands, or config, check `docs/` for consistency and proactively fix anything it no longer describes correctly.

