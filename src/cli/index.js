import { printHelp, printCommandHelp } from "./help.js";
import { CliError } from "../shared/errors.js";
import * as configTemplate from "../features/config-template/command.js";
import * as secretsSet from "../features/secrets-set/command.js";
import * as secretsDelete from "../features/secrets-delete/command.js";
import * as secretsList from "../features/secrets-list/command.js";
import * as prComments from "../features/pr-comments/command.js";
import * as prDigest from "../features/pr-digest/command.js";
import * as jiraFetch from "../features/jira-fetch/command.js";
import * as jiraComments from "../features/jira-comments/command.js";
import * as jiraProject from "../features/jira-project/command.js";
import * as jiraCreate from "../features/jira-create/command.js";
import * as jiraUpdate from "../features/jira-update/command.js";
import * as jiraFilter from "../features/jira-filter/command.js";
import * as jiraTemplate from "../features/jira-template/command.js";
import * as confluenceDownload from "../features/confluence-download/command.js";
import * as confluenceCreate from "../features/confluence-create/command.js";
import * as confluenceUpload from "../features/confluence-upload/command.js";
import * as confluenceTemplate from "../features/confluence-template/command.js";
import * as uiEstimate from "../features/ui-estimate/command.js";

// Two-level command map: "<group> <subcommand>" -> feature command module.
const commands = {
    "config template": configTemplate,
    "secrets set": secretsSet,
    "secrets delete": secretsDelete,
    "secrets list": secretsList,
    "pr comments": prComments,
    "pr digest": prDigest,
    "jira fetch": jiraFetch,
    "jira comments": jiraComments,
    "jira project": jiraProject,
    "jira create": jiraCreate,
    "jira update": jiraUpdate,
    "jira filter": jiraFilter,
    "jira template": jiraTemplate,
    "confluence download": confluenceDownload,
    "confluence create": confluenceCreate,
    "confluence upload": confluenceUpload,
    "confluence template": confluenceTemplate,
    "ui estimate": uiEstimate,
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
