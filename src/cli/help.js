export function printHelp() {
    console.log(`ushabti — automate little engineering tasks

Usage:
  ushabti pr comments  --repo <owner/name> --pr <n> --out <file>
  ushabti jira fetch   --project <key> --out <file>
  ushabti jira create  --file <markdown>

Global options:
  -h, --help     Show this help
  --config       Path to config file (default: ./ushabti.config.toml, then ~/.config/ushabti/config.toml)
`);
}
