export function printHelp() {
    console.log(`ushabti — automate little engineering tasks

Usage: ushabti <group> <command> [options]

Commands:
  config template        Print an example config file
  secrets set            Store a token in the OS keychain
  secrets delete         Remove a stored token
  secrets list           List stored tokens and clean up broken scopes
  pr comments            Fetch unresolved PR review threads to JSON
  pr digest              Fetch merged-PR history in a date window to JSON
  jira fetch             Fetch a ticket or a project's tickets to JSON or markdown
  jira comments          Fetch a ticket's comments to JSON or markdown
  jira project           Fetch a project's people and sprints to a YAML reference file
  jira create            Create a Jira ticket from a markdown file
  jira update            Update a Jira ticket from a markdown file
  jira filter            Filter locally fetched tickets by a JS expression
  jira template          Print an example ticket markdown file
  confluence download    Fetch a Confluence page to JSON or markdown
  confluence comments    Fetch a page's footer and inline comments to JSON or markdown
  confluence create      Create a Confluence page from a markdown file
  confluence upload      Update a Confluence page from a markdown file
  confluence template    Print an example page markdown file
  ui estimate            Serve the local task estimation UI

Run \`ushabti <group> <command> --help\` for options and examples.

Global options:
  -h, --help     Show this help
  --config       Config file, used exclusively; without it, ./ushabti.config.toml
                 is merged over ~/.config/ushabti/config.toml (local wins)
`);
}

