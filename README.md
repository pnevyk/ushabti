# ushabti

A CLI tool for automating little tasks of a software engineer.

Works with:
- GitHub
- Jira
- Confluence

Read the [docs](docs/) for more detailed getting started, how to guides and reference material.

## Quickstart

Install:

```sh
git clone git@github.com:pnevyk/ushabti.git
cd ushabti
pnpm install
npm install -g .
```

Configure by copying the example config to the user config location and fill in credentials:

```sh
mkdir -p ~/.config/ushabti
cp ushabti.config.example.toml ~/.config/ushabti/config.toml
```

ushabti looks for `./ushabti.config.toml` first, then `~/.config/ushabti/config.toml`.
Override the path with `--config <file>` on any command.

List the available commands, then see options and examples for one:

```sh
ushabti --help
ushabti <group> <command> --help
```

## Why ushabti

Routine developer chores, such as triaging PR feedback, summarizing what merged last week, or drafting a batch of Jira tickets, are mechanical to fetch but need judgment to act on.
Coding agents are good at the judgment.
They are a poor fit for the fetching: handing an agent a broad GitHub or Jira token means unscoped reads and unpredictable writes against services you cannot afford to have corrupted.

ushabti is the deterministic layer in between.
It performs each chore as a narrow, auditable operation with scoped credentials that stay on your machine:

- Reads produce a plain local file (JSON or markdown).
  The agent reasons over the file, not over a live API.
- Writes go through explicit, single-purpose commands whose input is a file you can review before it runs (`jira create --file ticket.md`).

The boundary is simple.
ushabti does the I/O with controlled access; the agent does the thinking over local files.
You stay in control of what crosses back to the service.

## Concept

A ushabti is a small figurine placed in ancient Egyptian tombs to carry out menial work on the owner's behalf.
This tool is the same idea for a developer's repetitive chores.
