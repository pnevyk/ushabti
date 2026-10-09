# Getting started

This walks through installing ushabti and setting up a working config, from nothing to your first successful command.
For the full list of config fields and what each one does, see the [configuration reference](reference/configuration.md).

## Install

ushabti requires Node.js 24 or newer.

```sh
npm install -g ushabti
```

Confirm it worked:

```sh
ushabti --help
```

### Install from source

To run a development checkout instead of the published package:

```sh
git clone git@github.com:pnevyk/ushabti.git
cd ushabti
pnpm install
npm install -g .
```

## Update

```sh
npm install -g ushabti
```

Updating a source checkout:

```sh
cd ushabti
git pull
pnpm install
npm install -g .
```

## Set up the config file

ushabti reads credentials and settings from a TOML file, resolved from two places:

1. `./ushabti.config.toml` — a project-local config, so different repos can use different credentials or fields.
2. `~/.config/ushabti/config.toml` — a global config, for the defaults you want everywhere.

Both are read when they exist, and merged field-by-field, with the project-local file taking precedence over the global one — so the local file only needs to state what it wants to override, not repeat the whole global config. Pass `--config <file>` on any command to use that file exclusively instead, skipping this merge entirely.

Start from the example config:

```sh
mkdir -p ~/.config/ushabti
ushabti config template > ~/.config/ushabti/config.toml
```

Put your durable, everywhere defaults (Atlassian base URL and email, Jira custom fields) in the global file. If one project needs its own settings, run `ushabti config template > ushabti.config.toml` inside that project instead, and fill in only the fields that need to differ there. Tokens don't go in this file at all — see below.

## Configure GitHub access

`pr comments` and `pr digest` need a GitHub token with read access to the repositories you'll run them against.

1. Create a token at [github.com/settings/tokens](https://github.com/settings/tokens) — a fine-grained token scoped to just the repositories you need, with read-only "Pull requests" access, is enough.
2. Store it:

   ```sh
   ushabti secrets set github
   ```

   This prompts for the token (input is hidden) and stores it in your OS keychain, falling back to a dedicated secrets file if no keychain is available. See [Secrets](reference/configuration.md#secrets-tokens) in the configuration reference for how storage and scoping work.

## Configure Atlassian access

`jira` and `confluence` commands share one set of Atlassian Cloud credentials.

1. Create an API token at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens).
2. Fill in your site's base URL and the email address tied to the token — these aren't secrets, so they live in the config file:

   ```toml
   [atlassian]
   baseUrl = "https://your-site.atlassian.net"
   email = "you@example.com"
   ```
3. Store the token itself:

   ```sh
   ushabti secrets set atlassian
   ```

If your Jira project tracks story points or sprints in custom fields and you plan to read or write them through ushabti, also fill in `[jira] storyPointsField` / `sprintField` — see the [configuration reference](reference/configuration.md) for how to find their field ids.

## Try it

With `[github]` configured, from inside a repository with an open PR:

```sh
ushabti pr comments
```

With `[atlassian]` configured:

```sh
ushabti jira project ABC
```

Each should produce a local JSON or YAML file. If a command instead fails saying the configuration is missing something, double check the section it names in your config file. Any other failure — an invalid token, no network, GitHub/Jira/Confluence being unreachable — prints a short explanation of what went wrong and how to fix it, plus the path to a log file with the full technical detail.

## Next steps

- Walk through a concrete workflow in the [how-to guides](how-to/).
- Look up every config field, or how ADF content maps to markdown, in the [reference](reference/).
