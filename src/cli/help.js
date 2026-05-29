export function printHelp() {
    console.log(`ushabti — automate little engineering tasks

Usage:
  ushabti pr comments  [--pr <n>] [--repo <owner/name>] [--out <file>]
  ushabti jira fetch   --project <key> --out <file>
  ushabti jira create  --file <markdown>

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
    "jira fetch": `Usage: ushabti jira fetch --project <key> --out <file>

Fetch Jira tickets for a project into a file.

Options:
  --project <key>   Jira project key
  --out <file>      Output file
  --config <file>   Config file path
  -h, --help        Show this help`,
    "jira create": `Usage: ushabti jira create --file <markdown>

Create a Jira ticket from a markdown file.

Options:
  --file <markdown>   Markdown file describing the ticket
  --config <file>     Config file path
  -h, --help          Show this help`,
};

export function printCommandHelp(key) {
    console.log(COMMAND_HELP[key]);
}
