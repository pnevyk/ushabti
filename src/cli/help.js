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
  -h, --help     Show this help
  --config       Path to config file (default: ./ushabti.config.toml, then ~/.config/ushabti/config.toml)
`);
}
