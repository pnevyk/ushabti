# Configuration reference

ushabti reads a TOML config file. Every field below is present in the example config, printed by `ushabti config template`, as a starting point.

## File location and precedence

1. `--config <file>`, passed on any command, is used exclusively — no other file is read, and it isn't merged with anything.
2. Otherwise, `./ushabti.config.toml` (project-local) and `~/.config/ushabti/config.toml` (global) are merged field-by-field wherever both exist, the project-local file taking precedence. Either may be absent; at least one must exist.

Use the project-local file for credentials or Jira custom fields specific to one repo (e.g. a token scoped to only that repo, or that project's `storyPointsField`); use the global file for a default that's the same everywhere — the project-local file only needs to state what it overrides. Since the project-local file typically holds real credentials, keep it out of version control (add `ushabti.config.toml` to `.gitignore`).

Recommend scoped tokens with least privilege for both `[github]` and `[atlassian]` below — a token that can only read the repos or spaces you actually run ushabti against limits what a corrupted config or a compromised machine can do.

## `[github]`

| Field | Required | Description |
|---|---|---|
| `token` | Yes, for `pr comments` / `pr digest` | A GitHub token. A fine-grained personal access token scoped to the specific repositories you run ushabti against, with read-only "Pull requests" access, is enough — no write scope is ever used. |

## `[atlassian]`

Shared by every `jira` and `confluence` command.

| Field | Required | Description |
|---|---|---|
| `baseUrl` | Yes | Your Atlassian Cloud site, e.g. `https://your-site.atlassian.net`. |
| `email` | Yes | The email address tied to the API token below. |
| `token` | Yes | An Atlassian API token, created at your Atlassian account's security settings. |

Legacy fallback: configs written before Confluence support existed may instead have these three fields under `[jira]`. `[atlassian]` takes precedence field-by-field; `[jira].baseUrl`/`email`/`token` are only read for a field missing from `[atlassian]`. New configs should use `[atlassian]`.

## `[jira]`

| Field | Required | Description |
|---|---|---|
| `storyPointsField` | No | Custom field id backing story points, e.g. `"customfield_10026"`. Without it, `storyPoints` in ticket frontmatter is silently ignored on create/update, and omitted on fetch. |
| `sprintField` | No | Custom field id backing sprint, e.g. `"customfield_10020"`. Same behavior as `storyPointsField` when unset. |

Both are per-project custom field ids, not fixed across Jira sites — find them under your Jira site's custom fields administration, or via the Jira REST API's `/rest/api/3/field` endpoint (search the response for a field whose `name` matches, e.g. "Story point estimate" or "Sprint").

`jira project --project <key>` resolves the *values* these fields take (people's account ids for `assignee`, numeric sprint ids for `sprint`) — it doesn't discover the field ids themselves.

With `sprintField` configured, `jira fetch`'s markdown/JSON output also carries a ticket's past sprint ids as `sprintHistory` (present only when the ticket has moved through more than one sprint) alongside its current `sprint`.

## `[confluence.plugins]`

Controls which macro implementation `confluence create`/`upload` produce for a fresh (hand-authored, no plugin details comment yet) fence, keyed by fence language:

```toml
[confluence.plugins]
mermaid = "mermaid"  # or "uml"
```

See the [Confluence macro plugins reference](plugins.md) for the full list of available plugin ids and what each produces. Setting a target to an id with no matching plugin, or a target that doesn't exist, fails immediately with a `CliError` at the start of `confluence create`/`upload` — not partway through. `confluence download` doesn't consult this table at all; decoding never needs a default.

## `[ui]`

Every `ui <tool>` command (e.g. `ui estimate`) serves a small local browser UI over HTTP on an ephemeral `http://127.0.0.1:<port>`, printed when it starts, and keeps running until stopped with Ctrl+C.

| Field | Required | Description |
|---|---|---|
| `openBrowser` | No | Automatically open the UI in your default browser once the server starts. Shared by every `ui` command — not configurable per tool. Default: `false`. |

`openBrowser` is overridden per invocation by that command's `--browser` (force open) or `--no-browser` (force closed) flag; passing both is a `CliError`. `ui` commands work with no config file at all — they have no required credentials, so a missing config file is not an error the way it is for `jira`/`confluence`/`pr` commands.

Available `ui` tools:

- `estimate` — a distance/friction/relativity task-estimation calculator. See the [how-to guide](../how-to/estimate-tasks.md).
