import { printHelp } from "./help.js";
import { CliError } from "../shared/errors.js";
import * as prComments from "../features/pr-comments/command.js";
import * as jiraFetch from "../features/jira-fetch/command.js";
import * as jiraCreate from "../features/jira-create/command.js";

// Two-level command map: "<group> <subcommand>" -> feature command module.
const commands = {
    "pr comments": prComments,
    "jira fetch": jiraFetch,
    "jira create": jiraCreate,
};

export async function run(argv) {
    if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
        printHelp();
        return;
    }

    const [group, sub, ...rest] = argv;
    const command = commands[`${group} ${sub}`];
    if (!command) {
        throw new CliError(`Unknown command: ${[group, sub].filter(Boolean).join(" ")}`);
    }

    await command.run(rest);
}