// Per-command help, keyed by "<group> <sub>".
const COMMAND_HELP = {
    "config template": `Usage: ushabti config template

Print the example config file (ushabti.config.example.toml), with every field
present but blank or commented out. Redirect to a file to start a new config:
\`ushabti config template > ushabti.config.toml\`.

Options:
  -h, --help    Show this help`,
    "secrets set": `Usage: ushabti secrets set <github|atlassian> [--local]

Store a token in the OS keychain, falling back to a dedicated secrets file
(ushabti.secrets.toml) if no keychain is available. Reads the value from
stdin if piped, otherwise prompts for it (hidden, nothing echoed).

--local scopes the token to the current directory (and its subdirectories);
without it, the token is available everywhere.

Examples:
  ushabti secrets set github
  echo -n "$TOKEN" | ushabti secrets set atlassian --local

Options:
  --local       Scope to the current directory instead of storing globally
  -h, --help    Show this help`,
    "secrets delete": `Usage: ushabti secrets delete <github|atlassian> [--local]

Remove a token from wherever it's stored (OS keychain and/or secrets file) at
the given scope. Reports "not found" if there was nothing to remove.

Examples:
  ushabti secrets delete github
  ushabti secrets delete atlassian --local

Options:
  --local       Operate on the current directory's scope instead of global
  -h, --help    Show this help`,
    "secrets list": `Usage: ushabti secrets list

List every stored token with its scope (global or a directory). Registered
directory scopes whose directory no longer exists are flagged; run
interactively to be prompted to delete each broken scope's secrets.

Options:
  -h, --help    Show this help`,
    "pr comments": `Usage: ushabti pr comments [<pr-number|url>] [--repo <owner/name>] [--out <file>] [--all]

Fetch unresolved review comment threads on a PR into a JSON file.

Examples:
  ushabti pr comments                                  current branch's open PR
  ushabti pr comments 42 --all                         specific PR, include resolved
  ushabti pr comments https://github.com/acme/widget/pull/42
  ushabti pr comments --repo acme/widget --out cr.json

Arguments:
  <pr-number|url>       PR number, or a GitHub PR URL (which also gives the
                        repository). Default: open PR for the current branch

Options:
  --repo <owner/name>   Repository (default: from the PR URL, else git origin remote)
  --out <file>          Output file (default: pr-comments.ushabti.json)
  --all                 Include resolved threads (default: unresolved only)
  --pr <n>              (deprecated) Use the <pr-number> argument instead
  --config <file>       Config file path
  -h, --help            Show this help`,
    "pr digest": `Usage: ushabti pr digest --since <date> [--until <date>] [--repo <owner/name>] [--out <file>]

Fetch every PR merged in a date window, each with its reviews, inline review
comments and conversation comments, into one JSON file.

Dates are YYYY-MM-DD or ISO datetime (e.g. 2026-06-01T00:00:00Z). The window
filters on merge date; a matched PR's full comment history is included
regardless of when individual comments were made.

Examples:
  ushabti pr digest --since 2026-06-01
  ushabti pr digest --since 2026-06-01 --until 2026-06-15
  ushabti pr digest --since 2026-06-01 --repo acme/widget --out sprint.json
  ushabti pr digest --since 2026-06-01 --author me
  ushabti pr digest --since 2026-06-01 --reviewer octocat
  ushabti pr digest --since 2026-06-01 --commenter octocat
  ushabti pr digest --since 2026-06-01 --author me --comments-by octocat

Options:
  --since <date>          Window start (required)
  --until <date>          Window end (default: open-ended)
  --repo <owner/name>     Repository (default: git origin remote)
  --author <login|me>     Only PRs authored by this user
  --reviewer <login|me>   Only PRs reviewed by this user
  --commenter <login|me>  Only PRs commented on by this user
                          (--author/--reviewer/--commenter are mutually exclusive)
  --comments-by <login|me>
                          Trim each PR's comments (inline and conversation) down to
                          this user's own. Applies to whichever PRs matched the
                          above filters (or all of them, with none set).
  --out <file>            Output file (default: pr-digest.ushabti.json)
  --config <file>         Config file path
  -h, --help              Show this help

"me" resolves to the github.username config field.

Note: GitHub search returns at most 1000 results. If a search matches more,
the digest is capped at 1000 and a warning is printed to stderr; narrow the
window for very busy repositories to get a complete digest.`,
    "jira fetch": `Usage: ushabti jira fetch [<ticket-id|project-key>] [--format json|markdown] [--out <path>]

Fetch a single Jira ticket, or all tickets of a project.

The argument is a ticket id (ABC-123), a project key (ABC), or a Jira URL
containing either (e.g. https://acme.atlassian.net/browse/ABC-123). A ticket id
already implies its project. Without an argument, the project is read from the
\`project\` field under [jira] in the config.

Default format is markdown: one <ID>.md per ticket, YAML frontmatter (id,
title, type, parent, storyPoints, assignee) plus the description body. Pass
--format json for a single {tickets:[...]} file instead.

Examples:
  ushabti jira fetch ABC
  ushabti jira fetch ABC-123
  ushabti jira fetch ABC --format json
  ushabti jira fetch https://acme.atlassian.net/browse/ABC-123 --format json

Arguments:
  <ticket-id|project-key>  Ticket to fetch, or project whose tickets to fetch
                           (default: [jira] project from the config)

Options:
  --format json|markdown   Output format (default: markdown)
  --out <path>             Output directory (markdown) or file (json)
                           Default (project): jira-<project>/ or jira-<project>.ushabti.json
                           Default (ticket): <id>.md or jira-<id>.ushabti.json in cwd
  --id <ticket-id>         (deprecated) Use the <ticket-id> argument instead
  --project <key>          (deprecated) Use the <project-key> argument instead
  --config <file>          Config file path
  -h, --help               Show this help`,
    "jira comments": `Usage: ushabti jira comments <ticket-id> [--format json|markdown] [--out <path>]

Fetch all comments of a single Jira ticket.

Each comment carries id, author (display name), authorId (accountId), created,
updated and body (rendered from ADF to markdown). Default format is markdown:
one file with a section per comment. Pass --format json for a single
{comments:[...]} file instead.

Examples:
  ushabti jira comments ABC-123
  ushabti jira comments ABC-123 --format json
  ushabti jira comments https://acme.atlassian.net/browse/ABC-123 --out thread.md

Arguments:
  <ticket-id>              Ticket to fetch comments for, e.g. ABC-123, or its
                           Jira URL (required)

Options:
  --format json|markdown   Output format (default: markdown)
  --out <path>             Output file
                           Default: <id>-comments.md or jira-<id>-comments.ushabti.json
  --id <ticket-id>         (deprecated) Use the <ticket-id> argument instead
  --config <file>          Config file path
  -h, --help               Show this help`,
    "jira project": `Usage: ushabti jira project [<project-key>] [--out <file>]

Fetch a project's assignable people and its boards' sprints into a YAML file,
mapping human-readable names to the ids used by the assignee and sprint fields.

People list accountIds (for the assignee field). Boards each nest their sprints
(all states) listing numeric sprint ids (for the sprint field).

Without an argument, the project is read from the \`project\` field under
[jira] in the config.

Examples:
  ushabti jira project ABC
  ushabti jira project ABC --out people.yaml

Arguments:
  <project-key>       Jira project key (default: [jira] project from the config)

Options:
  --out <file>        Output file (default: jira-<project>.ushabti.yaml)
  --project <key>     (deprecated) Use the <project-key> argument instead
  --config <file>     Config file path
  -h, --help          Show this help`,
    "jira create": `Usage: ushabti jira create <markdown> [<project-key>] [--update]

Create a Jira ticket from a markdown file with YAML frontmatter.

Frontmatter: title (required), type (required), parent, storyPoints, assignee
(accountId) optional. The body becomes the ticket description.

The project is the second argument, or the \`project\` field under [jira] in
the config when omitted.

Examples:
  ushabti jira create ticket.md ABC
  ushabti jira create ticket.md ABC --update
  ushabti jira create ticket.md            project from config

Arguments:
  <markdown>          Markdown file describing the ticket (required)
  <project-key>       Jira project key (default: [jira] project from the config)

Options:
  --update            After creation, write id into frontmatter and rename
                      the file to <KEY>.md
  --file <markdown>   (deprecated) Use the <markdown> argument instead
  --project <key>     (deprecated) Use the <project-key> argument instead
  --config <file>     Config file path
  -h, --help          Show this help`,
    "jira update": `Usage: ushabti jira update <markdown>

Update an existing Jira ticket from a markdown file with YAML frontmatter.

The issue key is read from frontmatter \`id\` (as written by \`jira create
--update\` or \`jira fetch --format markdown\`). All fields are optional; only
those present are updated, the rest are left unchanged.

Frontmatter: id (required), title, type, parent, storyPoints, assignee
(accountId) optional. The body becomes the ticket description.

Examples:
  ushabti jira update ABC-123.md

Arguments:
  <markdown>          Markdown file describing the update (required)

Options:
  --file <markdown>   (deprecated) Use the <markdown> argument instead
  --config <file>     Config file path
  -h, --help          Show this help`,
    "jira filter": `Usage: ushabti jira filter [<project-key>] [--in <path>] [--where <expr>]

Filter locally fetched tickets and print matching ticket ids, one per line.

Reads tickets from --in (a JSON file or a markdown directory, detected
automatically). Without --in, the project (argument, or [jira] project from the
config) derives the default input: jira-<project>.ushabti.json, then
jira-<project>/.

--where is a JavaScript expression evaluated per ticket; the ticket passes
when it is truthy. Omit --where to print every ticket. These fields are in
scope as variables: id, title, type, parent, assignee, storyPoints.

Examples:
  ushabti jira filter ABC --where '!parent'
  ushabti jira filter ABC --where 'type === "Epic" && storyPoints > 3'
  ushabti jira filter --in ./tickets

Arguments:
  <project-key>     Jira project key (not needed with --in)

Options:
  --in <path>       JSON file or markdown directory (default: project-derived)
  --where <expr>    JavaScript filter expression (default: match all)
  --project <key>   (deprecated) Use the <project-key> argument instead
  --config <file>   Config file path
  -h, --help        Show this help

Note: --where is evaluated with new Function over local input; do not pass
untrusted expressions.`,
    "jira template": `Usage: ushabti jira template

Print an example ticket markdown file for project ABC, with optional
frontmatter fields present but commented out. Redirect to a file to start a
new ticket: \`ushabti jira template > ticket.md\`.

Options:
  -h, --help    Show this help`,
    "confluence download": `Usage: ushabti confluence download <page-id|url> [--format json|markdown] [--out <path>] [--children]

Fetch a single Confluence page's content (as Atlas Document Format, converted
to markdown) to a local file.

Default format is markdown: YAML frontmatter (id, title, type, spaceId,
parentId) plus the page body as markdown. type is "page" or "live" (a live
doc). Pass --format json for a single JSON object instead. The output
filename always includes the page's title: <title>-<id>.md (or .ushabti.json).

With --children, --id may be a page or a folder: downloads it plus every
descendant at any depth into a directory tree, one file per node
(<title>-<id>.<ext>) plus a same-named subdirectory for any node that has
children. Confluence folders (which have no content of their own) become a
file with just id/title/type/parentId and a subdirectory for their children.
Descendants of an unsupported type (whiteboard, database, embed, ...) are
skipped, along with their own descendants, and reported on stderr.

Examples:
  ushabti confluence download 12345
  ushabti confluence download 12345 --format json
  ushabti confluence download 12345 --children
  ushabti confluence download https://acme.atlassian.net/wiki/spaces/ENG/pages/12345/Title

Arguments:
  <page-id|url>            Confluence page or folder id, or its URL (required)

Options:
  --format json|markdown   Output format (default: markdown)
  --out <path>             Output file, or output directory with --children
                           Default: <title>-<id>.md or <title>-<id>.ushabti.json
                           Default with --children: confluence-<id>/
  --children               Also download every descendant, as a directory tree
  --id <pageId>            (deprecated) Use the <page-id|url> argument instead
  --config <file>          Config file path
  -h, --help               Show this help`,
    "confluence comments": `Usage: ushabti confluence comments <page-id|url> [--format json|markdown] [--out <path>]

Fetch a single Confluence page's footer and inline comment threads, each with
its full reply chain.

Each thread carries kind (footer or inline), resolutionStatus (inline only:
dangling/open/reopened/resolved), selection (the highlighted text an inline
thread is anchored to, inline only) and comments: an array of { authorId,
createdAt, body }, root first then replies in chronological order. authorId
is the raw accountId -- Confluence's API has no display name here, unlike
Jira's. body is rendered from ADF to markdown. Default format is markdown:
threads merged into chronological order (by root comment), each opening with
"- Type:"/"- Status:" bullets and its comments as "## Author:" sections,
separated by "---" rules. Pass --format json for a single {threads:[...]}
file instead.

Examples:
  ushabti confluence comments 12345
  ushabti confluence comments 12345 --format json
  ushabti confluence comments 12345 --out thread.md

Arguments:
  <page-id|url>            Confluence page id, or its URL (required)

Options:
  --format json|markdown   Output format (default: markdown)
  --out <path>             Output file
                           Default: confluence-<id>-comments.md or
                           confluence-<id>-comments.ushabti.json
  --id <pageId>            (deprecated) Use the <page-id|url> argument instead
  --config <file>          Config file path
  -h, --help               Show this help`,
    "confluence create": `Usage: ushabti confluence create <markdown> [<space-key>] [--update]

Create a new Confluence page from a markdown file with YAML frontmatter.

Frontmatter: title (required), parentId (optional, a page id to nest under),
type (optional, "page" (default) or "live" to create a live doc). The body
becomes the page content.

The space is the second argument (a key, or a URL under /spaces/<KEY>/), or the
\`space\` field under [confluence] in the config when omitted.

Examples:
  ushabti confluence create page.md ENG
  ushabti confluence create page.md ENG --update
  ushabti confluence create page.md        space from config

Arguments:
  <markdown>          Markdown file describing the page (required)
  <space-key>         Confluence space key (default: [confluence] space from the config)

Options:
  --update            After creation, write id into frontmatter and rename
                      the file to <id>.md
  --file <markdown>   (deprecated) Use the <markdown> argument instead
  --space <key>       (deprecated) Use the <space-key> argument instead
  --config <file>     Config file path
  -h, --help          Show this help`,
    "confluence upload": `Usage: ushabti confluence upload <markdown>

Update an existing Confluence page from a markdown file with YAML frontmatter.

The page id is read from frontmatter \`id\` (as written by \`confluence create
--update\` or \`confluence download\`). title and parentId are optional (only
applied if present; parentId moves the page under a new parent); the body
always replaces the page content. The current page version is fetched
automatically to satisfy Confluence's optimistic-locking requirement
(version.number must increment by exactly 1) -- no version field is needed in
frontmatter. type is not supported here -- a page's subtype (page vs. live
doc) can't be changed after creation.

Examples:
  ushabti confluence upload 12345.md

Arguments:
  <markdown>          Markdown file describing the update (required)

Options:
  --file <markdown>   (deprecated) Use the <markdown> argument instead
  --config <file>     Config file path
  -h, --help          Show this help`,
    "confluence template": `Usage: ushabti confluence template

Print an example page markdown file for space ABC, with optional frontmatter
fields present but commented out. Redirect to a file to start a new page:
\`ushabti confluence template > page.md\`.

Options:
  -h, --help    Show this help`,
    "ui estimate": `Usage: ushabti ui estimate [--browser | --no-browser]

Serve the quantified task estimation UI (distance + friction x relativity)
on a local HTTP server and print its URL. Runs until stopped (Ctrl+C).

Examples:
  ushabti ui estimate
  ushabti ui estimate --browser

Options:
  --browser         Open the UI in your default browser (default: config
                    ui.openBrowser, else off)
  --no-browser      Never open the browser, even if config ui.openBrowser
                    is true
  --config <file>   Config file path
  -h, --help        Show this help`,
};

export function printCommandHelp(key) {
    console.log(COMMAND_HELP[key]);
}
