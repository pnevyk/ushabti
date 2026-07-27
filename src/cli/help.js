export function printHelp() {
    console.log(`ushabti — automate little engineering tasks

Usage: ushabti <group> <command> [options]

Commands:
  pr comments            Fetch unresolved PR review threads to JSON
  pr digest              Fetch merged-PR history in a date window to JSON
  jira fetch             Fetch a project's tickets to JSON or markdown
  jira comments          Fetch a ticket's comments to JSON or markdown
  jira project           Fetch a project's people and sprints to a YAML reference file
  jira create            Create a Jira ticket from a markdown file
  jira update            Update a Jira ticket from a markdown file
  jira filter            Filter locally fetched tickets by a JS expression
  confluence download    Fetch a Confluence page to JSON or markdown
  confluence create      Create a Confluence page from a markdown file

Run \`ushabti <group> <command> --help\` for options and examples.

Global options:
  -h, --help     Show this help
  --config       Config file (default: ./ushabti.config.toml, then ~/.config/ushabti/config.toml)
`);
}

// Per-command help, keyed by "<group> <sub>".
const COMMAND_HELP = {
    "pr comments": `Usage: ushabti pr comments [--pr <n>] [--repo <owner/name>] [--out <file>] [--all]

Fetch unresolved review comment threads on a PR into a JSON file.

Examples:
  ushabti pr comments                                  current branch's open PR
  ushabti pr comments --pr 42 --all                    specific PR, include resolved
  ushabti pr comments --repo acme/widget --out cr.json

Options:
  --pr <n>              PR number (default: open PR for the current branch)
  --repo <owner/name>   Repository (default: git origin remote)
  --out <file>          Output file (default: pr-comments.ushabti.json)
  --all                 Include resolved threads (default: unresolved only)
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

Options:
  --since <date>        Window start (required)
  --until <date>        Window end (default: open-ended)
  --repo <owner/name>   Repository (default: git origin remote)
  --out <file>          Output file (default: pr-digest.ushabti.json)
  --config <file>       Config file path
  -h, --help            Show this help

Note: GitHub search returns at most 1000 results; narrow the window for very
busy repositories.`,
    "jira fetch": `Usage: ushabti jira fetch (--project <key> | --id <ticket-id>) [--format json|markdown] [--out <path>]

Fetch a project's Jira tickets, or a single ticket with --id.

With --id, the ticket key already implies its project, so --project is not
required (and is ignored).

With --format markdown, writes one <ID>.md per ticket: YAML frontmatter
(id, title, type, parent, storyPoints, assignee) plus the description body.

Examples:
  ushabti jira fetch --project ABC
  ushabti jira fetch --project ABC --id ABC-123
  ushabti jira fetch --project ABC --format markdown
  ushabti jira fetch --project ABC --id ABC-123 --format markdown

Options:
  --project <key>          Jira project key (required unless --id is given)
  --id <ticket-id>         Fetch only this ticket (e.g. ABC-123) instead of all
  --format json|markdown   Output format (default: json)
  --out <path>             Output file (json) or directory (markdown)
                           Default (project): jira-<project>.ushabti.json or jira-<project>/
                           Default (--id): jira-<id>.ushabti.json or <id>.md in cwd
  --config <file>          Config file path
  -h, --help               Show this help`,
    "jira comments": `Usage: ushabti jira comments --id <ticket-key> [--format json|markdown] [--out <path>]

Fetch all comments of a single Jira ticket.

Each comment carries id, author (display name), authorId (accountId), created,
updated and body (rendered from ADF to markdown). With --format markdown, writes
one file with a section per comment.

Examples:
  ushabti jira comments --id ABC-123
  ushabti jira comments --id ABC-123 --format markdown
  ushabti jira comments --id ABC-123 --out thread.json

Options:
  --id <ticket-key>        Ticket to fetch comments for, e.g. ABC-123 (required)
  --format json|markdown   Output format (default: json)
  --out <path>             Output file
                           Default: jira-<id>-comments.ushabti.json or <id>-comments.md
  --config <file>          Config file path
  -h, --help               Show this help`,
    "jira project": `Usage: ushabti jira project --project <key> [--out <file>]

Fetch a project's assignable people and its boards' sprints into a YAML file,
mapping human-readable names to the ids used by the assignee and sprint fields.

People list accountIds (for the assignee field). Boards each nest their sprints
(all states) listing numeric sprint ids (for the sprint field).

Examples:
  ushabti jira project --project ABC
  ushabti jira project --project ABC --out people.yaml

Options:
  --project <key>     Jira project key (required)
  --out <file>        Output file (default: jira-<project>.ushabti.yaml)
  --config <file>     Config file path
  -h, --help          Show this help`,
    "jira create": `Usage: ushabti jira create --project <key> --file <markdown> [--update]

Create a Jira ticket from a markdown file with YAML frontmatter.

Frontmatter: title (required), type (required), parent, storyPoints, assignee
(accountId) optional. The body becomes the ticket description.

Examples:
  ushabti jira create --project ABC --file ticket.md
  ushabti jira create --project ABC --file ticket.md --update

Options:
  --project <key>     Jira project key (required)
  --file <markdown>   Markdown file describing the ticket (required)
  --update            After creation, write id into frontmatter and rename
                      the file to <KEY>.md
  --config <file>     Config file path
  -h, --help          Show this help`,
    "jira update": `Usage: ushabti jira update --file <markdown>

Update an existing Jira ticket from a markdown file with YAML frontmatter.

The issue key is read from frontmatter \`id\` (as written by \`jira create
--update\` or \`jira fetch --format markdown\`). All fields are optional; only
those present are updated, the rest are left unchanged.

Frontmatter: id (required), title, type, parent, storyPoints, assignee
(accountId) optional. The body becomes the ticket description.

Examples:
  ushabti jira update --file ABC-123.md

Options:
  --file <markdown>   Markdown file describing the update (required)
  --config <file>     Config file path
  -h, --help          Show this help`,
    "jira filter": `Usage: ushabti jira filter (--project <key> | --in <path>) [--where <expr>]

Filter locally fetched tickets and print matching ticket ids, one per line.

Reads tickets from --in (a JSON file or a markdown directory, detected
automatically). Without --in, --project is required to derive the default
input: jira-<project>.ushabti.json, then jira-<project>/.

--where is a JavaScript expression evaluated per ticket; the ticket passes
when it is truthy. Omit --where to print every ticket. These fields are in
scope as variables: id, title, type, parent, assignee, storyPoints.

Examples:
  ushabti jira filter --project ABC --where '!parent'
  ushabti jira filter --project ABC --where 'type === "Epic" && storyPoints > 3'
  ushabti jira filter --project ABC --in ./tickets

Options:
  --project <key>   Jira project key (required unless --in is given)
  --in <path>       JSON file or markdown directory (default: project-derived)
  --where <expr>    JavaScript filter expression (default: match all)
  --config <file>   Config file path
  -h, --help        Show this help

Note: --where is evaluated with new Function over local input; do not pass
untrusted expressions.`,
    "confluence download": `Usage: ushabti confluence download --id <pageId> [--format json|markdown] [--out <path>]

Fetch a single Confluence page's content (as Atlas Document Format, converted
to markdown) to a local file.

With --format markdown, writes YAML frontmatter (id, title, spaceId, parentId)
plus the page body as markdown.

Examples:
  ushabti confluence download --id 12345
  ushabti confluence download --id 12345 --format markdown

Options:
  --id <pageId>            Confluence page id (required)
  --format json|markdown   Output format (default: json)
  --out <path>             Output file
                           Default: confluence-<id>.ushabti.json or <id>.md
  --config <file>          Config file path
  -h, --help               Show this help`,
    "confluence create": `Usage: ushabti confluence create --space <key> --file <markdown> [--update]

Create a new Confluence page from a markdown file with YAML frontmatter.

Frontmatter: title (required), parent (optional, a page id to nest under).
The body becomes the page content.

Examples:
  ushabti confluence create --space ENG --file page.md
  ushabti confluence create --space ENG --file page.md --update

Options:
  --space <key>       Confluence space key (required)
  --file <markdown>   Markdown file describing the page (required)
  --update            After creation, write id into frontmatter and rename
                      the file to <id>.md
  --config <file>     Config file path
  -h, --help          Show this help`,
};

export function printCommandHelp(key) {
    console.log(COMMAND_HELP[key]);
}
