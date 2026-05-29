export function printHelp() {
    console.log(`ushabti — automate little engineering tasks

Usage:
  ushabti pr comments  [--pr <n>] [--repo <owner/name>] [--out <file>]
  ushabti jira fetch   --project <key> [--format json|markdown] [--out <path>]
  ushabti jira create  --project <key> --file <markdown>

pr comments defaults:
  --pr     the open PR for the current branch
  --repo   git origin remote
  --out    pr-comments.ushabti.json

Global options:
  -h, --help     Show this help (also per command: ushabti <group> <sub> --help)
  --config       Path to config file (default: ./ushabti.config.toml, then ~/.config/ushabti/config.toml)
`);
}

// Per-command help, keyed by "<group> <sub>".
const COMMAND_HELP = {
    "pr comments": `Usage: ushabti pr comments [--pr <n>] [--repo <owner/name>] [--out <file>]

Fetch unresolved review comment threads on a PR into a JSON file.

Options:
  --pr <n>              PR number (default: open PR for the current branch)
  --repo <owner/name>   Repository (default: git origin remote)
  --out <file>          Output file (default: pr-comments.ushabti.json)
  --config <file>       Config file path
  -h, --help            Show this help`,
    "jira fetch": `Usage: ushabti jira fetch --project <key> [--format json|markdown] [--out <path>]

Fetch all Jira tickets for a project.

Options:
  --project <key>          Jira project key (required)
  --format json|markdown   Output format (default: json)
  --out <path>             Output file (json) or directory (markdown)
                           Default: jira-<project>.ushabti.json or jira-<project>/
  --config <file>          Config file path
  -h, --help               Show this help

With --format markdown, writes one <ID>.md per ticket: YAML frontmatter
(id, title, type, parent, storyPoints, assignee) plus the description body.`,
    "jira create": `Usage: ushabti jira create --project <key> --file <markdown>

Create a Jira ticket from a markdown file with YAML frontmatter.

Frontmatter: title (required), type (required), parent, storyPoints, assignee
(accountId) optional. The body becomes the ticket description.

Options:
  --project <key>     Jira project key (required)
  --file <markdown>   Markdown file describing the ticket (required)
  --config <file>     Config file path
  -h, --help          Show this help`,
};

export function printCommandHelp(key) {
    console.log(COMMAND_HELP[key]);
}
