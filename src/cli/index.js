import { printHelp, printCommandHelp } from "./help.js";
import { CliError } from "../shared/errors.js";
import * as prComments from "../features/pr-comments/command.js";
import * as prDigest from "../features/pr-digest/command.js";
import * as jiraFetch from "../features/jira-fetch/command.js";
import * as jiraComments from "../features/jira-comments/command.js";
import * as jiraProject from "../features/jira-project/command.js";
import * as jiraCreate from "../features/jira-create/command.js";
import * as jiraUpdate from "../features/jira-update/command.js";
import * as jiraFilter from "../features/jira-filter/command.js";

// Two-level command map: "<group> <subcommand>" -> feature command module.
const commands = {
    "pr comments": prComments,
    "pr digest": prDigest,
    "jira fetch": jiraFetch,
    "jira comments": jiraComments,
    "jira project": jiraProject,
    "jira create": jiraCreate,
    "jira update": jiraUpdate,
    "jira filter": jiraFilter,
};

export async function run(argv) {
    if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
        printHelp();
        return;
    }

    const [group, sub, ...rest] = argv;
    const key = `${group} ${sub}`;
    const command = commands[key];
    if (!command) {
        throw new CliError(`Unknown command: ${[group, sub].filter(Boolean).join(" ")}`);
    }

    if (rest.includes("-h") || rest.includes("--help")) {
        printCommandHelp(key);
        return;
    }

    await command.run(rest);
}
