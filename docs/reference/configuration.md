# Configuration reference

ushabti reads a TOML config file. Every field below is present in the example config, printed by `ushabti config template`, as a starting point.

## File location and precedence

1. `--config <file>`, passed on any command, is used exclusively — no other file is read, and it isn't merged with anything.
2. Otherwise, `./ushabti.config.toml` (project-local) and `~/.config/ushabti/config.toml` (global) are merged field-by-field wherever both exist, the project-local file taking precedence. Either may be absent; at least one must exist.

Use the project-local file for Jira custom fields or other settings specific to one repo (e.g. that project's `storyPointsField`); use the global file for a default that's the same everywhere — the project-local file only needs to state what it overrides. Tokens don't belong in either file — see [Secrets (tokens)](#secrets-tokens) below. If a project-local file ends up holding anything sensitive anyway, keep it out of version control (add `ushabti.config.toml` to `.gitignore`).

## Secrets (tokens)

Tokens are managed separately from the rest of the config, via `ushabti secrets set/delete/list`, instead of being written into a TOML file. Currently this covers two fields: `[github].token` and `[atlassian].token` (both documented below).

Looking up a token checks, in order:

1. Your OS keychain.
2. A dedicated secrets file — `./ushabti.secrets.toml` (project-local) and `~/.config/ushabti/secrets.toml` (global), merged the same way as the main config file. Used automatically when no OS keychain is available.

A token can be **global** (available everywhere) or **scoped** to the directory it was created in, including any subdirectory of it — a scoped token set in `~/code/acme` is also found when running ushabti from `~/code/acme/subproject`. Scoped beats global wherever both exist.

Commands:

```sh
# Store a token -- prompts for it (hidden input) unless piped
ushabti secrets set github
echo -n "$TOKEN" | ushabti secrets set atlassian --local   # scoped to the current directory

# Remove a token
ushabti secrets delete github
ushabti secrets delete atlassian --local

# List every stored token and its scope
ushabti secrets list
```

Without `--local`, `set`/`delete` operate on the global token; with it, on the token scoped to the current directory. `secrets list` shows every stored token with its scope, and flags any scoped token whose directory has since been deleted or moved — run it interactively to be prompted to clean those up.

If your platform's keychain isn't set up, a token is stored in the secrets file instead. See your platform's own documentation:

- [macOS Keychain Access](https://support.apple.com/guide/keychain-access/welcome/mac)
- [Windows Credential Manager](https://support.microsoft.com/en-us/windows/accessing-credential-manager-1b5c916a-6a16-889f-8581-fc16e8165ac0)
- [Linux: GNOME Keyring](https://wiki.gnome.org/Projects/Libsecret)
- [Linux: KWallet](https://userbase.kde.org/KWallet)

Use least-privilege tokens below — one that can only access what ushabti actually needs limits what a corrupted machine can do.

## `[github]`

| Field | Required | Description |
|---|---|---|
| `token` | Yes, for `pr comments` / `pr digest` | A GitHub token, set via `ushabti secrets set` (see [Secrets (tokens)](#secrets-tokens)). A fine-grained personal access token scoped to the specific repositories you run ushabti against, with read-only "Pull requests" access, is enough — no write scope is ever used. |

## `[atlassian]`

Shared by every `jira` and `confluence` command.

| Field | Required | Description |
|---|---|---|
| `baseUrl` | Yes | Your Atlassian Cloud site, e.g. `https://your-site.atlassian.net`. |
| `email` | Yes | The email address tied to the API token below. |
| `token` | Yes | An Atlassian API token, set via `ushabti secrets set` (see [Secrets (tokens)](#secrets-tokens)), created at your Atlassian account's security settings. |

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

See the [Confluence macro plugins reference](plugins.md) for the full list of available plugin ids and what each produces. Setting a target to an id with no matching plugin, or a target that doesn't exist, fails immediately at the start of `confluence create`/`upload` — not partway through. `confluence download` doesn't consult this table at all; decoding never needs a default.

## `[ui]`

Every `ui <tool>` command (e.g. `ui estimate`) serves a small local browser UI over HTTP on an ephemeral `http://127.0.0.1:<port>`, printed when it starts, and keeps running until stopped with Ctrl+C.

| Field | Required | Description |
|---|---|---|
| `openBrowser` | No | Automatically open the UI in your default browser once the server starts. Shared by every `ui` command — not configurable per tool. Default: `false`. |

`openBrowser` is overridden per invocation by that command's `--browser` (force open) or `--no-browser` (force closed) flag; passing both is an error. `ui` commands work with no config file at all — they have no required credentials, so a missing config file is not an error the way it is for `jira`/`confluence`/`pr` commands.

Available `ui` tools:

- `estimate` — a distance/friction/relativity task-estimation calculator. See the [how-to guide](../how-to/estimate-tasks.md).
